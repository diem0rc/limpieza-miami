"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { ROUTES } from "@/lib/routes";
import { usePrefersReducedMotion } from "@/lib/usePrefersReducedMotion";
import { useIsNarrowViewport } from "@/lib/useIsNarrowViewport";
import { ButtonLink } from "@/components/ui/Button";
import PrimaryCtaWithDiscount from "@/components/PrimaryCtaWithDiscount";
import styles from "./CleaningScrollVideo.module.css";

/**
 * ES EL HERO — no una sección aparte debajo de él. Reemplaza al Hero de
 * fondo plano que había antes: el clip (sala desordenada → impecable,
 * cámara avanzando) es el fondo, y encima van el título, el subtítulo y los
 * mismos botones de reservar que ya existían. A pedido explícito: "sobre el
 * video van a estar los botones".
 *
 * El avance del video NO depende de autoplay — lo controla la posición del
 * scroll dentro de esta sección. El video nunca se reproduce solo
 * (`video.pause()` siempre); todo el movimiento viene de asignar
 * `currentTime` a mano en un loop de `requestAnimationFrame`.
 *
 * El wrapper es más alto que la pantalla (`styles.runway`) para dar
 * "distancia de scroll" suficiente — el interior se queda fijo
 * (`position: sticky`) mientras se recorre esa distancia, y ahí es donde
 * vive el video. Sin ese wrapper alto, el video pasaría por la pantalla en
 * un solo scroll normal y no habría margen para "restregar" el tiempo.
 *
 * `top` del sticky compensa el header fijo del sitio (`Header.tsx`,
 * `sticky top-0`, `h-28`) — sin el offset, el video quedaría tapado por el
 * header en vez de pegarse justo debajo.
 *
 * Los botones (`ButtonLink` secundario, `PrimaryCtaWithDiscount`) ya tienen
 * fondo sólido propio (blanco y acento respectivamente, ver Button.tsx) —
 * se leen bien sobre cualquier fotograma del video sin necesitar ajustes de
 * contraste especiales para este componente.
 */
