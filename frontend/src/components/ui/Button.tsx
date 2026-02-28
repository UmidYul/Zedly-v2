import type { ButtonHTMLAttributes } from "react";
import { cn } from "../../lib/cn";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "link";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: "ui-button-primary",
  secondary: "ui-button-secondary",
  ghost: "ui-button-ghost",
  danger: "ui-button-danger",
  link: "ui-button-link"
};

const SIZE_CLASS: Record<ButtonSize, string> = {
  sm: "ui-button-sm",
  md: "ui-button-md",
  lg: "ui-button-lg"
};

export function Button({
  className,
  variant = "primary",
  size = "md",
  loading = false,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn("ui-button", VARIANT_CLASS[variant], SIZE_CLASS[size], className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <span className="ui-button-spinner" aria-hidden="true" /> : null}
      <span>{children}</span>
    </button>
  );
}
