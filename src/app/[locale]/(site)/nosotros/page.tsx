import type { Metadata } from "next";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { BRAND } from "@/config/brand.config";
import { ROUTES } from "@/lib/routes";
import Container from "@/components/ui/Container";
import { ButtonLink } from "@/components/ui/Button";
import styles from "./portrait.module.css";

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

      {/* Texto y retrato conviven en una grilla: en escritorio van lado a
          lado, y en móvil —el caso principal— la grilla colapsa sola y la
          foto queda debajo del texto, sin reglas aparte. */}
      <div className="mt-8 grid items-center gap-10 md:grid-cols-[1.15fr_0.85fr]">
        <div className="max-w-2xl space-y-5">
          <p className="text-h3 leading-relaxed text-text">
            {t("lead", { city: BRAND.city })}
          </p>
          <p className="text-body leading-relaxed text-text-muted">
            {t("body1")}
          </p>
          <p className="text-body leading-relaxed text-text-muted">
            {t("body2")}
          </p>
        </div>

        {/* Los bordes difuminados viven en portrait.module.css — ver ahí el
            porqué de la elipse y del prefijo -webkit. */}
        <Image
          src="/images/isabely.jpg"
          alt={t("portraitAlt")}
          width={777}
          height={1100}
          sizes="(max-width: 768px) 70vw, 380px"
          className={`${styles.retrato} mx-auto h-auto w-full max-w-[18rem] md:max-w-sm`}
        />
      </div>

      <div className="mt-12">
        <ButtonLink href={ROUTES.booking}>{t("cta")}</ButtonLink>
      </div>
    </Container>
  );
}
