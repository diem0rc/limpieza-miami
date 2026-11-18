import "server-only";
import { randomBytes } from "node:crypto";
import { unstable_cache } from "next/cache";
import type {
  AdminReview,
  BookingReviewState,
  ManualInviteSummary,
  ModerationAction,
  ModerationReason,
  ReviewLocale,
  ReviewPhoto,
  ReviewStatus,
} from "@/lib/review-types";
import { listPhotosByInvite } from "@/lib/review-photos";
import { SITE_URL } from "@/lib/seo";
import { getSupabaseAdmin } from "@/lib/supabase";

/**
 * Invitaciones de reseña: el permiso para dejar UNA reseña.
 *
 * Por qué existe esta capa en vez de columnas en `bookings`: el negocio tiene
 * clientes que nunca pasaron por la web (llamaron por teléfono o escribieron
 * por WhatsApp) y que no tienen fila en `bookings`. Si el link de reseña
 * colgara de una reserva, esos clientes no podrían reseñar. Colgándolo de una
 * invitación, `booking_id` puede ser nulo y el mismo sistema sirve para los
 * dos casos sin ramas duplicadas.
 *
 * Nadie puede reseñar sin token. No hay formulario público abierto, y eso es
 * una decisión de cumplimiento (regla 4 de reseñas, ver el SQL en
 * supabase/sql/2026-11-fase7-resenas.sql), no una preferencia de diseño.
 */

export interface ReviewInvite {
  id: string;
  token: string;
  booking_id: string | null;
  source: "web" | "manual";
  customer_name: string;
  contact_email: string | null;
  service_type: string;
  service_date: string | null;
  locale: ReviewLocale;
  emailed_at: string | null;
}

const INVITE_COLUMNS =
  "id, token, booking_id, source, customer_name, contact_email, service_type, service_date, locale, emailed_at";

/** Estados de una reserva en los que ya tiene sentido pedir una reseña. */
const INVITABLE_STATUSES = ["completado", "link_enviado", "pagado"];

/** Violación de restricción única en Postgres. */
const UNIQUE_VIOLATION = "23505";

/**
 * Resultado explícito en vez de `ReviewInvite | null`, para que cada quien
 * decida qué hacer con el fallo: `/api/admin/review-invites` traduce el
 * motivo a un código HTTP, y `/api/admin/payment-link` lo ignora y sigue —
 * un problema con la reseña nunca puede impedir que se cobre.
 */
export type InviteResult =
  | { ok: true; invite: ReviewInvite }
  | { ok: false; reason: "notFound" | "notEligible" | "dbError" };

function normalizeLocale(value: unknown): ReviewLocale {
  return value === "en" ? "en" : "es";
}

/**
 * 24 bytes aleatorios en base64url: 32 caracteres, seguros en una URL y sin
 * necesidad de escaparlos.
 *
 * Por qué un token y no el id de la reserva: si la URL fuera
 * `/resena/{id}`, cualquiera que viera un link podría probar otros ids. El
 * token no es adivinable y no revela nada del cliente ni del negocio.
 */
function newToken(): string {
  return randomBytes(24).toString("base64url");
}

/**
 * La URL que se le manda al cliente. El origen sale de `SITE_URL`
 * (src/lib/seo.ts), el mismo que usan el sitemap y los canonical — no se
 * escribe el dominio a mano en ningún lado.
 */
export function reviewUrl(invite: Pick<ReviewInvite, "token" | "locale">): string {
  return `${SITE_URL}/${invite.locale}/resena/${invite.token}`;
}

/** Primer nombre, para encabezar el formulario: "Hola María, ...". */
export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}

/**
 * Nombre sugerido para publicar: "María G." — primer nombre más la inicial
 * del apellido. El cliente lo puede editar; es solo el valor de arranque,
 * para que publicar no exija escribir nada.
 */
export function suggestDisplayName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0].slice(0, 40);
  const initial = parts[parts.length - 1][0];
  return `${parts[0]} ${initial.toUpperCase()}.`.slice(0, 40);
}

