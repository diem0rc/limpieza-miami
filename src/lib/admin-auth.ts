import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase";

/**
 * Guarda de acceso a `/api/admin/*`.
 *
 * Ya no es un secreto único comparado a mano: el panel usa Supabase Auth de
 * verdad (un solo usuario, el dueño del negocio, creado por él mismo desde
 * el dashboard de Supabase — nunca por este código). El navegador manda el
 * `access_token` de su sesión como Bearer y aquí se valida contra Supabase
 * con la clave de servicio, que puede verificar cualquier JWT emitido por
 * este proyecto sin necesitar manejo de cookies ni `@supabase/ssr`.
 *
 * El token expira (~1h, lo decide Supabase). Cuando eso pase, esta función
 * devuelve `false` igual que un token inválido; la UI ya limpia el token
 * guardado y vuelve a pedir login en ese caso — no hace falta refresh token
 * para una herramienta de un solo operador.
 */
export async function isAuthorizedAdmin(request: Request): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return false; // sin Supabase configurado, nadie entra

  const header = request.headers.get("authorization") ?? "";
  const prefix = "Bearer ";
  if (!header.startsWith(prefix)) return false;

  const token = header.slice(prefix.length);
  if (!token) return false;

  const { data, error } = await supabase.auth.getUser(token);
  return !error && !!data.user;
}
