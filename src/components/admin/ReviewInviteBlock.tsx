"use client";

import { useState } from "react";
import CopyLinkButton from "@/components/admin/CopyLinkButton";
import { describeEmailFailure, sendInviteEmail } from "@/lib/admin-review-client";
import type { BookingReviewState } from "@/lib/review-types";

/**
 * Bloque "Reseña" dentro de una reserva web.
 *
 * Aparece solo cuando el servicio ya se hizo (`completado`, `link_enviado` o
 * `pagado`) — no se le pide a nadie que opine de un trabajo que todavía no
 * ocurrió.
 *
 * Normalmente la invitación ya existe, porque la crea sola el generador del
 * link de pago. El botón de crearla cubre dos casos reales: las reservas que
 * se marcaron completadas antes de que existiera este sistema, y las que se
 * cobraron por fuera de Stripe (efectivo, Zelle) y por lo tanto nunca
 * pasaron por el generador de links.
 */
export default function ReviewInviteBlock({
  bookingId,
  token,
  resena,
  onChange,
  onExpired,
}: {
  bookingId: string;
  token: string;
  resena: BookingReviewState | null;
  onChange: (next: BookingReviewState) => void;
  onExpired: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createInvite() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/review-invites", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ bookingId }),
      });

      if (res.status === 401) {
        onExpired();
        return;
      }

      const data = await res.json().catch(() => ({}));
      if (!res.ok || typeof data.url !== "string") {
        setError(
          data.error === "notEligible"
            ? "Esta reserva todavía no está marcada como completada."
            : "No se pudo crear el link. Intenta de nuevo.",
        );
        return;
      }

      onChange({
        inviteId: data.id,
        url: data.url,
        emailedAt: null,
        reviewStatus: null,
      });
    } catch {
      setError("Se perdió la conexión. Verifica antes de reintentar.");
    } finally {
      setBusy(false);
    }
  }

  async function sendEmail() {
    if (!resena) return;
    setBusy(true);
    setError(null);

    const outcome = await sendInviteEmail(resena.inviteId, token);
    setBusy(false);

    if (outcome.ok) {
      onChange({ ...resena, emailedAt: outcome.emailedAt });
      return;
    }
    if (outcome.kind === "expired") {
      onExpired();
      return;
    }
    setError(describeEmailFailure(outcome.kind));
  }

  return (
    <div className="mt-4 border-t-2 border-border pt-4">
      <p className="text-tiny font-semibold uppercase tracking-wider text-text-faint">
        Reseña
      </p>

      {error && <p className="mt-2 text-small text-error">{error}</p>}

      {!resena ? (
        <button
          type="button"
          disabled={busy}
          onClick={createInvite}
          className="mt-2 h-11 w-full rounded-pill border-2 border-border-strong text-small font-semibold text-text transition-colors hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "Creando…" : "Crear link de reseña"}
        </button>
      ) : (
        <div className="mt-2 flex flex-col gap-2">
          <p className="text-small text-text-muted">{describeState(resena)}</p>
          <input
            type="text"
            readOnly
            value={resena.url}
            onFocus={(e) => e.currentTarget.select()}
            onClick={(e) => e.currentTarget.select()}
            className="h-11 w-full rounded-md border-2 border-border bg-bg-alt px-3 text-tiny text-text"
          />
          <CopyLinkButton url={resena.url} label="Copiar link de reseña" />

          {/*
            El botón de correo desaparece si ya reseñó: volver a pedirle una
            opinión a quien ya la dio es la forma más fácil de que un cliente
            contento deje de estarlo.
          */}
          {resena.reviewStatus === null && (
            <button
              type="button"
              disabled={busy}
              onClick={sendEmail}
              className="h-11 w-full rounded-pill border-2 border-border-strong text-small font-semibold text-text transition-colors hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy
                ? "Enviando…"
                : resena.emailedAt
                  ? "Volver a enviar por correo"
                  : "Enviar por correo"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Qué se le dice al dueño, en una línea. El estado de la reseña manda sobre
 * el del envío: una vez que llegó, que se haya mandado un correo o no deja de
 * importar.
 */
export function describeState(state: {
  emailedAt: string | null;
  reviewStatus: string | null;
}): string {
  if (state.reviewStatus) {
    const label =
      state.reviewStatus === "pendiente"
        ? "pendiente de revisar"
        : state.reviewStatus === "publicado"
          ? "publicada"
          : "rechazada";
    return `Recibida: ${label}`;
  }
  if (state.emailedAt) return `Enviada el ${shortDate(state.emailedAt)}`;
  return "Sin enviar";
}

/**
 * "5 nov" — el panel va en español, sin depender de `messages`.
 *
 * Recibe dos formas distintas y hay que distinguirlas, o la fecha sale
 * corrida un día:
 *
 * - `emailed_at` es una marca de tiempo completa, con zona incluida
 *   (`2026-11-10T15:32:42Z`). Se parsea directo.
 * - `service_date` es una fecha suelta (`2026-11-10`). `new Date()` la
 *   interpreta como medianoche UTC, y al mostrarla en Miami (UTC-5) cae el
 *   día ANTERIOR. Construyéndola con sus partes queda en la zona local y
 *   coincide con el día que el dueño escribió en el formulario.
 *
 * Mismo cuidado que `src/lib/timezone.ts` y que la página de reseña.
 */
export function shortDate(value: string): string {
  const soloFecha = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const date = soloFecha
    ? new Date(Number(soloFecha[1]), Number(soloFecha[2]) - 1, Number(soloFecha[3]))
    : new Date(value);

  return date.toLocaleDateString("es-US", {
    day: "numeric",
    month: "short",
  });
}
