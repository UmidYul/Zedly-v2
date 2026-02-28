import type { HTMLAttributes } from "react";
import { cn } from "../../lib/cn";

type BadgeVariant = "default" | "success" | "warning" | "danger" | "info" | "outline";
type BadgeSize = "sm" | "md";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
}

const VARIANT_CLASS: Record<BadgeVariant, string> = {
  default: "ui-badge-default",
  success: "ui-badge-success",
  warning: "ui-badge-warning",
  danger: "ui-badge-danger",
  info: "ui-badge-info",
  outline: "ui-badge-outline"
};

const SIZE_CLASS: Record<BadgeSize, string> = {
  sm: "ui-badge-sm",
  md: "ui-badge-md"
};

export function Badge({ className, variant = "default", size = "sm", children, ...props }: BadgeProps) {
  return (
    <span className={cn("ui-badge", VARIANT_CLASS[variant], SIZE_CLASS[size], className)} {...props}>
      {children}
    </span>
  );
}
