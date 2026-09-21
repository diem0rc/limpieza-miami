import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

/**
 * Envoltorios de navegación conscientes del idioma: `<Link href="/reservar">`
 * resuelve a `/es/reservar` o `/en/reservar` según el idioma activo.
 * Usar SIEMPRE estos en vez de los de `next/link` y `next/navigation`.
 */
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
