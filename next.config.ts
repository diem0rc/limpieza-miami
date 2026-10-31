import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin();

/**
 * Cabeceras de seguridad. Producción solo mandaba `strict-transport-security`
 * (lo pone Vercel). Estas cuatro son las que no pueden romper nada: no
 * limitan de dónde se cargan scripts ni estilos, solo cierran puertas que
 * no usamos.
 *
 * Lo que NO está acá a propósito es una Content-Security-Policy completa.
 * Next inyecta scripts y estilos en línea, así que una CSP estricta necesita
 * nonces por petición; mal puesta deja el sitio en blanco y sin avisar. Es
 * un trabajo aparte, con su propia verificación.
 */
const CABECERAS_DE_SEGURIDAD = [
  {
    // Que nadie pueda meter el sitio en un <iframe> y hacerlo pasar por
    // suyo para capturar clics. Nada del sitio se embebe en otro lado:
    // Stripe Checkout es una redirección, no un iframe.
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    // Impide que el navegador "adivine" el tipo de un archivo y lo trate
    // como algo distinto de lo que decimos que es.
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    // Al salir del sitio se manda el origen, nunca la ruta completa. Importa
    // porque hay URLs de reserva que no tienen por qué filtrarse a terceros.
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    // El sitio no usa cámara, micrófono ni ubicación. Declararlo evita que
    // algo incrustado a futuro las pida en nuestro nombre.
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

const nextConfig: NextConfig = {
  // Hay un package-lock.json suelto en el home del usuario; sin esto Turbopack
  // lo toma como raíz del workspace y avisa en cada build.
  turbopack: {
    root: path.dirname(fileURLToPath(import.meta.url)),
  },

  async headers() {
    return [{ source: "/:path*", headers: CABECERAS_DE_SEGURIDAD }];
  },
};

export default withNextIntl(nextConfig);
