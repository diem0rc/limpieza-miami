# Contexto del proyecto

Sitio de una empresa de limpieza en Miami. **Mobile-first**: la mayoría del
tráfico llega escaneando códigos QR desde el teléfono, así que el móvil es el
caso principal, no una adaptación.

Hechas las fases 1, 2, 4, 5 y 6 (setup, rutas bilingües, configurador de
reserva, cobro con Stripe, reservas en Supabase + Auth real). La fase 3 era
el motor de precios, que vino ya construido.

La marca ya no es placeholder: `brand.config.ts` tiene el nombre, logo y
paleta reales (DiBasilio Maid, celeste/terracota, tema claro) que llegaron a
mitad de proyecto — ver la entrada 10 más abajo. El pago tampoco es el
original: empezó como depósito al reservar + saldo cobrado a una tarjeta
guardada, se rediseñó a "no se cobra nada al reservar, se manda un link de
pago después" (entrada 8), y el registro de esas reservas pasó de un truco
sobre Stripe a una base de datos de verdad en Supabase (entrada 17).

El `README.md` explica la arquitectura y cómo poner en marcha Stripe. Este
archivo es lo otro: las decisiones deliberadas y las trampas, para no volver a
deducirlas ni "arreglar" cosas que están así a propósito.

# Regla dura: la lógica de `src/config/` no se toca; los valores sí

`brand.config.ts`, `pricing.config.ts` y `pricing.ts` los entregó el usuario ya
escritos y probados. La regla nunca fue "no tocar estos archivos jamás" —
es "no reescribir su lógica, ni duplicar sus valores en un componente; cuando
el negocio decide cambiar un precio, un color o una regla, se edita el valor
ahí y el resto del sitio lo refleja solo."

Esto ya pasó de verdad, dos veces, y ambas veces fue lo correcto:
- `pricing.config.ts`: `GLOBAL_MINIMUM` bajó de 165 a 90, `FREQUENCY_DISCOUNT.once`
  subió de 0 a 0.20, y `DEPOSIT_AMOUNT` bajó de 50 a 0 — los tres a pedido
  explícito del usuario, cambiando solo el número.
- `brand.config.ts`: se reemplazó entero cuando llegó la marca real (nombre,
  logo, paleta) — ver la entrada 10 de decisiones. Ya no es idéntico al
  placeholder original ni tiene sentido que lo sea.

`pricing.ts` (el motor: `calculatePrice()`, `getStepsFor()`) es el que de
verdad no se toca — es lógica pura, no datos, y sigue intacto.

**Lo que nunca se hace** es reescribir la ESTRUCTURA de `pricing.config.ts` o
`brand.config.ts`, ni hardcodear en un componente lo que debería venir de
ahí. Si un cambio pareciera exigir tocar la lógica de `pricing.ts` — no un
valor de `pricing.config.ts` — pregunta antes: eso sí sería nuevo.

# Versiones que no se comportan como esperarías

- **Next.js 16**: el Middleware pasó a llamarse Proxy. El archivo es
  `src/proxy.ts` y exporta `proxy`. No crear `middleware.ts`.
- **Tailwind v4**: no existe `tailwind.config.js`. El tema vive en
  `src/app/globals.css` dentro de `@theme inline`.
- **ESLint / react-hooks**: llamar a `setState` dentro de un `useEffect` es
  **error**, no aviso (`react-hooks/set-state-in-effect`, parte del ruleset
  del React Compiler que trae `eslint-config-next`). Por eso
  `src/lib/useClientNow.ts` usa `useSyncExternalStore` en lugar de un efecto.
  No lo simplifiques a un efecto: el lint lo rechaza y además
  `getServerSnapshot` es lo que evita el desajuste de hidratación con la hora
  del cliente. Mismo patrón en `src/lib/useAdminToken.ts` para leer
  `sessionStorage` sin efecto.
  Dos matices de esta regla que cuesta encontrar leyendo solo el mensaje de
  error (están en `node_modules/eslint-plugin-react-hooks/cjs/*.development.js`,
  función `validateNoSetStateInEffects`, si hace falta volver a mirar):
  - Se dispara aunque el `setState` esté detrás de una función llamada desde
    el efecto (`useEffect(() => { if (x) load(x) }, [x])` cuenta si `load`
    llama a `setState`), no solo cuando está escrito literal en el cuerpo.
  - Hay una vía de escape *documentada en el propio código* y activa por
    defecto (`enableAllowSetStateFromRefsInEffects`): si el `setState` está
    condicionado por un `ref` (`if (!algunRef.current) { algunRef.current =
    true; setState(...) }`), no se marca. Es el patrón que usa
    `AdminBookingsView.tsx` para la carga automática de la primera visita —
    no es un hack, es la forma soportada de decir "esto corre una sola vez".
    Un login nuevo por formulario, en cambio, dispara la carga directo desde
    el `onSubmit` (evento, no efecto), sin necesitar esta vía.
    Matiz encontrado con `IntroAnimation.tsx`: la vía de escape solo
    reconoce una **llamada incondicional** justo después de la guardia —
    `if (ref.current) return; ref.current = true; setState(...)` pasa, pero
    `if (ref.current) return; ref.current = true; if (condición) setState(...)`
    (un `if` extra metido en el cuerpo del efecto) NO pasa, aunque
    funcionalmente sea "lo mismo corriendo una sola vez". La condición tiene
    que vivir DENTRO de una función aparte (`useCallback`) que el efecto
    llama sin condicionales propios — mueve el `if` de dentro del efecto a
    dentro de la función.
  - Las llamadas a `Date.now()` / `Math.random()` cuentan como "impuras" y se
    rechazan si el analizador las ve alcanzables desde el cuerpo de un
    componente (regla `react-hooks/purity`), incluso dentro de una función que
    solo se invoca desde un `onClick`. Si hace falta un valor aleatorio para
    un evento, generarlo dentro del propio `onClick={() => fn(crypto.randomUUID())}`
    en el JSX evita el problema — `crypto.randomUUID()` no está en la lista de
    funciones marcadas como impuras, a diferencia de las otras dos.

