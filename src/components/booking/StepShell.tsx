"use client";

import type { ReactNode } from "react";

/**
 * Una pregunta por pantalla: título grande, subtítulo de apoyo y el cuerpo
 * del paso. Nada más compite por la atención.
 */
export default function StepShell({
  title,
  subtitle,
  children,
  role,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  /** `radiogroup` en pasos de opción única; `group` en el resto. */
  role?: "radiogroup" | "group";
}) {
  return (
    <div>
      <h1 className="text-h2 font-bold leading-tight tracking-tight text-text sm:text-h1">
        {title}
      </h1>
      {subtitle && (
        <p className="mt-3 text-body leading-relaxed text-text-muted">
          {subtitle}
        </p>
      )}

      <div
        role={role}
        aria-label={title}
        className="mt-8 flex flex-col gap-3 pb-4"
      >
        {children}
      </div>
    </div>
  );
}
