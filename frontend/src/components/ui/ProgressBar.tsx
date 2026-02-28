import type { HTMLAttributes } from "react";
import { cn } from "../../lib/cn";

type ProgressVariant = "default" | "success" | "warning" | "danger";

interface ProgressBarProps extends HTMLAttributes<HTMLDivElement> {
  value: number;
  max?: number;
  labeled?: boolean;
  variant?: ProgressVariant;
}

export function ProgressBar({
  value,
  max = 100,
  labeled = false,
  variant = "default",
  className,
  ...props
}: ProgressBarProps) {
  const safeValue = Math.max(0, Math.min(max, value));
  const percent = Math.round((safeValue / max) * 100);

  return (
    <div className={cn("ui-progress-wrap", className)} {...props}>
      {labeled ? <span className="ui-progress-label">{percent}%</span> : null}
      <div className="ui-progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={safeValue}>
        <div className={cn("ui-progress-fill", `ui-progress-${variant}`)} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
