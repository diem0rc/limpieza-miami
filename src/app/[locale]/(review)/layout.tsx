import type { ReactNode } from "react";
import { setRequestLocale } from "next-intl/server";

/**
 * La página de reseña va sin header ni footer del sitio, igual que el
 * configurador: el cliente llega por un link directo desde un correo o desde
 * la pantalla de pago, con una sola cosa que hacer. Un menú de navegación
 * solo le daría formas de irse sin dejar la reseña.
 */
export default async function ReviewLayout({
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
