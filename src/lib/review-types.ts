/**
 * Formas que cruzan la frontera servidor/navegador.
 *
 * Viven acá y no en `src/lib/reviews.ts` porque ese archivo es `server-only`
 * (usa la clave secreta de Supabase) y los componentes del panel corren en el
 * navegador. Un archivo de tipos sin dependencias puede importarlo cualquiera
 * de los dos lados, así que la forma se declara UNA vez y no hay dos
 * definiciones que puedan divergir.
 */

export type ReviewStatus = "pendiente" | "publicado" | "rechazado";

export type ReviewLocale = "es" | "en";

/** Lo que el panel sabe de la reseña de una reserva web. */
export interface BookingReviewState {
  inviteId: string;
  url: string;
  emailedAt: string | null;
  reviewStatus: ReviewStatus | null;
}

/** Una invitación de cliente telefónico, en la lista del panel. */
export interface ManualInviteSummary {
  id: string;
  url: string;
  customerName: string;
  email: string | null;
  serviceType: string;
  serviceDate: string | null;
  locale: ReviewLocale;
  emailedAt: string | null;
  reviewStatus: ReviewStatus | null;
}

// ---------------------------------------------------------------------------
// Moderación (parte 2)
// ---------------------------------------------------------------------------

/**
 * Los únicos motivos por los que una reseña se puede rechazar u ocultar.
 *
 * Es una lista cerrada, no un campo de texto libre, y eso es cumplimiento,
 * no comodidad: la regla de la FTC sobre reseñas (16 CFR Part 465, vigente
 * desde octubre de 2024) y la política de reseñas de Google prohíben filtrar
 * reseñas por ser negativas. Los cuatro motivos de acá no miran la
 * calificación — una reseña de 1★ bien escrita sobre el servicio no encaja en
 * ninguno, así que el sistema no ofrece ninguna forma de quitarla.
 *
 * Que la lista viva en el tipo y no en la UI es lo que lo hace cumplirse: el
 * servidor rechaza cualquier motivo que no esté acá, así que ni un cliente
 * manipulado ni un botón futuro pueden colar "es negativa".
 */
export const MODERATION_REASONS = [
  "ofensivo",
  "datosPersonales",
  "noHablaDelServicio",
  "spam",
] as const;

export type ModerationReason = (typeof MODERATION_REASONS)[number];

/**
 * `rechazar` y `ocultar` acaban las dos en `status: 'rechazado'` y las dos
 * exigen motivo. Son dos acciones distintas porque el estado del que PARTEN
 * es distinto, y ese estado de partida es el guardián: rechazar solo vale
 * sobre una pendiente, ocultar solo sobre una publicada. Con una sola acción
 * genérica, un clic repetido sobre una reseña que otra pestaña ya movió
 * volvería a "funcionar" en vez de avisar de que el mundo cambió.
 */
export type ModerationAction = "publicar" | "rechazar" | "ocultar";

/** Una reseña tal como la ve el panel de moderación. */
export interface AdminReview {
  id: string;
  rating: number;
  body: string;
  displayName: string;
  serviceType: string;
  locale: ReviewLocale;
  status: ReviewStatus;
  /** De una reserva web o de una invitación creada a mano para un teléfono. */
  source: "web" | "manual";
  customerName: string;
  createdAt: string;
  publishedAt: string | null;
  moderationReason: ModerationReason | null;
}
