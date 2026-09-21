"use client";

import { useLocale, useTranslations } from "next-intl";
import { FREQUENCY_DISCOUNT } from "@/config/pricing.config";
import { calculatePrice } from "@/config/pricing";
import { FREQUENCIES } from "@/lib/booking-options";
import { formatMoney } from "@/lib/format";
import { selectionOf, useBooking } from "@/components/booking/store";
import OptionCard from "@/components/booking/OptionCard";
import StepShell from "@/components/booking/StepShell";

export default function FrequencyStep() {
  const t = useTranslations("booking.frequency");
  const locale = useLocale();
  const { state, dispatch } = useBooking();

  // Con todo lo demás ya elegido (tamaño, nivel, mascotas, adicionales), el
  // único campo que cambia por tarjeta es la frecuencia — se recalcula con
  // calculatePrice() para cada una, nunca a mano: es el mismo precio real
  // que vería el motor si esa fuera la opción elegida, ni un centavo de
  // diferencia con lo que se cobra después.
  const baseSelection = selectionOf(state);
  const money = (n: number) => formatMoney(n, locale);

  return (
    <StepShell title={t("title")} subtitle={t("subtitle")} role="radiogroup">
      {FREQUENCIES.map((option) => {
        const rate = FREQUENCY_DISCOUNT[option];
        const optionPrice = baseSelection
          ? calculatePrice({ ...baseSelection, frequency: option })
          : null;

        return (
          <OptionCard
            key={option}
            selected={state.frequency === option}
            onSelect={() => dispatch({ type: "setFrequency", value: option })}
            title={t(option)}
            description={option === "weekly" ? t("weeklyNote") : undefined}
            meta={
              rate > 0
                ? t("discount", { percent: Math.round(rate * 100) })
                : t("noDiscount")
            }
            metaMuted={rate === 0}
          >
            {optionPrice && (
              <span className="mt-2 flex items-baseline gap-2 tabular-nums">
                {/* Tachar solo si de verdad se paga menos que el subtotal —
                    el mínimo global puede absorber el descuento entero en
                    trabajos pequeños, y tachar un precio igual o mayor al
                    real se leería al revés. */}
                {optionPrice.total < optionPrice.subtotal && (
                  <span className="text-small text-text-faint line-through">
                    {money(optionPrice.subtotal)}
                  </span>
                )}
                <span className="text-body font-bold text-accent">
                  {money(optionPrice.total)}
                </span>
              </span>
            )}
          </OptionCard>
        );
      })}
    </StepShell>
  );
}
