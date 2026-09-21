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
