"use client";

import { useSyncExternalStore } from "react";

/**
 * Lee `prefers-reduced-motion` del cliente. Mismo patrón que
 * `useClientNow.ts`/`useAdminToken.ts`: `getServerSnapshot` devuelve `false`
 * (asume movimiento permitido, el caso común) para que el primer render del
 * cliente coincida con el del servidor sin aviso de hidratación — si el
 * visitante sí prefiere menos movimiento, React vuelve a renderizar con el
 * valor real justo después de montar, sin pasar por un efecto con `setState`.
 */
const QUERY = "(prefers-reduced-motion: reduce)";

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

export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
