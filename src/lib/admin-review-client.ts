import {
  MAX_PHOTOS_PER_INVITE,
  type AdminReview,
  type ManualInviteSummary,
  type ModerationAction,
  type ModerationReason,
  type ReviewPhoto,
} from "@/lib/review-types";

/**
 * Llamadas del panel al API de reseñas, desde el navegador.
 *
 * Vive aparte porque dos componentes distintos mandan el mismo correo (el
 * bloque de una reserva web y la lista de invitaciones manuales) y la
 * traducción de códigos HTTP a algo que el dueño pueda leer tiene que ser
 * idéntica en los dos. Repetida, cualquier cambio en un sitio dejaría el
 * otro mintiendo.
 */

export type EmailFailureKind = "expired" | "noEmail" | "failed" | "network";

export type EmailOutcome =
  | { ok: true; emailedAt: string }
  | { ok: false; kind: EmailFailureKind };

export async function sendInviteEmail(
  inviteId: string,
  token: string,
): Promise<EmailOutcome> {
  try {
    const res = await fetch(`/api/admin/review-invites/${inviteId}/email`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.status === 401) return { ok: false, kind: "expired" };

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      return { ok: false, kind: data.error === "noEmail" ? "noEmail" : "failed" };
    }

    return { ok: true, emailedAt: data.emailedAt ?? new Date().toISOString() };
  } catch {
    return { ok: false, kind: "network" };
  }
}

/** El mensaje que ve el dueño para cada fallo de envío. */
export function describeEmailFailure(kind: EmailFailureKind): string {
  switch (kind) {
    case "noEmail":
      return "Esta invitación no tiene correo. Copia el link y mándalo por WhatsApp.";
    case "network":
      return "Se perdió la conexión. Verifica antes de reintentar.";
    default:
      return "No se pudo enviar el correo. Intenta de nuevo.";
  }
}

export type ManualInviteDraft = {
  name: string;
  serviceType: string;
  serviceDate: string;
  email: string;
  locale: "es" | "en";
};

export type CreateManualOutcome =
  | { ok: true; invite: Pick<ManualInviteSummary, "id" | "url"> }
  | { ok: false; kind: "expired" | "invalid" | "failed" | "network" };

export async function createManualInviteRequest(
  draft: ManualInviteDraft,
  token: string,
): Promise<CreateManualOutcome> {
  try {
    const res = await fetch("/api/admin/review-invites", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        manual: {
          name: draft.name.trim(),
          serviceType: draft.serviceType,
          serviceDate: draft.serviceDate || null,
          email: draft.email.trim() || null,
          locale: draft.locale,
        },
      }),
    });

    if (res.status === 401) return { ok: false, kind: "expired" };

    const data = await res.json().catch(() => ({}));

    if (!res.ok || typeof data.url !== "string") {
      return {
        ok: false,
        kind: data.error === "invalidRequest" ? "invalid" : "failed",
      };
    }

    return { ok: true, invite: { id: data.id, url: data.url } };
  } catch {
    return { ok: false, kind: "network" };
  }
}

// ---------------------------------------------------------------------------
// Moderación (parte 2)
// ---------------------------------------------------------------------------

/**
 * `expired` queda fuera de esta lista porque no es un fallo que se le cuente
 * al dueño: significa que la sesión caducó, y el panel reacciona volviendo a
 * pedir login en vez de mostrando un mensaje de error.
 */
export type ModerationFailureKind = "conflict" | "notFound" | "failed" | "network";

export type ModerateOutcome =
  | { ok: true; review: AdminReview }
  | { ok: false; kind: "expired" | ModerationFailureKind };

