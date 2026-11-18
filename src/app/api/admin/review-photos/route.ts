import { revalidateTag } from "next/cache";
import { isAuthorizedAdmin } from "@/lib/admin-auth";
import {
  ALLOWED_PHOTO_TYPES,
  MAX_PHOTO_BYTES,
  addPhoto,
} from "@/lib/review-photos";
import { REVIEWS_CACHE_TAG } from "@/lib/reviews";

export const runtime = "nodejs";

/**
 * Sube UNA foto del trabajo terminado y la une a una invitación.
 *
 * Una por petición, no varias: así una foto que falla no arrastra a las que
 * ya se subieron bien, y el panel puede ir marcando el progreso de verdad
 * cuando se eligen tres o cuatro desde el teléfono.
 *
 * La imagen llega YA REDIMENSIONADA por el navegador (ver
 * src/lib/image-resize.ts). Eso no es un adorno: las funciones de Vercel
 * rechazan cuerpos de más de 4,5 MB y una foto de un teléfono moderno pasa de
 * eso sin despeinarse. Redimensionar en el navegador también evita gastar CPU
 * del servidor y bajar megas a quien después mire la home.
 *
 * Las comprobaciones de tipo y tamaño se repiten acá aunque el navegador ya
 * las haya hecho: lo de allá es comodidad, lo de acá es la frontera real —
 * el mismo criterio que `booking-payload.ts` con los precios.
 */
export async function POST(request: Request) {
  if (!(await isAuthorizedAdmin(request))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "invalidRequest" }, { status: 400 });
  }

  const inviteId = form.get("inviteId");
  const file = form.get("file");
  const width = Number(form.get("width"));
  const height = Number(form.get("height"));

  if (
    typeof inviteId !== "string" ||
    !inviteId ||
    !(file instanceof File) ||
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width <= 0 ||
    height <= 0
  ) {
    return Response.json({ error: "invalidRequest" }, { status: 400 });
  }

  if (!ALLOWED_PHOTO_TYPES.includes(file.type)) {
    return Response.json({ error: "badType" }, { status: 415 });
  }
  if (file.size > MAX_PHOTO_BYTES) {
    return Response.json({ error: "tooLarge" }, { status: 413 });
  }

  const result = await addPhoto({
    inviteId,
    bytes: await file.arrayBuffer(),
    contentType: file.type,
    width,
    height,
  });

  if (!result.ok) {
    const status = result.reason === "tooMany" ? 409 : 502;
    return Response.json({ error: result.reason }, { status });
  }

  // Si la reseña de esta invitación ya está publicada, la home la muestra y
  // acaba de cambiar. Se invalida siempre en vez de averiguar primero si está
  // publicada: la consulta extra costaría más que una regeneración de más, y
  // equivocarse por exceso solo significa recalcular una página.
  revalidateTag(REVIEWS_CACHE_TAG, "max");

  return Response.json({ photo: result.photo });
}
