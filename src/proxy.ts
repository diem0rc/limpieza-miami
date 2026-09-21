import createMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";

/**
 * En Next.js 16 el Middleware pasó a llamarse Proxy: el archivo es `proxy.ts`
 * y la función se exporta como `proxy`. next-intl sigue publicando su handler
 * bajo `next-intl/middleware`; la firma es la misma, solo cambia el nombre.
 *
 * Se encarga de redirigir `/` a `/es` y de negociar el idioma con la cabecera
 * Accept-Language (un visitante angloparlante que escanee el QR cae en `/en`).
 */
export const proxy = createMiddleware(routing);

export const config = {
  // Todo salvo rutas de API, assets internos de Next y archivos con extensión.
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
