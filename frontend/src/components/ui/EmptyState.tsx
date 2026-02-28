import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";
import { Button } from "./Button";

interface EmptyStateProps {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: LucideIcon;
}

export function EmptyState({ title, description, actionLabel, onAction, icon: Icon = Inbox }: EmptyStateProps) {
  return (
    <section className="ui-empty-state">
      <div className="ui-empty-icon">
        <Icon size={22} aria-hidden="true" />
      </div>
      <h3>{title}</h3>
      {description ? <p>{description}</p> : null}
      {actionLabel && onAction ? (
        <Button variant="secondary" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </section>
  );
}