# Decisiones deliberadas (no revertir sin preguntar)

1. **`--brand-*` en vez de `--color-*`.** `cssVariables()` de `brand.config.ts`
   emite los colores como `--color-*`, que es justo el namespace que Tailwind v4
   reserva para su paleta. `src/lib/brand-css.ts` los re-prefija para evitar la
   colisión. No es un descuido.

2. **`localeDetection: false`** en `src/i18n/routing.ts`. El español es el
   idioma por defecto por especificación. Con la detección por `Accept-Language`
   activada casi nadie vería español, porque los teléfonos en Miami reportan
   `en-US`. Los angloparlantes tienen el selector en el header.

3. **Segmentos de ruta en español en ambos idiomas** (`/en/reservar`, no
   `/en/book`), para que un mismo QR impreso funcione se abra como se abra.

4. **Stripe Checkout alojado**, no el Payment Element embebido — así se pagan
   los links de `/admin/reservas`. Con tráfico móvil, Checkout da Apple Pay y
   Google Pay sin código extra y ningún dato de tarjeta pasa por nuestro
   servidor.

5. **El servidor recalcula el precio siempre.** `src/lib/booking-payload.ts` es
   una frontera de seguridad, no una validación cosmética: descarta los campos
   que el servicio elegido no admite, de modo que un cliente manipulado no puede
   colar un descuento por frecuencia en post-construcción ni cobrarse
   adicionales de otro servicio. El importe que manda el navegador se ignora.

6. **Los horarios se interpretan en `America/New_York`**
   (`src/lib/timezone.ts`), no en la zona del servidor. En Vercel corre en UTC y
   el margen mínimo de 12 h se desviaría entre 4 y 5 horas.

7. **El número de pasos del configurador lo decide `getStepsFor()`**, nunca la
   UI. Varía según el servicio. No codificar la lista de pasos a mano.

8. **No se cobra nada al reservar; el cobro llega después por un link, y lo
   dispara el equipo a mano — solo cuando el servicio ya se marcó como
   completado.** Esto reemplazó un diseño anterior (depósito al reservar +
   saldo cobrado a una tarjeta guardada vía `off_session`) que el usuario
   descartó explícitamente: si no se cobra nada al reservar, pedirle la
   tarjeta al cliente en ese momento no tiene justificación — "el cliente no
   tiene razones para dar sus datos de la tarjeta". Por eso `/reservar` ya no
   toca Stripe para nada de dinero (`/api/bookings` solo inserta una fila en
   `bookings` de Supabase, ver entrada 17) y `/admin/reservas` genera un
   **Payment Link** — no un cargo directo — que ahora se envía solo por
   correo al cliente (antes era copiar y mandar a mano por WhatsApp/SMS; ver
   entrada 14 sobre por qué eso cambió).
   El paso "marcar servicio completado" antes de poder generar el link
   (`status: 'reservado' → 'completado'`) es nuevo en la fase 6: sin él,
   cualquier reserva pendiente podía generar su link en cualquier momento,
   incluso antes de hacer el trabajo. El guardián vive en el propio `update`
   de Supabase (`.eq('status', 'reservado')` / `.eq('status', 'completado')`
   según la transición), no solo en la UI — un clic duplicado o una carrera
   entre pestañas no puede saltarse el orden.
   El disparador sigue siendo manual **por la misma razón que antes**: el
   sistema no tiene forma de saber por sí solo si el trabajo se hizo (no hay
   app de campo), así que automatizarlo cobraría igual aunque el servicio se
   cancelara o cambiara de alcance. Eso no cambió con el rediseño — sigue
   siendo una decisión de producto, no un descuido técnico. No lo automatices
   ni le agregues guardado de tarjeta sin volver a preguntar.

