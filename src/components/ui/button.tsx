import Link from "next/link";
import type { ComponentProps } from "react";

type Variant = "primary" | "outline" | "ghost";

const variants: Record<Variant, string> = {
  primary:
    "bg-terracotta text-white hover:bg-terracotta-dark shadow-soft border border-transparent",
  outline:
    "bg-transparent text-charcoal border border-charcoal/20 hover:border-terracotta hover:text-terracotta",
  ghost: "bg-transparent text-charcoal hover:bg-black/5",
};

export function Button({
  className = "",
  variant = "primary",
  ...props
}: ComponentProps<"button"> & { variant?: Variant }) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-pill px-5 py-2.5 text-sm font-medium transition ${variants[variant]} ${className}`}
      {...props}
    />
  );
}

export function ButtonLink({
  className = "",
  variant = "primary",
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant }) {
  return (
    <Link
      className={`inline-flex items-center justify-center gap-2 rounded-pill px-5 py-2.5 text-sm font-medium transition ${variants[variant]} ${className}`}
      {...props}
    />
  );
}
