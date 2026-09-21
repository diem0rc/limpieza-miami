"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { MAIN_NAV, ROUTES } from "@/lib/routes";
import BrandMark from "@/components/BrandMark";
import LocaleSwitcher from "@/components/LocaleSwitcher";
import Container from "@/components/ui/Container";
import { ButtonLink } from "@/components/ui/Button";

export default function Header() {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-bg/85 backdrop-blur-md">
      <Container>
        {/* h-28, no el h-16 original: a pedido explícito el logo casi se
            duplicó (h-12 → h-24) y la barra creció con él para darle
            8px de aire arriba y abajo — CleaningScrollVideo.module.css
            depende de esta altura (su `top` del sticky la compensa), así
            que si esto vuelve a cambiar hay que actualizar los dos juntos. */}
        <div className="flex h-28 items-center justify-between gap-4">
          <Link href={ROUTES.home} className="shrink-0">
            <BrandMark className="!h-24" />
          </Link>

          <nav className="hidden items-center gap-7 md:flex">
            {MAIN_NAV.map(({ href, key }) => (
              <Link
                key={href}
                href={href}
                className={`text-small transition-colors ${
                  pathname === href
                    ? "text-accent"
                    : "text-text-muted hover:text-text"
                }`}
              >
                {t(key)}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <LocaleSwitcher />
            {/* El "hidden md:..." va en este div envoltorio, no en el
                propio ButtonLink: Button.tsx siempre trae un `inline-flex`
                incondicional en su clase base, y esa regla queda MÁS ABAJO
                que `.hidden` en la hoja compilada — con igual especificidad,
                gana la que aparece después, así que `hidden` nunca alcanza
                a ocultar un elemento que también trae `inline-flex` a secas.
                Poniendo el toggle en un div sin esa clase de por medio se
                evita la colisión. Bug preexistente, no de hoy — se notó al
                agrandar el logo: antes igual sobraba espacio para que
                "Reservar" se viera aun estando "oculto". */}
            <div className="hidden md:block">
              <ButtonLink href={ROUTES.booking} className="!h-10 px-5 !text-small">
                {t("book")}
              </ButtonLink>
            </div>

            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-controls="mobile-nav"
              aria-label={open ? t("closeMenu") : t("openMenu")}
              className="grid h-10 w-10 place-items-center rounded-md border border-border text-text md:hidden"
            >
              <span aria-hidden className="relative block h-3.5 w-4.5">
                <span
                  className={`absolute left-0 block h-0.5 w-full rounded-pill bg-current transition-transform duration-200 ${
                    open ? "top-1.5 rotate-45" : "top-0"
                  }`}
                />
                <span
                  className={`absolute left-0 top-1.5 block h-0.5 w-full rounded-pill bg-current transition-opacity duration-200 ${
                    open ? "opacity-0" : "opacity-100"
                  }`}
                />
                <span
                  className={`absolute left-0 block h-0.5 w-full rounded-pill bg-current transition-transform duration-200 ${
                    open ? "top-1.5 -rotate-45" : "top-3"
                  }`}
                />
              </span>
            </button>
          </div>
        </div>
      </Container>

      {open && (
        <nav
          id="mobile-nav"
          className="border-t border-border bg-bg md:hidden"
        >
          <Container className="flex flex-col gap-1 py-4">
            {MAIN_NAV.map(({ href, key }) => (
              <Link
                key={href}
                href={href}
                onClick={close}
                className={`rounded-md px-2 py-3 text-body ${
                  pathname === href
                    ? "text-accent"
                    : "text-text-muted hover:bg-surface hover:text-text"
                }`}
              >
                {t(key)}
              </Link>
            ))}
            <ButtonLink
              href={ROUTES.booking}
              full
              onClick={close}
              className="mt-3"
            >
              {t("book")}
            </ButtonLink>
          </Container>
        </nav>
      )}
    </header>
  );
}
