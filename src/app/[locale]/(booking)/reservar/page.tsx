import type { Metadata } from "next";
import { Suspense } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import BookingFlow from "@/components/booking/BookingFlow";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "booking" });
  return { title: t("title") };
}

export default async function BookingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  // BookingFlow lee `?servicio=` con useSearchParams(), que exige un límite
  // de Suspense por encima para que la ruta pueda seguir siendo SSG (ver
  // CLAUDE.md, "Cómo verificar un cambio": todas las páginas deben quedar
  // estáticas salvo /api/* y /reservar/confirmacion).
  return (
    <Suspense>
      <BookingFlow />
    </Suspense>
  );
}
