import "server-only";
import { randomBytes } from "node:crypto";
import { MAX_PHOTOS_PER_INVITE, type ReviewPhoto } from "@/lib/review-types";
import { getSupabaseAdmin } from "@/lib/supabase";

/**
 * Las fotos del trabajo terminado, que el equipo sube desde el panel.
 *
 * Son fotos DEL NEGOCIO, no del cliente. Esa distinción no es cosmética: la
 * regla de la FTC sobre reseñas (16 CFR Part 465) trata como engañoso
 * presentar material de la empresa como si viniera de quien escribió la
 * reseña. Por eso la home las muestra bajo una etiqueta que dice de quién
 * son, separadas del texto del cliente, y por eso no existe ningún camino
 * para que una foto subida acá aparezca sin esa atribución.
 *
 * Cuelgan de la invitación y no de la reseña a propósito — el porqué está en
 * supabase/sql/2026-11-fotos-de-resenas.sql: el equipo tiene las fotos el día
 * del trabajo, días antes de que llegue la reseña.
 */

export const PHOTOS_BUCKET = "review-photos";

/** Lo que el servidor acepta, después de que el navegador ya redimensionó. */
export const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
export const ALLOWED_PHOTO_TYPES = ["image/webp", "image/jpeg", "image/png"];

const EXTENSION: Record<string, string> = {
  "image/webp": "webp",
  "image/jpeg": "jpg",
  "image/png": "png",
};

type Fila = {
  id: string;
  storage_path: string;
  width: number;
  height: number;
};

function toPhoto(
  fila: Fila,
  urlDe: (path: string) => string,
): ReviewPhoto {
  return {
    id: fila.id,
    url: urlDe(fila.storage_path),
    width: fila.width,
    height: fila.height,
  };
}

/**
 * Las fotos de varias invitaciones de una vez, agrupadas por invitación.
 *
 * Una sola consulta para toda la pantalla. El panel muestra decenas de
 * reservas y la home hasta seis reseñas: preguntar por cada una sería el
 * clásico N+1, el mismo que `listReviewStateByBooking` ya evita.
 */
export async function listPhotosByInvite(
  inviteIds: string[],
): Promise<Map<string, ReviewPhoto[]>> {
  const map = new Map<string, ReviewPhoto[]>();
  if (inviteIds.length === 0) return map;

  const supabase = getSupabaseAdmin();
  if (!supabase) return map;

  const { data, error } = await supabase
    .from("review_photos")
    .select("id, invite_id, storage_path, width, height")
    .in("invite_id", inviteIds)
    .order("position", { ascending: true });

  if (error) {
    // Las fotos nunca son críticas: si esta consulta falla, las reseñas y el
    // panel siguen funcionando sin ellas. Mismo criterio que con las
    // invitaciones manuales en el panel.
    console.error("[review-photos] no se pudieron listar:", error);
    return map;
  }

  const urlDe = (path: string) =>
    supabase.storage.from(PHOTOS_BUCKET).getPublicUrl(path).data.publicUrl;

  for (const fila of data ?? []) {
    const lista = map.get(fila.invite_id) ?? [];
    lista.push(toPhoto(fila as Fila, urlDe));
    map.set(fila.invite_id, lista);
  }

  return map;
}

export type AddPhotoResult =
  | { ok: true; photo: ReviewPhoto }
  | { ok: false; reason: "tooMany" | "storageError" | "dbError" };

/**
 * Sube una foto y la registra.
 *
 * El tope de fotos se comprueba acá, en el servidor, y no solo escondiendo el
 * botón: dos pestañas abiertas o un reintento podrían saltarse una
 * comprobación que viva solo en la interfaz.
 *
 * Si el archivo se sube pero la fila no se puede insertar, se borra el
 * archivo antes de responder. Sin eso el bucket acumularía archivos que nada
 * referencia y que nadie podría encontrar para borrar — basura invisible que
 * solo crece.
 */
