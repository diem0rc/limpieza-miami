import { isAuthorizedAdmin } from "@/lib/admin-auth";
import { SERVICE_TYPES } from "@/lib/booking-options";
import {
  createInviteForBooking,
  createManualInvite,
  listManualInvites,
  reviewUrl,
  type InviteResult,
} from "@/lib/reviews";

export const runtime = "nodejs";

/**
 * Las invitaciones manuales ya creadas, para que el panel pueda volver a
 * copiar un link días después. No hace falta el equivalente para las web:
 * esas viajan dentro de `GET /api/admin/bookings`, pegadas a su reserva.
 */
export async function GET(request: Request) {
  if (!(await isAuthorizedAdmin(request))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  return Response.json({ invites: await listManualInvites() });
}

/**
 * Crea (o recupera) una invitación de reseña. Dos formas de llamarla:
 *
 *   { bookingId }   → la invitación de una reserva web
 *   { manual: {…} } → una invitación para un cliente telefónico
 *
 * La primera es idempotente: si ya existía, devuelve la misma en vez de
 * crear otra (lo garantiza el `unique(booking_id)` de la tabla).
 */
export async function POST(request: Request) {
  if (!(await isAuthorizedAdmin(request))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return Response.json({ error: "invalidRequest" }, { status: 400 });
  }

  let result: InviteResult;

  if (typeof body.bookingId === "string" && body.bookingId) {
    result = await createInviteForBooking(body.bookingId);
  } else if (body.manual && typeof body.manual === "object") {
    const manual = parseManual(body.manual);
    if (!manual) {
      return Response.json({ error: "invalidRequest" }, { status: 400 });
    }
    result = await createManualInvite(manual);
  } else {
    return Response.json({ error: "invalidRequest" }, { status: 400 });
  }

  if (!result.ok) {
    const status =
      result.reason === "notFound" ? 404 : result.reason === "notEligible" ? 409 : 502;
    return Response.json({ error: result.reason }, { status });
  }

  return Response.json({ id: result.invite.id, url: reviewUrl(result.invite) });
}

/**
 * Valida el formulario manual. El servicio se comprueba contra
 * `SERVICE_TYPES` (src/lib/booking-options.ts), la misma lista canónica que
 * usa el configurador y que valida `/api/bookings` — no una copia.
 */
function parseManual(raw: Record<string, unknown>): {
  name: string;
  email: string | null;
  serviceType: string;
  serviceDate: string | null;
  locale: "es" | "en";
} | null {
  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  if (!name) return null;

  const serviceType = SERVICE_TYPES.find((s) => s === raw.serviceType);
  if (!serviceType) return null;

  const email = typeof raw.email === "string" && raw.email.trim() ? raw.email.trim() : null;

  // Solo se acepta AAAA-MM-DD, que es lo que manda un <input type="date"> y
  // lo que espera una columna `date` de Postgres.
  const serviceDate =
    typeof raw.serviceDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw.serviceDate)
      ? raw.serviceDate
      : null;

  return {
    name: name.slice(0, 120),
    email,
    serviceType,
    serviceDate,
    locale: raw.locale === "en" ? "en" : "es",
  };
}
