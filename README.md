# DiBasilio Maid — sitio web

Sitio de una empresa de limpieza en Miami. Toda la identidad visual vive
aislada en un solo archivo — así se pudo pasar de una marca placeholder a la
real (DiBasilio Maid) cambiando un solo config, sin tocar un componente.

Next.js 16 (App Router) · TypeScript · Tailwind v4 · next-intl · mobile-first.

## Arrancar

```bash
npm run dev
```

## Los tres archivos que mandan

Están en `src/config/` y son la fuente de verdad. **No se editan desde los
componentes ni se duplican sus valores en ningún lado.**

| Archivo             | Qué controla                                          |
| ------------------- | ----------------------------------------------------- |
| `brand.config.ts`   | Nombre, logo, colores, tipografía, radios de esquina   |
| `pricing.config.ts` | Todos los precios y las reglas de negocio             |
| `pricing.ts`        | Motor de cálculo (funciones puras, no tocar)          |

### Cambiar la marca

Edita `COLORS` en `src/config/brand.config.ts` y el sitio entero se actualiza.
El puente es `src/lib/brand-css.ts`, que convierte esos valores en variables
CSS `--brand-*` inyectadas en el `<html>`; `src/app/globals.css` mapea la
paleta de Tailwind a esas variables con `@theme inline`.

> El detalle a saber: `cssVariables()` emite los colores como `--color-*`, que
> es justo el namespace que Tailwind v4 reserva para su paleta. Por eso se
> re-prefijan a `--brand-*` antes de inyectarlos.

El logo ya está en `public/logo.png` y `BRAND.logoPath` apunta ahí — cuando
`logoPath` es `null`, `BrandMark` muestra el nombre en texto en su lugar.

> **Sobre el fondo transparente**: el archivo que llegó era una captura con un
> degradado celeste/beige de fondo, no un logo aislado — se veía como una caja
> de color en el header. Se le quitó el fondo localmente con un script propio
> (distancia de color contra una estimación del fondo por desenfoque
> gaussiano, no un modelo de IA genérico — esos tienden a desvanecer texto
> plano en logos, tratándolo como "no es el sujeto principal"). El resultado
> es limpio sobre el blanco del sitio; si algún día llega un archivo mejor
> (vector o PNG ya transparente del diseñador), sigue siendo solo reemplazar
> el archivo — ningún componente cambia.

### Cambiar precios

Edita `pricing.config.ts`. Se refleja al instante en `/precios` y en el
configurador — ningún componente contiene números de precio.

## Estructura

```
src/
  config/          los tres archivos de arriba
  i18n/            routing, navegación y carga de mensajes
  messages/        es.json · en.json  ← toda la copia visible
  lib/             formato, rutas, puente de marca
  components/
    booking/       el configurador (store + 10 pasos)
  app/[locale]/
    (site)/        home, servicios, precios, nosotros, contacto, políticas
    (booking)/     /reservar, sin header ni footer del sitio
  proxy.ts         redirección de idioma
```

## Idiomas

Español por defecto, inglés disponible. Los prefijos son siempre explícitos
(`/es/...`, `/en/...`) para que un QR impreso sea inequívoco, y los segmentos
de ruta son los mismos en ambos idiomas (`/en/reservar`, no `/en/book`) para
que un mismo QR funcione en cualquier caso.

La detección por `Accept-Language` está **desactivada** a propósito
(`localeDetection: false` en `src/i18n/routing.ts`): la mayoría de los
teléfonos en Miami reportan `en-US` y, con detección activa, casi nadie vería
el español. Los angloparlantes tienen el selector en el header.

> Next.js 16 renombró Middleware a Proxy: el archivo es `src/proxy.ts` y
> exporta `proxy`, no `middleware`.

## El configurador (`/reservar`)

Una pregunta por pantalla. **El número de pasos lo decide el motor**, no la UI:
`getStepsFor(serviceType)`.

| Servicio          | Pasos |
| ----------------- | ----- |
| Residencial       | 10    |
| Airbnb            | 9     |
| Mudanza           | 8     |
| Comercial         | 8     |
| Post-construcción | 6     |

