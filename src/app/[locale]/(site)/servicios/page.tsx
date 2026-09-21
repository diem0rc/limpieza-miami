import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SERVICE_TYPES } from "@/lib/booking-options";
import { ROUTES } from "@/lib/routes";
import Container from "@/components/ui/Container";
import { ButtonLink } from "@/components/ui/Button";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "services" });
  return { title: t("title"), description: t("intro") };
}

export default async function ServicesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <Services />;
}

function Services() {
  const t = useTranslations("services");

  return (
    <Container className="py-16">
      <h1 className="text-h1 font-black tracking-tight">{t("title")}</h1>
      <p className="mt-4 max-w-2xl text-body leading-relaxed text-text-muted">
        {t("intro")}
      </p>

      <div className="mt-12 grid gap-4 md:grid-cols-2">
        {SERVICE_TYPES.map((id) => (
          <article
            key={id}
            className="rounded-lg border border-border bg-surface p-7"
          >
            <p className="text-tiny font-semibold uppercase tracking-wider text-accent">
              {t(`items.${id}.short`)}
            </p>
            <h2 className="mt-2 text-h3 font-semibold">
              {t(`items.${id}.name`)}
            </h2>
            <p className="mt-3 text-small leading-relaxed text-text-muted">
              {t(`items.${id}.description`)}
            </p>
          </article>
        ))}
      </div>

      <div className="mt-12">
        <ButtonLink href={ROUTES.booking}>{t("cta")}</ButtonLink>
      </div>
    </Container>
  );
}
