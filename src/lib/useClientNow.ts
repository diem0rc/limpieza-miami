"use client";

import { useSyncExternalStore } from "react";

/**
 * Hora actual, solo en el cliente.
 *
 * El servidor no puede saber la hora del visitante, así que renderiza `null`
 * y el valor real llega tras la hidratación — por eso `getServerSnapshot`
 * devuelve `null`: React lo usa también en el primer render del cliente y así
 * el HTML coincide.
 *
 * Se refresca cada minuto para que, si alguien deja la pestaña abierta un
 * buen rato, los horarios que caen dentro del margen mínimo de anticipación
 * se bloqueen solos.
 */
const TICK_MS = 60_000;

let current = 0;
let timer: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);

  if (timer === null) {
    current = Date.now();
    timer = setInterval(() => {
      current = Date.now();
      for (const l of listeners) l();
    }, TICK_MS);
  }

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  };
}

/** Debe devolver siempre el mismo valor entre ticks, o React entra en bucle. */
function getSnapshot(): number | null {
  if (current === 0) current = Date.now();
  return current;
}

function getServerSnapshot(): number | null {
  return null;
}

export function useClientNow(): number | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