9. **`/admin/reservas` usa Supabase Auth de verdad, no un secreto único.**
   Reemplazó al secreto compartido (`ADMIN_SECRET`, ya retirado de
   `.env.local`/Vercel) en la fase 6, exactamente como esta misma entrada ya
   anticipaba antes: "cuando exista autenticación de verdad, esto se
   reemplaza". Es un solo usuario — el dueño del negocio, creado por él mismo
   desde **Authentication → Users** del dashboard de Supabase, nunca por
   este código ni con una contraseña que pase por Claude. El login
   (`AdminBookingsView.tsx`) llama a `supabase.auth.signInWithPassword()` en
   el navegador con la clave "publishable" (pública a propósito) y guarda el
   `access_token` de la sesión con el mismo `useAdminToken()` de siempre — el
   servidor (`src/lib/admin-auth.ts`) valida ese token contra Supabase con la
   clave "secret" en cada request a `/api/admin/*`, sin manejo de cookies ni
   `@supabase/ssr`. El token expira en ~1h (lo decide Supabase); cuando eso
   pase, un 401 limpia la sesión guardada y vuelve a pedir login — no hay
   refresh token, a propósito: es una herramienta de un solo operador, no
   vale la pena la complejidad para eso.

10. **La marca real llegó como un `brand.config.ts` completo, no como
    instrucciones sueltas — así se debe seguir tratando.** El usuario mandó un
    archivo con la misma forma exacta que el original (mismos exports,
    mismas claves) y pidió explícitamente revisarlo y usarlo. Eso se
    reemplazó entero, EXCEPTO `COLORS.discount` (el rojo de la insignia de
    promoción, entrada 11): ese token no viene en los archivos que manda el
    cliente porque es una necesidad interna del sitio (distinguir una oferta
    del resto de la paleta), así que hay que volver a añadirlo a mano cada
    vez que llegue una paleta nueva — no es parte de lo que el cliente define.
    El logo (`public/logo.png`) llegó como una captura con fondo no
    transparente (gradiente celeste/beige), no un archivo de logo aislado —
    se usó tal cual al principio porque así se pidió, avisando que se veía
    como una caja de color en el header. Después el usuario SÍ pidió
    quitarlo, y se hizo localmente: un script propio (distancia de color de
    cada píxel contra una estimación del fondo por desenfoque gaussiano
    grande — no un modelo de IA genérico tipo `rembg`/u2net, que **desvaneció
    el texto del logo** al tratarlo como "no es el sujeto principal", bien
    documentado como fallo conocido de los modelos de recorte por saliencia
    en logos con texto plano + ícono). El PNG resultante ya está en el repo.
    Si algún día llega un archivo mejor (vector o PNG ya transparente del
    diseñador), es solo reemplazar `public/logo.png` — nada de código cambia.
    Lo que sigue sin hacerse sin que lo pidan explícitamente es *rediseñar*
    el logo (recortar composición, cambiar proporciones del arte, etc.) —
    eso sigue siendo decisión del usuario o su diseñador, no del código.
    Consecuencia práctica: el tema pasó de oscuro (teal) a **claro**
    (blanco/celeste/terracota). Esto no rompió nada porque nunca hubo un
    color hardcodeado fuera de `brand.config.ts` (verificado con
    `grep -rE "#[0-9a-fA-F]{3,6}"` sobre `src/` antes de cambiar la paleta) —
    exactamente el resultado que la regla de "todo color sale de un solo
    archivo" está diseñada para dar. Si algo se ve mal tras un cambio de
    paleta, el bug está en un componente con un color fuera de sitio, no en
    la paleta.

11. **`COLORS.discount` es un color que este proyecto añadió, no parte de la
    marca del cliente.** Sostiene la insignia "20% de descuento" del hero
    (`DiscountBadge.tsx`). Se eligió un rojo puro y distinto del acento de
    marca a propósito, para que la promo se lea como algo aparte del sistema
    de color habitual. Si se reemplaza `brand.config.ts` con una paleta nueva
    del cliente, este token no vendrá incluido — hay que volver a añadirlo
    (y quitarlo del todo cuando la promoción del 20% termine).

