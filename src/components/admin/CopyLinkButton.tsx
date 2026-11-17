"use client";

import { useState } from "react";

/**
 * Botón de copiar con su propio "¡Copiado!" y una salida de emergencia.
 *
 * Existe para que los dos links del panel (el de pago y el de reseña) se
 * comporten igual sin repetir la lógica ni llevar en el componente padre un
 * registro de "cuál se copió" por cada fila.
 *
 * Copiar al portapapeles desde una web falla más de lo que parece y de
 * formas que no se pueden prever desde acá: `navigator.clipboard` no existe
 * fuera de un contexto seguro, Safari lo bloquea si la llamada no sale de un
 * gesto del usuario, algunos navegadores dentro de otras apps (el de
 * Instagram, el de Gmail) lo niegan sin más, y un permiso denegado hace que
 * la promesa se rechace en silencio.
 *
 * Por eso hay tres niveles, de mejor a peor, y el tercero no puede fallar:
 *
 * 1. `navigator.clipboard.writeText` — lo normal.
 * 2. `document.execCommand("copy")` sobre un campo seleccionado. Está
 *    obsoleto, pero funciona donde el primero no llega (contextos no
 *    seguros, navegadores viejos) y sigue soportado en todas partes.
 * 3. Si los dos fallan: se muestra el link completo en un campo que se
 *    selecciona solo al tocarlo, con la instrucción de copiarlo a mano.
 *
 * **La versión anterior de este archivo se tragaba el error en silencio**:
 * si el portapapeles fallaba, el botón no hacía absolutamente nada — ni
 * copiaba ni avisaba — y el link quedaba cortado por CSS en una línea que en
 * un teléfono no hay forma cómoda de seleccionar. Un fallo invisible es peor
 * que un fallo: deja pensando que la aplicación está rota.
 */
export default function CopyLinkButton({
  url,
  label = "Copiar link",
}: {
  url: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [manual, setManual] = useState(false);

  /**
   * El plan B. Necesita un campo de verdad en el documento y seleccionado:
   * `execCommand("copy")` copia lo que esté seleccionado, no lo que se le
   * pase. Se crea y se destruye en el momento para no dejar un campo
   * invisible suelto en cada fila de la lista.
   */
  function copiarConCampoTemporal(): boolean {
    const campo = document.createElement("textarea");
    campo.value = url;
    // Fuera de la vista pero dentro del documento: un `display: none` o un
    // `hidden` no se puede seleccionar, así que no se podría copiar.
    campo.setAttribute("readonly", "");
    campo.style.position = "fixed";
    campo.style.top = "-1000px";
    campo.style.opacity = "0";
    document.body.appendChild(campo);
    try {
      campo.select();
      campo.setSelectionRange(0, url.length);
      return document.execCommand("copy");
    } catch {
      return false;
    } finally {
      document.body.removeChild(campo);
    }
  }

  function ok() {
    setCopied(true);
    setManual(false);
    setTimeout(() => setCopied(false), 2000);
  }

  function copy() {
    // Sin `await` antes de pedir el portapapeles: Safari solo lo concede
    // dentro del gesto que lo disparó, y un `await` de por medio rompe esa
    // relación aunque el código se vea igual de correcto.
    const api = navigator.clipboard?.writeText(url);

    if (api) {
      api.then(ok, () => {
        if (copiarConCampoTemporal()) ok();
        else setManual(true);
      });
      return;
    }

    if (copiarConCampoTemporal()) ok();
    else setManual(true);
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={copy}
        className="h-11 w-full rounded-pill border-2 border-border-strong text-small font-semibold text-text transition-colors hover:bg-surface-hover"
      >
        {copied ? "¡Copiado!" : label}
      </button>

      {manual && (
        <div>
          <p className="text-small text-text-muted">
            Tu navegador no deja copiar solo. Toca el link y cópialo a mano:
          </p>
          {/*
            Un <input readonly> y no un <p>: en un teléfono, seleccionar
            texto dentro de un párrafo exige mantener pulsado y arrastrar dos
            manijas. En un campo, un toque lo selecciona entero.
          */}
          <input
            type="text"
            readOnly
            value={url}
            onFocus={(e) => e.currentTarget.select()}
            onClick={(e) => e.currentTarget.select()}
            className="mt-1 h-11 w-full rounded-md border-2 border-border bg-bg-alt px-3 text-tiny text-text"
          />
        </div>
      )}
    </div>
  );
}
