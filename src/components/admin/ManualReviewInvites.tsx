"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import CopyLinkButton from "@/components/admin/CopyLinkButton";
import { describeState, shortDate } from "@/components/admin/ReviewInviteBlock";
import {
  createManualInviteRequest,
  describeEmailFailure,
  sendInviteEmail,
  type ManualInviteDraft,
} from "@/lib/admin-review-client";
import { SERVICE_TYPES } from "@/lib/booking-options";
import type { ManualInviteSummary } from "@/lib/review-types";

const EMPTY: ManualInviteDraft = {
  name: "",
  serviceType: SERVICE_TYPES[0],
  serviceDate: "",
  email: "",
  locale: "es",
};

/**
 * Invitaciones para clientes que no reservaron por la web.
 *
 * Es la razón por la que las reseñas cuelgan de una invitación y no de una
 * reserva: la primera clienta del negocio llamó por teléfono y no existe en
 * `bookings`. Sin esto, los clientes que llaman no podrían reseñar nunca.
 *
 * Esto NO crea una reserva: no hay precio, ni link de pago, ni fila en
 * `bookings`. Solo el permiso para dejar una reseña.
 */
export default function ManualReviewInvites({
  token,
  invites,
  onChanged,
  onExpired,
}: {
  token: string;
  invites: ManualInviteSummary[];
  onChanged: () => void;
  onExpired: () => void;
}) {
  // Los nombres de los servicios salen de `messages`, los mismos que ve el
  // cliente en el sitio — no una lista nueva escrita a mano acá.
  const tServices = useTranslations("services.items");

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<ManualInviteDraft>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ url: string; hasEmail: boolean } | null>(null);

  // Estado por fila de la lista, para el botón de reenviar correo.
  const [rowBusy, setRowBusy] = useState<string | null>(null);
  const [rowError, setRowError] = useState<Record<string, string>>({});

  async function submit() {
    if (!draft.name.trim()) {
      setError("Escribe el nombre del cliente.");
      return;
    }

    setBusy(true);
    setError(null);

    const outcome = await createManualInviteRequest(draft, token);
    setBusy(false);

    if (!outcome.ok) {
      if (outcome.kind === "expired") {
        onExpired();
        return;
      }
      setError(
        outcome.kind === "invalid"
          ? "Faltan datos o el servicio no es válido."
          : "No se pudo crear la invitación. Intenta de nuevo.",
      );
      return;
    }

    setCreated({ url: outcome.invite.url, hasEmail: !!draft.email.trim() });
    setDraft(EMPTY);
    setOpen(false);
    onChanged();
  }

  async function emailRow(invite: ManualInviteSummary) {
    setRowBusy(invite.id);
    setRowError((e) => ({ ...e, [invite.id]: "" }));

    const outcome = await sendInviteEmail(invite.id, token);
    setRowBusy(null);

    if (outcome.ok) {
      onChanged();
      return;
    }
    if (outcome.kind === "expired") {
      onExpired();
      return;
    }
    setRowError((e) => ({ ...e, [invite.id]: describeEmailFailure(outcome.kind) }));
  }

  return (
    <section className="mt-10">
      <h2 className="text-h3 font-semibold text-text">Clientes sin reserva web</h2>
      <p className="mt-1 text-small text-text-muted">
        Para quien llamó o escribió por WhatsApp. Solo clientes a los que de verdad
        se les hizo un servicio.
      </p>

      {!open && (
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            setCreated(null);
          }}
          className="mt-3 h-11 w-full rounded-pill border-2 border-border-strong text-small font-semibold text-text transition-colors hover:bg-surface-hover"
        >
          + Link de reseña para cliente sin reserva web
        </button>
      )}

      {/* Confirmación de lo que se acaba de crear, con el link a mano. */}
      {created && (
        <div className="mt-3 rounded-lg border-2 border-border bg-surface p-4">
          <p className="text-small font-semibold text-text">Invitación creada</p>
          <p className="mt-2 truncate rounded-md bg-bg-alt px-3 py-2 text-tiny text-text-faint">
            {created.url}
          </p>
          <div className="mt-2">
            <CopyLinkButton url={created.url} label="Copiar link de reseña" />
          </div>
          {!created.hasEmail && (
            <p className="mt-2 text-tiny text-text-faint">
              Sin correo: mándalo por WhatsApp o SMS.
            </p>
          )}
        </div>
      )}

      {open && (
        <div className="mt-3 flex flex-col gap-4 rounded-lg border-2 border-border bg-surface p-5">
          <div>
            <label htmlFor="mi-name" className="text-small font-semibold text-text">
              Nombre del cliente
            </label>
            <input
              id="mi-name"
              type="text"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              className="mt-1 h-12 w-full rounded-md border-2 border-border bg-surface px-4 text-body text-text placeholder:text-text-faint focus:border-accent focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="mi-service" className="text-small font-semibold text-text">
              Servicio
            </label>
            <select
              id="mi-service"
              value={draft.serviceType}
              onChange={(e) => setDraft({ ...draft, serviceType: e.target.value })}
              className="mt-1 h-12 w-full rounded-md border-2 border-border bg-surface px-4 text-body text-text focus:border-accent focus:outline-none"
            >
              {SERVICE_TYPES.map((id) => (
                <option key={id} value={id}>
                  {tServices(`${id}.name`)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="mi-date" className="text-small font-semibold text-text">
              Fecha del servicio{" "}
              <span className="font-normal text-text-faint">(opcional)</span>
            </label>
            <input
              id="mi-date"
              type="date"
              value={draft.serviceDate}
              onChange={(e) => setDraft({ ...draft, serviceDate: e.target.value })}
              className="mt-1 h-12 w-full rounded-md border-2 border-border bg-surface px-4 text-body text-text focus:border-accent focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="mi-email" className="text-small font-semibold text-text">
              Correo <span className="font-normal text-text-faint">(opcional)</span>
            </label>
            <input
              id="mi-email"
              type="email"
              value={draft.email}
              onChange={(e) => setDraft({ ...draft, email: e.target.value })}
              placeholder="Sin correo, el link se manda por WhatsApp"
              className="mt-1 h-12 w-full rounded-md border-2 border-border bg-surface px-4 text-body text-text placeholder:text-text-faint focus:border-accent focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="mi-locale" className="text-small font-semibold text-text">
              Idioma del cliente
            </label>
            <select
              id="mi-locale"
              value={draft.locale}
              onChange={(e) =>
                setDraft({ ...draft, locale: e.target.value === "en" ? "en" : "es" })
              }
              className="mt-1 h-12 w-full rounded-md border-2 border-border bg-surface px-4 text-body text-text focus:border-accent focus:outline-none"
            >
              <option value="es">Español</option>
              <option value="en">English</option>
            </select>
          </div>

          {error && <p className="text-small text-error">{error}</p>}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setError(null);
                setDraft(EMPTY);
              }}
              className="h-11 flex-1 rounded-pill border-2 border-border-strong text-small font-semibold text-text transition-colors hover:bg-surface-hover"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={submit}
              className="h-11 flex-1 rounded-pill bg-accent text-small font-semibold text-on-accent transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? "Creando…" : "Crear invitación"}
            </button>
          </div>
        </div>
      )}

      {invites.length > 0 && (
        <ul className="mt-4 flex flex-col gap-3">
          {invites.map((invite) => (
            <li
              key={invite.id}
              className="rounded-lg border-2 border-border bg-surface p-4"
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-body font-semibold text-text">
                  {invite.customerName}
                </span>
                <span className="text-tiny uppercase tracking-wider text-text-faint">
                  {invite.locale}
                </span>
              </div>
              <p className="mt-1 text-small text-text-muted">
                {tServices(`${invite.serviceType}.name`)}
                {invite.serviceDate ? ` · ${shortDate(invite.serviceDate)}` : ""}
              </p>
              <p className="mt-1 text-small text-text-muted">
                {invite.email ?? "Sin correo"}
              </p>
              <p className="mt-2 text-tiny font-semibold uppercase tracking-wider text-text-faint">
                {describeState(invite)}
              </p>

              {rowError[invite.id] && (
                <p className="mt-2 text-small text-error">{rowError[invite.id]}</p>
              )}

              <div className="mt-3 flex flex-col gap-2">
                <CopyLinkButton url={invite.url} label="Copiar link de reseña" />
                {invite.email && invite.reviewStatus === null && (
                  <button
                    type="button"
                    disabled={rowBusy === invite.id}
                    onClick={() => emailRow(invite)}
                    className="h-11 w-full rounded-pill border-2 border-border-strong text-small font-semibold text-text transition-colors hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {rowBusy === invite.id
                      ? "Enviando…"
                      : invite.emailedAt
                        ? "Volver a enviar por correo"
                        : "Enviar por correo"}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
