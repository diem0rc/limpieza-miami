import { parseBookingPayload } from "@/lib/booking-payload";
import { sendBookingConfirmedEmail, sendNewBookingEmail } from "@/lib/email";
import { formatDateLong, formatHour, parseDateKey } from "@/lib/format";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

/**
 * Registra una reserva. No cobra nada: el negocio no pide tarjeta al
 * reservar, así que no hay razón para que el cliente la dé. El pago llega
 * después, por un link que el equipo genera desde /admin/reservas cuando
 * marca el servicio como completado (ver esa ruta y /api/admin/payment-link).
 *
 * La fila vive en Supabase (`bookings`), no en Stripe: Stripe ya no se toca
 * en absoluto en este paso, solo más adelante para el link de pago.
 */
export async function POST(request: Request) {
  const raw = await request.json().catch(() => null);
  const parsed = parseBookingPayload(raw);
  if (!parsed.ok) {
    return Response.json({ error: parsed.error }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    // Falta configurar Supabase: es un fallo de configuración, no del cliente.
    return Response.json({ error: "notConfigured" }, { status: 503 });
  }

  const booking = parsed.value;
  const { selection, price, contact, locale } = booking;

  if (price.total <= 0) {
    return Response.json({ error: "invalidSelection" }, { status: 400 });
  }

  const hour = Number(booking.time.slice(0, 2));
  const when = `${formatDateLong(parseDateKey(booking.date), locale)} · ${formatHour(hour, locale)}`;

  const { error } = await supabase.from("bookings").insert({
    status: "reservado",
    service_type: selection.serviceType,
    size_tier: selection.sizeTier ?? null,
    sqft_tier: selection.sqftTier ?? null,
    cleaning_level: selection.cleaningLevel ?? null,
    pets: selection.pets ?? null,
    frequency: selection.frequency ?? null,
    addons: price.addonDetail.map((a) => a.id),
    bedrooms: booking.bedrooms,
    full_baths: booking.fullBaths,
    half_baths: booking.halfBaths,
    date: booking.date,
    time: booking.time,
    when_label: when,
    contact_name: contact.name,
    contact_phone: contact.phone,
    contact_email: contact.email,
    contact_address: contact.address,
    contact_notes: contact.notes,
    locale,
    total_price: price.total,
    total_cents: Math.round(price.total * 100),
  });

  if (error) {
    console.error("[bookings] no se pudo registrar la reserva:", error);
    return Response.json({ error: "dbError" }, { status: 502 });
  }

  // Nunca lanzan: un fallo de correo no debe convertir una reserva válida en
  // un error para el cliente. Ver src/lib/email.ts.
  await Promise.all([
    sendNewBookingEmail(booking, when),
    sendBookingConfirmedEmail(booking, when),
  ]);

  return Response.json({ ok: true });
}
