import { isAuthorizedAdmin } from "@/lib/admin-auth";
import { listReviewsForAdmin } from "@/lib/reviews";

export const runtime = "nodejs";

/**
 * Las reseñas que el dueño puede moderar: pendientes y publicadas.
 *
 * Una sola consulta para las dos listas (ver `listReviewsForAdmin`), igual
 * que el estado de reseña de las reservas: el panel se abre desde el
 * teléfono y cada ida y vuelta se nota.
 */
export async function GET(request: Request) {
  if (!(await isAuthorizedAdmin(request))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const { pendientes, publicadas } = await listReviewsForAdmin();
  return Response.json({ pendientes, publicadas });
}
