"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { usePrefersReducedMotion } from "@/lib/usePrefersReducedMotion";
import Container from "@/components/ui/Container";
import styles from "./TrustReasons.module.css";

const REASONS = ["price", "booking", "insured"] as const;
// Grilla + jitter (no puntos al azar puros): con pocas decenas de círculos
// sueltos, un scatter aleatorio deja huecos grandes en algunas zonas y
// amontona otras. La grilla garantiza cobertura pareja del área del texto;
// el jitter por celda es lo que evita que se note como una cuadrícula.
const GRID_COLS = 20;
const GRID_ROWS = 4;
const PARTICLES_PER_REASON = GRID_COLS * GRID_ROWS;
const DUST_TRANSITION = 0.12;

type DustParticle = { left: number; top: number; size: number };

// Hash determinístico (no Math.random: mismo resultado en servidor y
// cliente, sin desajuste de hidratación) para el jitter de cada partícula.
function hash(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

const DUST_PARTICLES: DustParticle[][] = REASONS.map((_, reasonIndex) =>
  Array.from({ length: PARTICLES_PER_REASON }, (_, i) => {
    const col = i % GRID_COLS;
    const row = Math.floor(i / GRID_COLS);
    const cellW = 100 / GRID_COLS;
    const cellH = 100 / GRID_ROWS;
    const seed = reasonIndex * 97 + i * 13.37;
    const jitterX = (hash(seed) - 0.5) * cellW * 0.85;
    const jitterY = (hash(seed + 4.71) - 0.5) * cellH * 0.85;
    return {
      left: clamp(col * cellW + cellW / 2 + jitterX, 1, 99),
      top: clamp(row * cellH + cellH / 2 + jitterY, 6, 94),
      size: 14 + hash(seed + 9.13) * 10,
    };
  })
);

/**
 * "Por qué reservar con nosotros" — el texto de cada razón arranca cubierto
 * de partículas de polvo; una sola escoba lo barre de izquierda a derecha
 * (orden de lectura) a medida que se scrollea, una razón a la vez — nunca
 * las tres de un tirón. La idea es generar curiosidad ("¿qué dice ahí?")
 * para que el texto se lea, no solo se escanee el título.
 *
 * El polvo son partículas sueltas, cada una un círculo independiente sin
 * ningún contenedor visual detrás (mismo .smudge que la pantalla sucia de
 * IntroAnimation.tsx, copiado literal) — nunca un rectángulo ni un color de
 * fondo sólido. Entre una partícula y la siguiente se ve lo que haya debajo
 * tal cual (el fondo blanco de la tarjeta), como granos de tierra sueltos
 * apoyados sobre el texto, no manchas sobre una superficie pintada. Cada
 * una se desvanece y encoge (opacity 1→0, scale 1→0.6) justo cuando la
 * escoba llega a su posición horizontal, como si se dispersara en el aire.
 *
 * El progreso sale de la posición real de scroll, suavizado cuadro a cuadro
 * (mismo criterio que el scroll-scrubbing de CleaningScrollVideo.tsx) para
 * que nunca se sienta de un solo golpe aunque se scrollee rápido. Es un
 * trinquete: solo puede subir, nunca baja (ver el Math.max en
 * updateRawProgress) — una vez que el scroll empujó el barrido hasta cierto
 * punto, ese punto queda. Subir y volver a bajar no vuelve a ensuciar nada;
 * es a propósito, no reversibilidad rota — la escoba ya pasó por ahí.
 *
 * El disparador de ese progreso es la posición de la GRILLA de tarjetas
 * (gridRef), no la de la <section> completa: la sección incluye el título,
 * que entra en pantalla mucho antes que las tarjetas porque el video del
 * hero es muy alto. Si el progreso arrancara con el título, la primera
 * tarjeta (y buena parte de la segunda) terminarían de barrerse antes de
 * que el usuario llegue a verlas — se ve como si el barrido "empezara" en
 * la última tarjeta. Atado a la grilla, el 0% cae cuando las tarjetas recién
 * asoman y el usuario ve las tres en orden, de arriba hacia abajo.
 *
 * Técnicamente hay 3 instancias de escoba, una por tarjeta: calcular la
 * posición de UNA sola escoba viajando entre tarjetas habría significado
 * perseguir coordenadas entre el grid de 3 columnas de escritorio y el
 * apilado vertical de móvil, que son layouts demasiado distintos. En vez de
 * eso, cada tarjeta tiene la suya y solo la del tramo activo es visible
 * (opacity) — como los tramos no se superponen, en cualquier momento se ve
 * una sola, que es lo que importa.
 *
 * Con prefers-reduced-motion no se monta nada de esto: el texto ya se
 * muestra limpio desde el inicio, sin polvo ni escoba — mismo patrón que el
 * <picture> de respaldo en CleaningScrollVideo.tsx.
 */
export default function TrustReasons() {
  const t = useTranslations("home");
  const prefersReducedMotion = usePrefersReducedMotion();

  const gridRef = useRef<HTMLDivElement>(null);
  const armed = useRef(false);
  const particleRefs = useRef<(HTMLDivElement | null)[][]>(
    REASONS.map(() => [])
  );
  const broomRefs = useRef<(HTMLDivElement | null)[]>([]);
  const rawProgress = useRef(0);
  const shownProgress = useRef(0);
  const frameId = useRef<number | null>(null);

  useEffect(() => {
    if (prefersReducedMotion) return;

    const grid = gridRef.current;
    if (!grid) return;

    function updateRawProgress() {
      const rect = grid!.getBoundingClientRect();
      // Sin layout todavía no hay nada que medir, y una medición de esas se
      // colaría en el trinquete como un valor alto falso.
      if (rect.height === 0) return;
      // 0 cuando el techo de la grilla ya subió hasta el 72% del alto del
      // viewport — o sea, con la primera tarjeta entera dentro de pantalla,
      // no apenas asomando por el borde de abajo. Si arrancara justo cuando
      // toca el fondo (100%), el barrido de la primera tarjeta pasaría casi
      // entero fuera de vista. 1 cuando la grilla ya está cómoda arriba
      // (12%): para entonces ya se pudo leer todo.
      const start = window.innerHeight * 0.72;
      const end = window.innerHeight * 0.12;
      const target = clamp((start - rect.top) / (start - end), 0, 1);

      // El trinquete recién se arma con el layout asentado (ver armRatchet).
      // Antes de eso el progreso sigue al scroll en los dos sentidos: el
      // hero mide 250vh y en dev el CSS entra por JS, así que por un
      // instante la grilla queda casi arriba de todo y la cuenta da 1. Con
      // el trinquete ya armado eso se trababa en 1 para siempre y las tres
      // tarjetas aparecían barridas desde el arranque.
      if (!armed.current) {
        rawProgress.current = target;
        shownProgress.current = target;
        return;
      }

      // Trinquete: nunca deja que el progreso baje, aunque el scroll real
      // retroceda — lo que ya se barrió queda barrido.
      rawProgress.current = Math.max(rawProgress.current, target);
    }

    function armRatchet() {
      updateRawProgress(); // línea base ya con el layout definitivo
      armed.current = true;
    }

    function apply(progress: number) {
      REASONS.forEach((_, i) => {
        const segStart = i / REASONS.length;
        const segEnd = (i + 1) / REASONS.length;
        const local = clamp((progress - segStart) / (segEnd - segStart), 0, 1);
        const active = progress >= segStart && progress <= segEnd;

        // El frente de barrido termina un poco más allá del borde derecho
        // (+DUST_TRANSITION) para que las últimas partículas —las que caen
        // al 98-99% del ancho— alcancen a disolverse del todo. Si terminara
        // justo en 100%, esas quedaban a media opacidad para siempre: un
        // grupito de polvo pegado al borde que no se limpiaba nunca.
        const sweepX = local * (1 + DUST_TRANSITION);

        // Cada partícula se disuelve cuando el frente de barrido la alcanza,
        // con una banda de transición corta alrededor de su propia posición
        // horizontal — no todas a la vez.
        DUST_PARTICLES[i].forEach((particle, pi) => {
          const el = particleRefs.current[i][pi];
          if (!el) return;
          const thresholdX = particle.left / 100;
          const dissolve = clamp(
            (sweepX - thresholdX) / DUST_TRANSITION,
            0,
            1
          );
          el.style.opacity = String(1 - dissolve);
          el.style.transform = `translate(-50%, -50%) scale(${1 - dissolve * 0.4})`;
        });

        // La escoba viaja sobre el mismo eje que usan las partículas para
        // su umbral, y solo se ve mientras su propia tarjeta es la que se
        // está barriendo — así se percibe como una sola escoba viajando de
        // tarjeta en tarjeta, no tres corriendo a la vez.
        const broom = broomRefs.current[i];
        if (broom) {
          broom.style.left = `${local * 100}%`;
          broom.style.opacity = active ? "1" : "0";
        }
      });
    }

    function tick() {
      const delta = rawProgress.current - shownProgress.current;
      if (Math.abs(delta) > 0.001) {
        // Sigue al valor real del scroll con retraso, nunca lo iguala de
        // un salto — así un scroll brusco no "teletransporta" el barrido.
        shownProgress.current += delta * 0.15;
      } else {
        shownProgress.current = rawProgress.current;
      }
      apply(shownProgress.current);
      frameId.current = requestAnimationFrame(tick);
    }

    updateRawProgress();
    shownProgress.current = rawProgress.current; // sin salto en el primer cuadro
    apply(shownProgress.current);

    window.addEventListener("scroll", updateRawProgress, { passive: true });
    window.addEventListener("resize", updateRawProgress);
    frameId.current = requestAnimationFrame(tick);

    // Un cuadro después de `load`: ahí el hero ya tiene su alto real y la
    // posición de la grilla es confiable para trabarla.
    let armId: number | null = null;
    function onLoad() {
      armId = requestAnimationFrame(armRatchet);
    }
    if (document.readyState === "complete") onLoad();
    else window.addEventListener("load", onLoad, { once: true });

    return () => {
      window.removeEventListener("scroll", updateRawProgress);
      window.removeEventListener("resize", updateRawProgress);
      window.removeEventListener("load", onLoad);
      if (armId !== null) cancelAnimationFrame(armId);
      if (frameId.current !== null) cancelAnimationFrame(frameId.current);
    };
  }, [prefersReducedMotion]);

  return (
    <section className="bg-bg-alt">
      <Container className="py-16">
        <h2 className="text-h2 font-bold tracking-tight">{t("trustTitle")}</h2>
        <div ref={gridRef} className="mt-8 grid gap-4 md:grid-cols-3">
          {REASONS.map((key, i) => (
            <div
              key={key}
              className="rounded-lg border border-border bg-surface p-6"
            >
              <h3 className="text-h3 font-semibold">{t(`trust.${key}Title`)}</h3>
              <div className="relative mt-2 overflow-hidden rounded-sm">
                <p className="text-small leading-relaxed text-text-muted">
                  {t(`trust.${key}Body`)}
                </p>
                {!prefersReducedMotion && (
                  <>
                    <div className={styles.dustLayer} aria-hidden>
                      {DUST_PARTICLES[i].map((particle, pi) => (
                        <div
                          key={pi}
                          ref={(el) => {
                            particleRefs.current[i][pi] = el;
                          }}
                          className={styles.dustParticle}
                          style={{
                            left: `${particle.left}%`,
                            top: `${particle.top}%`,
                            width: `${particle.size}px`,
                            height: `${particle.size}px`,
                          }}
                        />
                      ))}
                    </div>
                    <div
                      ref={(el) => {
                        broomRefs.current[i] = el;
                      }}
                      className={styles.broom}
                      aria-hidden
                    >
                      <BroomIcon />
                    </div>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}

// Mango recto + cabezal plano y ancho (la banda donde se atan las cerdas —
// eso es lo que distingue la silueta de una escoba de la de un cepillo
// redondo) + cerdas casi paralelas colgando del cabezal, con una apertura
// leve hacia abajo, nunca un abanico radiando desde un solo punto (eso se
// leía como cepillo de lavar auto). Mismo estilo plano/vectorial que el
// spray y el paño de IntroAnimation.tsx.
function BroomIcon() {
  return (
    <svg width="30" height="46" viewBox="0 0 48 64" fill="none">
      <line
        x1="32"
        y1="4"
        x2="21"
        y2="31"
        stroke="var(--color-text-faint)"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      <path d="M12 30 L30 30 L32 37 L10 37 Z" fill="var(--color-text-faint)" />
      <line x1="11" y1="37" x2="6" y2="59" stroke="var(--color-accent)" strokeWidth="1.6" strokeLinecap="round" />
      <line x1="14.5" y1="37" x2="11.5" y2="59.5" stroke="var(--color-accent)" strokeWidth="1.6" strokeLinecap="round" />
      <line x1="18" y1="37" x2="17" y2="60" stroke="var(--color-accent)" strokeWidth="1.6" strokeLinecap="round" />
      <line x1="21.5" y1="37" x2="22" y2="60" stroke="var(--color-accent)" strokeWidth="1.6" strokeLinecap="round" />
      <line x1="25" y1="37" x2="27.5" y2="59.5" stroke="var(--color-accent)" strokeWidth="1.6" strokeLinecap="round" />
      <line x1="28.5" y1="37" x2="33" y2="59" stroke="var(--color-accent)" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
