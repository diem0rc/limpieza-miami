import { useLocale, useTranslations } from "next-intl";
import { BRAND } from "@/config/brand.config";
import { Link } from "@/i18n/navigation";
import { LEGAL_NAV, MAIN_NAV } from "@/lib/routes";
import BrandMark from "@/components/BrandMark";
import Container from "@/components/ui/Container";
import type { Locale } from "@/i18n/routing";

export default function Footer() {
  const t = useTranslations("footer");
  const tNav = useTranslations("nav");
  const tContact = useTranslations("contact");
  const locale = useLocale() as Locale;

  return (
    <footer className="mt-24 border-t border-border bg-bg-alt">
      <Container className="py-12">
        <div className="grid gap-10 sm:grid-cols-2 md:grid-cols-4">
          <div className="md:col-span-2">
            <BrandMark />
            <p className="mt-3 max-w-xs text-small text-text-muted">
              {BRAND.tagline[locale]}
            </p>
          </div>

          <div>
            <h2 className="text-tiny font-semibold uppercase tracking-wider text-text-faint">
              {t("navTitle")}
            </h2>
            <ul className="mt-4 flex flex-col gap-2.5">
              {MAIN_NAV.map(({ href, key }) => (
                <li key={href}>
                  <Link
                    href={href}
                    className="text-small text-text-muted transition-colors hover:text-text"
                  >
                    {tNav(key)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="text-tiny font-semibold uppercase tracking-wider text-text-faint">
              {t("contactTitle")}
            </h2>
            <ul className="mt-4 flex flex-col gap-2.5 text-small text-text-muted">
              <li>{BRAND.city}</li>
              <li>{BRAND.phone || tContact("pendingValue")}</li>
              <li>{BRAND.email || tContact("pendingValue")}</li>
              {LEGAL_NAV.map(({ href, key }) => (
                <li key={href}>
                  <Link
                    href={href}
                    className="transition-colors hover:text-text"
                  >
                    {tNav(key)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <p className="mt-12 border-t border-border pt-6 text-tiny text-text-faint">
          © {new Date().getFullYear()} {BRAND.name}. {t("rights")}
        </p>
      </Container>
    </footer>
  );
}
