"use client";

import { useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { StepId } from "@/config/pricing";
import { FLOW_RULES } from "@/config/pricing.config";
import { formatDateLong, formatHour, formatMoney, parseDateKey } from "@/lib/format";
import { useBooking } from "@/components/booking/store";
import { useRouter } from "@/i18n/navigation";
import { ROUTES } from "@/lib/routes";
import StepShell from "@/components/booking/StepShell";

/** Códigos que el servidor puede devolver y para los que hay mensaje propio. */
const KNOWN_ERRORS = [
  "notConfigured",
  "invalidSelection",
  "invalidSchedule",
  "invalidContact",
  "dbError",
  "network",
];

export default function PaymentStep() {
  const t = useTranslations("booking.payment");
  const tSizes = useTranslations("sizeTiers");
  const tSqft = useTranslations("sqftTiers");
  const tServices = useTranslations("services.items");
  const tLevel = useTranslations("booking.level");
  const tPets = useTranslations("booking.pets");
  const tAddons = useTranslations("addons");
  const locale = useLocale();
  const router = useRouter();
  const { state, price, dispatch } = useBooking();

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // `submitting` deshabilita el botón, pero no sirve como cerrojo: setState
  // de React no es síncrono, así que dos toques en el mismo ciclo encuentran
  // el botón todavía habilitado y disparan dos reservas (verificado: dos
  // POST /api/bookings seguidas, ambas 200). Este ref sí cambia en el acto.
  const enviando = useRef(false);

  async function confirmBooking() {
    if (enviando.current) return;
    enviando.current = true;
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Se manda la selección, no el precio: el servidor lo recalcula.
        body: JSON.stringify({
          locale,
          serviceType: state.serviceType,
          sizeTier: state.sizeTier,
          sqftTier: state.sqftTier,
          cleaningLevel: state.cleaningLevel,
          pets: state.pets,
          addons: state.addons,
          frequency: state.frequency,
          bedrooms: state.bedrooms,
          fullBaths: state.fullBaths,
          halfBaths: state.halfBaths,
          date: state.date,
          time: state.time,
          contact: state.contact,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) {
        setError(typeof data.error === "string" ? data.error : "dbError");
        setSubmitting(false);
        enviando.current = false; // falló: tiene que poder reintentar
        return;
      }

      // No se reinicia `submitting`: la pantalla cambia a la confirmación,
      // no tiene sentido volver a habilitar el botón mientras eso ocurre.
      router.push(ROUTES.bookingConfirmation);
    } catch {
      setError("network");
      setSubmitting(false);
      enviando.current = false; // se cayó la red: tiene que poder reintentar
    }
  }

  if (!state.serviceType || !price) return null;

  const money = (n: number) => formatMoney(n, locale);

  const when =
    state.date && state.time
      ? `${formatDateLong(parseDateKey(state.date), locale)} · ${formatHour(
          Number(state.time.slice(0, 2)),
          locale,
        )}`
      : "—";

  const summary: { label: string; value: string; step: StepId }[] = [
    {
      label: t("service"),
      value: tServices(`${state.serviceType}.name`),
      step: "service",
    },
    {
      label: t("size"),
      value: state.sizeTier
        ? tSizes(state.sizeTier)
        : state.sqftTier
          ? tSqft(state.sqftTier)
          : "—",
      step: "size",
    },
  ];

  if (state.cleaningLevel) {
    summary.push({
      label: t("level"),
      value: tLevel(`${state.cleaningLevel}.name`),
      step: "level",
    });
  }

  if (FLOW_RULES.asksRoomCounts.includes(state.serviceType)) {
    summary.push({
      label: t("rooms"),
      value: t("roomsValue", {
        bedrooms: state.bedrooms,
        fullBaths: state.fullBaths,
        halfBaths: state.halfBaths,
      }),
      step: "rooms",
    });
  }

  if (state.pets) {
    summary.push({
      label: t("pets"),
      value: tPets(state.pets),
      step: "pets",
    });
  }

  summary.push(
    { label: t("when"), value: when, step: "schedule" },
    { label: t("where"), value: state.contact.address || "—", step: "contact" },
    {
      label: t("who"),
      value: [state.contact.name, state.contact.phone]
        .filter(Boolean)
        .join(" · "),
      step: "contact",
    },
  );

  return (
    <StepShell title={t("title")} subtitle={t("subtitle")} role="group">
      {/* Resumen del servicio */}
      <section className="rounded-lg border-2 border-border bg-surface p-5">
        <h2 className="text-tiny font-semibold uppercase tracking-wider text-text-faint">
          {t("detailsTitle")}
        </h2>
        <dl className="mt-4 flex flex-col gap-3">
          {summary.map(({ label, value, step }) => (
            <div key={label} className="flex items-baseline justify-between gap-4">
              <dt className="shrink-0 text-small text-text-muted">{label}</dt>
              <dd className="flex min-w-0 items-baseline gap-3 text-right">
                <span className="min-w-0 break-words text-small font-medium text-text">
                  {value}
                </span>
                <button
                  type="button"
                  onClick={() => dispatch({ type: "goToStep", value: step })}
                  className="shrink-0 text-tiny font-semibold text-accent hover:text-accent-soft"
                >
                  {t("editStep")}
                </button>
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Desglose de precio */}
      <section className="rounded-lg border-2 border-border bg-surface p-5">
        <h2 className="text-tiny font-semibold uppercase tracking-wider text-text-faint">
          {t("breakdownTitle")}
        </h2>

        <dl className="mt-4 flex flex-col gap-3">
          <Row label={t("base")} value={money(price.basePrice)} />

          {price.petSurcharge > 0 && (
            <Row
              label={t("petSurcharge")}
              value={`+ ${money(price.petSurcharge)}`}
            />
          )}

          {price.addonDetail.map((addon) => (
            <Row
              key={addon.id}
              label={tAddons(`${addon.id}.name`)}
              value={`+ ${money(addon.price)}`}
            />
          ))}

          <div className="border-t border-border pt-3">
            <Row label={t("subtotal")} value={money(price.subtotal)} />
          </div>

          {price.discountAmount > 0 && (
            <Row
              label={t("discount", {
                percent: Math.round(price.discountRate * 100),
              })}
              value={`− ${money(price.discountAmount)}`}
              accent
            />
          )}
        </dl>

        {price.minimumApplied && (
          <p className="mt-4 rounded-md bg-bg-alt px-4 py-3 text-small text-text-muted">
            {t("minimumNote", { amount: money(price.total) })}
          </p>
        )}

        <div className="mt-5 flex items-baseline justify-between border-t border-border pt-5">
          <span className="text-h3 font-semibold">{t("total")}</span>
          <span className="text-h2 font-black tabular-nums text-accent">
            {money(price.total)}
          </span>
        </div>
      </section>

      {error && (
        <p
          role="alert"
          className="rounded-md border-2 border-error/40 bg-error/10 px-4 py-3 text-small text-error"
        >
          {t(`errors.${KNOWN_ERRORS.includes(error) ? error : "dbError"}`)}
        </p>
      )}

      <button
        type="button"
        onClick={confirmBooking}
        disabled={submitting}
        className="mt-2 h-[var(--brand-button-height)] w-full rounded-pill bg-accent text-body font-semibold text-on-accent transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-45"
      >
        {submitting ? t("submitting") : t("confirm")}
      </button>
      <p className="text-center text-small text-text-faint">
        {t("paymentNotice")}
      </p>
    </StepShell>
  );
}

function Row({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-small text-text-muted">{label}</dt>
      <dd
        className={`shrink-0 text-small font-medium tabular-nums ${
          accent ? "text-accent" : "text-text"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
