"use client";

import { useTranslations } from "next-intl";
import { SERVICE_TYPES } from "@/lib/booking-options";
import { useBooking } from "@/components/booking/store";
import OptionCard from "@/components/booking/OptionCard";
import StepShell from "@/components/booking/StepShell";

export default function ServiceStep() {
  const t = useTranslations("booking.service");
  const tServices = useTranslations("services.items");
  const { state, dispatch } = useBooking();

  return (
    <StepShell title={t("title")} subtitle={t("subtitle")} role="radiogroup">
      {SERVICE_TYPES.map((id) => (
        <OptionCard
          key={id}
          selected={state.serviceType === id}
          onSelect={() => dispatch({ type: "setService", value: id })}
          title={tServices(`${id}.name`)}
          description={tServices(`${id}.description`)}
        />
      ))}
    </StepShell>
  );
}
