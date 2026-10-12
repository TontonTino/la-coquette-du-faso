import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type Variant = "or" | "action" | "noir" | "contour" | "contour-clair" | "discret" | "danger";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-medium transition-[background-color,color,border-color,box-shadow,transform] duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45 select-none whitespace-nowrap";

const variants: Record<Variant, string> = {
  /** Bouton principal des pages clientes : couleur d'action du salon (thème), texte lisible. */
  action: "bg-action text-action-texte hover:bg-action-fort shadow-carte",
  or: "bg-or text-noir hover:bg-[#d4b25e] shadow-or",
  noir: "bg-noir text-white hover:bg-noir-doux",
  contour: "border border-noir/15 bg-white text-noir hover:border-or hover:bg-creme",
  /** Contour pour fond noir. */
  "contour-clair": "border border-white/30 bg-transparent text-white hover:border-or hover:bg-white/10",
  discret: "text-encre hover:bg-noir/5",
  danger: "border border-rouge/30 bg-white text-rouge hover:bg-rouge-pale",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-4 text-sm",
  md: "h-11 px-5 text-sm",
  lg: "h-13 px-7 text-base",
};

export function buttonClasses(variant: Variant = "or", size: Size = "md", extra = "") {
  return `${base} ${variants[variant]} ${sizes[size]} ${extra}`;
}

export function Button({
  variant = "or",
  size = "md",
  className = "",
  loading,
  children,
  ...props
}: ComponentProps<"button"> & { variant?: Variant; size?: Size; loading?: boolean }) {
  return (
    <button type="button" className={buttonClasses(variant, size, className)} disabled={loading || props.disabled} aria-busy={loading || undefined} {...props}>
      {loading && <span className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden />}
      {children}
    </button>
  );
}

export function ButtonLink({
  href,
  variant = "or",
  size = "md",
  className = "",
  children,
}: {
  href: string;
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={buttonClasses(variant, size, className)}>
      {children}
    </Link>
  );
}
