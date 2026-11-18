"use client";

import { useRef, useState } from "react";
import {
  deletePhotoRequest,
  describePhotoFailure,
  uploadPhotoRequest,
  type PhotoFailureKind,
} from "@/lib/admin-review-client";
import { resizeForUpload } from "@/lib/image-resize";
import { MAX_PHOTOS_PER_INVITE, type ReviewPhoto } from "@/lib/review-types";

/**
 * Las fotos del trabajo terminado, subidas por el equipo.
 *
 * Se usa en los dos sitios donde existe una invitación: el bloque de Reseña
 * de una reserva web y cada fila de "Clientes sin reserva web". Es el mismo
 * componente porque es la misma tarea — las dos clases de cliente acaban con
 * una invitación, que es de lo que cuelgan las fotos.
 *
 * ESTAS FOTOS SON DEL NEGOCIO, NO DEL CLIENTE. La home las muestra con su
 * etiqueta ("Fotos del trabajo — DiBasilio Maid") separadas del texto de la
 * reseña. Presentarlas como si las hubiera tomado quien escribió la reseña es
 * precisamente lo que la regla de la FTC sobre reseñas considera engañoso, y
 * por eso la atribución no es opcional ni configurable.
 *
 * El redimensionado pasa en el navegador antes de subir nada — ver
 * `src/lib/image-resize.ts` para por qué no es opcional.
 */
export default function ReviewPhotosBlock({
  inviteId,
  photos,
  token,
  onChanged,
  onExpired,
}: {
  inviteId: string;
  photos: ReviewPhoto[];
  token: string;
  onChanged: () => void;
  onExpired: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const quedan = MAX_PHOTOS_PER_INVITE - photos.length;

  async function subir(elegidas: File[]) {
    setError(null);
    if (elegidas.length === 0) return;

    let fallo: PhotoFailureKind | null = null;

    for (let i = 0; i < elegidas.length; i++) {
      setBusy(`Subiendo ${i + 1} de ${elegidas.length}…`);

      const reducida = await resizeForUpload(elegidas[i]);
      if (!reducida) {
        fallo = "decode";
        break;
      }

      const outcome = await uploadPhotoRequest(
        inviteId,
        reducida.blob,
        reducida.width,
        reducida.height,
        token,
      );

      if (!outcome.ok) {
        if (outcome.kind === "expired") {
          setBusy(null);
          onExpired();
          return;
        }
        fallo = outcome.kind;
        break;
      }
    }

    setBusy(null);
    // Se recarga aunque alguna haya fallado: las anteriores sí se subieron y
    // tienen que aparecer. Mostrar el error y además perder las que sí
    // entraron sería engañoso.
    onChanged();
    if (fallo) setError(describePhotoFailure(fallo));
  }

  async function borrar(photo: ReviewPhoto) {
    setBusy("Borrando…");
    setError(null);
    const res = await deletePhotoRequest(photo.id, token);
    setBusy(null);

    if (res.expired) {
      onExpired();
      return;
    }
    if (!res.ok) {
      setError("No se pudo borrar. Intenta de nuevo.");
      return;
    }
    onChanged();
  }

  return (
    <div className="mt-3">
      <p className="text-tiny font-semibold uppercase tracking-wider text-text-faint">
        Fotos del trabajo
      </p>

      {photos.length > 0 && (
        <ul className="mt-2 grid grid-cols-4 gap-2">
          {photos.map((photo) => (
            <li key={photo.id} className="relative">
              {/*
                <img> y no next/image: estas fotos ya salen del navegador
                redimensionadas y en webp, así que el optimizador no tendría
                nada que mejorar — solo gastaría cuota del plan.
              */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.url}
                alt=""
                width={photo.width}
                height={photo.height}
                className="aspect-square w-full rounded-md border border-border object-cover"
              />
              <button
                type="button"
                disabled={!!busy}
                onClick={() => borrar(photo)}
                aria-label="Quitar esta foto"
                className="absolute -right-1.5 -top-1.5 grid h-6 w-6 place-items-center rounded-pill border-2 border-border-strong bg-surface text-small font-bold leading-none text-text disabled:opacity-50"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      {error && <p className="mt-2 text-small text-error">{error}</p>}

      {quedan > 0 ? (
        <>
          {/*
            El input va oculto y lo dispara el botón: el control de archivos
            nativo no se puede dar estilo, y en un teléfono se ve como un
            elemento ajeno al resto del panel. `multiple` permite elegir
            varias de una pasada por la galería.
          */}
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              // `Array.from` ANTES de limpiar `value`, y esto no es estilo:
              // `input.files` es una FileList VIVA, no una copia. Al poner
              // `value = ""` esa misma lista se vacía, así que una referencia
              // guardada antes se queda con cero archivos y no se sube nada.
              // Comprobado en el navegador: longitud 1 antes de limpiar, 0
              // después, sobre el mismo objeto.
              //
              // Y limpiar `value` hace falta: sin eso, elegir OTRA VEZ la
              // misma foto no dispararía el evento, así que borrar una y
              // volver a elegirla no haría nada.
              const elegidas = Array.from(e.currentTarget.files ?? []).slice(
                0,
                quedan,
              );
              e.currentTarget.value = "";
              if (elegidas.length > 0) subir(elegidas);
            }}
          />
          <button
            type="button"
            disabled={!!busy}
            onClick={() => inputRef.current?.click()}
            className="mt-2 h-11 w-full rounded-pill border-2 border-border-strong text-small font-semibold text-text transition-colors hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ??
              (photos.length === 0
                ? "Agregar fotos del trabajo"
                : `Agregar otra (quedan ${quedan})`)}
          </button>
        </>
      ) : (
        <p className="mt-2 text-tiny text-text-faint">
          Máximo {MAX_PHOTOS_PER_INVITE} fotos. Borra una para cambiarla.
        </p>
      )}
    </div>
  );
}
