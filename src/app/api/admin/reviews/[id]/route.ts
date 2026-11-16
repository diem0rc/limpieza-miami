import { revalidateTag } from "next/cache";
import { isAuthorizedAdmin } from "@/lib/admin-auth";
import {
  MODERATION_REASONS,
  type ModerationAction,
  type ModerationReason,
} from "@/lib/review-types";
import { REVIEWS_CACHE_TAG, moderateReview } from "@/lib/reviews";

export const runtime = "nodejs";

const ACTIONS: ModerationAction[] = ["publicar", "rechazar", "ocultar"];

function isAction(value: unknown): value is ModerationAction {
  return typeof value === "string" && (ACTIONS as string[]).includes(value);
}

function isReason(value: unknown): value is ModerationReason {
  return typeof value === "string" && (MODERATION_REASONS as readonly string[]).includes(value);
}

/**
 * Publicar, rechazar u ocultar una reseña.
 *
 * REGLA DE CUMPLIMIENTO (16 CFR Part 465, vigente desde oct. 2024, y la
 * política de reseñas de Google): una reseña solo se puede rechazar u
 * ocultar por un motivo que no tiene nada que ver con su calificación —
 * lenguaje ofensivo, datos personales de alguien, no hablar del servicio, o
 * spam. Nunca por tener pocas estrellas ni por ser negativa.
 *
 * Por eso el motivo llega como uno de una lista cerrada y el servidor
 * rechaza cualquier otro valor. No hay texto libre: un campo abierto
 * permitiría escribir "es negativa" y dejaría al negocio expuesto. Si algún
 * día hiciera falta un motivo nuevo, se añade a `MODERATION_REASONS` y se
 * comprueba que siga siendo neutral.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAuthorizedAdmin(request))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const action: unknown = body?.action;

  if (!isAction(action)) {
    return Response.json({ error: "invalidRequest" }, { status: 400 });
  }

  // Quitar una reseña de la vista SIEMPRE deja constancia de por qué. Sin
  // motivo no se aplica, y el motivo tiene que ser uno de la lista.
  let reason: ModerationReason | null = null;
  if (action !== "publicar") {
    if (!isReason(body?.reason)) {
      return Response.json({ error: "reasonRequired" }, { status: 400 });
    }
    reason = body.reason;
  }

  const result = await moderateReview(id, action, reason);

  if (!result.ok) {
    const status =
      result.reason === "notFound" ? 404 : result.reason === "conflict" ? 409 : 502;
    return Response.json({ error: result.reason }, { status });
  }

  // Solo estas dos acciones cambian lo que se ve en la home: una pendiente
  // que se rechaza nunca estuvo publicada, así que no hay nada que refrescar.
  //
  // `"max"` es el perfil recomendado en Next 16: marca la caché como vencida
  // y la primera visita siguiente dispara la regeneración en segundo plano
  // mientras se sigue sirviendo la versión anterior, en vez de hacer esperar
  // a quien justo entró. La forma de un solo argumento está obsoleta en esta
  // versión (ver node_modules/next/dist/docs, revalidateTag).
  if (action === "publicar" || action === "ocultar") {
    revalidateTag(REVIEWS_CACHE_TAG, "max");
  }

  return Response.json({ review: result.review });
}
