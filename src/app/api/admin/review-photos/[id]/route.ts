import { revalidateTag } from "next/cache";
import { isAuthorizedAdmin } from "@/lib/admin-auth";
import { deletePhoto } from "@/lib/review-photos";
import { REVIEWS_CACHE_TAG } from "@/lib/reviews";

export const runtime = "nodejs";

/**
 * Quita una foto del trabajo.
 *
 * Borra la fila y después el archivo del bucket — ese orden está explicado en
 * `deletePhoto`. Si la foto ya no existía, responde 404 y no pasa nada más:
 * un doble toque desde el teléfono no es un error.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAuthorizedAdmin(request))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const inviteId = await deletePhoto(id);

  if (!inviteId) {
    return Response.json({ error: "notFound" }, { status: 404 });
  }

  revalidateTag(REVIEWS_CACHE_TAG, "max");
  return Response.json({ ok: true });
}
