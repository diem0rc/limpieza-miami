import type Stripe from "stripe";
import { sendPaymentReceivedEmail } from "@/lib/email";
import {
  createInviteForBooking,
  inviteHasReview,
  markInviteEmailed,
  reviewUrl,
} from "@/lib/reviews";
import { getStripe } from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabase";

// `constructEvent` verifica la firma con crypto de Node: este handler no puede
// correr en el runtime edge.
export const runtime = "nodejs";

/**
 * Confirmación autoritativa de que un link de pago se cobró.
 *
 * El cliente puede cerrar la pestaña justo después de pagar y antes de que
 * Stripe termine de redirigirlo a ningún lado (ni hace falta que haya un
 * "ningún lado" a donde volver: el link se abre días después de reservar,
 * desde un correo, no dentro de una sesión de nuestro sitio). El webhook
 * llega igual, así que es aquí donde se marca la reserva como pagada.
 */
export async function POST(request: Request) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripe || !secret) {
    console.error("[webhook] faltan STRIPE_SECRET_KEY o STRIPE_WEBHOOK_SECRET");
    return new Response("Webhook sin configurar", { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return new Response("Falta la cabecera stripe-signature", { status: 400 });
  }

  // El cuerpo debe leerse en crudo: cualquier reserialización rompe la firma.
  const body = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, secret);
  } catch (error) {
    console.error("[webhook] firma inválida:", error);
    return new Response("Firma inválida", { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      // `payment_status` distingue un pago real de una sesión completada con
      // un método que aún está procesándose.
      if (session.payment_status === "paid") {
        await onBookingPaid(session);
      }
      break;
    }

    case "checkout.session.async_payment_succeeded":
      await onBookingPaid(event.data.object);
      break;

    default:
      break;
  }

  return Response.json({ received: true });
}

/**
 * Los links de pago de `/api/admin/payment-link` crean, por debajo, una
 * sesión de Checkout con `booking_id` en los metadatos. El `.eq("status",
 * "link_enviado")` del update es el guardián contra un webhook duplicado: si
 * ya estaba en `pagado`, el update no afecta filas y no se reenvían los
 * correos de pago.
 */
async function onBookingPaid(session: Stripe.Checkout.Session) {
  const m = session.metadata ?? {};
  if (m.kind !== "booking_payment" || !m.booking_id) return;

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    console.error("[webhook] Supabase no configurado, no se puede marcar el pago");
    return;
  }

  const { data, error } = await supabase
    .from("bookings")
    .update({ status: "pagado", paid_at: new Date().toISOString() })
    .eq("id", m.booking_id)
    .eq("status", "link_enviado")
    .select(
      "id, service_type, when_label, contact_name, contact_email, contact_address, locale",
    )
    .maybeSingle();

  if (error) {
    console.error("[webhook] no se pudo marcar la reserva como pagada:", error);
    return;
  }
  if (!data) return; // ya estaba pagada (o no existe): no reenviar correos

  const importe = (session.amount_total ?? 0) / 100;

  console.info("[webhook] reserva pagada", { bookingId: data.id, importe });

  // Respaldo del link de reseña, dentro del recibo que ya se manda.
  //
  // El camino principal es la redirección de Stripe al terminar de pagar
  // (ver /api/admin/payment-link). Esto cubre al cliente que cerró la pestaña
  // antes de que lo redirigieran, y a quien pagó por un método que termina de
  // procesarse más tarde.
  //
  // Solo se incluye si esa invitación todavía no tiene reseña: si el cliente
  // ya reseñó desde la redirección, el recibo no le vuelve a pedir nada.
  // La carrera inversa (el webhook llega mientras escribe la reseña) es
  // inofensiva: el link le llega igual y al abrirlo verá "ya recibimos tu
  // reseña".
  let reviewLink: string | null = null;
  const invite = await createInviteForBooking(data.id);
  if (invite.ok && !(await inviteHasReview(invite.invite.id))) {
    reviewLink = reviewUrl(invite.invite);
  }

  // Nunca lanza: ver src/lib/email.ts. Un fallo de correo no debe impedir
  // que el webhook responda 200 — Stripe reintentaría el evento sin motivo.
  await sendPaymentReceivedEmail({
    cliente: data.contact_name,
    email: data.contact_email,
    servicio: data.service_type,
    cuando: data.when_label,
    direccion: data.contact_address,
    importe,
    locale: data.locale === "en" ? "en" : "es",
    reviewUrl: reviewLink,
  });

  // El recibo lleva el link, así que cuenta como enviado: el panel mostrará
  // "Enviada el {fecha}" y no parecerá que nunca se le pidió.
  if (reviewLink && invite.ok) await markInviteEmailed(invite.invite.id);
}
