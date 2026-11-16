import { getLocale, getTranslations } from "next-intl/server";
import Container from "@/components/ui/Container";
import { StarRow } from "@/components/reviews/Star";
import { getPublishedReviews, type PublishedReview } from "@/lib/reviews";
import { BUSINESS_TIME_ZONE } from "@/lib/timezone";

/**
 * Las reseñas publicadas, en la home.
 *
 * Es un componente de servidor y la home sigue siendo estática (`●` en el
 * build). Lo que lo hace posible es que `getPublishedReviews()` está
 * cacheada con `unstable_cache` y no toca `headers()` ni `cookies()`: Next
 * puede resolverla al construir el sitio. Cuando se publica u oculta una
 * reseña, `/api/admin/reviews/[id]` invalida esa caché por su etiqueta y la
 * siguiente visita regenera la página — sin desplegar nada.
 *
 * SIN RESEÑAS PUBLICADAS NO SE RENDERIZA NADA. Ni encabezado, ni "todavía no
 * hay opiniones": un hueco vacío en la home de un negocio que empieza dice
 * justo lo contrario de lo que esta sección existe para decir.
 *
 * No lleva datos estructurados `AggregateRating` ni `Review` a propósito.
 * Google no muestra estrellas en los resultados para reseñas que un negocio
 * publica sobre sí mismo en su propio sitio, así que el marcado no ganaría
 * nada y entraría en su definición de marcado engañoso.
 */
export default async function ReviewsSection() {
  const { total, average, latest } = await getPublishedReviews();
  if (total === 0) return null;

  const t = await getTranslations("review.section");
  const tServices = await getTranslations("services.items");
  const locale = await getLocale();

  return (
    <section>
      <Container className="py-16">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
          <h2 className="text-h2 font-bold tracking-tight">{t("title")}</h2>
          <p className="flex items-center gap-2 text-body text-text-muted">
            {/* El promedio sin redondear: `StarRow` pinta media estrella
                cuando toca, para que las estrellas y el número de al lado
                digan exactamente lo mismo. */}
            <StarRow rating={average} label={t("stars", { rating: average })} />
            <span>
              {t("summary", {
                average: average.toLocaleString("en-US", {
                  minimumFractionDigits: 1,
                  maximumFractionDigits: 1,
                }),
                total,
              })}
            </span>
          </p>
        </div>

        {/*
          En móvil una fila que se arrastra de lado con scroll-snap, en
          escritorio una rejilla. `snap-mandatory` hace que cada tarjeta
          quede encuadrada al soltar, en vez de a medias.

          No hay nada que se mueva solo: ni autoplay, ni transiciones, ni
          scroll suave. Por eso no hace falta ninguna rama de
          `prefers-reduced-motion` — no hay movimiento que desactivar, que es
          la forma más sólida de respetarla.
        */}
        <ul className="mt-8 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4 md:grid md:grid-cols-3 md:overflow-x-visible md:pb-0">
          {latest.map((review) => (
            <ReviewCard
              key={review.id}
              review={review}
              serviceName={tServices(`${review.serviceType}.name`)}
              date={monthAndYear(review.publishedAt, locale)}
              starsLabel={t("stars", { rating: review.rating })}
              verifiedLabel={t("verified")}
            />
          ))}
        </ul>
      </Container>
    </section>
  );
}

function ReviewCard({
  review,
  serviceName,
  date,
  starsLabel,
  verifiedLabel,
}: {
  review: PublishedReview;
  serviceName: string;
  date: string;
  starsLabel: string;
  verifiedLabel: string;
}) {
  return (
    <li className="flex w-[82%] shrink-0 snap-start flex-col rounded-lg border border-border bg-surface p-6 sm:w-[48%] md:w-auto">
      <StarRow rating={review.rating} label={starsLabel} />

      {/*
        `lang` marca en qué idioma está escrita: las reseñas se muestran en
        el idioma original en las dos versiones del sitio, así que sin esto
        un lector de pantalla en español leería una reseña en inglés con
        pronunciación española.

        El texto del cliente se pinta como texto, nunca con
        dangerouslySetInnerHTML. Es lo único de la home que escribió alguien
        de fuera, y aunque `/api/reviews` lo guarda tal cual sin interpretar
        nada, el sitio donde de verdad importa es acá, que es donde se
        mostraría. `whitespace-pre-line` conserva sus saltos de línea.
      */}
      {review.body && (
        <p
          lang={review.locale}
          className="mt-4 grow whitespace-pre-line text-body leading-relaxed text-text"
        >
          {review.body}
        </p>
      )}

      <p className="mt-4 text-small font-semibold text-text">
        {review.displayName}
      </p>
      <p className="mt-0.5 text-small text-text-muted">
        {serviceName} · {date}
      </p>

      {/*
        "Cliente verificado" es literalmente cierto, no una insignia de
        adorno: una reseña solo puede existir si salió de una invitación con
        token, creada desde una reserva real o a mano para un cliente al que
        se le hizo el servicio. No hay formulario público abierto.
      */}
      <p className="mt-3 text-tiny font-semibold uppercase tracking-wider text-text-faint">
        {verifiedLabel}
      </p>
    </li>
  );
}

/**
 * "noviembre de 2026", en el idioma de quien mira la página.
 *
 * El TEXTO de la reseña se muestra en el idioma en que lo escribió el
 * cliente, pero la fecha no es del cliente: es una etiqueta nuestra, y va
 * pegada al nombre del servicio, que también sale de `messages`. Mezclar los
 * dos idiomas en la misma línea se leería como un error.
 *
 * La zona horaria se fija en la del negocio y no en la del servidor, igual
 * que los horarios de reserva: en Vercel el servidor corre en UTC, y una
 * reseña publicada un 31 por la noche en Miami aparecería como del mes
 * siguiente.
 */
function monthAndYear(iso: string, locale: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(locale === "en" ? "en-US" : "es-US", {
    month: "long",
    year: "numeric",
    timeZone: BUSINESS_TIME_ZONE,
  });
}
