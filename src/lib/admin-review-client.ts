import type { ManualInviteSummary } from "@/lib/review-types";

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
