"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { shortDate } from "@/components/admin/ReviewInviteBlock";
import ReviewPhotosBlock from "@/components/admin/ReviewPhotosBlock";
import { StarRow } from "@/components/reviews/Star";
import {
  describeModerationFailure,
  moderateReviewRequest,
} from "@/lib/admin-review-client";
import {
  MODERATION_REASONS,
  type AdminReview,
  type ModerationAction,
  type ModerationReason,
} from "@/lib/review-types";

/**
 * Moderación de reseñas, arriba del todo en `/admin/reservas`.
 *
 * REGLA DE CUMPLIMIENTO (16 CFR Part 465 de la FTC, vigente desde octubre de
 * 2024, y la política de reseñas de Google): una reseña se rechaza u oculta
 * solo por motivos ajenos a su calificación. Por eso esta pantalla no tiene
 * ningún botón de "quitar" suelto: cada acción que esconde una reseña obliga
 * a elegir uno de cuatro motivos neutrales, y el servidor rechaza cualquier
 * otro valor. Una reseña de 1★ que habla del servicio no encaja en ninguno,
 * y eso es exactamente lo que la regla exige.
 *
 * Los textos van en español directo en el código, como el resto del panel:
 * es una herramienta interna de una sola persona, no una página pública.
 */

const REASON_LABEL: Record<ModerationReason, string> = {
  ofensivo: "Lenguaje ofensivo",
  datosPersonales: "Datos personales de alguien",
  noHablaDelServicio: "No habla del servicio",
  spam: "Spam o duplicada",
};

const SOURCE_LABEL = { web: "Reserva web", manual: "Cliente por teléfono" };

/**
 * Una reseña con sus acciones.
 *
 * Vive fuera de `ReviewsModeration` a propósito. Declarada dentro, React
 * vería un tipo de componente nuevo en cada render del padre y desmontaría y
 * volvería a montar cada tarjeta — con su parpadeo y con el foco del teclado
 * perdido justo mientras se elige un motivo.
 */
function ReviewCard({
  review,
  isBusy,
  error,
  preguntando,
  serviceName,
  token,
  onApply,
  onAsk,
  onCancelAsk,
  onChanged,
  onExpired,
}: {
  review: AdminReview;
  isBusy: boolean;
  error: string | undefined;
  preguntando: ModerationAction | null;
  serviceName: string;
  token: string;
  onApply: (
    review: AdminReview,
    action: ModerationAction,
    reason: ModerationReason | null,
  ) => void;
  onAsk: (id: string, action: ModerationAction) => void;
  onCancelAsk: () => void;
  onChanged: () => void;
  onExpired: () => void;
}) {
    const fecha = review.status === "publicado" ? review.publishedAt : review.createdAt;

    return (
      <li className="rounded-lg border-2 border-border bg-surface p-4">
        <div className="flex items-start justify-between gap-3">
          <StarRow rating={review.rating} label={`${review.rating} de 5 estrellas`} />
          <span className="shrink-0 text-tiny uppercase tracking-wider text-text-faint">
            {fecha ? shortDate(fecha) : ""}
          </span>
        </div>

        {/* El texto del cliente se pinta SIEMPRE como texto, nunca con
            dangerouslySetInnerHTML: es lo único de esta pantalla que escribió
            alguien de fuera. `whitespace-pre-line` respeta sus saltos de
            línea sin interpretar nada más. */}
        {review.body && (
          <p className="mt-3 whitespace-pre-line text-body text-text">{review.body}</p>
        )}

        <p className="mt-3 text-small font-semibold text-text">{review.displayName}</p>
        <p className="mt-0.5 text-small text-text-muted">
          {serviceName} · {SOURCE_LABEL[review.source]} ·{" "}
          {review.locale.toUpperCase()}
        </p>
        {review.customerName && review.customerName !== review.displayName && (
          <p className="mt-0.5 text-tiny text-text-faint">
            Cliente: {review.customerName}
          </p>
        )}

        {/*
          Las fotos del trabajo, acá mismo.

          Están repetidas respecto a la fila de la invitación (en la reserva
          web o en "Clientes sin reserva web") a propósito: son el MISMO
          bloque sobre la MISMA invitación, no dos juegos de fotos. Cuando
          llega una reseña, esta tarjeta es donde se la mira, y no encontrar
          acá las fotos hace pensar que la reseña no las tiene.

          Siguen siendo fotos DEL NEGOCIO, no del cliente: el propio bloque
          lleva la etiqueta que lo dice, y la home las muestra separadas del
          texto de la reseña por la misma razón de cumplimiento.
        */}
        <ReviewPhotosBlock
          inviteId={review.inviteId}
          photos={review.photos}
          token={token}
          onChanged={onChanged}
          onExpired={onExpired}
        />

        {error && <p className="mt-2 text-small text-error">{error}</p>}

        {/* Elegir motivo. Son botones y no un <select> porque en el teléfono
            un toque directo es más rápido que abrir la rueda del selector. */}
        {preguntando ? (
          <div className="mt-3 rounded-md border-2 border-border bg-bg-alt p-3">
            <p className="text-small font-semibold text-text">
              ¿Por qué {preguntando === "rechazar" ? "se rechaza" : "se oculta"}?
            </p>
            <p className="mt-1 text-tiny text-text-faint">
              Solo estos motivos. Nunca por tener pocas estrellas.
            </p>
            <div className="mt-2 flex flex-col gap-2">
              {MODERATION_REASONS.map((motivo) => (
                <button
                  key={motivo}
                  type="button"
                  disabled={isBusy}
                  onClick={() => onApply(review, preguntando, motivo)}
                  className="h-11 w-full rounded-pill border-2 border-border-strong px-4 text-small font-semibold text-text transition-colors hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {REASON_LABEL[motivo]}
                </button>
              ))}
              <button
                type="button"
                onClick={onCancelAsk}
                className="h-11 w-full rounded-pill text-small font-semibold text-text-muted transition-colors hover:text-text"
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-3 flex flex-col gap-2">
            {review.status === "pendiente" ? (
              <>
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => onApply(review, "publicar", null)}
                  className="h-11 w-full rounded-pill bg-accent text-small font-semibold text-on-accent transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isBusy ? "Aplicando…" : "Publicar"}
                </button>
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => onAsk(review.id, "rechazar")}
                  className="h-11 w-full rounded-pill border-2 border-border-strong text-small font-semibold text-text transition-colors hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Rechazar
                </button>
              </>
            ) : (
              <button
                type="button"
                disabled={isBusy}
                onClick={() => onAsk(review.id, "ocultar")}
                className="h-11 w-full rounded-pill border-2 border-border-strong text-small font-semibold text-text transition-colors hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isBusy ? "Aplicando…" : "Ocultar de la web"}
              </button>
            )}
          </div>
        )}
      </li>
    );
}

