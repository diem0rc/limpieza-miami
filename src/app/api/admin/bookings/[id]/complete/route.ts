import { isAuthorizedAdmin } from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

/**
 * Marca una reserva como "el servicio ya se hizo". Es el paso previo
 * obligatorio a generar el link de pago (`/api/admin/payment-link` exige
 * `status === 'completado'`) — el guardián real es el `.eq("status",
 * "reservado")` de abajo: si la reserva ya no está en ese estado (porque ya
 * se completó, o se pagó, etc.), el update no afecta ninguna fila y se
 * responde 409 en vez de "completarla" dos veces.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAuthorizedAdmin(request))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return Response.json({ error: "notConfigured" }, { status: 503 });
  }

  const { id } = await params;

  const { data, error } = await supabase
    .from("bookings")
    .update({ status: "completado" })
    .eq("id", id)
    .eq("status", "reservado")
    .select("id");

  if (error) {
    console.error("[admin/complete] no se pudo actualizar:", error);
    return Response.json({ error: "dbError" }, { status: 502 });
  }

  if (data.length === 0) {
    return Response.json({ error: "notPending" }, { status: 409 });
  }

  return Response.json({ ok: true });
}
