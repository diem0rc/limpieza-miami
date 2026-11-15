import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import ReviewForm from "@/components/reviews/ReviewForm";
import { BRAND } from "@/config/brand.config";
import { formatDateLong } from "@/lib/format";
import {
  findInviteByToken,
  firstName,
  inviteHasReview,
  suggestDisplayName,
} from "@/lib/reviews";

/**
 * Página de reseña. Ruta dinámica legítima: el token no se conoce en el
 * build, así que no hay `generateStaticParams` y Next la sirve bajo demanda
 * (igual que `/api/*`).
 *
 * Lleva `noindex` y no entra al sitemap: es una URL privada de un solo
 * cliente. Que Google la indexara sería tan absurdo como indexar un link de
 * pago.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; token: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "review" });

  return {
    title: t("metaTitle"),
    robots: { index: false, follow: false },
  };
}

export default async function ReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; token: string }>;
  searchParams: Promise<{ desde?: string }>;
}) {
  const { locale, token } = await params;
  const { desde } = await searchParams;
  setRequestLocale(locale);

  const t = await getTranslations("review");
  const tServices = await getTranslations("services.items");

  const found = await findInviteByToken(token);

  // Caso 1: la base de datos no respondió. El link puede ser perfectamente
  // válido, así que NO se le dice al cliente que su link no sirve — se le
  // pide que reintente. Decirle "link inválido" a quien tiene uno bueno
  // garantiza que no vuelva a intentarlo.
  if (found.status === "error") {
    return (
      <Shell>
        <h1 className="text-h2 font-bold text-text">{t("error.title")}</h1>
        <p className="mt-3 text-body text-text-muted">
          {t("error.body", { phone: BRAND.phone })}
        </p>
      </Shell>
    );
  }

  // Caso 2: el token no existe de verdad. Un link mal copiado, o una
  // invitación que se borró con su reserva. Se responde con el teléfono real
  // del negocio para que el cliente no quede sin forma de contarnos nada.
  if (found.status === "notFound") {
    return (
      <Shell>
        <h1 className="text-h2 font-bold text-text">{t("invalid.title")}</h1>
        <p className="mt-3 text-body text-text-muted">
          {t("invalid.body", { phone: BRAND.phone })}
        </p>
      </Shell>
    );
  }

  const invite = found.invite;

  // Caso 3: ya reseñó. Es el estado que ve quien abre el link del recibo
  // después de haber reseñado desde la redirección del pago — por eso el
  // mensaje agradece en vez de sonar a error.
  if (await inviteHasReview(invite.id)) {
    return (
      <Shell>
        <h1 className="text-h2 font-bold text-text">{t("done.title")}</h1>
        <p className="mt-3 text-body text-text-muted">{t("done.body")}</p>
      </Shell>
    );
  }

  // Caso 4: a reseñar.
  const serviceLabel = tServices(`${invite.service_type}.name`);

  // `service_date` es AAAA-MM-DD. Se parte a mano en vez de `new Date(str)`
  // porque esa forma lo interpreta como medianoche UTC, y en una zona con
  // offset negativo (Miami) se mostraría el día anterior. Construyendo la
  // fecha con sus partes queda en la zona local y la etiqueta coincide con
  // el día que el cliente recuerda. Mismo cuidado que src/lib/timezone.ts.
  let dateLabel: string | null = null;
  if (invite.service_date) {
    const [y, m, d] = invite.service_date.split("-").map(Number);
    dateLabel = formatDateLong(new Date(y, m - 1, d), locale);
  }

  const heading = dateLabel
    ? t("form.headingDated", {
        name: firstName(invite.customer_name),
        service: serviceLabel.toLowerCase(),
        date: dateLabel,
      })
    : t("form.heading", {
        name: firstName(invite.customer_name),
        service: serviceLabel.toLowerCase(),
      });

  return (
    <Shell>
      {/*
        Viene de pagar. El texto NO afirma que el pago se confirmó: la
        confirmación autoritativa es el webhook de Stripe, y el cliente puede
        llegar acá con un método de pago que todavía se está procesando. Por
        eso habla del recibo que va a llegar, no de un pago ya hecho. Esta
        página tampoco toca el estado de la reserva.
      */}
      {desde === "pago" && (
        <p className="mb-6 rounded-md bg-bg-alt px-4 py-3 text-small text-text-muted">
          {t("form.fromPayment")}
        </p>
      )}

      {/*
        El encabezado lo renderiza el formulario, no esta página: al enviarse,
        la pantalla de gracias lo reemplaza. Si viviera acá, quedaría un
        "¿cómo estuvo tu limpieza?" encima de un "¡Gracias!".
      */}
      <ReviewForm
        token={invite.token}
        defaultDisplayName={suggestDisplayName(invite.customer_name)}
        heading={heading}
      />
    </Shell>
  );
}

/** Caja centrada y angosta: casi todos llegan desde el teléfono. */
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-12">
      {children}
    </div>
  );
}
