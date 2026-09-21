import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import {
  ADDONS,
  BASE_PRICES,
  FREQUENCY_DISCOUNT,
  GLOBAL_MINIMUM,
  SQFT_PRICING,
  type Frequency,
} from "@/config/pricing.config";
import { SIZE_TIERS } from "@/lib/booking-options";
import { formatMoney } from "@/lib/format";
import { ROUTES } from "@/lib/routes";
import Container from "@/components/ui/Container";
import { ButtonLink } from "@/components/ui/Button";

const RECURRING: Frequency[] = ["weekly", "biweekly", "monthly"];

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "pricing" });
  return { title: t("title"), description: t("intro") };
}

export default async function PricingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <Pricing locale={locale} />;
}

function Pricing({ locale }: { locale: string }) {
  const t = useTranslations("pricing");
  const tSizes = useTranslations("sizeTiers");
  const tAddons = useTranslations("addons");
  const tFreq = useTranslations("booking.frequency");
  const money = (n: number) => formatMoney(n, locale);

  return (
    <Container className="py-16">
      <h1 className="text-h1 font-black tracking-tight">{t("title")}</h1>
      <p className="mt-4 max-w-2xl text-body leading-relaxed text-text-muted">
        {t("intro")}
      </p>

      {/* Reglas globales */}
      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-border bg-surface p-6">
          <h2 className="text-h3 font-semibold">{t("minimumTitle")}</h2>
          <p className="mt-2 text-small text-text-muted">
            {t("minimumBody", { amount: money(GLOBAL_MINIMUM) })}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-surface p-6">
          <h2 className="text-h3 font-semibold">{t("paymentTitle")}</h2>
          <p className="mt-2 text-small text-text-muted">
            {t("paymentBody")}
          </p>
        </div>
      </div>

      {/* Tabla residencial */}
      <h2 className="mt-14 text-h2 font-bold tracking-tight">
        {t("residentialTitle")}
      </h2>
      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-md border-collapse overflow-hidden rounded-lg border border-border">
          <thead>
            <tr className="bg-bg-alt text-left">
              <th className="px-5 py-3 text-small font-semibold">
                {t("columnSize")}
              </th>
              <th className="px-5 py-3 text-right text-small font-semibold">
                {t("columnStandard")}
              </th>
              <th className="px-5 py-3 text-right text-small font-semibold">
                {t("columnDeep")}
              </th>
            </tr>
          </thead>
          <tbody>
            {SIZE_TIERS.map((tier) => (
              <tr key={tier} className="border-t border-border bg-surface">
                <td className="px-5 py-3 text-small text-text-muted">
                  {tSizes(tier)}
                </td>
                <td className="px-5 py-3 text-right text-body font-semibold">
                  {money(BASE_PRICES.residencial_estandar[tier])}
                </td>
                <td className="px-5 py-3 text-right text-body font-semibold text-accent">
                  {money(BASE_PRICES.residencial_profunda[tier])}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Por pie cuadrado */}
      <h2 className="mt-14 text-h2 font-bold tracking-tight">
        {t("sqftTitle")}
      </h2>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-border bg-surface p-6">
          <h3 className="text-h3 font-semibold">{t("sqftCommercial")}</h3>
          <p className="mt-3 text-body">
            <span className="font-semibold text-accent">
              ${SQFT_PRICING.comercial.estandar.toFixed(2)}
            </span>{" "}
            <span className="text-small text-text-muted">
              {t("perSqft")} · {t("columnStandard")}
            </span>
          </p>
          <p className="mt-1 text-body">
            <span className="font-semibold text-accent">
              ${SQFT_PRICING.comercial.profunda.toFixed(2)}
            </span>{" "}
            <span className="text-small text-text-muted">
              {t("perSqft")} · {t("columnDeep")}
            </span>
          </p>
          <p className="mt-3 text-small text-text-faint">
            {money(SQFT_PRICING.comercial.minimum)} {t("minimumLabel")}
          </p>
        </div>

        <div className="rounded-lg border border-border bg-surface p-6">
          <h3 className="text-h3 font-semibold">{t("sqftPostConstruction")}</h3>
          <p className="mt-3 text-body">
            <span className="font-semibold text-accent">
              ${SQFT_PRICING.postconstruccion.rate.toFixed(2)}
            </span>{" "}
            <span className="text-small text-text-muted">{t("perSqft")}</span>
          </p>
          <p className="mt-3 text-small text-text-faint">
            {money(SQFT_PRICING.postconstruccion.minimum)} {t("minimumLabel")}
          </p>
        </div>
      </div>

      {/* Adicionales */}
      <h2 className="mt-14 text-h2 font-bold tracking-tight">
        {t("addonsTitle")}
      </h2>
      <ul className="mt-5 divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
        {ADDONS.map((addon) => (
          <li
            key={addon.id}
            className="flex items-baseline justify-between gap-6 px-5 py-4"
          >
            <span className="text-small">{tAddons(`${addon.id}.name`)}</span>
            <span className="shrink-0 text-body font-semibold text-accent">
              {money(addon.price)}
            </span>
          </li>
        ))}
      </ul>

      {/* Frecuencia */}
      <h2 className="mt-14 text-h2 font-bold tracking-tight">
        {t("frequencyTitle")}
      </h2>
      <p className="mt-3 max-w-2xl text-small text-text-muted">
        {t("frequencyBody")}
      </p>
      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        {RECURRING.map((freq) => (
          <div
            key={freq}
            className="rounded-lg border border-border bg-surface p-6"
          >
            <p className="text-h2 font-bold text-accent">
              {tFreq("discount", {
                percent: Math.round(FREQUENCY_DISCOUNT[freq] * 100),
              })}
            </p>
            <p className="mt-1 text-small text-text-muted">{tFreq(freq)}</p>
          </div>
        ))}
      </div>

      <p className="mt-10 max-w-2xl text-small text-text-faint">{t("note")}</p>

      <div className="mt-8">
        <ButtonLink href={ROUTES.booking}>{t("cta")}</ButtonLink>
      </div>
    </Container>
  );
}
