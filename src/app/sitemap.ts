import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { ROUTES } from "@/lib/routes";
import { ALLOW_INDEXING, SITE_URL } from "@/lib/seo";

/**
 * Sitemap del sitio. Next lo sirve en /sitemap.xml y `robots.ts` lo declara.
 *
 * Qué entra: solo las páginas públicas que tiene sentido que alguien
 * encuentre en un buscador. Quedan fuera a propósito:
 *  - /reservar/confirmacion, que solo existe después de reservar y no
 *    significa nada si se llega por un resultado de búsqueda;
 *  - /admin/*, que además va con noindex.
 *
 * Cada página se lista una vez por idioma, y cada entrada declara la otra
 * como alternativa (`alternates.languages`). Eso es lo que le dice al
 * buscador que /es/precios y /en/precios son la misma página en dos
 * idiomas y no contenido duplicado.
 *
 * Si ALLOW_INDEXING está en false el sitemap sale vacío, para no contradecir
 * al robots.txt, que en ese caso bloquea todo.
 */

const PAGINAS_PUBLICAS = [
  ROUTES.home,
  ROUTES.services,
  ROUTES.pricing,
  ROUTES.about,
  ROUTES.contact,
  ROUTES.policies,
  ROUTES.booking,
] as const;

/** `/` es `/es`, no `/es/` — sin barra final suelta. */
function url(locale: string, ruta: string): string {
  return ruta === "/" ? `${SITE_URL}/${locale}` : `${SITE_URL}/${locale}${ruta}`;
}

export default function sitemap(): MetadataRoute.Sitemap {
  if (!ALLOW_INDEXING) return [];

  const ahora = new Date();

  return PAGINAS_PUBLICAS.flatMap((ruta) =>
    routing.locales.map((locale) => ({
      url: url(locale, ruta),
      lastModified: ahora,
      // La home y el configurador son las que importan: son el destino de
      // los códigos QR impresos.
      priority: ruta === ROUTES.home ? 1 : ruta === ROUTES.booking ? 0.9 : 0.7,
      alternates: {
        languages: Object.fromEntries(
          routing.locales.map((otro) => [otro, url(otro, ruta)]),
        ),
      },
    })),
  );
}
