"use client";

import { useSyncExternalStore } from "react";

/**
 * Lee si el viewport es angosto (bajo el breakpoint `md` de Tailwind,
 * 768px) para elegir el `poster` correcto de `CleaningScrollVideo` — el
 * `<video>` mismo resuelve su fuente solo, con `<source media="...">`
 * nativo, pero `poster` es un solo atributo sin variante responsive, así
 * que necesita este empujón de JS. Mismo patrón que
 * `usePrefersReducedMotion.ts`: `getServerSnapshot` devuelve `false` (el
 * caso ancho, el más común en desktop) para que el primer render del
 * cliente coincida con el del servidor sin aviso de hidratación.
 */
const QUERY = "(max-width: 767px)";

function subscribe(listener: () => void): () => void {
  const mql = window.matchMedia(QUERY);
  mql.addEventListener("change", listener);
  return () => mql.removeEventListener("change", listener);
}

function getSnapshot(): boolean {
  return window.matchMedia(QUERY).matches;
}

function getServerSnapshot(): boolean {
  return false;
}

export function useIsNarrowViewport(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