export async function moderateReviewRequest(
  id: string,
  action: ModerationAction,
  reason: ModerationReason | null,
  token: string,
): Promise<ModerateOutcome> {
  try {
    const res = await fetch(`/api/admin/reviews/${id}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ action, reason }),
    });

    if (res.status === 401) return { ok: false, kind: "expired" };

    const data = await res.json().catch(() => ({}));

    if (res.status === 409) return { ok: false, kind: "conflict" };
    if (res.status === 404) return { ok: false, kind: "notFound" };
    if (!res.ok || !data.review) return { ok: false, kind: "failed" };

    return { ok: true, review: data.review as AdminReview };
  } catch {
    return { ok: false, kind: "network" };
  }
}

/** El mensaje que ve el dueño cuando una decisión de moderación no se aplica. */
export function describeModerationFailure(kind: ModerationFailureKind): string {
  switch (kind) {
    case "conflict":
      // El caso real: dos pestañas abiertas, o un segundo clic que llegó
      // cuando el primero ya había cambiado el estado.
      return "Esta reseña ya cambió de estado. Actualiza para ver cómo quedó.";
    case "notFound":
      return "Esta reseña ya no existe.";
    case "network":
      return "Se perdió la conexión. Actualiza antes de reintentar.";
    default:
      return "No se pudo aplicar. Intenta de nuevo.";
  }
}

// ---------------------------------------------------------------------------
// Fotos del trabajo
// ---------------------------------------------------------------------------

export type PhotoFailureKind =
  | "tooMany"
  | "badType"
  | "tooLarge"
  | "decode"
  | "failed"
  | "network";

export type UploadPhotoOutcome =
  | { ok: true; photo: ReviewPhoto }
  | { ok: false; kind: "expired" | PhotoFailureKind };

/**
 * Sube UNA foto ya redimensionada. El redimensionado va aparte, en
 * `resizeForUpload`, para que el componente pueda mostrar progreso por foto
 * y para que un archivo que no se puede decodificar no llegue a la red.
 */
export async function uploadPhotoRequest(
  inviteId: string,
  blob: Blob,
  width: number,
  height: number,
  token: string,
): Promise<UploadPhotoOutcome> {
  try {
    const form = new FormData();
    form.set("inviteId", inviteId);
    form.set("width", String(width));
    form.set("height", String(height));
    // El nombre no se usa en el servidor —ahí se genera uno nuevo— pero
    // `FormData` necesita alguno para mandar el archivo como tal.
    form.set("file", blob, "foto");

    const res = await fetch("/api/admin/review-photos", {
      method: "POST",
      // Sin Content-Type a mano: el navegador tiene que poner el suyo con el
      // `boundary` del multipart. Fijarlo rompe el cuerpo.
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });

    if (res.status === 401) return { ok: false, kind: "expired" };

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.photo) {
      const kind: PhotoFailureKind =
        data.error === "tooMany" ||
        data.error === "badType" ||
        data.error === "tooLarge"
          ? data.error
          : "failed";
      return { ok: false, kind };
    }

    return { ok: true, photo: data.photo as ReviewPhoto };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function deletePhotoRequest(
  id: string,
  token: string,
): Promise<{ ok: boolean; expired?: boolean }> {
  try {
    const res = await fetch(`/api/admin/review-photos/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 401) return { ok: false, expired: true };
    // Un 404 significa que ya no estaba: para quien mira la pantalla, el
    // resultado es el mismo que borrarla, así que cuenta como éxito.
    return { ok: res.ok || res.status === 404 };
  } catch {
    return { ok: false };
  }
}

/** El mensaje que ve el dueño cuando una foto no se puede subir. */
export function describePhotoFailure(kind: PhotoFailureKind): string {
  switch (kind) {
    case "tooMany":
      return `Ya hay ${MAX_PHOTOS_PER_INVITE} fotos en este trabajo. Borra una para agregar otra.`;
    case "badType":
      return "Ese archivo no es una imagen que podamos usar.";
    case "tooLarge":
      return "La foto pesa demasiado incluso reducida. Prueba con otra.";
    case "decode":
      return "No se pudo abrir esa imagen. Puede estar dañada.";
    case "network":
      return "Se perdió la conexión. Verifica antes de reintentar.";
    default:
      return "No se pudo subir. Intenta de nuevo.";
  }
}
