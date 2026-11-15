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