/**
 * Devuelve la invitación de una reserva web, creándola si no existe.
 *
 * Es idempotente a propósito: la llaman tres caminos distintos (el panel al
 * generar el link de pago, el webhook al cobrarse, y el botón manual del
 * panel) y cualquiera puede llegar primero. El `unique(booking_id)` de la
 * tabla es lo que lo garantiza de verdad: si dos llamadas corren a la vez,
 * una inserta y la otra recibe 23505, vuelve a leer y devuelve la que ya
 * quedó. El bloqueo vive en la base de datos, no en este código, así que no
 * depende de que estas líneas corran en un solo proceso.
 */
export async function createInviteForBooking(bookingId: string): Promise<InviteResult> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { ok: false, reason: "dbError" };

  const existing = await supabase
    .from("review_invites")
    .select(INVITE_COLUMNS)
    .eq("booking_id", bookingId)
    .maybeSingle();

  if (existing.error) {
    console.error("[reviews] no se pudo leer la invitación:", existing.error);
    return { ok: false, reason: "dbError" };
  }
  if (existing.data) {
    return { ok: true, invite: existing.data as ReviewInvite };
  }

  const booking = await supabase
    .from("bookings")
    .select("id, status, contact_name, contact_email, service_type, date, locale")
    .eq("id", bookingId)
    .maybeSingle();

  if (booking.error) {
    console.error("[reviews] no se pudo leer la reserva:", booking.error);
    return { ok: false, reason: "dbError" };
  }
  if (!booking.data) return { ok: false, reason: "notFound" };

  // No se pide reseña de un servicio que todavía no se hizo. `reservado`
  // significa justamente eso: agendado y sin ejecutar.
  if (!INVITABLE_STATUSES.includes(booking.data.status)) {
    return { ok: false, reason: "notEligible" };
  }

  const inserted = await supabase
    .from("review_invites")
    .insert({
      token: newToken(),
      booking_id: booking.data.id,
      source: "web",
      customer_name: booking.data.contact_name,
      contact_email: booking.data.contact_email,
      service_type: booking.data.service_type,
      service_date: booking.data.date,
      locale: normalizeLocale(booking.data.locale),
    })
    .select(INVITE_COLUMNS)
    .maybeSingle();

  if (inserted.error) {
    // Otra llamada ganó la carrera: la invitación existe, solo hay que leerla.
    if (inserted.error.code === UNIQUE_VIOLATION) {
      const again = await supabase
        .from("review_invites")
        .select(INVITE_COLUMNS)
        .eq("booking_id", bookingId)
        .maybeSingle();
      if (again.data) return { ok: true, invite: again.data as ReviewInvite };
    }
    console.error("[reviews] no se pudo crear la invitación:", inserted.error);
    return { ok: false, reason: "dbError" };
  }

  return { ok: true, invite: inserted.data as ReviewInvite };
}

/**
 * Invitación para un cliente que no reservó por la web. La crea el dueño a
 * mano desde el panel, y por eso no hay nada que validar contra `bookings`:
 * no existe ahí.
 *
 * Regla 4 de reseñas: esto es únicamente para clientes a los que de verdad
 * se les hizo un servicio. El sistema no puede verificarlo — la invitación
 * manual existe porque no hay registro que consultar — así que la honestidad
 * de este botón depende de quien lo usa.
 */
export async function createManualInvite(params: {
  name: string;
  email?: string | null;
  serviceType: string;
  serviceDate?: string | null;
  locale: ReviewLocale;
}): Promise<InviteResult> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { ok: false, reason: "dbError" };

  const inserted = await supabase
    .from("review_invites")
    .insert({
      token: newToken(),
      booking_id: null,
      source: "manual",
      customer_name: params.name,
      contact_email: params.email || null,
      service_type: params.serviceType,
      service_date: params.serviceDate || null,
      locale: params.locale,
    })
    .select(INVITE_COLUMNS)
    .maybeSingle();

  if (inserted.error) {
    console.error("[reviews] no se pudo crear la invitación manual:", inserted.error);
    return { ok: false, reason: "dbError" };
  }

  return { ok: true, invite: inserted.data as ReviewInvite };
}