El estado vive en `src/components/booking/store.tsx` y sobrevive a la
navegación entre pasos. Si cambias de servicio a mitad del flujo, se descarta
solo lo que deja de aplicar (el tramo de habitaciones al pasar a un servicio
por pie cuadrado, las mascotas, los adicionales no disponibles) y se conserva
lo que sí (nivel de limpieza y frecuencia, si el nuevo servicio los admite).

Desde el paso 2 la barra inferior muestra el estimado en vivo, recalculado con
`calculatePrice()` en cada cambio. El último paso muestra el desglose completo.

## Animación de bienvenida

`IntroAnimation.tsx` cubre la home con una "pantalla sucia" que se limpia con
un rociador y un paño (`IntroAnimation.module.css`) — solo la primera vez que
alguien entra al sitio en su navegador (`localStorage`, clave `intro-seen`).
Se monta solo en la home, no en `/reservar`: ahí la prioridad es la
velocidad, no la primera impresión.

No hay una maqueta debajo — la animación es una capa `position: fixed` por
encima de la home real, que ya está montada; al terminar (9.6s, o casi
instantáneo con `prefers-reduced-motion`, que ya está cubierto globalmente en
`globals.css`) se retira sola y se ve el sitio de verdad.

Para volver a verla en desarrollo: `localStorage.removeItem('intro-seen')`
desde la consola y recargar.

## Reservas (Supabase) y pagos (Stripe)

**No se cobra nada al reservar.** `DEPOSIT_AMOUNT` en `pricing.config.ts` es
`0` — el negocio decidió que pedir la tarjeta sin cobrar nada en ese momento no
tenía sentido para el cliente, así que el pago se mueve entero a después.

### 1. Reservar no toca Stripe para nada — inserta una fila en Supabase

`/reservar` termina con "Confirmar reserva": sin tarjeta, sin redirección a
Stripe. `POST /api/bookings` valida la selección (`src/lib/booking-payload.ts`,
recalculando el precio en el servidor) e inserta una fila en la tabla
`bookings` de Supabase con `status: 'reservado'`. Stripe no se toca en este
paso en absoluto.

### 2. El equipo marca el servicio como hecho, y ahí se genera el link

**No hay forma de que el sistema sepa por sí solo que el servicio se hizo** —
no hay app de campo ni check-in. El dueño del negocio entra a
`/admin/reservas` (login con su cuenta de Supabase Auth), pulsa "Marcar
servicio completado", y solo entonces aparece "Generar y enviar link de
pago" — que crea un Payment Link de Stripe por el monto exacto guardado y lo
manda por correo al cliente automáticamente.

Estados de una reserva: `reservado → completado → link_enviado → pagado`
(más `cancelado`, sin acción de UI todavía). Cada transición es un `update`
de Supabase con el estado anterior como condición (`.eq('status', ...)`) —
un clic duplicado o un webhook reintentado no puede saltarse un paso ni
reenviar correos de más.

| Ruta                                          | Qué hace                                              |
| ---------------------------------------------- | ------------------------------------------------------ |
| `POST /api/bookings`                           | Inserta la reserva en Supabase (sin cobrar nada)       |
| `GET /api/admin/bookings`                      | Lista reservas activas (todo menos `cancelado`)        |
| `POST /api/admin/bookings/[id]/complete`       | `reservado` → `completado`                             |
| `POST /api/admin/payment-link`                 | Genera el link, `completado` → `link_enviado`          |
| `POST /api/stripe/webhook`                     | `link_enviado` → `pagado` cuando el link se cobra      |
| `/admin/reservas`                              | La pantalla que junta las rutas de arriba              |

El acceso a `/admin/reservas` es **Supabase Auth**, un solo usuario (el dueño
del negocio, creado por él mismo en el dashboard de Supabase — nunca por
código ni con una contraseña que pase por un agente). El login llama a
`supabase.auth.signInWithPassword()` en el navegador y guarda el
`access_token` de la sesión (`src/lib/useAdminToken.ts`); el servidor
(`src/lib/admin-auth.ts`) valida ese token contra Supabase en cada request a
`/api/admin/*` — sin ese token válido no se ve ningún dato.

El link de pago se genera con la API de **Payment Links** de Stripe, con
metadata `{ kind: 'booking_payment', booking_id }`; una vez pagado, el
webhook busca la fila por `booking_id` y la marca `pagado`.

