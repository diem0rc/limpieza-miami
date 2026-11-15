-- ===========================================================================
-- Fase 7 — Sistema de reseñas
-- Noviembre 2026
-- ===========================================================================
--
-- PRIMER archivo de esquema versionado del proyecto.
--
-- Aclaración importante: el `create table bookings` original NO está acá.
-- Esa tabla se creó a mano en el SQL Editor del dashboard de Supabase durante
-- la fase 6 y nunca se guardó como migración (ver la entrada 17 de CLAUDE.md
-- y la sección "Estado real de la infraestructura"). Este archivo no la
-- reconstruye ni la modifica: solo agrega las dos tablas nuevas y las enlaza
-- con la que ya existe.
--
-- No hay runner de migraciones en el proyecto. Esto se corre a mano, una sola
-- vez, en el SQL Editor del dashboard de Supabase.
--
-- Está envuelto en `begin` / `commit` a propósito: si algo falla a mitad de
-- camino, no queda media estructura creada. O quedan las dos tablas completas,
-- o no queda nada.
--
-- Si lo corrés dos veces, el segundo intento falla con "already exists" y no
-- cambia nada. Eso es intencional: preferible un error ruidoso a que un
-- `if not exists` se saltee algo en silencio.


-- ---------------------------------------------------------------------------
-- PASO 0 — Verificación previa. Corré SOLO esto primero y mirá el resultado.
-- ---------------------------------------------------------------------------
--
-- Las llaves foráneas de abajo asumen que `bookings.id` es de tipo `uuid`.
-- El código del sitio no lo demuestra: el `insert` de /api/bookings nunca
-- escribe `id` (lo genera la base de datos con su valor por defecto) y
-- TypeScript solo lo declara como `string`. Como el esquema de `bookings` no
-- está versionado, no hay ningún archivo donde leer el tipo real.
--
-- Esta consulta lo confirma:
--
--     select column_name, data_type
--     from information_schema.columns
--     where table_schema = 'public'
--       and table_name   = 'bookings'
--       and column_name  = 'id';
--
-- Tiene que decir `uuid`. Si dijera `bigint`, `text` u otra cosa, avisame
-- antes de seguir: hay que cambiarle el tipo a `review_invites.booking_id`
-- para que coincida, o la llave foránea falla al crearse.


begin;


-- ---------------------------------------------------------------------------
-- TABLA 1 — review_invites
-- ---------------------------------------------------------------------------
--
-- Una invitación es el permiso para dejar UNA reseña. Es la pieza central del
-- diseño y existe para resolver un problema concreto: hay clientes que no
-- están en `bookings`.
--
-- El negocio tiene dos tipos de cliente:
--   - los que reservaron por la web   → tienen fila en `bookings`
--   - los que llamaron o escribieron  → NO tienen fila en ninguna parte
--
-- Si el link de reseña colgara de `bookings`, el segundo grupo quedaría sin
-- poder reseñar. Por eso la reseña cuelga de la invitación, y la invitación
-- puede o no tener una reserva detrás.
--
-- `gen_random_uuid()` es parte del núcleo de Postgres desde la versión 13, así
-- que acá no hace falta ningún prefijo de esquema (a diferencia de `crypt()` y
-- `gen_salt()`, que viven en el esquema `extensions`).

