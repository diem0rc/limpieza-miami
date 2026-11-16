/**
 * La estrella, en un solo sitio.
 *
 * La dibujan tres pantallas distintas — el formulario público, el panel de
 * moderación y la sección de la home — y las tres tienen que verse idénticas.
 * Con el `path` copiado en cada una, un retoque al dibujo dejaría dos
 * versiones conviviendo en el mismo sitio sin que nadie lo note.
 *
 * No lleva `"use client"` a propósito: no tiene estado ni eventos, así que
 * sirve igual dentro de un componente de servidor (la home) que de uno de
 * cliente (el formulario y el panel).
 *
 * Los colores salen de `--brand-star` / `--brand-star-empty`, los dos tokens
 * que añadió este proyecto para seguir la convención universal de las
 * reseñas. Ver la entrada de `brand.config.ts`: son la única excepción
 * documentada en la que una convención de fuera pesa más que la paleta de la
 * marca, porque unas estrellas color terracota no se leerían como estrellas.
 */
export default function Star({
  filled,
  className = "size-5",
}: {
  filled: boolean;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={`${className} ${filled ? "text-star" : "text-star-empty"}`}
    >
      <path
        d="M12 2.5l2.9 6.07 6.6.86-4.83 4.6 1.2 6.57L12 17.5l-5.87 3.1 1.2-6.57L2.5 9.43l6.6-.86L12 2.5z"
        fill="currentColor"
      />
    </svg>
  );
}

/**
 * Las cinco estrellas de una calificación ya dada, para leer, no para elegir.
 *
 * El `label` llega de fuera en vez de armarse acá porque los dos sitios que
 * la usan lo sacan de fuentes distintas: el panel lo escribe en español
 * directo (es una herramienta interna) y la home lo saca de `messages`, en el
 * idioma de quien mira. Un texto fijo acá dentro obligaría a uno de los dos a
 * mentir.
 *
 * Las estrellas van `aria-hidden` y el grupo lleva un solo `role="img"` con
 * su nombre: sin eso, un lector de pantalla anunciaría cinco imágenes
 * sueltas en vez de "4 de 5 estrellas".
 */
export function StarRow({
  rating,
  label,
  size = "size-5",
}: {
  rating: number;
  label: string;
  size?: string;
}) {
  return (
    <span role="img" aria-label={label} className="inline-flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => {
        // Cuánto de ESTA estrella corresponde pintar: 1 entera, 0 vacía, o
        // algo intermedio. Las calificaciones de una reseña son enteras y
        // nunca entran por el caso de en medio; el promedio de la home sí.
        const parte = Math.min(Math.max(rating - (n - 1), 0), 1);
        if (parte >= 0.75) return <Star key={n} filled className={size} />;
        if (parte < 0.25) return <Star key={n} filled={false} className={size} />;
        return <HalfStar key={n} size={size} />;
      })}
    </span>
  );
}

/**
 * Media estrella, para un promedio como 4.5.
 *
 * Sin esto habría que redondear, y redondear hacia arriba pinta cinco
 * estrellas llenas junto al texto "4.5 de 5" — el sitio diciendo dos cosas
 * distintas a la vez, y la de más peso visual exagerando. Redondear hacia
 * abajo sería honesto pero mezquino con un 4.9.
 *
 * Es la estrella vacía con la llena encima, recortada a la mitad por un
 * contenedor con `overflow-hidden`. Se hace así y no con un degradado
 * dentro del SVG porque el recorte no depende de que el navegador resuelva
 * `objectBoundingBox` igual en todas partes.
 */
function HalfStar({ size }: { size: string }) {
  return (
    <span className="relative inline-flex">
      <Star filled={false} className={size} />
      <span className="absolute inset-y-0 left-0 w-1/2 overflow-hidden">
        <Star filled className={size} />
      </span>
    </span>
  );
}