export default function CleaningScrollVideo() {
  const t = useTranslations("home");
  const prefersReducedMotion = usePrefersReducedMotion();
  const isNarrow = useIsNarrowViewport();

  const runwayRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const targetProgress = useRef(0);
  const frameId = useRef<number | null>(null);
  /** Última fuente que este componente le pidió al <video> — ver el efecto
   *  de abajo; evita comparar contra `video.currentSrc`, que se actualiza
   *  con retraso respecto a un `.load()` recién pedido. */
  const lastRequestedSrc = useRef<string | null>(null);

  useEffect(() => {
    // Con "reducir movimiento" activado no se monta nada de esto: la <img>
    // de respaldo (más abajo) ya cubre ese caso, estática desde el inicio.
    if (prefersReducedMotion) return;

    const runway = runwayRef.current;
    const video = videoRef.current;
    if (!runway || !video) return;

    // A diferencia de <picture>, un <video> con <source media="..."> elige
    // el archivo UNA SOLA VEZ — cuando el elemento se crea, o cuando algo
    // llama a .load() — y no vuelve a mirar los <source> si el viewport
    // real termina siendo otro. En una página hidratada por React eso deja
    // una ventana real donde el navegador puede decidir antes de que el
    // viewport esté asentado, y el video se queda con el archivo
    // equivocado sin corregirse solo (síntoma reportado: video de
    // escritorio en el teléfono o viceversa, que solo se arregla si algo
    // fuerza que el <video> se vuelva a montar, como cambiar de idioma).
    // Los <source media> siguen ahí como respaldo sin JS; acá se fuerza la
    // fuente correcta según el mismo `isNarrow` que ya decide el poster, y
    // se llama a .load() explícito — sin esto, reasignar `src` a mano no
    // hace que el navegador vuelva a intentar cargar nada.
    const targetSrc = isNarrow
      ? "/videos/sala-limpieza-vertical.mp4"
      : "/videos/sala-limpieza.mp4";
    // Comparar contra `video.currentSrc` (en vez de contra la ref de abajo)
    // parece más directo, pero `currentSrc` tarda en reflejar un `.load()`
    // recién pedido — con dos renders seguidos (el de `isNarrow` por
    // defecto y el que lo corrige después de hidratar) esa lectura queda
    // vieja y el segundo chequeo se cree "ya está bien" cuando en realidad
    // el primer `.load()` (con el valor todavía por defecto) sigue en
    // curso y termina "ganando". `lastRequestedSrc` evita la carrera: es
    // solo lo último que ESTE efecto pidió, sin depender de que el
    // navegador ya haya terminado de procesarlo.
    if (lastRequestedSrc.current !== targetSrc) {
      video.src = targetSrc;
      video.load();
      lastRequestedSrc.current = targetSrc;
    }

    // En iOS y algunos Android, un <video> al que nunca se le pidió
    // reproducir no llega a decodificar ni pintar NINGÚN cuadro — se ve
    // vacío/transparente aunque `currentTime` se esté moviendo por debajo
    // (el layout del scroll-scrubbing funciona igual, por eso el síntoma es
    // "hay que scrollear varias veces para pasar el Hero, pero no se ve
    // nada"). Reproducir un instante y pausar de inmediato "enciende" el
    // decodificador; con `muted` + `playsInline` no hace falta que el
    // usuario haya interactuado antes. Si el navegador igual lo rechaza
    // (autoplay bloqueado), no pasa nada grave: el `poster` sigue cubriendo
    // ese hueco y el resto del scrubbing no depende de esto.
    video.play().then(() => video.pause()).catch(() => {});

    function updateTargetProgress() {
      const rect = runway!.getBoundingClientRect();
      const scrollable = rect.height - window.innerHeight;
      if (scrollable <= 0) {
        targetProgress.current = rect.top <= 0 ? 1 : 0;
        return;
      }
      const scrolled = clamp(-rect.top, 0, scrollable);
      targetProgress.current = scrolled / scrollable;
    }

    function tick() {
      // `video.seeking` evita pedir un salto nuevo mientras el anterior
      // todavía se está resolviendo — sin este freno, en un video con
      // keyframes espaciados los pedidos se acumulan más rápido de lo que
      // el decodificador resuelve y el tiempo se queda pegado (medido: sin
      // esto, currentTime no avanzaba nada en 3s de scroll simulado). El
      // video ya se reencodificó con un keyframe por cuadro para que cada
      // salto sea barato — esto es una segunda red de seguridad, no el
      // arreglo principal.
      if (video && video.duration && !video.seeking) {
        // Interpola hacia el objetivo en vez de saltar directo: un scroll
        // brusco (rueda del mouse, "fling" en el teléfono) se siente suave
        // en vez de entrecortado.
        const targetTime = targetProgress.current * video.duration;
        const delta = targetTime - video.currentTime;
        if (Math.abs(delta) > 0.005) {
          video.currentTime += delta * 0.3;
        }
      }
      frameId.current = requestAnimationFrame(tick);
    }

    updateTargetProgress();
    window.addEventListener("scroll", updateTargetProgress, { passive: true });
    window.addEventListener("resize", updateTargetProgress);
    frameId.current = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("scroll", updateTargetProgress);
      window.removeEventListener("resize", updateTargetProgress);
      if (frameId.current !== null) cancelAnimationFrame(frameId.current);
    };
    // `isNarrow` entra a la lista de dependencias a propósito: si cambia
    // (viewport recién asentado tras hidratar, o un resize real que cruza
    // el breakpoint) este efecto se vuelve a correr y corrige la fuente.
  }, [prefersReducedMotion, isNarrow]);

  return (
    <section className={styles.runway} ref={runwayRef}>
      <div className={styles.sticky}>
        {prefersReducedMotion ? (
          // El frame FINAL (sala ya limpia) — no el de "mientras carga" de
          // más abajo. Quien tiene reducir-movimiento activo nunca ve la
          // transición, así que lo que se le muestra fijo debe ser el
          // resultado terminado, no el punto de partida desordenado.
          // <picture> con <source media> — igual que el <video> de abajo,
          // pero para la imagen fija: en un teléfono, mostrar el recorte
          // horizontal estirado con object-fit:cover dejaría los laterales
          // cortados casi por completo (16:9 contra una pantalla angosta y
          // alta). El recorte vertical ya viene compuesto para eso, no es
          // el mismo cuadro escalado.
          <picture className={styles.media}>
            <source media="(max-width: 767px)" srcSet="/videos/sala-limpia-vertical.jpg" />
            <img src="/videos/sala-limpia.jpg" alt="" aria-hidden />
          </picture>
        ) : (
          <video
            ref={videoRef}
            className={styles.media}
            poster={isNarrow ? "/videos/sala-poster-vertical.jpg" : "/videos/sala-poster.jpg"}
            muted
            playsInline
            preload="auto"
            aria-hidden
          >
            {/* Mismo motivo que el <picture> de arriba: en un teléfono, el
                recorte horizontal escalado con cover dejaría casi todo el
                cuadro fuera de pantalla por los costados. Estos <source>
                son el respaldo para cuando no hay JS (o para el primer
                instante antes de que el efecto de arriba corrija) — a
                diferencia de <picture>, un <video> no vuelve a mirarlos si
                el viewport real resulta otro, así que con JS disponible la
                fuente de verdad es `isNarrow` (ver el efecto de arriba). */}
            <source media="(max-width: 767px)" src="/videos/sala-limpieza-vertical.mp4" />
            <source src="/videos/sala-limpieza.mp4" />
          </video>
        )}

        <div className={styles.overlay}>
          <h1 className={styles.title}>{t("heroTitle")}</h1>
          <p className={styles.subtitle}>{t("heroSubtitle")}</p>
          <div className={styles.actions}>
            <PrimaryCtaWithDiscount />
            <ButtonLink href={ROUTES.services} variant="secondary">
              {t("ctaSecondary")}
            </ButtonLink>
          </div>
        </div>
      </div>
    </section>
  );
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
