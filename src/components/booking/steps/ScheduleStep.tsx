"use client";

import { useEffect, useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { BOOKING_POLICY } from "@/config/pricing.config";
import { dateKey, formatHour } from "@/lib/format";
import { useClientNow } from "@/lib/useClientNow";
import { useBooking } from "@/components/booking/store";
import StepShell from "@/components/booking/StepShell";

const DAYS_AHEAD = 21;
const HOUR_MS = 60 * 60 * 1000;

const slotValue = (hour: number) => `${String(hour).padStart(2, "0")}:00`;

export default function ScheduleStep() {
  const t = useTranslations("booking.schedule");
  const locale = useLocale();
  const { state, dispatch } = useBooking();

  // `null` en el servidor y en el primer render del cliente.
  const now = useClientNow();
  const { operatingHours, minimumNoticeHours } = BOOKING_POLICY;

  const hours = useMemo(() => {
    const out: number[] = [];
    for (let h = operatingHours.start; h < operatingHours.end; h++) out.push(h);
    return out;
  }, [operatingHours.start, operatingHours.end]);

  const days = useMemo(() => {
    if (now === null) return [];
    const base = new Date(now);
    base.setHours(0, 0, 0, 0);
    return Array.from({ length: DAYS_AHEAD }, (_, i) => {
      const day = new Date(base);
      day.setDate(base.getDate() + i);
      return day;
    });
  }, [now]);

  /**
   * Huecos por día, ya filtrados por el margen mínimo de anticipación que fija
   * BOOKING_POLICY. Subir `minimumNoticeHours` bloquea más horarios sin tocar
   * este componente.
   */
  const availability = useMemo(() => {
    const map = new Map<string, Set<string>>();
    if (now === null) return map;

    const earliest = now + minimumNoticeHours * HOUR_MS;
    for (const day of days) {
      const open = new Set<string>();
      for (const hour of hours) {
        const slot = new Date(day);
        slot.setHours(hour, 0, 0, 0);
        if (slot.getTime() >= earliest) open.add(slotValue(hour));
      }
      map.set(dateKey(day), open);
    }
    return map;
  }, [now, days, hours, minimumNoticeHours]);

  const firstAvailable = useMemo(() => {
    for (const day of days) {
      const key = dateKey(day);
      if ((availability.get(key)?.size ?? 0) > 0) return key;
    }
    return null;
  }, [days, availability]);

  // Preseleccionar el primer día con hueco: en móvil ahorra un toque.
  useEffect(() => {
    if (!firstAvailable || state.date) return;
    dispatch({ type: "setDate", value: firstAvailable });
  }, [firstAvailable, state.date, dispatch]);

  const openSlots = state.date ? availability.get(state.date) : undefined;

  const dayLabel = (day: Date, index: number) => {
    if (index === 0) return t("today");
    if (index === 1) return t("tomorrow");
    return new Intl.DateTimeFormat(locale === "es" ? "es-US" : "en-US", {
      weekday: "short",
    }).format(day);
  };

  return (
    <StepShell
      title={t("title")}
      subtitle={t("subtitle", {
        start: formatHour(operatingHours.start, locale),
        end: formatHour(operatingHours.end, locale),
      })}
      role="group"
    >
      {now === null ? (
        <p className="text-body text-text-muted">{t("loading")}</p>
      ) : (
        <>
          {/* Días */}
          <h2 className="text-tiny font-semibold uppercase tracking-wider text-text-faint">
            {t("dateLabel")}
          </h2>
          <div
            role="radiogroup"
            aria-label={t("dateLabel")}
            className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-2"
          >
            {days.map((day, index) => {
              const key = dateKey(day);
              const enabled = (availability.get(key)?.size ?? 0) > 0;
              const selected = state.date === key;
              return (
                <button
                  key={key}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  disabled={!enabled}
                  onClick={() => dispatch({ type: "setDate", value: key })}
                  className={`flex w-16 shrink-0 flex-col items-center gap-1 rounded-lg border-2 py-3 transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${
                    selected
                      ? "border-accent bg-surface-hover"
                      : "border-border bg-surface hover:border-border-strong"
                  }`}
                >
                  <span className="text-tiny uppercase text-text-muted">
                    {dayLabel(day, index)}
                  </span>
                  <span className="text-h3 font-bold tabular-nums text-text">
                    {day.getDate()}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Horas */}
          <h2 className="mt-6 text-tiny font-semibold uppercase tracking-wider text-text-faint">
            {t("timeLabel")}
          </h2>

          {openSlots && openSlots.size === 0 ? (
            <p className="text-body text-text-muted">{t("noSlots")}</p>
          ) : (
            <div
              role="radiogroup"
              aria-label={t("timeLabel")}
              className="grid grid-cols-3 gap-2 sm:grid-cols-4"
            >
              {hours.map((hour) => {
                const value = slotValue(hour);
                const enabled = openSlots?.has(value) ?? false;
                const selected = state.time === value;
                return (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    disabled={!enabled}
                    onClick={() => dispatch({ type: "setTime", value })}
                    className={`rounded-md border-2 py-3 text-small font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${
                      selected
                        ? "border-accent bg-surface-hover text-text"
                        : "border-border bg-surface text-text-muted hover:border-border-strong hover:text-text"
                    }`}
                  >
                    {formatHour(hour, locale)}
                  </button>
                );
              })}
            </div>
          )}

          <p className="mt-4 text-small text-text-faint">
            {t("noticeNote", { hours: minimumNoticeHours })}
          </p>
        </>
      )}
    </StepShell>
  );
}
