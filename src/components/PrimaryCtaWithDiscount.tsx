import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ROUTES } from "@/lib/routes";

/**
 * El CTA principal del hero con la insignia de descuento pegada a su esquina,
 * fusionados en un solo enlace — no un botón y una insignia sueltos al lado.
 * Clickear la insignia lleva a lo mismo que el botón (reservar): al estar
 * anidada dentro del mismo `<Link>`, cualquier punto del conjunto, insignia
 * incluida, dispara la misma navegación.
 *
 * El rojo (`discount`/`onDiscount`) es el mismo token puntual que ya usaba la
 * insignia suelta — ver brand.config.ts. Quitar la promo es borrar esas dos
 * líneas y este componente, no rediseñar el hero.
 */
export default function PrimaryCtaWithDiscount() {
  const t = useTranslations("home");

  return (
    <Link
      href={ROUTES.booking}
      className="relative inline-flex h-[var(--brand-button-height)] items-center justify-center rounded-pill bg-accent px-6 text-body font-semibold text-on-accent transition-colors duration-150 select-none hover:bg-accent-hover active:bg-accent-hover"
    >
      {t("ctaPrimary")}

      <span
        className="absolute -top-3 -right-3 inline-flex items-center gap-1 rounded-pill border-2 border-bg bg-discount px-2.5 py-1 text-tiny font-bold text-on-discount shadow-sm"
        aria-hidden
      >
        <DiscountTagIcon />
        {t("discountBadgeShort")}
      </span>
      {/* La insignia lleva el precio completo para quien usa lector de
          pantalla — visualmente arriba solo se ve "-20%". */}
      <span className="sr-only"> — {t("discountBadge")}</span>
    </Link>
  );
}

function DiscountTagIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-3 w-3 shrink-0" aria-hidden>
      <path
        fill="currentColor"
        d="M2 3.5A1.5 1.5 0 0 1 3.5 2h5.086a1.5 1.5 0 0 1 1.06.44l7.415 7.414a2 2 0 0 1 0 2.829l-5.379 5.379a2 2 0 0 1-2.828 0L1.44 10.647A1.5 1.5 0 0 1 1 9.586V3.5Z"
      />
      <circle cx="6" cy="6" r="1.3" fill="var(--brand-discount)" />
    </svg>
  );
}
