import "server-only";
import { randomBytes } from "node:crypto";
import type {
  BookingReviewState,
  ManualInviteSummary,
  ReviewLocale,
  ReviewStatus,
} from "@/lib/review-types";
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

  for (const row of data ?? []) {
    if (!row.booking_id) continue;
    map.set(row.booking_id, {
      inviteId: row.id,
      url: reviewUrl({ token: row.token, locale: normalizeLocale(row.locale) }),
      emailedAt: row.emailed_at,
      reviewStatus: embeddedReviewStatus(row.reviews),
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
