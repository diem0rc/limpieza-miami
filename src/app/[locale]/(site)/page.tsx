import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { SERVICE_TYPES } from "@/lib/booking-options";
import { ROUTES } from "@/lib/routes";
import Container from "@/components/ui/Container";
import { ButtonLink } from "@/components/ui/Button";
import IntroAnimation from "@/components/IntroAnimation";
import CleaningScrollVideo from "@/components/CleaningScrollVideo";

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <Home />;
}

function Home() {
  const t = useTranslations("home");
  const tServices = useTranslations("services");

  return (
    <>
      {/* Solo se ve la primera vez (localStorage) — cubre esta misma página
          9.6s y se retira sola; no reemplaza nada de lo de abajo. */}
      <IntroAnimation />

      {/* Hero — el video de fondo con scroll-scrubbing, con el título, el
          subtítulo y los botones de reservar superpuestos. Ver
          CleaningScrollVideo.tsx: ya no hay un <section> de Hero aparte. */}
      <CleaningScrollVideo />

      {/* Confianza */}
      <section className="bg-bg-alt">
        <Container className="py-16">
          <h2 className="text-h2 font-bold tracking-tight">
            {t("trustTitle")}
          </h2>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {(["price", "booking", "insured"] as const).map((key) => (
              <div
                key={key}
                className="rounded-lg border border-border bg-surface p-6"
              >
                <h3 className="text-h3 font-semibold">
                  {t(`trust.${key}Title`)}
                </h3>
                <p className="mt-2 text-small leading-relaxed text-text-muted">
                  {t(`trust.${key}Body`)}
                </p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* Servicios */}
      <section>
        <Container className="py-16">
          <h2 className="text-h2 font-bold tracking-tight">
            {t("servicesTitle")}
          </h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {SERVICE_TYPES.map((id) => (
              <Link
                key={id}
                href={ROUTES.services}
                className="group rounded-lg border border-border bg-surface p-6 transition-colors hover:border-border-strong hover:bg-surface-hover"
              >
                <p className="text-tiny font-semibold uppercase tracking-wider text-accent">
                  {tServices(`items.${id}.short`)}
                </p>
                <h3 className="mt-2 text-h3 font-semibold">
                  {tServices(`items.${id}.name`)}
                </h3>
              </Link>
            ))}
          </div>
          <Link
            href={ROUTES.services}
            className="mt-8 inline-block text-small font-semibold text-accent hover:text-accent-soft"
          >
            {t("servicesLink")} →
          </Link>
        </Container>
      </section>

      {/* Cómo funciona */}
      <section className="bg-bg-alt">
        <Container className="py-16">
          <h2 className="text-h2 font-bold tracking-tight">{t("howTitle")}</h2>
          <ol className="mt-8 grid gap-8 md:grid-cols-3">
            {([1, 2, 3] as const).map((n) => (
              <li key={n}>
                <span className="grid h-10 w-10 place-items-center rounded-pill bg-accent text-body font-bold text-on-accent">
                  {n}
                </span>
                <h3 className="mt-4 text-h3 font-semibold">
                  {t(`how.step${n}Title`)}
                </h3>
                <p className="mt-2 text-small leading-relaxed text-text-muted">
                  {t(`how.step${n}Body`)}
                </p>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      {/* CTA final */}
      <section>
        <Container className="py-20">
          <div className="rounded-lg border border-border-strong bg-surface p-10 text-center">
            <h2 className="text-h2 font-bold tracking-tight">
              {t("finalCtaTitle")}
            </h2>
            <p className="mx-auto mt-3 max-w-md text-body text-text-muted">
              {t("finalCtaBody")}
            </p>
            <div className="mt-8 flex justify-center">
              <ButtonLink href={ROUTES.booking}>
                {t("finalCtaButton")}
              </ButtonLink>
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}