/** Busca la invitación por su id. La usa el botón "Enviar por correo". */
export async function findInviteById(id: string): Promise<ReviewInvite | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("review_invites")
    .select(INVITE_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("[reviews] no se pudo leer la invitación por id:", error);
    return null;
  }
  return (data as ReviewInvite | null) ?? null;
}

/**
 * Resultado de buscar un token. Son TRES casos, no dos, y la diferencia
 * importa para el cliente:
 *
 * - `notFound`: el token no existe. El link está mal copiado o es inventado.
 * - `error`: la base de datos no respondió. El link puede ser perfectamente
 *   válido.
 *
 * Mezclarlos (devolviendo `null` para ambos) hacía que un hipo de Supabase
 * le dijera a un cliente con un link bueno "este link no es válido" — y a
 * quien lee eso no se le ocurre reintentar. Un mensaje equivocado es peor
 * que un mensaje de error.
 */
export type FindInviteResult =
  | { status: "found"; invite: ReviewInvite }
  | { status: "notFound" }
  | { status: "error" };

/** Busca la invitación por el token de la URL. */
export async function findInviteByToken(token: string): Promise<FindInviteResult> {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    console.error("[reviews] Supabase no está configurado");
    return { status: "error" };
  }

  const { data, error } = await supabase
    .from("review_invites")
    .select(INVITE_COLUMNS)
    .eq("token", token)
    .maybeSingle();

  if (error) {
    console.error("[reviews] no se pudo buscar el token:", error);
    return { status: "error" };
  }

  return data
    ? { status: "found", invite: data as ReviewInvite }
    : { status: "notFound" };
}

/**
 * Si esta invitación ya tiene reseña. Lo usan la página pública (para mostrar
 * "ya recibimos tu reseña" en vez del formulario) y el webhook (para no
 * mandar el link a quien ya reseñó).
 */
export async function inviteHasReview(inviteId: string): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return false;

  const { data, error } = await supabase
    .from("reviews")
    .select("id")
    .eq("invite_id", inviteId)
    .maybeSingle();

  if (error) {
    console.error("[reviews] no se pudo comprobar la reseña:", error);
    return false;
  }
  return !!data;
}

/** Marca que el link se mandó por correo. El panel lo muestra como fecha. */
export async function markInviteEmailed(inviteId: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return;

  const { error } = await supabase
    .from("review_invites")
    .update({ emailed_at: new Date().toISOString() })
    .eq("id", inviteId);

  if (error) console.error("[reviews] no se pudo marcar emailed_at:", error);
}

/**
 * Estado de reseña de todas las reservas web, en UNA sola consulta.
 *
 * El panel muestra decenas de reservas; preguntar por cada una sería N+1.
 * Acá se traen todas las invitaciones con `booking_id` y, embebida, su reseña
 * si la tiene — PostgREST resuelve el join por la llave foránea.
 */
export async function listReviewStateByBooking(): Promise<Map<string, BookingReviewState>> {
  const map = new Map<string, BookingReviewState>();
  const supabase = getSupabaseAdmin();
  if (!supabase) return map;

  const { data, error } = await supabase
    .from("review_invites")
    .select("id, token, locale, booking_id, emailed_at, reviews(status)")
    .not("booking_id", "is", null);

  if (error) {
    console.error("[reviews] no se pudo listar el estado de reseñas:", error);
    return map;
  }

  // Las fotos de todas las invitaciones de un tirón, no una consulta por fila.
  const fotos = await listPhotosByInvite((data ?? []).map((r) => r.id));

  for (const row of data ?? []) {
    if (!row.booking_id) continue;
    map.set(row.booking_id, {
      inviteId: row.id,
      url: reviewUrl({ token: row.token, locale: normalizeLocale(row.locale) }),
      emailedAt: row.emailed_at,
      reviewStatus: embeddedReviewStatus(row.reviews),
      photos: fotos.get(row.id) ?? [],
    });
  }

  return map;
}

