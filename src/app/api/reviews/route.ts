import { sendNewReviewEmail } from "@/lib/email";
import { findInviteByToken } from "@/lib/reviews";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

/** Violación de restricción única en Postgres. */
const UNIQUE_VIOLATION = "23505";

/**
 * Recibe la reseña del cliente. Es la única ruta pública de este sistema.
 *
 * No es un formulario abierto: sin un token válido no se puede insertar nada.
 * Eso es lo que sostiene la regla 4 (solo clientes reales) y lo que hace
 * honesta la etiqueta "Cliente verificado" de la home.
 */
export async function POST(request: Request) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return Response.json({ error: "notConfigured" }, { status: 503 });
  }

  const raw = await request.json().catch(() => null);
  if (!raw || typeof raw !== "object") {
    return Response.json({ error: "invalidRequest" }, { status: 400 });
  }

  const token = typeof raw.token === "string" ? raw.token : "";
  if (!token) {
    return Response.json({ error: "invalidRequest" }, { status: 400 });
  }

  // Las mismas reglas que valida el formulario, repetidas acá porque el
  // formulario es del navegador y se puede saltear. Los `check` de la tabla
  // son la tercera capa: aunque este código fallara, la base de datos no
  // acepta un rating fuera de 1-5 ni un consentimiento en falso.
  if (!Number.isInteger(raw.rating) || raw.rating < 1 || raw.rating > 5) {
    return Response.json({ error: "invalidRating" }, { status: 400 });
  }
  if (raw.consent !== true) {
    return Response.json({ error: "consentRequired" }, { status: 400 });
  }

  const bodyText = typeof raw.body === "string" ? raw.body.trim() : "";
  if (bodyText.length > 1000) {
    return Response.json({ error: "bodyTooLong" }, { status: 400 });
  }

  const displayName = typeof raw.displayName === "string" ? raw.displayName.trim() : "";
  if (displayName.length < 1 || displayName.length > 40) {
    return Response.json({ error: "invalidDisplayName" }, { status: 400 });
  }

  // Se distinguen los dos fallos: un token inexistente es culpa del link
  // (404), una base de datos caída es culpa nuestra (502). Si los dos
  // respondieran 404, el formulario le diría al cliente que su link no sirve
  // cuando en realidad solo hace falta reintentar.
  const found = await findInviteByToken(token);
  if (found.status === "error") {
    return Response.json({ error: "dbError" }, { status: 502 });
  }
  if (found.status === "notFound") {
    return Response.json({ error: "invalidToken" }, { status: 404 });
  }
  const invite = found.invite;

  // `service_type` y `locale` se copian de la invitación, nunca se toman del
  // cuerpo de la petición: son datos del negocio, no del cliente. Así nadie
  // puede hacer que su reseña aparezca bajo otro servicio.
  const inserted = await supabase
    .from("reviews")
    .insert({
      invite_id: invite.id,
      rating: raw.rating,
      // El texto se guarda tal cual lo escribió el cliente, sin limpiar ni
      // escapar nada. Es correcto porque en React siempre se pinta como
      // texto ({review.body}), nunca con dangerouslySetInnerHTML — el
      // escapado es trabajo del renderizado, no del almacenamiento.
      body: bodyText,
      display_name: displayName,
      service_type: invite.service_type,
      locale: invite.locale,
      consent: true,
      status: "pendiente",
    })
    .select("id")
    .maybeSingle();

  if (inserted.error) {
    // El `unique(invite_id)` es el guardián contra dobles envíos, en el mismo
    // espíritu que los `.eq('status', …)` del resto del proyecto: el segundo
    // intento no inserta nada Y no manda un aviso duplicado al negocio.
    // Vive en la base de datos, así que una carrera entre dos pestañas o un
    // reintento por mala señal tampoco lo pueden saltear.
    if (inserted.error.code === UNIQUE_VIOLATION) {
      return Response.json({ error: "alreadyReviewed" }, { status: 409 });
    }
    console.error("[reviews] no se pudo guardar la reseña:", inserted.error);
    return Response.json({ error: "dbError" }, { status: 502 });
  }

  // Nunca lanza: ver src/lib/email.ts.
  await sendNewReviewEmail({
    rating: raw.rating,
    displayName,
    servicio: invite.service_type,
    body: bodyText,
  });

  return Response.json({ ok: true });
}
