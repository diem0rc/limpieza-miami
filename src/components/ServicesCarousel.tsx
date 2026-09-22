"use client";

import { useRef } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { SERVICE_TYPES } from "@/lib/booking-options";
import { ROUTES } from "@/lib/routes";
import Container from "@/components/ui/Container";

/**
 * "Qué limpiamos" en la home: carrusel horizontal de los 5 tipos de
 * servicio. Cada tarjeta enlaza directo al configurador con el servicio ya
 * elegido (`/reservar?servicio=<ServiceType>`) — `BookingFlow.tsx` lee ese
 * parámetro y arranca en el paso "size" (tamaño/pies cuadrados) en vez de
 * "¿qué servicio?", que ya no hace falta preguntar. Ver `store.tsx`
 * (`initialServiceType`).
 *
 * Scroll-snap nativo con un ref, sin librería de carrusel: son 5 tarjetas y
 * nada del resto del sitio agrega una dependencia para algo que CSS + un
 * `scrollBy` resuelven solos (mismo criterio que `CleaningScrollVideo.tsx`
 * con el scroll-scrubbing del video).
 */
export default function ServicesCarousel() {
  const t = useTranslations("home");
  const tServices = useTranslations("services");
  const trackRef = useRef<HTMLDivElement>(null);

  function scrollByCards(direction: 1 | -1) {
    const track = trackRef.current;
    if (!track) return;
    // El ancho real de la primera tarjeta (más el gap) — así el salto es
    // exacto en cualquier breakpoint sin repetir los mismos anchos a mano
    // en dos lugares distintos.
    const card = track.firstElementChild as HTMLElement | null;
    const delta = (card?.offsetWidth ?? track.clientWidth * 0.8) + 16;
    track.scrollBy({ left: delta * direction, behavior: "smooth" });
  }

  return (
    <section>
      <Container className="py-16">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-h2 font-bold tracking-tight">
            {t("servicesTitle")}
          </h2>
          <div className="flex shrink-0 gap-2">
            <CarouselButton
              direction="prev"
              label={t("servicesPrev")}
              onClick={() => scrollByCards(-1)}
            />
            <CarouselButton
              direction="next"
              label={t("servicesNext")}
              onClick={() => scrollByCards(1)}
            />
          </div>
        </div>

        <div
          ref={trackRef}
          className="mt-8 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {SERVICE_TYPES.map((id) => (
            <Link
              key={id}
              href={`${ROUTES.booking}?servicio=${id}`}
              className="group w-[78%] shrink-0 snap-start overflow-hidden rounded-lg border border-border bg-surface transition-colors hover:border-border-strong hover:bg-surface-hover sm:w-[46%] lg:w-[31%]"
            >
              <div className="relative aspect-[4/3] w-full">
                {/* Un archivo por servicio en public/images/, nombrado igual
                    que el ServiceType (ver src/config/pricing.config.ts) —
                    así no hace falta un mapa id → archivo. */}
                <Image
                  src={`/images/${id}.webp`}
                  alt={tServices(`items.${id}.name`)}
                  fill
                  sizes="(min-width: 1024px) 31vw, (min-width: 640px) 46vw, 78vw"
                  className="object-cover"
                />
              </div>
              <div className="p-6">
                <p className="text-tiny font-semibold uppercase tracking-wider text-accent">
                  {tServices(`items.${id}.short`)}
                </p>
                <h3 className="mt-2 text-h3 font-semibold">
                  {tServices(`items.${id}.name`)}
                </h3>
              </div>
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
  );
}

function CarouselButton({
  direction,
  label,
  onClick,
}: {
  direction: "prev" | "next";
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="grid h-10 w-10 shrink-0 place-items-center rounded-pill border-2 border-border text-text transition-colors hover:border-border-strong hover:bg-surface-hover"
    >
      <svg
        viewBox="0 0 16 16"
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d={direction === "prev" ? "M10 3 5 8l5 5" : "M6 3l5 5-5 5"} />
      </svg>
    </button>
  );
}