12. **`IntroAnimation.tsx` solo se monta en la home** (`(site)/page.tsx`),
    no en el layout raíz ni en `/reservar`. A propósito: es un momento de
    marca para la primera impresión, no algo que deba interponerse en el
    flujo de reserva, donde la velocidad es el punto ("reserva en menos de
    dos minutos"). Si algún día se pide en más páginas, hay que decidir cuál
    localStorage key gobierna eso — hoy `intro-seen` es una sola bandera
    global, no por página.
    El contenido detrás de la animación es la página real (la propia home
    ya renderizando, no una maqueta): `IntroAnimation` es una capa
    `position: fixed` que se agrega como hijo, no como wrapper — cubre lo
    que ya está montado debajo y se retira sola.
    Los colores de la animación (`IntroAnimation.module.css`) salen de
    `var(--brand-*)` como todo lo demás, con una excepción documentada:
    `COLORS.grime` (el beige "sucio") es un color que este proyecto añadió,
    igual que `discount` — no viene de la marca del cliente. Las texturas
    menores (mota, huella, rayón) no tienen cada una su propio token: se
    derivan con `color-mix()` de los tokens que ya existen. No es descuido,
    es la misma decisión que con `discount`: colores de un efecto puntual,
    no identidad de marca, no necesitan un catálogo propio.

13. **`ALLOW_INDEXING` pasó a `true`.** El criterio ya estaba escrito de
    antemano en `src/lib/seo.ts`: nombre, logo, teléfono y correo reales,
    los cuatro. Con `phone`/`email` puestos en `brand.config.ts` se cumplían
    los cuatro, así que se activó sin volver a preguntar — es la condición
    que el propio comentario del código dejó planteada, no una decisión
    nueva. Si el sitio vuelve a quedar a medias por cualquier motivo (otro
    rediseño, otra marca placeholder), es ese archivo el que hay que tocar,
    no `robots.ts` (ese solo lee la bandera).

14. **Los avisos por correo van al negocio Y al cliente — esto cambió en la
    fase 6.** Originalmente el usuario pidió explícitamente "que me lleguen
    los correos a mí" y solo se avisaba al negocio; al construir la fase 6
    confirmó que quería automatizar también los correos al cliente (reserva
    confirmada, link de pago, recibo de pago), así que esta entrada quedó
    revertida a propósito — no es una regresión, es una decisión de negocio
    posterior y explícita. `BRAND.email` sigue siendo a la vez el correo de
    contacto público Y el destino de los avisos al negocio (un solo campo,
    dos usos, sigue siendo la misma dirección real del negocio); los correos
    al cliente van a `contact_email` de cada reserva, en su propio idioma
    (`booking.locale`, guardado en la fila).
    Se eligió Resend por ser lo más simple de integrar con Next.js, sin que
    el usuario haya pedido un proveedor específico — si alguna vez se
    quiere otro (SendGrid, Postmark, SMTP de Gmail), es reemplazar
    `src/lib/email.ts` entero, nada más lo importa por su forma interna.
    Nota de otra sesión del usuario: existe un proyecto separado ("AI
    Automation", con n8n y cal.com) que maneja correos de otra forma — no
    tiene relación con este sitio y no aplica aquí; confirmado explícitamente
    por el usuario, no asumir integración entre ambos sin que lo pida.
    **`dibasiliomaid.com` ya está verificado en Resend** (el usuario ya tenía
    el dominio comprado; lo agregó en Resend y quedó `status: "verified"` con
    envío habilitado casi de inmediato). `FROM` en `src/lib/email.ts` pasó de
    `onboarding@resend.dev` (el remitente de pruebas, que solo entrega a la
    dirección de la cuenta) a `reservas@dibasiliomaid.com`. Verificado con un
    correo real a una dirección que NO es la de la cuenta de Resend
    (`najibndrs@gmail.com`, `delivered` según la propia API) y con una
    reserva real en producción cuyo correo "Reserva confirmada" llegó a esa
    misma dirección — los 3 correos al cliente ya salen de verdad, no solo al
    negocio. Si algún día el dominio deja de estar verificado (vencido, DNS
    movido a otro proveedor), Resend vuelve a rechazar el envío a cualquier
    dirección que no sea `BRAND.email` — eso se ve como un error de Resend en
    los logs (`[email] Resend rechazó el envío...`), no como un bug de código.

15. **La insignia de descuento del hero ya no es un elemento suelto — vive
    DENTRO del mismo `<Link>` que "Cotizar y reservar".**
    `PrimaryCtaWithDiscount.tsx` reemplazó a `DiscountBadge.tsx` (borrado, sin
    referencias) a pedido explícito: el usuario quería que clickear la
    insignia llevara a reservar, igual que el botón. Al anidar la insignia
    (`position: absolute`, esquina superior derecha, `-top-3 -right-3`)
    DENTRO del `<a>` en vez de al lado, cualquier punto del conjunto dispara
    la misma navegación — no hizo falta ningún `onClick` extra ni
    duplicar el `href`. Verificado clickeando la insignia específicamente
    (no el botón): navega a `/reservar`.
    Texto corto a propósito (`discountBadgeShort`, "-20%") en vez del
    `discountBadge` completo ("20% de descuento") — no cabe legible en una
    insignia de esquina pequeña. El texto completo se conserva de todos
    modos, oculto visualmente pero leído por lectores de pantalla
    (`sr-only`, después del texto del botón) — la insignia visual lleva
    `aria-hidden` para no duplicar el anuncio.
    Se agregó `COLORS.onDiscount` (blanco) al mismo patrón que `discount` y
    `grime`: color de un efecto puntual, no de la marca del cliente.

16. **Los precios de cada tarjeta de Frecuencia se recalculan con
    `calculatePrice()`, nunca a mano en el componente.** `selectionOf()` se
    exportó desde `store.tsx` específicamente para esto: `FrequencyStep`
    arma una `BookingSelection` hipotética por cada opción (todo igual salvo
    la frecuencia) y llama al motor real — mismo camino que usaría el
    servidor para cobrar, así que nunca puede divergir. Verificado
    cambiando mascotas a "dos o más" (+$40) y confirmando que las cuatro
    tarjetas de Frecuencia recalcularon solas ($335→$375 de subtotal, los
    cuatro precios con descuento se movieron igual).
    El precio tachado (gris) solo se muestra si `total < subtotal` de
    verdad — no basta con que la tasa de descuento sea mayor a 0. El mínimo
    global (`GLOBAL_MINIMUM`) puede absorber el descuento entero en un
    trabajo pequeño, y tachar un precio igual o menor al que se cobra
    finalmente se leería al revés (como si costara más de lo que cuesta).

17. **Fase 6: las reservas viven en una tabla `bookings` de Supabase, no en
    metadatos de Stripe.** El truco anterior (un Customer de Stripe sin
    tarjeta ni cargo, con todo en `metadata`) siempre fue explícitamente
    temporal — este mismo archivo lo llamaba "mientras tanto" — y sus límites
    ya se habían encontrado en producción antes de reemplazarlo: la Search
    API de Stripe tardaba ~8s en indexar una reserva nueva, cada valor de
    metadata tiene tope de 500 caracteres, y no hay relaciones ni historial.
    Stripe ahora solo se usa para lo que es (Payment Links + su webhook);
    Supabase es la única fuente de verdad de una reserva.
    RLS está activo en `bookings` **sin ninguna política** — a propósito: el
    navegador nunca lee ni escribe esa tabla directo (ni con la clave
    pública), todo pasa por `/api/*` con la clave "secret" del servidor
    (`src/lib/supabase.ts`, `getSupabaseAdmin()`), que ignora RLS por
    diseño. La clave pública (`NEXT_PUBLIC_SUPABASE_ANON_KEY`) solo se usa
    para `auth.signInWithPassword()` — no puede tocar `bookings` aunque
    alguien la extraiga del bundle del cliente, que es justamente el punto
    de que sea pública.
    Estados de una reserva: `reservado → completado → link_enviado →
    pagado` (más `cancelado`, en el esquema pero sin acción de UI todavía —
    no construir un botón de cancelar sin que lo pidan). Cada transición usa
    un `update` con `.eq('status', <estado esperado>)` como guardián
    (`/api/bookings`, `/api/admin/bookings/[id]/complete`,
    `/api/admin/payment-link`, el webhook) — un clic duplicado, una carrera
    entre pestañas, o un webhook reintentado por Stripe no puede reenviar
    correos ni saltarse un paso, porque el `update` simplemente no afecta
    ninguna fila si el estado ya cambió.
    `total_cents` (no `total_price`, que es el número en dólares solo para
    mostrar) es lo único que arma el line item del Payment Link — igual que
    antes con `total_centavos` en los metadatos de Stripe, la razón no
    cambió: nunca derivar centavos parseando un string en dólares.
    Verificado de punta a punta con las claves reales del usuario, en local
    y en producción: reserva → fila en Supabase con los mismos números que
    mostró el configurador → login real en `/admin/reservas` (con un usuario
    de prueba creado y borrado por la API de Admin de Supabase, nunca con la
    contraseña real del dueño) → marcar completado → generar link → pagarlo
    de verdad en modo test de Stripe → el webhook de **producción** marcó
    `pagado` y hora en `paid_at` → los 5 correos del flujo completo
    (negocio ×2, cliente ×3) llegaron `delivered` según la propia API de
    Resend. La fila y el usuario de prueba se borraron después de verificar.

18. **`/api/cron/keep-alive` existe solo para que el proyecto gratis de
    Supabase nunca se pause solo.** El plan gratis de Supabase pausa un
    proyecto tras ~7 días sin ninguna petición a su API — un riesgo real
    para un negocio que recién empieza y puede pasar una semana sin una
    reserva ni una visita a `/admin/reservas`. Vercel Cron (`vercel.json`)
    llama esa ruta una vez al día; ella hace un `select ... head: true`
    sobre `bookings` (cuenta filas sin traerlas) solo para que cuente como
    actividad, nada de negocio real. Protegida por `CRON_SECRET` (401 sin el
    header correcto) siguiendo la recomendación de Vercel para sus cron
    jobs — no porque la ruta exponga nada sensible, sino para que no la
    dispare cualquiera. Si `CRON_SECRET` no está configurada, la ruta igual
    funciona sin verificar el header: mejor eso a que el proyecto se pause
    por un detalle de configuración que nadie notó.
    Si el negocio crece y esto deja de ser necesario (o se pasa a un plan de
    pago de Supabase, que no se pausa), esta ruta y su entrada en
    `vercel.json` se pueden borrar sin que nada más dependa de ellas.

19. **`public/videos/sala-limpieza.mp4` está reencodificado con un keyframe
    por cuadro (`-g 1 -keyint_min 1 -sc_threshold 0 -bf 0`) — el archivo que
    entregó Higgsfield originalmente traía UN SOLO keyframe en sus 120
    cuadros.** Esto no es un detalle cosmético: el scroll-scrubbing de
    `CleaningScrollVideo.tsx` pide `currentTime` en cada frame de scroll, y
    con un solo keyframe cada salto hacia el final del clip obligaba al
    navegador a decodificar la cadena completa de cuadros P/B intermedios —
    medido: ~35-50ms por salto hacia adelante contra ~4-8ms hacia atrás (la
    asimetría es la huella de este problema). Con un keyframe por cuadro,
    cualquier salto cuesta ~3-7ms parejo en cualquier dirección — más de 5x
    más rápido, y sin la asimetría. `tick()` además chequea `video.seeking`
    antes de pedir un salto nuevo, como segunda red de seguridad (sin esto,
    medido con un scroll simulado a 60fps: `currentTime` se quedaba pegado
    en 0 durante 3 segundos enteros porque los pedidos se acumulaban más
    rápido de lo que el decodificador resolvía).
    De paso se le quitó el audio (`-an`): el `<video>` va `muted`, así que
    la pista de audio que Higgsfield generó igual no se usaba para nada —
    solo pesaba.
    **Cuando llegue el video final en 1080p/6s (pendiente de créditos de
    Higgsfield), hay que reencodificarlo con este mismo comando antes de
    subirlo** — el problema es inherente a cómo generan estas herramientas
    el archivo, no algo puntual de este clip:
    ```bash
    ffmpeg -i ORIGINAL.mp4 -an -c:v libx264 -preset slow -crf 20 \
      -g 1 -keyint_min 1 -sc_threshold 0 -bf 0 -pix_fmt yuv420p sala-limpieza.mp4
    ```
    El costo es tamaño de archivo: un encode todo-keyframes pesa bastante
    más que uno con GOP largo a la misma calidad (2.7MB → 4.9MB en este
    clip de 4s) — sigue siendo "pocos MB", pero no asumir que un video más
    largo (6s a más resolución) vaya a pesar proporcionalmente poco; medir
    el archivo resultante antes de darlo por bueno.
    Verificado con `ffprobe -show_entries frame=pict_type` (confirma
    120/120 cuadros como `I`) y con una prueba de seeks reales contra el
    servidor de Next (el `python -m http.server` usado en un primer
    intento de medir esto NO sirve: no soporta `Range requests`, y sin eso
    cualquier medición de seek da resultados falsos — hay que probar contra
    un servidor que responda `206 Partial Content`).

20. **`CleaningScrollVideo` tiene una fuente de video (y de imagen fija)
    distinta para móvil, y el `<video>` se "ceba" con play()+pause() al
    montar — dos problemas reales de un usuario probando en su teléfono,
    no cosas que se vieran en el navegador de escritorio.**
    - **Recorte lateral:** el clip de escritorio es 16:9 (1280×720). Con
      `object-fit: cover` en un contenedor angosto y alto (un teléfono),
      eso significa escalar por la ALTURA y recortar casi todo el ANCHO —
      en un iPhone típico, se perdía más de dos tercios de la escena por
      los costados.
      **Primer intento (superado):** recortar el mismo archivo horizontal a
      9:16 con ffmpeg — funcionaba, pero el encuadre quedaba limitado a lo
      que ya existía en la toma de escritorio.
      **Versión actual:** un clip vertical generado aparte con Higgsfield
      (`wan2_7`, 1080×1920, 4s — mismo modelo y duración que el de
      escritorio por presupuesto de créditos), compuesto específicamente
      para pantalla angosta (cámara acercada al sofá y la mesa de café, no
      al ancho completo). A pedido explícito del usuario en esta iteración:
      más desorden inicial (ropa/manta, objetos y papeles en el piso y la
      mesa) y los cojines del sofá quedan simétricos y acomodados al final,
      no solo "sin desorden alrededor". Tiene un defecto conocido y
      **aceptado a propósito**: entre el segundo 1.5 y 2.5 se nota un
      fundido/doble-exposición (la mesa de café incluso cambia de diseño
      entre el inicio y el final) — el modelo económico generó esto como
      dos escenas mezcladas en vez de una toma continua. Un reintento con
      prompt ajustado ("sin fundido, mismos objetos exactos") habría
      costado 10 créditos más; el usuario prefirió aceptarlo así. Si esto
      molesta más adelante, reintentar la generación en vez de intentar
      arreglarlo en post-producción — no es algo que un recorte o un
      reencodificado puedan corregir.
      Mismo tratamiento anti-lag que el de escritorio (keyframe por cuadro,
      sin audio — Higgsfield generó audio de nuevo aunque el `<video>` va
      `muted`) y sus propias `sala-poster-vertical.jpg` (primer cuadro,
      desordenado) / `sala-limpia-vertical.jpg` (último cuadro, ordenado).
      La elección de qué archivo cargar es del propio navegador, sin JS:
      el `<video>` lleva dos `<source media="...">` (breakpoint `768px`,
      el mismo `md` de Tailwind) y el respaldo de `prefers-reduced-motion`
      usa `<picture>` con `<source media="...">` igual. Lo único que sí
      necesita JS es el atributo `poster` (no admite variantes por CSS) —
      de ahí `useIsNarrowViewport`, mismo patrón que
      `usePrefersReducedMotion`.
      Nota de implementación no obvia: `<picture>` no es un elemento
      reemplazado como `<video>`/`<img>` — sin `display: block` explícito
      es `inline` por defecto y no hereda el `width/height: 100%` que
      `.sticky` necesita pasarle a su hijo. `CleaningScrollVideo.module.css`
      pone `display: block` tanto en `.media` (el `<picture>`) como en
      `.media img` (la `<img>` de adentro) — un porcentaje de alto solo
      resuelve si CADA antecesor en la cadena ya tiene una altura definida,
      no alcanza con que la tenga el antecesor directo.
    - **El video no se veía en absoluto en un teléfono real** (aunque el
      alto del `runway` seguía ocupando su lugar en el scroll — la prueba
      de que era un problema de pintado, no de layout). Causa conocida de
      iOS Safari y algunos Android: un `<video>` al que nunca se le pidió
      reproducir no llega a decodificar ni pintar ningún cuadro, aunque
      `currentTime` se esté moviendo por JS por debajo. El arreglo es
      "cebarlo" una vez al montar — `video.play().then(() =>
      video.pause())`, con `.catch(() => {})` por si el navegador de
      cualquier forma bloquea el autoplay (con `muted` + `playsInline`
      normalmente no lo bloquea, pero si lo hiciera, el `poster` sigue
      cubriendo el hueco sin romper nada más).
    Ambos problemas solo se notan en un dispositivo real o con la emulación
    de viewport del navegador — un `next dev` en desktop sin emular no los
    muestra. Si se agrega contenido de video en otra parte del sitio,
    revisar si aplica el mismo tratamiento.

# Estado real de la infraestructura

- **Hay base de datos: Supabase, desde la fase 6.** Tabla `bookings` (ver
  entrada 17 de decisiones), con RLS activo y sin políticas — todo el acceso
  pasa por el servidor con la clave "secret". El esquema (SQL de creación de
  la tabla) no vive en el repo como migración versionada todavía — se corrió
  una vez a mano en el SQL Editor del dashboard de Supabase; si hace falta
  otra columna, es un `alter table` ahí, no un archivo que buscar aquí.
- **Auth también es de Supabase**, un solo usuario (el dueño,
  `dibasiliomaid@gmail.com`), creado desde el dashboard — ver entrada 9.
- **Los avisos por correo** (`src/lib/email.ts`, Resend) van al negocio
  (siempre) y al cliente (desde la fase 6, ver entrada 14) — **los 5 correos
  del flujo completo ya están verificados con envío real** en producción:
  reserva confirmada + nueva reserva al reservar, link de pago al generarlo,
  recibo + pago recibido al pagar — los cinco `delivered` según la propia
  API de Resend. `sendSafely()` sigue siendo el único punto de envío y nunca
  lanza; recibe `to` explícito ahora (antes siempre mandaba a `BRAND.email`).
  **`dibasiliomaid.com` está verificado en Resend** (`FROM` en
  `src/lib/email.ts` ya usa `reservas@dibasiliomaid.com`, no el dominio de
  pruebas) — confirmado enviando a una dirección que no es la de la cuenta
  de Resend y con una reserva real en producción cuyo correo llegó a esa
  dirección. Ya no hay ninguna restricción pendiente sobre a quién le puede
  llegar un correo.
- **Stripe, Supabase y el panel interno tienen claves reales configuradas**,
  tanto en `.env.local` como en Vercel (producción): `STRIPE_SECRET_KEY`
  (modo **test**, `sk_test_...`, sin mover dinero real), `STRIPE_WEBHOOK_SECRET`
  (endpoint real en el dashboard de Stripe, apuntando a
  `https://limpieza-miami.vercel.app/api/stripe/webhook`), `SUPABASE_URL` +
  `SUPABASE_SERVICE_ROLE_KEY` + `NEXT_PUBLIC_SUPABASE_URL` +
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`, y `RESEND_API_KEY`. `ADMIN_SECRET` se
  retiró de ambos entornos — ya no lo usa nada.
- **El flujo de reserva, el panel de admin y el webhook ya no son maquetas —
  y ya se probó el ciclo completo con claves reales**, en local y en
  producción: reservar → fila en Supabase → marcar completado → generar y
  enviar link → pagarlo de verdad en modo test → el webhook de producción
  marca `pagado` → los correos de pago salen. Toda la basura de prueba
  (fila de `bookings`, usuario de Auth temporal) se borró después de
  verificar.
- **`total_cents` en la fila de `bookings` es lo que de verdad se usa** para
  armar el Payment Link en `/api/admin/payment-link`, no `total_price` (ese
  es el número en dólares, solo para mostrar). No lo derives de nuevo
  redondeando el número en dólares — ya está en centavos exactos para eso.
- **No hay test runner instalado.** La verificación se hace levantando
  `npm run dev` (puerto 3000, ver `.claude/launch.json`) y conduciendo el
  navegador. Con el panel del navegador oculto los clicks reales fallan: usar
  `javascript_tool` para disparar eventos y capturas para comprobar.
  Un truco que costó descubrir: al automatizar el configurador con una
  secuencia larga de clics por JS, un solo `byText(...)` que no encuentra su
  botón (por ejemplo por un cambio de layout) deja el resto de la secuencia
  en un estado inconsistente sin lanzar un error visible de inmediato — el
  síntoma es terminar en una pantalla que no tiene sentido (la home, en vez
  del último paso) sin ninguna pista de qué falló. Si el resultado de una
  automatización no cuadra, no asumas que es un bug de la app: repetir el
  flujo paso a paso con un `read_page` de por medio en cada clic aísla si el
  problema está en el script o en el código.
  Para animaciones con un temporizador propio (como `IntroAnimation`, 9.6s):
  no confíes en cronometrar una captura de pantalla — la latencia de cada
  llamada a la herramienta del navegador es demasiado variable para acertar
  un instante concreto del timeline. Mejor verificar por JS con
  `getBoundingClientRect()`/`getComputedStyle()`/`textContent` justo después
  de navegar (sin `wait` de por medio): confirma cobertura, z-index y
  contenido sin depender de una captura bien cronometrada.

# Cómo verificar un cambio

```bash
npx tsc --noEmit && npx eslint . && npx next build
```

En la salida del build, **todas las páginas del sitio deben quedar como SSG
(`●`) en ambos idiomas**. Si alguna aparece como dinámica (`ƒ`) sin motivo,
suele faltar `setRequestLocale(locale)` en un layout o página — incluidos los
layouts de grupo `(site)` y `(booking)`. Las únicas rutas dinámicas legítimas
son `/api/*` y `/reservar/confirmacion`.

# Decisión tomada: nada de bloques autogenerados aquí

`next dev` genera un `AGENTS.md` con un bloque delimitado por marcadores
`nextjs-agent-rules` que ordena leer siempre `node_modules/next/dist/docs/`.
**El usuario pidió borrarlo y quitar esa instrucción**, así que `AGENTS.md` ya
no existe y este archivo tampoco lo importa.

El generador vive en `node_modules/next/dist/server/lib/generate-agent-files.js`
y no tiene interruptor: se dispara al arrancar `next dev` cuando detecta un
agente de IA por variables de entorno. Como ya no hay `AGENTS.md` donde alojar
el bloque, lo añadiría al final de **este** archivo. Por eso el script `dev` de
`package.json` arranca con `env -u` de esas variables: sin ellas la detección
devuelve null y no se escribe nada.

Si aun así ves reaparecer ese bloque aquí abajo (por ejemplo si alguien arranca
el servidor con `npx next dev` saltándose el script): **bórralo**, es la
decisión vigente. No recrees `AGENTS.md` para "recolocarlo", y no escribas los
marcadores literales en prosa dentro de este archivo — el generador busca el
primer marcador de apertura y el primer cierre posterior, así que un marcador
suelto en un párrafo haría que se tragara el texto que hay en medio.

Lo que se rechaza es la orden de leer esos docs *siempre*, no la fuente: siguen
en `node_modules/next/dist/docs/` para una consulta puntual, y las diferencias
de Next 16 que de verdad afectan a este proyecto ya están recogidas arriba.
