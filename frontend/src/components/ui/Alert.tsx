import type { HTMLAttributes } from "react";
import { CircleAlert, CircleCheckBig, Info, TriangleAlert, X } from "lucide-react";
import { cn } from "../../lib/cn";

type AlertVariant = "info" | "success" | "warning" | "danger";

interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  variant?: AlertVariant;
  title: string;
  message?: string;
  onDismiss?: () => void;
}

const ICON_MAP = {
  info: Info,
  success: CircleCheckBig,
  warning: TriangleAlert,
  danger: CircleAlert
};

export function Alert({ variant = "info", title, message, className, onDismiss, ...props }: AlertProps) {
  const Icon = ICON_MAP[variant];

  return (
    <section className={cn("ui-alert", `ui-alert-${variant}`, className)} role="alert" {...props}>
      <div className="ui-alert-icon-wrap">
        <Icon size={16} aria-hidden="true" />
      </div>
      <div className="ui-alert-content">
        <strong>{title}</strong>
        {message ? <p>{message}</p> : null}
      </div>
      {onDismiss ? (
        <button type="button" className="ui-alert-dismiss" onClick={onDismiss} aria-label="Dismiss alert">
          <X size={16} aria-hidden="true" />
        </button>
      ) : null}
    </section>
  );
}
