import type { HTMLAttributes } from "react";
import { cn } from "../../lib/cn";

interface StatProps extends HTMLAttributes<HTMLDivElement> {
  label: string;
  value: string | number;
  delta?: number;
}

export function Stat({ label, value, delta, className, ...props }: StatProps) {
  const hasDelta = typeof delta === "number";

  return (
    <article className={cn("ui-stat", className)} {...props}>
      <span className="ui-stat-label">{label}</span>
      <strong className="ui-stat-value">{value}</strong>
      {hasDelta ? (
        <span className={cn("ui-stat-delta", delta >= 0 ? "ui-stat-delta-up" : "ui-stat-delta-down")}>
          {delta >= 0 ? "↑" : "↓"} {Math.abs(delta)}%
        </span>
      ) : null}
    </article>
  );
}
