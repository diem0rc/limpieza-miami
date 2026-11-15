"use client";

import { useState } from "react";

/**
 * Botón de copiar con su propio "¡Copiado!".
 *
 * Existe para que los dos links del panel (el de pago y el de reseña) se
 * comporten igual sin repetir la lógica ni llevar en el componente padre un
 * registro de "cuál se copió" por cada fila.
 */
export default function CopyLinkButton({
  url,
  label = "Copiar link",
}: {
  url: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // El portapapeles puede fallar sin permiso o fuera de HTTPS; el link
      // sigue visible en pantalla para copiarlo a mano.
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="h-11 w-full rounded-pill border-2 border-border-strong text-small font-semibold text-text transition-colors hover:bg-surface-hover"
    >
      {copied ? "¡Copiado!" : label}
    </button>
  );
}
