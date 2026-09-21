import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { BOOKING_POLICY, GLOBAL_MINIMUM } from "@/config/pricing.config";
import { formatHour, formatMoney } from "@/lib/format";
import Container from "@/components/ui/Container";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "policies" });
  return { title: t("title"), description: t("intro") };
}

export default async function PoliciesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <Policies locale={locale} />;
}

function Policies({ locale }: { locale: string }) {
  const t = useTranslations("policies");
  const { operatingHours } = BOOKING_POLICY;

  // Cada política se redacta con los valores reales de pricing.config.ts:
  // cambiar una regla ahí cambia también este texto.
  const sections = [
    {
      title: t("noticeTitle"),
      body: t("noticeBody", { hours: BOOKING_POLICY.minimumNoticeHours }),
    },
    {
      title: t("cancelTitle"),
      body: t("cancelBody", { hours: BOOKING_POLICY.fullRefundHoursBefore }),
    },
    {
      title: t("paymentTitle"),
      body: t("paymentBody"),
    },
    {
      title: t("hoursTitle"),
      body: t("hoursBody", {
        start: formatHour(operatingHours.start, locale),
        end: formatHour(operatingHours.end, locale),
      }),
    },
    {
      title: t("minimumTitle"),
      body: t("minimumBody", { amount: formatMoney(GLOBAL_MINIMUM, locale) }),
    },
  ];

  return (
    <Container className="py-16">
      <h1 className="text-h1 font-black tracking-tight">{t("title")}</h1>
      <p className="mt-4 max-w-2xl text-body text-text-muted">{t("intro")}</p>

      <div className="mt-10 max-w-2xl space-y-8">
        {sections.map(({ title, body }) => (
          <section key={title}>
            <h2 className="text-h3 font-semibold">{title}</h2>
            <p className="mt-2 text-body leading-relaxed text-text-muted">
              {body}
            </p>
          </section>
        ))}
      </div>
    </Container>
  );
}