export async function addPhoto(params: {
  inviteId: string;
  bytes: ArrayBuffer;
  contentType: string;
  width: number;
  height: number;
}): Promise<AddPhotoResult> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { ok: false, reason: "dbError" };

  const { count, error: countError } = await supabase
    .from("review_photos")
    .select("id", { count: "exact", head: true })
    .eq("invite_id", params.inviteId);

  if (countError) {
    console.error("[review-photos] no se pudo contar:", countError);
    return { ok: false, reason: "dbError" };
  }
  const yaHay = count ?? 0;
  if (yaHay >= MAX_PHOTOS_PER_INVITE) return { ok: false, reason: "tooMany" };

  // El nombre lo pone el servidor, nunca el navegador: un nombre de archivo
  // que llega de fuera puede traer rutas ("../"), caracteres que el bucket
  // interpreta, o el nombre real del archivo del teléfono del cliente.
  const ext = EXTENSION[params.contentType] ?? "bin";
  const storagePath = `${params.inviteId}/${randomBytes(12).toString("hex")}.${ext}`;

  const subida = await supabase.storage
    .from(PHOTOS_BUCKET)
    .upload(storagePath, params.bytes, {
      contentType: params.contentType,
      // Nunca sobrescribir: la ruta lleva 12 bytes aleatorios, así que una
      // colisión significaría algo muy raro y es mejor que falle ruidosamente.
      upsert: false,
      // Un año. Es seguro porque el archivo NUNCA cambia: cada subida tiene
      // su propia ruta aleatoria y nada se sobrescribe, así que reemplazar
      // una foto es en realidad subir otra distinta y borrar la vieja.
      //
      // La contrapartida, medida: al borrar una foto, su URL sigue
      // respondiendo 200 un rato porque el CDN de Supabase la tiene cacheada,
      // aunque el archivo ya no esté en el bucket. No afecta al sitio —la
      // fila se borró, así que ninguna página la enlaza— pero significa que
      // "borrada" y "ya no se puede abrir con el link directo" no ocurren en
      // el mismo instante. Para fotos de marketing que el propio negocio
      // publicó, es un intercambio razonable a cambio de que quien vuelva a
      // la home no se las baje otra vez.
      cacheControl: "31536000",
    });

  if (subida.error) {
    console.error("[review-photos] no se pudo subir:", subida.error);
    return { ok: false, reason: "storageError" };
  }

  const { data, error } = await supabase
    .from("review_photos")
    .insert({
      invite_id: params.inviteId,
      storage_path: storagePath,
      width: params.width,
      height: params.height,
      position: yaHay,
    })
    .select("id, storage_path, width, height")
    .single();

  if (error || !data) {
    console.error("[review-photos] subida sin fila, deshaciendo:", error);
    await supabase.storage.from(PHOTOS_BUCKET).remove([storagePath]);
    return { ok: false, reason: "dbError" };
  }

  const urlDe = (path: string) =>
    supabase.storage.from(PHOTOS_BUCKET).getPublicUrl(path).data.publicUrl;

  return { ok: true, photo: toPhoto(data as Fila, urlDe) };
}

/**
 * Borra una foto: primero la fila, después el archivo.
 *
 * Ese orden importa. Si se borrara el archivo primero y la fila fallara,
 * quedaría una fila apuntando a un archivo que ya no existe y la home
 * mostraría una imagen rota. Al revés, el peor caso es un archivo huérfano en
 * el bucket, que no se ve en ningún lado.
 *
 * Devuelve el `invite_id` de la foto borrada para que quien llama sepa qué
 * trabajo quedó afectado — y `null` si no había nada que borrar, que es lo
 * que hace que un doble clic no sea un error.
 */
export async function deletePhoto(id: string): Promise<string | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("review_photos")
    .delete()
    .eq("id", id)
    .select("invite_id, storage_path")
    .maybeSingle();

  if (error) {
    console.error("[review-photos] no se pudo borrar la fila:", error);
    return null;
  }
  if (!data) return null;

  const { error: storageError } = await supabase.storage
    .from(PHOTOS_BUCKET)
    .remove([data.storage_path]);

  if (storageError) {
    console.error(
      "[review-photos] fila borrada pero el archivo quedó en el bucket:",
      storageError,
    );
  }

  return data.invite_id;
}
