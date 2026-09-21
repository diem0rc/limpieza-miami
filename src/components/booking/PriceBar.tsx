"use client";

import { useLocale, useTranslations } from "next-intl";
import { formatMoney } from "@/lib/format";
import { useBooking } from "@/components/booking/store";
import Container from "@/components/ui/Container";

/**
 * Barra fija inferior: estimado en vivo + navegación. El estimado aparece
 * desde el paso 2, cuando ya hay un servicio elegido y el número significa
 * algo.
 */
export default function PriceBar({
  onNext,
  onBack,
  nextDisabled,
}: {
  onNext: () => void;
  onBack: () => void;
  nextDisabled: boolean;
}) {
  const t = useTranslations("booking");
  const locale = useLocale();
  const { price, showPrice, isFirst, isLast } = useBooking();

  return (
    <div className="sticky bottom-0 z-40 border-t border-border bg-bg/95 backdrop-blur-md">
      <Container className="py-4">
        {showPrice && price && (
          <div className="mb-3 flex items-baseline justify-between gap-4">
            <span className="text-small text-text-muted">{t("estimate")}</span>
            <span
              aria-live="polite"
              className="text-h2 font-black tabular-nums text-accent"
            >
              {formatMoney(price.total, locale)}
            </span>
          </div>
        )}

        <div className="flex gap-3">
          {!isFirst && (
            <button
              type="button"
              onClick={onBack}
              className="h-[var(--brand-button-height)] shrink-0 rounded-pill border border-border-strong bg-surface px-6 text-body font-semibold text-text transition-colors hover:bg-surface-hover"
            >
              {t("back")}
            </button>
          )}

          {!isLast && (
            <button
              type="button"
              onClick={onNext}
              disabled={nextDisabled}
              className="h-[var(--brand-button-height)] flex-1 rounded-pill bg-accent text-body font-semibold text-on-accent transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-45"
            >
              {t("next")}
            </button>
          )}
        </div>
      </Container>
    </div>
  );
}
