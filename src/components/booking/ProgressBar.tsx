"use client";

import { useTranslations } from "next-intl";
import { useBooking } from "@/components/booking/store";

export default function ProgressBar() {
  const t = useTranslations("booking");
  const { stepNumber, totalSteps, totalKnown } = useBooking();

  // Hasta elegir servicio no se sabe cuántos pasos hay, así que no se inventa
  // un total: se muestra solo "Paso 1" y una barra mínima.
  const percent = totalKnown ? (stepNumber / totalSteps) * 100 : 6;

  return (
    <div>
      <div
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={totalKnown ? totalSteps : undefined}
        aria-valuenow={stepNumber}
        aria-label={
          totalKnown
            ? t("progress", { current: stepNumber, total: totalSteps })
            : t("progressStart")
        }
        className="h-1.5 w-full overflow-hidden rounded-pill bg-surface"
      >
        <div
          className="h-full rounded-pill bg-accent transition-[width] duration-300 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>

      <p className="mt-2.5 text-tiny font-semibold uppercase tracking-wider text-text-faint">
        {totalKnown
          ? t("progress", { current: stepNumber, total: totalSteps })
          : t("progressStart")}
      </p>
    </div>
  );
}
