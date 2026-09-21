"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

/**
 * Cambia de idioma conservando la ruta actual: desde `/es/precios` lleva a
 * `/en/precios`.
 */
export default function LocaleSwitcher() {
  const t = useTranslations("nav");
  const active = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div
      role="group"
      aria-label={t("language")}
      className="inline-flex items-center rounded-pill border border-border bg-surface p-0.5"
    >
      {routing.locales.map((locale) => {
        const isActive = locale === active;
        return (
          <button
            key={locale}
            type="button"
            lang={locale}
            aria-current={isActive ? "true" : undefined}
            onClick={() => router.replace(pathname, { locale })}
            className={`rounded-pill px-3 py-1 text-tiny font-semibold uppercase transition-colors ${
              isActive
                ? "bg-accent text-on-accent"
                : "text-text-muted hover:text-text"
            }`}
          >
            {locale}
          </button>
        );
      })}
    </div>
  );
}
