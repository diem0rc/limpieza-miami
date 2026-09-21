"use client";

import { useTranslations } from "next-intl";
import { CLEANING_LEVELS } from "@/lib/booking-options";
import { useBooking } from "@/components/booking/store";
import OptionCard from "@/components/booking/OptionCard";
import StepShell from "@/components/booking/StepShell";

export default function LevelStep() {
  const t = useTranslations("booking.level");
  const { state, dispatch } = useBooking();

  return (
    <StepShell title={t("title")} subtitle={t("subtitle")} role="radiogroup">
      {CLEANING_LEVELS.map((level) => {
        // `t.raw` porque la lista de incluidos es un array en los mensajes.
        const includes = t.raw(`${level}.includes`) as string[];

        return (
          <OptionCard
            key={level}
            selected={state.cleaningLevel === level}
            onSelect={() => dispatch({ type: "setLevel", value: level })}
            title={t(`${level}.name`)}
            description={t(`${level}.tagline`)}
          >
            <span className="mt-4 flex flex-col gap-2">
              {includes.map((item) => (
                <span
                  key={item}
                  className="flex items-start gap-2.5 text-small text-text-muted"
                >
                  <svg
                    aria-hidden
                    viewBox="0 0 16 16"
                    className="mt-1 h-3.5 w-3.5 shrink-0 text-accent"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M3 8.5l3.5 3.5L13 4.5" />
                  </svg>
                  {item}
                </span>
              ))}
            </span>
          </OptionCard>
        );
      })}
    </StepShell>
  );
}
