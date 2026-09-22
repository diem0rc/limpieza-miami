import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { ROUTES } from "@/lib/routes";
import Container from "@/components/ui/Container";
import { ButtonLink } from "@/components/ui/Button";
import IntroAnimation from "@/components/IntroAnimation";
import CleaningScrollVideo from "@/components/CleaningScrollVideo";
import TrustReasons from "@/components/TrustReasons";
import ServicesCarousel from "@/components/ServicesCarousel";

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

  return (
    <>
      {/* Solo se ve la primera vez (localStorage) — cubre esta misma página
          9.6s y se retira sola; no reemplaza nada de lo de abajo. */}
      <IntroAnimation />

      {/* Hero — el video de fondo con scroll-scrubbing, con el título, el
          subtítulo y los botones de reservar superpuestos. Ver
          CleaningScrollVideo.tsx: ya no hay un <section> de Hero aparte. */}
      <CleaningScrollVideo />

      {/* Confianza — texto tapado de polvo, una escoba lo barre con el
          scroll. Ver TrustReasons.tsx. */}
      <TrustReasons />

      {/* Servicios — carrusel, cada tarjeta enlaza directo al configurador
          con el servicio ya elegido. Ver ServicesCarousel.tsx. */}
      <ServicesCarousel />

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
