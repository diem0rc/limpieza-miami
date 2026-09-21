"use client";

import { useSyncExternalStore } from "react";

/**
 * Clave del panel interno, persistida en `sessionStorage` (dura mientras la
 * pestaña está abierta). Mismo patrón que `useClientNow.ts`: el servidor no
 * puede leer `sessionStorage`, así que `getServerSnapshot` devuelve `null` y
 * ese es también el valor del primer render en el cliente — evita el efecto
 * (y el aviso de lint sobre `setState` dentro de uno) que haría falta para
 * leerlo "después de montar".
 */
const TOKEN_KEY = "admin-token";
const listeners = new Set<() => void>();

function readToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null; // almacenamiento no disponible (ventana privada, etc.)
  }
}

function getServerSnapshot(): string | null {
  return null;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useAdminToken(): [string | null, (value: string | null) => void] {
  const token = useSyncExternalStore(subscribe, readToken, getServerSnapshot);

  function setToken(value: string | null) {
    try {
      if (value) sessionStorage.setItem(TOKEN_KEY, value);
      else sessionStorage.removeItem(TOKEN_KEY);
    } catch {
      // Sin almacenamiento persistente, el token solo vive en memoria para
      // esta sesión de render — sigue funcionando, solo no sobrevive a un F5.
    }
    for (const listener of listeners) listener();
  }

  return [token, setToken];
}
