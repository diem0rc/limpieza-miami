import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

/**
 * Cliente de servidor, con la clave `service_role` (aquí "secret" en el
 * formato nuevo de claves de Supabase): ignora Row Level Security por
 * completo. Por eso `bookings` no tiene políticas de RLS — todo el acceso a
 * esa tabla pasa por aquí, nunca por el navegador.
 *
 * `null` si el proyecto aún no tiene las variables configuradas — mismo
 * patrón que `getStripe()`.
 */
export function getSupabaseAdmin(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  if (!client) {
    client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}
