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
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} filled={n <= rating} className={size} />
      ))}
    </span>
  );
}
