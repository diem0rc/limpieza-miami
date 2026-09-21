import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ROUTES } from "@/lib/routes";
import BrandMark from "@/components/BrandMark";
import Container from "@/components/ui/Container";
import { ButtonLink } from "@/components/ui/Button";
import { Link } from "@/i18n/navigation";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "booking.confirmation" });
  // No queremos que una página sin contenido propio acabe indexada.
  return { title: t("title"), robots: { index: false, follow: false } };
}

/**
 * No cobra nada, así que no hay nada que verificar contra Stripe aquí — a
 * diferencia del flujo de depósito anterior, no se llega a esta página por
 * una vuelta desde una pasarela de pago, sino por una navegación normal justo
 * después de que `/api/bookings` confirma el registro. Por eso es estática,
 * sin `searchParams`: no hay datos de la reserva que mostrar sin exponerlos
 * en la URL, y el pago real llega después por un link aparte.
 */
export default async function ConfirmationPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "booking.confirmation" });

  return (
    <div className="flex min-h-[100dvh] flex-col">
      <header className="border-b border-border">
        <Container className="flex h-16 items-center">
          <Link href={ROUTES.home}>
            <BrandMark />
          </Link>
        </Container>
      </header>

      <Container className="flex flex-1 flex-col justify-center py-14">
        <div className="mx-auto w-full max-w-lg">
          <span
            aria-hidden
            className="grid h-14 w-14 place-items-center rounded-pill border-2 border-accent text-accent"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-7 w-7"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 13l4 4L19 7" />
            </svg>
          </span>

          <h1 className="mt-6 text-h1 font-black leading-tight tracking-tight">
            {t("title")}
          </h1>

          <p className="mt-3 text-body leading-relaxed text-text-muted">
            {t("subtitle")}
          </p>

          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href={ROUTES.home}>{t("backHome")}</ButtonLink>
            <ButtonLink href={ROUTES.booking} variant="secondary">
              {t("newBooking")}
            </ButtonLink>
          </div>
        </div>
      </Container>
    </div>
  );
}