create table public.review_invites (
  id uuid primary key default gen_random_uuid(),

  -- El token es lo que viaja en la URL: /es/resena/{token}.
  -- `unique` acá no es decorativo: crea el índice con el que se busca la
  -- invitación en cada visita a la página de reseña. Sin él, cada apertura
  -- del link sería un recorrido completo de la tabla.
  token text not null unique,

  -- La reserva web de la que salió esta invitación. `null` = cliente
  -- telefónico, que no tiene reserva.
  --
  -- El `unique` garantiza "una invitación por reserva": aunque dos procesos
  -- intenten crearla al mismo tiempo (el panel y el webhook del pago, por
  -- ejemplo), la base de datos deja pasar una sola y la otra recibe el error
  -- 23505, que el código usa para volver a leer la que ya existe.
  --
  -- El detalle que hace que esto funcione: en Postgres, `unique` NO bloquea
  -- varios `null`, porque `null` nunca es igual a `null`. Así que podés tener
  -- cientos de invitaciones manuales (todas con `booking_id` nulo) y al mismo
  -- tiempo un máximo de una por cada reserva web. Una sola restricción cubre
  -- los dos casos.
  --
  -- `on delete cascade`: si se borra una reserva, se va su invitación con
  -- ella. No queremos invitaciones huérfanas apuntando a nada.
  booking_id uuid unique references public.bookings(id) on delete cascade,

  -- De dónde vino. 'web' = creada a partir de una reserva; 'manual' = la creó
  -- el dueño desde el panel para un cliente telefónico.
  source text not null check (source in ('web', 'manual')),

  customer_name text not null,

  -- Nullable a propósito: un cliente que llamó por teléfono puede no haber
  -- dado correo. En ese caso el link se le pasa por WhatsApp o SMS, copiándolo
  -- desde el panel.
  contact_email text,

  -- Uno de los valores de ServiceType en src/config/pricing.config.ts.
  -- El check mantiene la base de datos y el tipo de TypeScript sincronizados:
  -- si algún día se agrega un servicio nuevo, este check es uno de los dos
  -- lugares que hay que tocar (el otro es el union de TypeScript).
  service_type text not null check (
    service_type in ('residencial', 'airbnb', 'mudanza', 'comercial', 'postconstruccion')
  ),

  -- Nullable: en una invitación manual el dueño puede no recordar la fecha
  -- exacta, y no vale la pena bloquear la invitación por eso.
  service_date date,

  -- Los dos idiomas del sitio (src/i18n/routing.ts). Decide en qué idioma se
  -- le muestra el formulario al cliente y en qué idioma se le manda el correo.
  locale text not null default 'es' check (locale in ('es', 'en')),

  -- Última vez que se le mandó el link por correo. `null` = nunca se envió
  -- (normal en las invitaciones de clientes telefónicos sin correo). El panel
  -- lo usa para mostrar "Sin enviar" o "Enviada el {fecha}".
  emailed_at timestamptz,

  created_at timestamptz not null default now()
);


-- ---------------------------------------------------------------------------
-- TABLA 2 — reviews
-- ---------------------------------------------------------------------------
--
-- La reseña que escribió el cliente. Nace en `pendiente` y solo se ve en la
-- home cuando el dueño la publica.

create table public.reviews (
  id uuid primary key default gen_random_uuid(),

  -- De qué invitación salió. `not null`: no existe reseña sin invitación —
  -- no hay formulario público abierto, y eso es una decisión de cumplimiento,
  -- no de diseño (ver las reglas de reseñas más abajo).
  --
  -- El `unique` es el guardián contra dobles envíos, en el mismo espíritu que
  -- los `.eq('status', …)` del resto del proyecto: si el cliente toca "Enviar"
  -- dos veces con mala señal, el segundo insert choca con esta restricción,
  -- la API responde 409 y no se manda un aviso duplicado al negocio. El
  -- bloqueo vive en la base de datos, no en la UI, así que una carrera entre
  -- dos pestañas tampoco lo puede saltear.
  invite_id uuid not null unique references public.review_invites(id) on delete cascade,

  rating smallint not null check (rating between 1 and 5),

  -- El texto es opcional (por eso el default vacío), pero la columna es
  -- `not null` para no tener que distinguir entre "vacío" y "nulo" al
  -- mostrarla. El tope de 1000 caracteres es el mismo que valida el
  -- formulario; tenerlo también acá significa que ningún cliente manipulado
  -- puede guardar un texto de 50.000 caracteres llamando a la API directo.
  body text not null default '' check (char_length(body) <= 1000),

  -- El nombre con el que se publica. Se precarga como "María G." y el cliente
  -- lo puede editar.
  display_name text not null check (char_length(display_name) between 1 and 40),

  -- Copia del service_type de la invitación. Es duplicación deliberada: deja
  -- pintar la tarjeta de la home sin un join a review_invites.
  --
  -- Acá no le puse check de valores, al contrario que en review_invites: este
  -- valor no lo escribe nunca un cliente, lo copia nuestro servidor desde una
  -- fila que ya pasó el check de la otra tabla. Agregarlo también acá
  -- obligaría a tocar dos restricciones cada vez que se agregue un servicio.
  -- Si preferís la redundancia, decime y lo agrego.
  service_type text not null,

  -- Idioma en que la escribió el cliente. Las reseñas se muestran en su idioma
  -- original en las dos versiones del sitio.
  locale text not null check (locale in ('es', 'en')),

  -- El consentimiento para publicar. Que sea `not null` con check `= true`
  -- parece raro (una columna que solo puede valer `true`), y es a propósito:
  -- convierte "no publicamos sin permiso" en algo que la base de datos hace
  -- cumplir. Ningún camino del código, ni un bug futuro, puede guardar una
  -- reseña sin consentimiento. La fila es también el registro de que se dio.
  consent boolean not null check (consent = true),

  status text not null default 'pendiente' check (
    status in ('pendiente', 'publicado', 'rechazado')
  ),

  -- Por qué se rechazó u ocultó. Se llena desde una lista cerrada de motivos
  -- neutrales (lenguaje ofensivo, datos personales, no habla del servicio,
  -- spam o duplicada). No hay texto libre, justamente para que no pueda
  -- aparecer un motivo del tipo "es negativa".
  moderation_reason text,

  created_at timestamptz not null default now(),

  -- Cuándo se publicó. `null` mientras está pendiente o rechazada.
  published_at timestamptz
);

