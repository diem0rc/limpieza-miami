"use client";

import type { ReactNode } from "react";

/**
 * Tarjeta grande y tocable del configurador. La selección se marca con borde
 * grueso del color de acento — el borde mide siempre 2px para que marcar y
 * desmarcar no mueva el layout.
 */
export default function OptionCard({
  selected,
  onSelect,
  title,
  description,
  meta,
  metaMuted = false,
  multi = false,
  disabled = false,
  children,
}: {
  selected: boolean;
  onSelect: () => void;
  title: string;
  description?: string;
  /** Esquina derecha: normalmente el precio o el descuento. */
  meta?: string;
  metaMuted?: boolean;
  /** `true` en pasos de selección múltiple (adicionales). */
  multi?: boolean;
  disabled?: boolean;
  children?: ReactNode;
}) {
  return (
    <button
      type="button"
      role={multi ? "checkbox" : "radio"}
      aria-checked={selected}
      disabled={disabled}
      onClick={onSelect}
      className={`flex w-full min-h-[var(--brand-card-min-height)] items-start gap-4 rounded-lg border-2 p-5 text-left transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-45 ${
        selected
          ? "border-accent bg-surface-hover"
          : "border-border bg-surface hover:border-border-strong hover:bg-surface-hover"
      }`}
    >
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-3">
          <span className="text-h3 font-semibold leading-snug text-text">
            {title}
          </span>
          {meta && (
            <span
              className={`shrink-0 text-body font-semibold ${
                metaMuted ? "text-text-faint" : "text-accent"
              }`}
            >
              {meta}
            </span>
          )}
        </span>

        {description && (
          <span className="mt-1.5 block text-small leading-relaxed text-text-muted">
            {description}
          </span>
        )}

        {children}
      </span>

      {/* Indicador de selección; ocupa su espacio siempre. */}
      <span
        aria-hidden
        className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center border-2 transition-colors ${
          multi ? "rounded-sm" : "rounded-pill"
        } ${
          selected
            ? "border-accent bg-accent text-on-accent"
            : "border-border-strong text-transparent"
        }`}
      >
        <svg
          viewBox="0 0 16 16"
          className="h-3.5 w-3.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 8.5l3.5 3.5L13 4.5" />
        </svg>
      </span>
    </button>
  );
}
