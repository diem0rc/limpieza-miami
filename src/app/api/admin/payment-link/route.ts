import { isAuthorizedAdmin } from "@/lib/admin-auth";
import { sendPaymentLinkEmail } from "@/lib/email";
import { createInviteForBooking, reviewUrl } from "@/lib/reviews";
import { getStripe } from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

/**
 * Genera (o reutiliza) el link de pago de una reserva, y se lo manda al
 * cliente por correo. Se dispara desde `/admin/reservas` una vez el servicio
 * ya se marcó como completado — no antes: `status !== 'completado'` es 409.
 */
export async function POST(request: Request) {
  if (!(await isAuthorizedAdmin(request))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const stripe = getStripe();
  const supabase = getSupabaseAdmin();
  if (!stripe || !supabase) {
    return Response.json({ error: "notConfigured" }, { status: 503 });
  }

  const body = await request.json().catch(() => null);
  const bookingId =
    body && typeof body.bookingId === "string" ? body.bookingId : null;
  if (!bookingId) {
    return Response.json({ error: "invalidRequest" }, { status: 400 });
  }

  const { data: booking, error: fetchError } = await supabase
    .from("bookings")
    .select(
      "id, status, service_type, when_label, contact_name, contact_email, locale, total_cents, stripe_payment_link_url",
    )
    .eq("id", bookingId)
    .maybeSingle();

  if (fetchError) {
    console.error("[admin/payment-link] no se pudo leer la reserva:", fetchError);
    return Response.json({ error: "dbError" }, { status: 502 });
  }
  if (!booking) {
    return Response.json({ error: "notFound" }, { status: 404 });
  }

  // Ya se generó antes: se devuelve el mismo, no uno nuevo por cada clic.
  if (booking.stripe_payment_link_url) {
    return Response.json({ url: booking.stripe_payment_link_url });
  }

  if (booking.status !== "completado") {
    return Response.json({ error: "notChargeable" }, { status: 409 });
  }

  if (!Number.isInteger(booking.total_cents) || booking.total_cents <= 0) {
    return Response.json({ error: "invalidAmount" }, { status: 422 });
  }

  const linkMetadata: Record<string, string> = {
    kind: "booking_payment",
    booking_id: booking.id,
  };

  // La invitación de reseña se crea ANTES del link porque su token tiene que
  // ir dentro de la URL de redirección, y esa URL se fija al crear el link.
  //
  // Pero el cobro NUNCA depende de la reseña: si esto falla, se registra y se
  // sigue sin redirección, y Stripe usa su pantalla de confirmación por
  // defecto. Un problema con las reseñas no puede dejar al negocio sin poder
  // cobrar un trabajo ya hecho.
  //
  // Nota de privacidad: Stripe guarda esta URL (token incluido) en el objeto
  // del Payment Link. Es aceptable porque el token solo sirve para dejar una
  // reseña una vez.
  let reviewRedirect: string | null = null;
  const invite = await createInviteForBooking(booking.id);
  if (invite.ok) {
    // `?desde=pago` le dice a la página que viene de pagar, para saludar sin
    // afirmar que el pago ya se confirmó — eso lo decide el webhook.
    reviewRedirect = `${reviewUrl(invite.invite)}?desde=pago`;
  } else {
    console.error(
      "[admin/payment-link] sin invitación de reseña, el link va sin redirección:",
      invite.reason,
    );
  }

  try {
    const link = await stripe.paymentLinks.create({
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: booking.total_cents,
            product_data: {
              name: `${booking.service_type} · ${booking.when_label}`.trim(),
            },
          },
        },
      ],
      metadata: linkMetadata,
      payment_intent_data: { metadata: linkMetadata },
      // Forma verificada en los tipos de stripe 22.6.1
      // (node_modules/stripe/cjs/resources/PaymentLinks.d.ts):
      // after_completion.type es 'redirect' | 'hosted_confirmation' y la URL
      // va en after_completion.redirect.url.
      ...(reviewRedirect
        ? {
            after_completion: {
              type: "redirect" as const,
              redirect: { url: reviewRedirect },
            },
          }
        : {}),
    });

    const { error: updateError } = await supabase
      .from("bookings")
      .update({
        stripe_payment_link_id: link.id,
        stripe_payment_link_url: link.url,
        status: "link_enviado",
      })
      .eq("id", booking.id)
      .eq("status", "completado");

    if (updateError) {
      console.error("[admin/payment-link] link creado pero no se guardó:", updateError);
    }

    // Nunca lanza: ver src/lib/email.ts.
    await sendPaymentLinkEmail({
      cliente: booking.contact_name,
      email: booking.contact_email,
      servicio: booking.service_type,
      cuando: booking.when_label,
      total: booking.total_cents / 100,
      url: link.url,
      locale: booking.locale === "en" ? "en" : "es",
    });

    return Response.json({ url: link.url });
  } catch (error) {
    console.error("[admin/payment-link] no se pudo generar el link:", error);
    return Response.json({ error: "stripeError" }, { status: 502 });
  }
}
