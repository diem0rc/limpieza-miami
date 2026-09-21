import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { BRAND } from "@/config/brand.config";
import { BOOKING_POLICY } from "@/config/pricing.config";
import { formatHour } from "@/lib/format";
import { ROUTES } from "@/lib/routes";
import Container from "@/components/ui/Container";
import { ButtonLink } from "@/components/ui/Button";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "contact" });
  return { title: t("title"), description: t("intro") };
}

export default async function ContactPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <Contact locale={locale} />;
}

function Contact({ locale }: { locale: string }) {
  const t = useTranslations("contact");
  const { operatingHours } = BOOKING_POLICY;

  const rows = [
    { label: t("phoneLabel"), value: BRAND.phone || t("pendingValue") },
    { label: t("emailLabel"), value: BRAND.email || t("pendingValue") },
    { label: t("areaLabel"), value: BRAND.city },
    {
      label: t("hoursLabel"),
      value: t("hoursValue", {
        start: formatHour(operatingHours.start, locale),
        end: formatHour(operatingHours.end, locale),
      }),
    },
  ];

  return (
    <Container className="py-16">
      <h1 className="text-h1 font-black tracking-tight">{t("title")}</h1>
      <p className="mt-4 max-w-xl text-body text-text-muted">{t("intro")}</p>

      <dl className="mt-10 max-w-md divide-y divide-border rounded-lg border border-border bg-surface">
        {rows.map(({ label, value }) => (
          <div
            key={label}
            className="flex items-baseline justify-between gap-6 px-6 py-4"
          >
            <dt className="text-small text-text-muted">{label}</dt>
            <dd className="text-right text-body font-medium">{value}</dd>
          </div>
        ))}
      </dl>

      <p className="mt-8 max-w-xl text-small leading-relaxed text-text-muted">
        {t("bookingNote")}
      </p>

      <div className="mt-8">
        <ButtonLink href={ROUTES.booking}>{t("cta")}</ButtonLink>
      </div>
    </Container>
  );
}
