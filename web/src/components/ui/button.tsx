import { ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "primary" | "secondary" | "ghost";

const BASE_STYLES =
  "inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#f1e6d8] focus:ring-offset-0 disabled:pointer-events-none disabled:opacity-60";

const VARIANT_STYLES: Record<Variant, string> = {
  primary:
    "bg-[#c89b6d] text-white shadow-sm shadow-[#c89b6d]/40 hover:-translate-y-0.5 hover:bg-[#ad7a46] active:translate-y-0",
  secondary:
    "border border-[#ead8c4] bg-white text-[#ad7a46] shadow-sm shadow-[#ead8c4]/40 hover:-translate-y-0.5 hover:border-[#c89b6d] hover:text-[#c89b6d] active:translate-y-0",
  ghost:
    "bg-transparent text-[#7f6b5a] hover:bg-[#f1e6d8] hover:text-[#3d3128]",
};

export const buttonVariants = (
  variant: Variant = "primary",
  className?: string,
) => {
  return [BASE_STYLES, VARIANT_STYLES[variant], className]
    .filter(Boolean)
    .join(" ");
};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={buttonVariants(variant, className)}
        {...props}
      />
    );
  },
);

Button.displayName = "Button";
