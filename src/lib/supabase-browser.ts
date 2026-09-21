"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

/**
 * Cliente de navegador, con la clave "publishable" (pública a propósito,
 * protegida por RLS — que en `bookings` no tiene políticas, así que esta
 * clave no puede leer ni escribir ahí). Solo se usa para una cosa:
 * `auth.signInWithPassword()` en el login de `/admin/reservas`. El resto del
 * panel (leer/escribir reservas) sigue yendo por `/api/admin/*` con el
 * `access_token` de esta sesión como Bearer — nunca habla con Supabase
 * directo para datos.
 */
export function getSupabaseBrowser(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  if (!client) client = createClient(url, key);
  return client;
}
