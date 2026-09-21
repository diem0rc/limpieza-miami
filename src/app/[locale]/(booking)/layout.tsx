import type { ReactNode } from "react";
import { setRequestLocale } from "next-intl/server";

/**
 * El configurador va sin header ni footer del sitio: es un flujo de pantalla
 * completa y la barra fija de precio necesita el borde inferior para ella sola.
 * Su propia cabecera mínima vive dentro de BookingFlow.
 */
export default async function BookingLayout({
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