export default function ReviewsModeration({
  token,
  pendientes,
  publicadas,
  onChanged,
  onExpired,
}: {
  token: string;
  pendientes: AdminReview[];
  publicadas: AdminReview[];
  onChanged: () => void;
  onExpired: () => void;
}) {
  const tServices = useTranslations("services.items");

  const [busyId, setBusyId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  /** Qué reseña está esperando que se elija un motivo, y para qué acción. */
  const [asking, setAsking] = useState<{ id: string; action: ModerationAction } | null>(
    null,
  );
  const [verPublicadas, setVerPublicadas] = useState(false);

  async function apply(
    review: AdminReview,
    action: ModerationAction,
    reason: ModerationReason | null,
  ) {
    setBusyId(review.id);
    setErrors((e) => ({ ...e, [review.id]: "" }));

    const outcome = await moderateReviewRequest(review.id, action, reason, token);
    setBusyId(null);
    setAsking(null);

    if (outcome.ok) {
      onChanged();
      return;
    }
    if (outcome.kind === "expired") {
      onExpired();
      return;
    }
    // El mensaje se calcula FUERA del callback: TypeScript no conserva el
    // estrechamiento de `outcome.kind` dentro de una función anidada, así que
    // ahí dentro volvería a incluir "expired", que acabamos de descartar.
    const mensaje = describeModerationFailure(outcome.kind);
    setErrors((e) => ({ ...e, [review.id]: mensaje }));
  }

  if (pendientes.length === 0 && publicadas.length === 0) return null;

  return (
    <section className="mt-8">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-h3 font-semibold text-text">Reseñas</h2>
        {pendientes.length > 0 && (
          <span className="rounded-pill bg-accent px-3 py-1 text-tiny font-semibold text-on-accent">
            {pendientes.length} por revisar
          </span>
        )}
      </div>

      {pendientes.length === 0 ? (
        <p className="mt-2 text-small text-text-muted">Nada pendiente por revisar.</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-3">
          {pendientes.map((r) => (
            <ReviewCard
              key={r.id}
              review={r}
              isBusy={busyId === r.id}
              error={errors[r.id]}
              preguntando={asking?.id === r.id ? asking.action : null}
              serviceName={tServices(`${r.serviceType}.name`)}
              token={token}
              onApply={apply}
              onAsk={(id, action) => setAsking({ id, action })}
              onCancelAsk={() => setAsking(null)}
              onChanged={onChanged}
              onExpired={onExpired}
            />
          ))}
        </ul>
      )}

      {publicadas.length > 0 && (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setVerPublicadas((v) => !v)}
            className="text-small font-semibold text-accent transition-colors hover:text-accent-soft"
          >
            {/* "Cerrar la lista" y no "Ocultar las publicadas": dentro de cada
                tarjeta hay un botón "Ocultar de la web", que hace algo muy
                distinto. Dos "ocultar" en la misma pantalla con significados
                opuestos es justo el tipo de detalle que hace dudar antes de
                tocar un botón. */}
            {verPublicadas
              ? "Cerrar la lista"
              : publicadas.length === 1
                ? "Ver la reseña publicada"
                : `Ver las ${publicadas.length} publicadas`}
          </button>

          {verPublicadas && (
            <ul className="mt-3 flex flex-col gap-3">
              {publicadas.map((r) => (
                <ReviewCard
              key={r.id}
              review={r}
              isBusy={busyId === r.id}
              error={errors[r.id]}
              preguntando={asking?.id === r.id ? asking.action : null}
              serviceName={tServices(`${r.serviceType}.name`)}
              token={token}
              onApply={apply}
              onAsk={(id, action) => setAsking({ id, action })}
              onCancelAsk={() => setAsking(null)}
              onChanged={onChanged}
              onExpired={onExpired}
            />
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
