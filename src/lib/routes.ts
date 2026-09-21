/**
 * Rutas del sitio. Los segmentos están en español en ambos idiomas
 * (`/es/reservar` y `/en/reservar`) para que un mismo QR impreso funcione
 * sin importar el idioma en que se abra.
 */
export const ROUTES = {
  home: "/",
  services: "/servicios",
  pricing: "/precios",
  about: "/nosotros",
  contact: "/contacto",
  policies: "/politicas",
  booking: "/reservar",
  bookingConfirmation: "/reservar/confirmacion",
} as const;

/** Enlaces del menú principal. `key` apunta al namespace `nav` de los mensajes. */
export const MAIN_NAV = [
  { href: ROUTES.services, key: "services" },
  { href: ROUTES.pricing, key: "pricing" },
  { href: ROUTES.about, key: "about" },
  { href: ROUTES.contact, key: "contact" },
] as const;

export const LEGAL_NAV = [{ href: ROUTES.policies, key: "policies" }] as const;
