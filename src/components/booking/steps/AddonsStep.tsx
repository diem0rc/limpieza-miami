"use client";

import { useLocale, useTranslations } from "next-intl";
import { getAvailableAddons } from "@/config/pricing";
import { formatMoney } from "@/lib/format";
import { useBooking } from "@/components/booking/store";
import OptionCard from "@/components/booking/OptionCard";
import StepShell from "@/components/booking/StepShell";

export default function AddonsStep() {
  const t = useTranslations("booking.addons");
  const tAddons = useTranslations("addons");
  const locale = useLocale();
  const { state, dispatch } = useBooking();

  if (!state.serviceType) return null;

  // Qué adicionales existen para este servicio lo decide el motor.
  const available = getAvailableAddons(state.serviceType);
  const hasExclusive = available.some((a) => a.exclusiveGroup);

  return (
    <StepShell title={t("title")} subtitle={t("subtitle")} role="group">
      {available.map((addon) => (
        <OptionCard
          key={addon.id}
          multi
          selected={state.addons.includes(addon.id)}
          onSelect={() => dispatch({ type: "toggleAddon", value: addon.id })}
          title={tAddons(`${addon.id}.name`)}
          description={tAddons(`${addon.id}.description`)}
          meta={formatMoney(addon.price, locale)}
        />
      ))}

      {hasExclusive && (
        <p className="mt-1 text-small text-text-faint">{t("exclusiveNote")}</p>
      )}
    </StepShell>
  );
}
