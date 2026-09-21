import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import AdminBookingsView from "@/components/admin/AdminBookingsView";

// Defensa adicional: aunque hoy todo el sitio ya es noindex (ALLOW_INDEXING
// en src/lib/seo.ts), esta ruta debe seguir fuera del índice el día que la
// marca real se publique y el resto del sitio pase a indexable.
export const metadata: Metadata = {
  title: "Acceso interno",
  robots: { index: false, follow: false },
};

export default async function AdminReservasPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <AdminBookingsView />;
}
