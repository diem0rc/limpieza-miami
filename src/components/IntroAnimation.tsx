"use client";

import { useCallback, useEffect, useRef, useState, type AnimationEvent, type CSSProperties } from "react";
import { useTranslations } from "next-intl";
import BrandMark from "@/components/BrandMark";
import styles from "./IntroAnimation.module.css";

/**
 * Animación de "pantalla sucia" que se limpia al abrir el sitio, mostrada
 * solo la primera vez (por navegador, vía `localStorage`). Se monta como
 * una capa fija por encima de la página real — no reemplaza nada del
 * contenido, solo lo cubre 9.6s y se retira sola.
 */
const SEEN_KEY = "intro-seen";

export default function IntroAnimation() {
  const t = useTranslations("home");
  const [visible, setVisible] = useState(false);

  // Se marca "vista" en el momento en que se decide mostrarla, no cuando
  // termina: así un refresh a mitad de la animación no la repite.
  const maybeShowIntro = useCallback(() => {
    try {
      if (!localStorage.getItem(SEEN_KEY)) {
        localStorage.setItem(SEEN_KEY, "1");
        setVisible(true);
      }
    } catch {
      // Sin almacenamiento (ventana privada, etc.): mejor no mostrarla que
      // repetirla en cada visita.
    }
  }, []);

  // El `ref` es lo que hace válido este efecto según la regla de lint del
  // proyecto (ver CLAUDE.md): tiene que ser una llamada incondicional a una
  // función justo después de la guardia, no un `if` intermedio — de ahí
  // que la condición viva dentro de `maybeShowIntro` y no aquí. Mismo
  // patrón que la carga automática de AdminBookingsView.tsx.
  const checked = useRef(false);
  useEffect(() => {
    if (checked.current) return;
    checked.current = true;
    maybeShowIntro();
  }, [maybeShowIntro]);

  if (!visible) return null;

  // Todas las animaciones del timeline duran 9.6s y terminan a la vez (ver
  // el CSS module) — incluso con prefers-reduced-motion, que solo acorta la
  // duración, no cambia el timeline. `currentTarget` evita reaccionar a los
  // `animationend` de los hijos, que burbujean.
  function handleAnimationEnd(e: AnimationEvent<HTMLDivElement>) {
    if (e.target !== e.currentTarget) return;
    setVisible(false);
  }

  return (
    <div className={styles.stage} aria-hidden>
      <div className={styles.dirtyLayer} onAnimationEnd={handleAnimationEnd}>
        <div className={styles.grimeTexture}>
          <div className={styles.smudge} style={{ width: 180, height: 180, top: "15%", left: "12%" }} />
          <div className={styles.smudge} style={{ width: 220, height: 220, top: "55%", left: "70%" }} />
          <div className={styles.smudge} style={{ width: 140, height: 140, top: "70%", left: "20%" }} />
          <div className={styles.smudge} style={{ width: 160, height: 160, top: "10%", left: "65%" }} />
          <div className={styles.fingerprint} style={{ top: "30%", left: "35%", "--rot": "12deg" } as CSSProperties} />
          <div className={styles.fingerprint} style={{ top: "32%", left: "39%", "--rot": "-8deg" } as CSSProperties} />
          <div className={styles.fingerprint} style={{ top: "60%", left: "55%", "--rot": "20deg" } as CSSProperties} />
          <div className={styles.fingerprint} style={{ top: "22%", left: "60%", "--rot": "-15deg" } as CSSProperties} />
          <div className={styles.streak} style={{ width: 220, top: "25%", left: "20%", transform: "rotate(4deg)" }} />
          <div className={styles.streak} style={{ width: 160, top: "68%", left: "50%", transform: "rotate(-6deg)" }} />
          <div className={styles.streak} style={{ width: 190, top: "45%", left: "65%", transform: "rotate(10deg)" }} />
        </div>
      </div>

      <div className={styles.msg}>{t("introDirtyMessage")}</div>

      <div className={styles.sprayer}>
        <svg width="90" height="150" viewBox="0 0 90 150">
          <rect x="30" y="50" width="30" height="90" rx="8" fill="var(--brand-border-strong)" />
          <rect x="38" y="30" width="14" height="24" rx="3" fill="var(--brand-text-muted)" />
          <path d="M40 30 L20 14 L26 8 L48 22 Z" fill="var(--brand-accent)" />
          <circle cx="45" cy="16" r="5" fill="var(--brand-accent-hover)" />
        </svg>
        <div className={styles.mistCone} />
        <div className={`${styles.droplet} ${styles.dropletBurst1}`} style={{ width: 15, height: 15, left: 15, top: 8 }} />
        <div className={`${styles.droplet} ${styles.dropletBurst1}`} style={{ width: 11, height: 11, left: 2, top: 2 }} />
        <div className={`${styles.droplet} ${styles.dropletBurst1}`} style={{ width: 18, height: 18, left: 26, top: -6 }} />
        <div className={`${styles.droplet} ${styles.dropletBurst1}`} style={{ width: 10, height: 10, left: -10, top: 6 }} />
        <div className={`${styles.droplet} ${styles.dropletBurst1}`} style={{ width: 13, height: 13, left: 34, top: 4 }} />
        <div className={`${styles.droplet} ${styles.dropletBurst2}`} style={{ width: 16, height: 16, left: 30, top: 10 }} />
        <div className={`${styles.droplet} ${styles.dropletBurst2}`} style={{ width: 12, height: 12, left: 10, top: 0 }} />
        <div className={`${styles.droplet} ${styles.dropletBurst2}`} style={{ width: 19, height: 19, left: 20, top: -8 }} />
        <div className={`${styles.droplet} ${styles.dropletBurst2}`} style={{ width: 11, height: 11, left: -6, top: 4 }} />
        <div className={`${styles.droplet} ${styles.dropletBurst2}`} style={{ width: 14, height: 14, left: 40, top: 6 }} />
      </div>

      <div className={styles.cloth}>
        <div className={styles.clothShape} />
        <div className={styles.clothIcon} />
      </div>

      <div className={styles.shineBurst}>
        <div className={styles.flashRing} />
        {/* El destello revela el logo justo cuando la pantalla termina de
            limpiarse — mismo instante que flashRing, no uno propio.
            Reutiliza BrandMark (no un <img> aparte) para no duplicar el
            componente que ya resuelve logo-vs-texto y su proporción real.
            Ancho relativo (mitad del Hero, a pedido explícito) en vez de
            una altura fija: así se mantiene "la mitad" en cualquier tamaño
            de pantalla, con el alto siguiendo solo desde la proporción
            real del archivo (BrandMark ya declara 1288×864). */}
        <div className={styles.logoReveal}>
          <BrandMark className="!h-auto !w-1/2" />
        </div>
        <div className={`${styles.spark} ${styles.spark1}`}>
          <svg width="60" height="60" viewBox="-30 -30 60 60">
            <path d="M0,-28 L7,-7 L28,0 L7,7 L0,28 L-7,7 L-28,0 L-7,-7 Z" fill="var(--brand-accent)" />
          </svg>
        </div>
        <div className={`${styles.spark} ${styles.spark2}`}>
          <svg width="36" height="36" viewBox="-18 -18 36 36">
            <path d="M0,-17 L4,-4 L17,0 L4,4 L0,17 L-4,4 L-17,0 L-4,-4 Z" fill="var(--brand-border-strong)" />
          </svg>
        </div>
        <div className={`${styles.spark} ${styles.spark3}`}>
          <svg width="30" height="30" viewBox="-15 -15 30 30">
            <path d="M0,-14 L4,-4 L14,0 L4,4 L0,14 L-4,4 L-14,0 L-4,-4 Z" fill="var(--brand-text-faint)" />
          </svg>
        </div>
        <div className={`${styles.spark} ${styles.spark4}`}>
          <svg width="26" height="26" viewBox="-13 -13 26 26">
            <path d="M0,-12 L3,-3 L12,0 L3,3 L0,12 L-3,3 L-12,0 L-3,-3 Z" fill="var(--brand-border-strong)" />
          </svg>
        </div>
        <div className={`${styles.spark} ${styles.spark5}`}>
          <svg width="22" height="22" viewBox="-11 -11 22 22">
            <path d="M0,-10 L3,-3 L10,0 L3,3 L0,10 L-3,3 L-10,0 L-3,-3 Z" fill="var(--brand-accent)" />
          </svg>
        </div>
      </div>
    </div>
  );
}
