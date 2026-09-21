import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { BRAND } from "@/config/brand.config";
import { ROUTES } from "@/lib/routes";
import Container from "@/components/ui/Container";
import { ButtonLink } from "@/components/ui/Button";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "about" });
  return { title: t("title") };
}

export default async function AboutPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <About />;
}

function About() {
  const t = useTranslations("about");

  return (
    <Container className="py-16">
      <h1 className="text-h1 font-black tracking-tight">{t("title")}</h1>

      <div className="mt-8 max-w-2xl space-y-5">
        <p className="text-h3 leading-relaxed text-text">
          {t("lead", { city: BRAND.city })}
        </p>
        <p className="text-body leading-relaxed text-text-muted">{t("body1")}</p>
        <p className="text-body leading-relaxed text-text-muted">{t("body2")}</p>
      </div>

      <div className="mt-12">
        <ButtonLink href={ROUTES.booking}>{t("cta")}</ButtonLink>
      </div>
    </Container>
  );
}