-- El índice que sirve a la consulta de la home: "las publicadas, más recientes
-- primero". Es compuesto y en ese orden porque Postgres primero filtra por
-- `status` y después ya encuentra las filas ordenadas por fecha, sin tener que
-- ordenarlas en memoria. Sirve igual al contador de pendientes del panel.
create index reviews_status_published_at_idx
  on public.reviews (status, published_at desc);


-- ---------------------------------------------------------------------------
-- RLS — activo y sin políticas, igual que `bookings`
-- ---------------------------------------------------------------------------
--
-- Mismo patrón que la tabla `bookings` (entrada 17 de CLAUDE.md). "Activo sin
-- políticas" significa: nadie que use la clave pública puede leer ni escribir
-- estas tablas, ni siquiera un `select`. No es un olvido ni una configuración
-- a medio hacer — es el estado final buscado.
--
-- Todo el acceso pasa por /api/* en el servidor con `getSupabaseAdmin()`, que
-- usa la clave "secret" y por diseño ignora RLS. El navegador nunca habla con
-- estas tablas directo, así que no hay nada que una política tenga que
-- permitir.
--
-- Esto es lo que hace seguro tener la clave pública dentro del bundle de
-- JavaScript: aunque alguien la extraiga, no alcanza nada.

alter table public.review_invites enable row level security;
alter table public.reviews        enable row level security;


commit;


-- ---------------------------------------------------------------------------
-- Después de crear: recargar la caché del esquema y COMPROBAR
-- ---------------------------------------------------------------------------
--
-- Supabase sirve su API a través de PostgREST, que guarda en memoria la lista
-- de tablas que conoce. Crear tablas a mano no actualiza esa lista sola: sin
-- este `notify`, la API sigue respondiendo "no encuentro la tabla" aunque la
-- tabla exista.

notify pgrst, 'reload schema';

-- La consulta de abajo va al final A PROPÓSITO: el SQL Editor de Supabase
-- muestra el resultado de la ÚLTIMA instrucción, así que esto es lo que vas a
-- ver al terminar. Tiene que devolver DOS filas (review_invites y reviews).
-- Si devuelve cero, algo no se creó y hay que mirar por qué — no asumas que
-- funcionó porque no apareció ningún error.

select table_schema, table_name
from information_schema.tables
where table_name in ('review_invites', 'reviews')
order by table_name;


-- ---------------------------------------------------------------------------
-- REGLAS DE RESEÑAS (cumplimiento) — no son preferencias de diseño
-- ---------------------------------------------------------------------------
--
-- Vienen de la regla de la FTC sobre reseñas de consumidores (16 CFR Part 465,
-- vigente desde octubre de 2024) y de la política de reseñas de Google. El
-- esquema de arriba está construido para sostenerlas:
--
-- 1. MODERACIÓN NEUTRAL. Una reseña solo se rechaza u oculta por motivos que
--    no tienen nada que ver con su calificación: lenguaje ofensivo, datos
--    personales de alguien, no habla del servicio, o spam/duplicada. NUNCA
--    por tener pocas estrellas ni por ser negativa. Por eso
--    `moderation_reason` se llena de una lista cerrada y no de texto libre.
--
-- 2. EL MISMO TRATO PARA TODOS. La invitación, el formulario y la pantalla de
--    gracias son idénticos sin importar la calificación. Nada de "si da 5
--    estrellas pasa X, si da menos pasa Y".
--
-- 3. SIN INCENTIVOS. Ningún descuento ni beneficio a cambio de una reseña.
--
-- 4. SOLO CLIENTES REALES. Solo puede reseñar quien tiene un token, y los
--    tokens salen de invitaciones. Las invitaciones manuales son únicamente
--    para clientes a los que de verdad se les hizo un servicio — nunca para
--    nosotros, familiares ni empleados.
--
-- 5. EL PROMEDIO Y EL TOTAL SON HONESTOS. Se calculan sobre todas las reseñas
--    publicadas. Como la moderación es neutral, representan lo que dicen los
--    clientes.
