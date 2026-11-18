-- ===========================================================================
-- Fotos del trabajo, unidas a una reseña
-- Noviembre 2026
-- ===========================================================================
--
-- Continuación de 2026-11-fase7-resenas.sql. Agrega UNA tabla y no toca
-- ninguna de las que ya existen.
--
-- Se corre a mano, una sola vez, en el SQL Editor del dashboard de Supabase.
-- No hay runner de migraciones en el proyecto.
--
-- Si lo corrés dos veces, el segundo intento falla con "already exists" y no
-- cambia nada — igual que el archivo de la fase 7, y por la misma razón:
-- preferible un error ruidoso a un `if not exists` que se saltee algo en
-- silencio.
--
-- ---------------------------------------------------------------------------
-- ANTES DE CORRER ESTO: hace falta un bucket de Storage
-- ---------------------------------------------------------------------------
--
-- En el dashboard de Supabase, Storage → New bucket:
--
--     Name:   review-photos
--     Public: SÍ (marcado)
--
-- Y nada más: sin restricción de tipo de archivo ni de tamaño, porque eso ya
-- lo valida el servidor antes de subir nada.
--
-- POR QUÉ PÚBLICO, que es la decisión menos obvia de todo esto: estas fotos
-- se muestran en la home, que es una página ESTÁTICA (`●` en el build,
-- entrada 22 de CLAUDE.md). Un bucket privado obliga a usar URLs firmadas, y
-- una URL firmada caduca — quedaría horneada dentro del HTML prerenderizado y
-- a las pocas horas las fotos de la home empezarían a fallar sin que nadie
-- tocara nada. Un bucket público da URLs permanentes, que es justo lo que una
-- página estática necesita.
--
-- Lo que SÍ protege el contenido es que la ruta de cada archivo lleva un
-- identificador aleatorio: no se puede listar el bucket ni adivinar rutas. Y
-- sobre todo, acá solo entran fotos que el equipo eligió subir a propósito
-- para enseñarlas — no hay nada del cliente que se suba solo.


begin;


-- ---------------------------------------------------------------------------
-- review_photos — las fotos de un trabajo terminado
-- ---------------------------------------------------------------------------
--
-- Cuelgan de la INVITACIÓN, no de la reseña. Es deliberado y tiene una razón
-- práctica: el equipo tiene las fotos cuando acaba de terminar el trabajo y
-- todavía está en la casa, que es días ANTES de que llegue la reseña. Si
-- colgaran de la reseña no habría dónde ponerlas hasta que el cliente
-- escribiera, y para entonces nadie se acuerda de subirlas.
--
-- Colgando de la invitación se pueden subir el mismo día. Cuando la reseña
-- llegue, ya están esperándola; y si no llega nunca, simplemente no se
-- muestran en ningún lado.
--
-- Además la invitación es el único punto común entre los dos tipos de
-- cliente: el que reservó por la web y el que llamó por teléfono. Colgarlas
-- de `bookings` dejaría fuera a los segundos, que es exactamente el error que
-- la entrada 21 de CLAUDE.md explica por qué no se cometió con las reseñas.
create table public.review_photos (
  id uuid primary key default gen_random_uuid(),

  -- `on delete cascade`: borrar una invitación se lleva su reseña (ya estaba)
  -- y ahora también sus fotos. Un solo borrado deja todo limpio.
  --
  -- Sin `unique`, al revés que `reviews.invite_id`: una reseña por invitación,
  -- pero varias fotos por invitación. De eso trata la tabla.
  invite_id uuid not null references public.review_invites(id) on delete cascade,

  -- La ruta dentro del bucket `review-photos`, por ejemplo
  -- "a1b2.../f3e4d5c6.webp". NO es la URL completa: la URL se arma en el
  -- código a partir de SUPABASE_URL. Guardar la URL entera ataría las filas al
  -- dominio actual del proyecto de Supabase, y mover el proyecto obligaría a
  -- reescribir cada fila.
  --
  -- `unique` como guardián, en el mismo espíritu que el resto del proyecto: si
  -- una subida se reintenta (mala señal, doble toque), el segundo insert choca
  -- acá en vez de crear una fila duplicada apuntando al mismo archivo.
  storage_path text not null unique,

  -- Las dimensiones del archivo YA REDIMENSIONADO, tal como queda guardado.
  -- Se guardan para poder escribir `width`/`height` en la etiqueta <img> de la
  -- home: sin eso el navegador no sabe cuánto espacio reservar y la página
  -- pega un salto cuando cada foto termina de cargar. En un teléfono, con la
  -- sección de reseñas a media pantalla, ese salto es muy visible.
  width integer not null check (width > 0),
  height integer not null check (height > 0),

  -- El orden en que se muestran. Lo decide quien las sube, por el orden en que
  -- las eligió.
  position smallint not null default 0,

  created_at timestamptz not null default now()
);

-- La consulta real siempre es "las fotos de estas invitaciones, en orden".
-- El índice compuesto en ese mismo orden deja que Postgres filtre y entregue
-- las filas ya ordenadas, sin ordenarlas en memoria.
create index review_photos_invite_position_idx
  on public.review_photos (invite_id, position);


-- ---------------------------------------------------------------------------
-- RLS — activo y sin políticas, igual que las otras tres tablas
-- ---------------------------------------------------------------------------
--
-- Mismo patrón que `bookings`, `review_invites` y `reviews`. "Activo sin
-- políticas" significa que nadie que use la clave pública puede leer ni
-- escribir esta tabla, ni siquiera un `select`. Es el estado final buscado, no
-- una configuración a medio hacer.
--
-- Todo pasa por /api/* en el servidor con `getSupabaseAdmin()`, que usa la
-- clave "secret" e ignora RLS por diseño.
--
-- Ojo con la asimetría, que es a propósito: la TABLA es inaccesible desde el
-- navegador, pero los ARCHIVOS del bucket son públicos. No se contradicen: la
-- tabla es la que dice qué foto va con qué trabajo, y eso no tiene por qué
-- ser consultable por nadie de fuera; los archivos, en cambio, se publican a
-- propósito en la home.
alter table public.review_photos enable row level security;


commit;


-- ---------------------------------------------------------------------------
-- Verificación. Queda al final para que sea lo último que imprima el editor.
-- ---------------------------------------------------------------------------
--
-- Tiene que devolver UNA fila: review_photos, con rls_activo = true.
select
  c.relname                as tabla,
  c.relrowsecurity         as rls_activo,
  count(a.attname)         as columnas
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
where n.nspname = 'public' and c.relname = 'review_photos'
group by c.relname, c.relrowsecurity;
