import { isAuthorizedAdmin } from "@/lib/admin-auth";
import { sendReviewRequestEmail } from "@/lib/email";
import { findInviteById, markInviteEmailed, reviewUrl } from "@/lib/reviews";

export const runtime = "nodejs";

/**
 * Manda el link de reseña por correo al cliente de esta invitación.
 *
 * Un cliente telefónico puede no haber dado correo: en ese caso la invitación
 * existe igual (su link se pasa por WhatsApp o SMS copiándolo del panel) y
 * esta ruta responde `400 noEmail`. No es un error del sistema, es una
 * situación normal que el panel traduce a un botón deshabilitado.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAuthorizedAdmin(request))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const invite = await findInviteById(id);
  if (!invite) {
    return Response.json({ error: "notFound" }, { status: 404 });
  }
  if (!invite.contact_email) {
    return Response.json({ error: "noEmail" }, { status: 400 });
  }

  // Nunca lanza: ver src/lib/email.ts.
  await sendReviewRequestEmail({
    cliente: invite.customer_name,
    email: invite.contact_email,
    url: reviewUrl(invite),
    locale: invite.locale,
  });

  await markInviteEmailed(invite.id);

  return Response.json({ ok: true, emailedAt: new Date().toISOString() });
}