/** Las invitaciones de clientes telefónicos, para volver a copiar su link. */
export async function listManualInvites(): Promise<ManualInviteSummary[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("review_invites")
    .select(
      "id, token, locale, customer_name, contact_email, service_type, service_date, emailed_at, reviews(status)",
    )
    .eq("source", "manual")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[reviews] no se pudieron listar las invitaciones manuales:", error);
    return [];
  }

  const fotos = await listPhotosByInvite((data ?? []).map((r) => r.id));

  return (data ?? []).map((row) => ({
    id: row.id,
    url: reviewUrl({ token: row.token, locale: normalizeLocale(row.locale) }),
    customerName: row.customer_name,
    email: row.contact_email,
    serviceType: row.service_type,
    serviceDate: row.service_date,
    locale: normalizeLocale(row.locale),
    emailedAt: row.emailed_at,
    reviewStatus: embeddedReviewStatus(row.reviews),
    photos: fotos.get(row.id) ?? [],
  }));
}

/**
 * PostgREST devuelve una relación embebida como objeto cuando puede
 * demostrar que es uno-a-uno (acá lo es, por el `unique(invite_id)`) y como
 * arreglo cuando no. La forma exacta depende de la versión, así que se
 * aceptan las dos en vez de atarse a una.
 */
function embeddedReviewStatus(raw: unknown): ReviewStatus | null {
  const row = Array.isArray(raw) ? raw[0] : raw;
  if (!row || typeof row !== "object") return null;
  const status = (row as { status?: unknown }).status;
  return typeof status === "string" ? (status as ReviewStatus) : null;
}

// ---------------------------------------------------------------------------
// Moderación (parte 2)
// ---------------------------------------------------------------------------

/**
 * La etiqueta de caché de la sección de reseñas de la home.
 *
 * Vive acá, junto a la única función que la invalida, para que no haya dos
 * cadenas de texto que tengan que coincidir en archivos distintos: la home
 * (parte 3) etiqueta su lectura con esta constante y el panel la invalida con
 * la misma. Si fueran dos literales iguales escritos a mano, un cambio en uno
 * dejaría la home servida desde una caché que ya nadie invalida, y el síntoma
 * sería "publiqué una reseña y no aparece" días después.
 */
export const REVIEWS_CACHE_TAG = "resenas-publicadas";

const REVIEW_COLUMNS =
  "id, rating, body, display_name, service_type, locale, status, created_at, published_at, moderation_reason, review_invites(source, customer_name)";

/**
 * PostgREST devuelve la invitación embebida como objeto o como arreglo según
 * pueda demostrar que la relación es uno-a-uno. Mismo motivo que en
 * `embeddedReviewStatus`: se aceptan las dos formas en vez de atarse a una
 * versión concreta.
 */
function embeddedInvite(raw: unknown): { source: "web" | "manual"; customerName: string } {
  const row = Array.isArray(raw) ? raw[0] : raw;
  const obj = (row ?? {}) as { source?: unknown; customer_name?: unknown };
  return {
    source: obj.source === "manual" ? "manual" : "web",
    customerName: typeof obj.customer_name === "string" ? obj.customer_name : "",
  };
}

function toAdminReview(row: Record<string, unknown>): AdminReview {
  const invite = embeddedInvite(row.review_invites);
  return {
    id: String(row.id),
    rating: Number(row.rating),
    body: typeof row.body === "string" ? row.body : "",
    displayName: String(row.display_name ?? ""),
    serviceType: String(row.service_type ?? ""),
    locale: normalizeLocale(row.locale),
    status: (row.status as ReviewStatus) ?? "pendiente",
    source: invite.source,
    customerName: invite.customerName,
    createdAt: String(row.created_at ?? ""),
    publishedAt: (row.published_at as string | null) ?? null,
    moderationReason: (row.moderation_reason as ModerationReason | null) ?? null,
  };
}

