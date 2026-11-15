import { isAuthorizedAdmin } from "@/lib/admin-auth";
import { listReviewStateByBooking } from "@/lib/reviews";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

/**
 * Lista las reservas activas (todo menos `cancelado`) para que el panel
 * muestre el pipeline completo: reservado → completado → link_enviado →
 * pagado. Es la fuente de datos de `/admin/reservas`.
 */
export async function GET(request: Request) {
  if (!(await isAuthorizedAdmin(request))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return Response.json({ error: "notConfigured" }, { status: 503 });
  }

  const { data, error } = await supabase
    .from("bookings")
    .select(
      "id, status, service_type, addons, contact_name, contact_phone, contact_email, contact_address, when_label, date, time, total_price, stripe_payment_link_url",
    )
    .neq("status", "cancelado")
    .order("date", { ascending: true })
    .order("time", { ascending: true });

  if (error) {
    console.error("[admin/bookings] no se pudo listar:", error);
    return Response.json({ error: "dbError" }, { status: 502 });
  }

  // UNA consulta extra para todas las reservas, no una por reserva. Con
  // decenas de filas en pantalla, preguntar por cada una sería el clásico
  // N+1: la lista tardaría proporcionalmente a cuántas reservas haya.
  const reviewState = await listReviewStateByBooking();

  const bookings = data.map((b) => ({
    id: b.id,
    status: b.status,
    cliente: b.contact_name,
    telefono: b.contact_phone,
    email: b.contact_email,
    direccion: b.contact_address,
    servicio: b.service_type,
    addons: b.addons,
    cuando: b.when_label,
    total: b.total_price,
    paymentLinkUrl: b.stripe_payment_link_url,
    resena: reviewState.get(b.id) ?? null,
  }));

  return Response.json({ bookings });
}
