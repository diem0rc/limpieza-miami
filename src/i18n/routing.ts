import { defineRouting } from "next-intl/routing";

/**
 * Español es el idioma por defecto. El prefijo de idioma es siempre explícito
 * (`/es/...`, `/en/...`) para que cualquier URL impresa en un código QR sea
 * inequívoca y no dependa del navegador que la escanee.
 */
export const routing = defineRouting({
  locales: ["es", "en"],
  defaultLocale: "es",
  localePrefix: "always",

  // Sin negociación por Accept-Language: `/` siempre lleva a `/es`, porque el
  // español es el idioma por defecto del negocio. La mayoría de los teléfonos
  // en Miami reportan `en-US` y, con detección activada, casi nadie vería el
  // español. Los angloparlantes tienen el selector en el header.
  // Cambiar a `true` si algún día se prefiere adivinar por navegador.
  localeDetection: false,
});

export type Locale = (typeof routing.locales)[number];
