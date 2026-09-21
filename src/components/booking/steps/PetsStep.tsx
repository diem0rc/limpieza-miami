"use client";

import { useLocale, useTranslations } from "next-intl";
import { PET_SURCHARGE } from "@/config/pricing.config";
import { PETS_OPTIONS } from "@/lib/booking-options";
import { formatMoney } from "@/lib/format";
import { useBooking } from "@/components/booking/store";
import OptionCard from "@/components/booking/OptionCard";
import StepShell from "@/components/booking/StepShell";

export default function PetsStep() {
  const t = useTranslations("booking.pets");
  const locale = useLocale();
  const { state, dispatch } = useBooking();

  return (
    <StepShell title={t("title")} subtitle={t("subtitle")} role="radiogroup">
      {PETS_OPTIONS.map((option) => {
        const surcharge = PET_SURCHARGE[option];
        return (
          <OptionCard
            key={option}
            selected={state.pets === option}
            onSelect={() => dispatch({ type: "setPets", value: option })}
            title={t(option)}
            meta={
              surcharge > 0
                ? t("surcharge", { amount: formatMoney(surcharge, locale) })
                : t("noSurcharge")
            }
            metaMuted={surcharge === 0}
          />
        );
      })}
    </StepShell>
  );
}
