import { BRAND } from "@/config/brand.config";

/**
 * Invitación a dejar también una reseña en Google.
 *
 * REGLA DE CUMPLIMIENTO, y es la parte importante de este componente: esto se
 * muestra SIEMPRE, con cualquier calificación. Enseñar el link de Google solo
 * a quien dio cinco estrellas es "review gating", la práctica que la regla de
 * la FTC sobre reseñas (16 CFR Part 465) persigue de frente: fabrica un
 * promedio alto en Google filtrando a quién se le pide. Por eso aquí no entra
 * la calificación: el componente ni siquiera la recibe, así que no hay dónde
 * colgar esa condición aunque alguien quisiera. Verificado enviando una
 * reseña de 2★ y comprobando que la invitación aparece igual.
 *
 * Se renderiza solo si `BRAND.googleReviewUrl` tiene valor. Vacío (el valor
 * por defecto) significa que el negocio todavía no tiene ficha de Google, o
 * que no quiere pedir reseñas ahí, y entonces las pantallas se quedan
 * exactamente como estaban.
 *
 * Los textos llegan ya traducidos en vez de pedirlos acá con
 * `useTranslations`, porque esto se usa desde los dos lados: la pantalla de
 * gracias del formulario (cliente) y la de "ya recibimos tu reseña" (que la
 * pinta el servidor). Un hook de cliente no sirve en la segunda.
 */
export default function GoogleInvite({
  invite,
  button,
}: {
  invite: string;
  button: string;
}) {
  if (!BRAND.googleReviewUrl) return null;

  return (
    <div className="mt-8 rounded-lg border-2 border-border bg-surface p-5">
      <p className="text-body text-text">{invite}</p>
      <a
        href={BRAND.googleReviewUrl}
        // Se abre aparte para no sacar al cliente de esta página: si vuelve
        // atrás desde Google, encuentra su confirmación donde la dejó.
        // `noopener` es obligatorio con `_blank`: sin él, la página de destino
        // puede manipular la pestaña de origen.
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 grid h-12 w-full place-items-center rounded-pill bg-accent text-body font-semibold text-on-accent transition-colors hover:bg-accent-hover"
      >
        {button}
      </a>
    </div>
  );
}
