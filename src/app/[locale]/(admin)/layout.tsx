import type { ReactNode } from "react";
import { setRequestLocale } from "next-intl/server";

/**
 * Herramienta interna, sin header ni footer del sitio. Vive bajo `[locale]`
 * porque el proyecto no tiene un layout raíz fuera de ahí (ver CLAUDE.md);
 * la protección real es el secreto de `src/lib/admin-auth.ts` en
 * `/api/admin/*`, no la falta de header.
 */
export default async function AdminLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <main className="flex flex-1 flex-col">{children}</main>;
}
