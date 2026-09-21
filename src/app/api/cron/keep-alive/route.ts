import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

/**
 * No hace nada de negocio: existe solo para que Supabase reciba al menos una
 * petición al día y nunca acumule los ~7 días de inactividad que hacen que
 * el plan gratis pause el proyecto solo. Vercel Cron la llama una vez al día
 * (ver `vercel.json`).
 *
 * Verifica `CRON_SECRET` en el header, como recomienda Vercel para sus
 * cron jobs — no porque esta ruta exponga nada sensible (es un `count`
 * vacío), sino para que no la dispare cualquiera y genere ruido en los logs.
 * Si `CRON_SECRET` no está configurado, se deja pasar: es mejor que el
 * keep-alive funcione sin el secreto puesto a que el proyecto se pause por
 * un detalle de configuración que nadie notó.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const header = request.headers.get("authorization") ?? "";
    if (header !== `Bearer ${secret}`) {
      return new Response("Unauthorized", { status: 401 });
    }
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return Response.json({ ok: false, reason: "notConfigured" }, { status: 503 });
  }

  // `head: true` pide solo el conteo, sin traer filas — el punto es tocar la
  // base de datos, no leer datos de verdad.
  const { error } = await supabase
    .from("bookings")
    .select("id", { count: "exact", head: true });

  if (error) {
    console.error("[cron/keep-alive] Supabase respondió con error:", error);
    return Response.json({ ok: false }, { status: 502 });
  }

  return Response.json({ ok: true });
}