/**
 * Lo que ve el panel de moderación: las pendientes y las publicadas.
 *
 * Las rechazadas no se listan a propósito. Publicar solo vale desde
 * `pendiente`, así que una vez rechazada u oculta una reseña no vuelve, y
 * mostrarla en una lista sin ninguna acción posible solo sería ruido en una
 * pantalla que se usa desde el teléfono. Si algún día hace falta
 * deshacer una ocultación, es una transición nueva con su propio guardián,
 * no un filtro más en esta consulta.
 *
 * Las pendientes van de la MÁS VIEJA a la más nueva, al revés que el resto
 * del panel. Es una cola de trabajo: quien dejó su reseña primero no tiene
 * por qué esperar más solo porque sigan llegando otras.
 */
export async function listReviewsForAdmin(): Promise<{
  pendientes: AdminReview[];
  publicadas: AdminReview[];
}> {
  const vacio = { pendientes: [], publicadas: [] };
  const supabase = getSupabaseAdmin();
  if (!supabase) return vacio;

  const { data, error } = await supabase
    .from("reviews")
    .select(REVIEW_COLUMNS)
    .in("status", ["pendiente", "publicado"]);

  if (error) {
    console.error("[reviews] no se pudieron listar para el panel:", error);
    return vacio;
  }

  const todas = (data ?? []).map((row) => toAdminReview(row as Record<string, unknown>));

  return {
    pendientes: todas
      .filter((r) => r.status === "pendiente")
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    publicadas: todas
      .filter((r) => r.status === "publicado")
      .sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? "")),
  };
}

export type ModerationResult =
  | { ok: true; review: AdminReview }
  | { ok: false; reason: "notFound" | "conflict" | "dbError" };

/**
 * Aplica una decisión de moderación, con el estado de partida como guardián.
 *
 * El `.eq("status", …)` es lo que hace que un doble clic, dos pestañas
 * abiertas o un reintento de red no apliquen la acción dos veces: el segundo
 * `update` no encuentra ninguna fila en el estado esperado y no toca nada.
 * El guardián vive en la consulta, no en el botón deshabilitado de la UI,
 * porque la UI de la otra pestaña no se entera de lo que hizo esta.
 *
 * `published_at` NO se borra al ocultar. La home filtra por `status`, así que
 * dejarlo puesto no la afecta, y conserva el dato de cuándo estuvo visible.
 */
export async function moderateReview(
  id: string,
  action: ModerationAction,
  reason: ModerationReason | null,
): Promise<ModerationResult> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { ok: false, reason: "dbError" };

  // De qué estado tiene que venir y a cuál va. Publicar limpia el motivo:
  // si una reseña se publica, lo que se anotó antes sobre ella ya no aplica.
  const transicion =
    action === "publicar"
      ? {
          desde: "pendiente",
          cambios: {
            status: "publicado",
            published_at: new Date().toISOString(),
            moderation_reason: null,
          },
        }
      : {
          desde: action === "rechazar" ? "pendiente" : "publicado",
          cambios: { status: "rechazado", moderation_reason: reason },
        };

  const { data, error } = await supabase
    .from("reviews")
    .update(transicion.cambios)
    .eq("id", id)
    .eq("status", transicion.desde)
    .select(REVIEW_COLUMNS)
    .maybeSingle();

  if (error) {
    console.error("[reviews] no se pudo moderar:", error);
    return { ok: false, reason: "dbError" };
  }

  if (data) return { ok: true, review: toAdminReview(data as Record<string, unknown>) };

  // El update no afectó ninguna fila. Son dos cosas distintas y conviene
  // distinguirlas: o la reseña no existe, o alguien se adelantó y ya no está
  // en el estado del que esta acción podía partir. Esta consulta extra solo
  // corre en ese camino raro.
  const { data: actual } = await supabase
    .from("reviews")
    .select("id")
    .eq("id", id)
    .maybeSingle();

  return { ok: false, reason: actual ? "conflict" : "notFound" };
}

// ---------------------------------------------------------------------------
// La sección pública de la home (parte 3)
// ---------------------------------------------------------------------------

export interface PublishedReview {
  id: string;
  rating: number;
  body: string;
  displayName: string;
  serviceType: string;
  locale: ReviewLocale;
  publishedAt: string;
  /** Fotos del trabajo, subidas por el equipo. Pueden no existir. */
  photos: ReviewPhoto[];
}

