import { BRAND } from "@/config/brand.config";

/**
 * Interruptor único de indexación.
 *
 * Estuvo en `false` mientras `BRAND.name` era "TBD" y no había teléfono,
 * correo ni logo — hasta que el sitio no dejara de verse a medias, no debía
 * salir en buscadores. Los cuatro ya están (nombre, logo, teléfono, correo),
 * así que se activa.
 *
 * Si alguna vez se necesita volver a bloquear la indexación (otro rediseño a
 * medias, por ejemplo), poner esto en `false` y volver a desplegar.
 * Lo consumen `src/app/robots.ts` y los metadatos del layout raíz.
 */
export const ALLOW_INDEXING = true;

/**
 * Origen canónico del sitio, para las URLs absolutas del sitemap.
 *
 * Va con `www` a propósito: el apex redirige con 308 a `www`, así que es
 * ese el host canónico (verificado contra producción). Si el sitemap
 * listara el apex, cada URL del listado sería una redirección en vez del
 * destino final.
 *
 * El dominio sale de `BRAND.domain` para no tenerlo escrito dos veces; lo
 * único que se decide acá es el subdominio, que es una cuestión de hosting
 * y no de marca.
 */
export const SITE_URL = `https://www.${BRAND.domain}`;
