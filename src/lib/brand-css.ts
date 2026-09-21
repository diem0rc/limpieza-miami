import { SHAPE, TYPE, cssVariables } from "@/config/brand.config";

/**
 * Traduce brand.config.ts a variables CSS que se inyectan en el `<html>`.
 *
 * Detalle importante: `cssVariables()` emite los colores como `--color-*`,
 * que es exactamente el namespace que Tailwind v4 reserva para su paleta.
 * Para que no choquen, aquí se re-prefijan a `--brand-*` y `globals.css`
 * mapea el namespace de Tailwind a estas vía `@theme inline`.
 *
 * Resultado: brand.config.ts sigue siendo la ÚNICA fuente de verdad. Cambiar
 * un color, un radio o un tamaño de fuente ahí actualiza todo el sitio, sin
 * tocar ningún componente ni el CSS.
 */
export function brandCssVariables(): string {
  const colors = cssVariables().replaceAll("--color-", "--brand-");

  const radius = Object.entries(SHAPE.radius).map(
    ([key, value]) => `--brand-radius-${key}: ${value};`,
  );

  const shape = [
    `--brand-card-min-height: ${SHAPE.cardMinHeight};`,
    `--brand-button-height: ${SHAPE.buttonHeight};`,
  ];

  // `--brand-size-*` y no `--brand-text-*`: este último chocaría con los
  // colores de texto (`--brand-text`, `--brand-text-muted`).
  const sizes = Object.entries(TYPE.scale).map(
    ([key, value]) => `--brand-size-${key}: ${value};`,
  );

  const weights = Object.entries(TYPE.weight).map(
    ([key, value]) => `--brand-weight-${key}: ${value};`,
  );

  return [colors, ...radius, ...shape, ...sizes, ...weights].join("\n");
}