export interface PublishedReviews {
  /** Todas las publicadas, no solo las que se muestran. */
  total: number;
  /** Promedio sobre ese mismo total, con un decimal. 0 si no hay ninguna. */
  average: number;
  /** Las 6 más recientes, para pintar. */
  latest: PublishedReview[];
}

const VACIO: PublishedReviews = { total: 0, average: 0, latest: [] };

/** Cuántas tarjetas se pintan. El promedio NO se calcula sobre estas. */
const EN_PANTALLA = 6;

async function loadPublishedReviews(): Promise<PublishedReviews> {
  const supabase = getSupabaseAdmin();
  // En un build sin claves de Supabase esto es `null`, la sección no se
  // renderiza y el build no falla. Es el mismo criterio que el resto del
  // proyecto: una pieza que no se puede cargar desaparece, no rompe la página.
  if (!supabase) return VACIO;

  // Se traen TODAS las publicadas, no solo las seis que se ven, porque el
  // promedio y el total tienen que salir de todas (regla 5). Son pocas filas
  // y el índice (status, published_at desc) las entrega ya ordenadas; si
  // algún día fueran miles, esto se parte en una consulta de agregado más
  // otra de seis filas.
  const { data, error } = await supabase
    .from("reviews")
    .select(
      "id, invite_id, rating, body, display_name, service_type, locale, published_at",
    )
    .eq("status", "publicado")
    .order("published_at", { ascending: false });

  if (error) {
    console.error("[reviews] no se pudieron leer las publicadas:", error);
    return VACIO;
  }

  const filas = data ?? [];
  if (filas.length === 0) return VACIO;

  const suma = filas.reduce((acc, r) => acc + Number(r.rating), 0);

  // Solo las fotos de las que se van a pintar. El promedio y el total salen de
  // todas las publicadas, pero traer las fotos de todas sería trabajo tirado.
  const enPantalla = filas.slice(0, EN_PANTALLA);
  const fotos = await listPhotosByInvite(enPantalla.map((r) => String(r.invite_id)));

  return {
    total: filas.length,
    average: Math.round((suma / filas.length) * 10) / 10,
    latest: enPantalla.map((r) => ({
      id: String(r.id),
      rating: Number(r.rating),
      body: typeof r.body === "string" ? r.body : "",
      displayName: String(r.display_name ?? ""),
      serviceType: String(r.service_type ?? ""),
      locale: normalizeLocale(r.locale),
      publishedAt: String(r.published_at ?? ""),
      photos: fotos.get(String(r.invite_id)) ?? [],
    })),
  };
}

/**
 * La misma lectura, cacheada, para que la home siga siendo estática.
 *
 * Sin esto, consultar Supabase al renderizar la home la volvería dinámica
 * (`ƒ` en el build) y cada visita pagaría una ida y vuelta a la base de
 * datos. Con `unstable_cache` el resultado se calcula una vez y se guarda
 * bajo la etiqueta `REVIEWS_CACHE_TAG`.
 *
 * No se le pone `revalidate`: la caché no vence sola, a propósito. Las
 * reseñas no cambian con el tiempo, cambian cuando alguien las modera, y ese
 * momento se conoce exactamente — `/api/admin/reviews/[id]` llama a
 * `revalidateTag` al publicar u ocultar. Una revalidación por tiempo sería
 * peor de las dos maneras: la home se quedaría desactualizada hasta una hora
 * después de publicar, y consultaría la base de datos cada hora aunque no
 * hubiera cambiado nada.
 *
 * `unstable_cache` y no la directiva `use cache`: esta última necesita
 * `cacheComponents: true` en `next.config.ts`, que es un cambio de modelo de
 * caché para todo el proyecto. No tiene sentido activarlo por una sección.
 */
export const getPublishedReviews = unstable_cache(
  loadPublishedReviews,
  ["resenas-publicadas-home"],
  { tags: [REVIEWS_CACHE_TAG] },
);
