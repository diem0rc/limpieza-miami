import type { ComponentProps, ReactNode } from "react";
import { Link } from "@/i18n/navigation";

type Variant = "primary" | "secondary" | "ghost";

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-pill px-6 text-body font-semibold " +
  "transition-colors duration-150 select-none " +
  "disabled:cursor-not-allowed disabled:opacity-45";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-accent text-on-accent hover:bg-accent-hover active:bg-accent-hover",
  secondary:
    "border border-border-strong bg-surface text-text hover:bg-surface-hover",
  ghost: "text-text-muted hover:text-text",
};

/** Altura tomada de SHAPE.buttonHeight en brand.config.ts. */
const HEIGHT = "h-[var(--brand-button-height)]";

function classes(variant: Variant, full: boolean, className: string) {
  return [BASE, VARIANTS[variant], HEIGHT, full ? "w-full" : "", className]
    .filter(Boolean)
    .join(" ");
}

export function Button({
  variant = "primary",
  full = false,
  className = "",
  children,
  ...props
}: ComponentProps<"button"> & {
  variant?: Variant;
  full?: boolean;
  children: ReactNode;
}) {
  return (
    <button className={classes(variant, full, className)} {...props}>
      {children}
    </button>
  );
}

export function ButtonLink({
  href,
  variant = "primary",
  full = false,
  className = "",
  onClick,
  children,
}: {
  href: string;
  variant?: Variant;
  full?: boolean;
  className?: string;
  onClick?: () => void;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={classes(variant, full, className)}
    >
      {children}
    </Link>
  );
}
