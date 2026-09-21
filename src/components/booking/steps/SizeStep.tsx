"use client";

import { useTranslations } from "next-intl";
import { FLOW_RULES } from "@/config/pricing.config";
import { SIZE_TIERS, SQFT_TIERS } from "@/lib/booking-options";
import { useBooking } from "@/components/booking/store";
import OptionCard from "@/components/booking/OptionCard";
import StepShell from "@/components/booking/StepShell";

export default function SizeStep() {
  const t = useTranslations("booking.size");
  const tSizes = useTranslations("sizeTiers");
  const tSqft = useTranslations("sqftTiers");
  const { state, dispatch } = useBooking();

  // Qué escala usar la decide FLOW_RULES, no la UI.
  const usesBedrooms =
    !!state.serviceType &&
    FLOW_RULES.usesBedroomTiers.includes(state.serviceType);

  if (usesBedrooms) {
    return (
      <StepShell
        title={t("titleRooms")}
        subtitle={t("subtitleRooms")}
        role="radiogroup"
      >
        {SIZE_TIERS.map((tier) => (
          <OptionCard
            key={tier}
            selected={state.sizeTier === tier}
            onSelect={() => dispatch({ type: "setSizeTier", value: tier })}
            title={tSizes(tier)}
          />
        ))}
      </StepShell>
    );
  }

  return (
    <StepShell
      title={t("titleSqft")}
      subtitle={t("subtitleSqft")}
      role="radiogroup"
    >
      {SQFT_TIERS.map((tier) => (
        <OptionCard
          key={tier}
          selected={state.sqftTier === tier}
          onSelect={() => dispatch({ type: "setSqftTier", value: tier })}
          title={tSqft(tier)}
        />
      ))}
    </StepShell>
  );
}