### Ponerlo en marcha

1. Copia `.env.example` a `.env.local` y pon tus claves de Stripe (empieza
   con las de **test**, `sk_test_…`) y de Supabase (`Project Settings → API`
   del dashboard). Nunca subas `.env.local` al repositorio.
2. Corre el SQL de creación de la tabla `bookings` una vez en el **SQL
   Editor** del dashboard de Supabase (ver la entrada 17 de `CLAUDE.md` para
   el esquema completo).
3. Crea tu usuario del panel en **Authentication → Users → Add user** del
   dashboard de Supabase.
4. Para probar el webhook en local, reenvía los eventos a tu máquina:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

   Ese comando imprime un `whsec_…` propio de la sesión de escucha —
   distinto al que usa el endpoint de producción. En producción, registra el
   endpoint en el panel de Stripe apuntando a
   `https://TU-DOMINIO/api/stripe/webhook` y usa el `whsec_…` que te da ese
   endpoint, no el de `stripe listen`.
5. Tarjeta de prueba para pagar un link: `4242 4242 4242 4242`, cualquier
   fecha futura y CVC.

Cosas que conviene no romper:

- **El precio se recalcula en el servidor.** `/api/bookings` ignora cualquier
  importe que mande el navegador: vuelve a llamar a `calculatePrice()` con la
  selección, y descarta los campos que el servicio elegido no admite (nadie
  puede colar un descuento por frecuencia en post-construcción). La validación
  vive en `src/lib/booking-payload.ts`.
- **El webhook es lo que marca una reserva como pagada**, no la vuelta del
  cliente a ningún lado — el link de pago se abre días después desde un
  correo, no dentro de una sesión de nuestro sitio.
- **El segundo cobro es manual, a propósito** (no automático X horas después
  de la cita): automatizarlo cobraría igual aunque el servicio se cancelara o
  cambiara de alcance. Es una decisión de producto, no algo pendiente de
  terminar.
- **`bookings` tiene RLS activo y sin políticas.** Todo el acceso pasa por el
  servidor con la clave "secret" de Supabase — no se agregan políticas para
  que el navegador la lea directo, ni siquiera con la clave pública.

Los horarios se interpretan en `America/New_York` (`src/lib/timezone.ts`),
no en la zona del servidor: en Vercel corre en UTC y el margen mínimo de
anticipación se desviaría entre 4 y 5 horas.

## Avisos por correo (Resend)

`src/lib/email.ts` manda avisos al negocio y al cliente — nunca puede tumbar
una reserva, un login o un webhook si falla:

| Cuándo                                    | A quién              | Quién lo dispara                        |
| ------------------------------------------ | --------------------- | ---------------------------------------- |
| Entra una reserva nueva (sin cobrar)       | Negocio y cliente     | `POST /api/bookings`                     |
| Se genera el link de pago                  | Cliente               | `POST /api/admin/payment-link`           |
| Se cobra el link de pago de una reserva    | Negocio y cliente     | `POST /api/stripe/webhook`               |

Sin `RESEND_API_KEY` el envío se omite y queda en los logs (`[email] ...`) —
comportamiento correcto, no un fallo. Para activarlo:

1. Crea la cuenta en [resend.com](https://resend.com) — puede ser con
   cualquier correo, pero mientras el dominio de abajo no esté verificado,
   Resend solo deja enviar a la dirección con la que se creó la cuenta.
2. Dashboard → API Keys → crea una y ponla en `RESEND_API_KEY`
   (`.env.local` en local, variables de entorno del proyecto en Vercel).
3. Dashboard → Domains → Add Domain, con un dominio propio ya comprado
   (`dibasiliomaid.com` en este proyecto). Resend da unos registros DNS para
   agregar en el proveedor donde se compró el dominio; una vez verificado
   (`status: "verified"`), el remitente en `src/lib/email.ts` (`FROM`) pasa a
   usar ese dominio en vez de `onboarding@resend.dev`, y ahí los correos
   pueden llegar a cualquier dirección, no solo a la de la cuenta.

`dibasiliomaid.com` ya está verificado — los correos al cliente (reserva
confirmada, link de pago, recibo) llegan de verdad, no solo los del negocio.
