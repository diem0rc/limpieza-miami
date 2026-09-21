import Image from "next/image";
import { BRAND } from "@/config/brand.config";

/**
 * Muestra el logo si `BRAND.logoPath` existe; si no, el nombre en texto.
 * Cuando llegue el logo definitivo basta con apuntar `logoPath` en
 * brand.config.ts y todo el sitio pasa a mostrarlo.
 */
export default function BrandMark({ className = "" }: { className?: string }) {
  if (BRAND.logoPath) {
    return (
      <Image
        src={BRAND.logoPath}
        alt={BRAND.name}
        // Proporción real del archivo (1288×864 ≈ 3:2, no una tira ancha).
        // Declarar la proporción que no es no distorsiona el logo — con
        // `w-auto`, el ancho se calcula a partir de esta relación.
        width={161}
        height={108}
        priority
        className={`h-10 w-auto ${className}`}
      />
    );
  }

  return (
    <span className={`text-h3 font-bold tracking-tight text-text ${className}`}>
      {BRAND.name}
    </span>
  );
}
