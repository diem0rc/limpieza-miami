import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Geist } from "next/font/google";
import { notFound } from "next/navigation";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { BRAND } from "@/config/brand.config";
import { routing, type Locale } from "@/i18n/routing";
import { brandCssVariables } from "@/lib/brand-css";
import { ALLOW_INDEXING, SITE_URL } from "@/lib/seo";
import "../globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const lang: Locale = hasLocale(routing.locales, locale)
    ? locale
    : routing.defaultLocale;

  return {
    title: {
      default: `${BRAND.name} — ${BRAND.tagline[lang]}`,
      template: `%s · ${BRAND.name}`,
    },
    description: BRAND.tagline[lang],
    // Base para resolver las URLs relativas de los metadatos.
    metadataBase: new URL(SITE_URL),
    // `"./"` se resuelve contra la ruta de CADA página, así que una sola
    // línea acá produce un canonical distinto en cada una (verificado
    // comparando /es, /es/precios y /en/precios: los tres distintos).
    //
    // Para qué sirve acá: limpieza-miami.vercel.app sirve el mismo sitio en
    // paralelo al dominio propio. Al ser el canonical una URL absoluta hacia
    // www.dibasiliomaid.com, esa copia deja de competir como contenido
    // duplicado y la autoridad queda en un solo lado.
    alternates: { canonical: "./" },
    // El `noindex` es lo que de verdad mantiene el sitio fuera de Google
    // mientras la marca esté en placeholder; robots.txt solo pide que no lo
    // rastreen. Se hereda en todas las páginas. Ver src/lib/seo.ts.
    robots: { index: ALLOW_INDEXING, follow: ALLOW_INDEXING },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);

  return (
    <html
      lang={locale}
      className={`${geistSans.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col bg-bg text-text">
        {/*
          Tokens de marca inyectados desde brand.config.ts. React los eleva al
          <head> gracias a `precedence`, así que se aplican antes del primer
          pintado y no hay parpadeo de color.
        */}
        <style
          precedence="default"
          href="brand-tokens"
        >{`:root{${brandCssVariables()}}`}</style>

        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
