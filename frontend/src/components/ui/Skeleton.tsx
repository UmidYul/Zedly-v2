import { cn } from "../../lib/cn";

type SkeletonVariant = "text" | "card" | "table-row" | "stat";

interface SkeletonProps {
  variant?: SkeletonVariant;
  className?: string;
}

const VARIANT_CLASS: Record<SkeletonVariant, string> = {
  text: "skeleton-text",
  card: "skeleton-card",
  "table-row": "skeleton-table-row",
  stat: "skeleton-stat"
};

export function Skeleton({ variant = "text", className }: SkeletonProps) {
  return <div className={cn("skeleton", VARIANT_CLASS[variant], className)} aria-hidden="true" />;
}
