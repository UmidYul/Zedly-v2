import type { HTMLAttributes } from "react";
import { cn } from "../../lib/cn";

type AvatarSize = "sm" | "md" | "lg" | "xl";

interface AvatarProps extends HTMLAttributes<HTMLDivElement> {
  src?: string | null;
  alt?: string;
  name: string;
  size?: AvatarSize;
}

const SIZE_CLASS: Record<AvatarSize, string> = {
  sm: "ui-avatar-sm",
  md: "ui-avatar-md",
  lg: "ui-avatar-lg",
  xl: "ui-avatar-xl"
};

function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
}

export function Avatar({ src, alt, name, size = "md", className, ...props }: AvatarProps) {
  return (
    <div className={cn("ui-avatar", SIZE_CLASS[size], className)} {...props}>
      {src ? <img src={src} alt={alt || name} /> : <span>{getInitials(name) || "?"}</span>}
    </div>
  );
}

interface AvatarGroupProps extends HTMLAttributes<HTMLDivElement> {
  users: Array<{ id: string; name: string; src?: string | null }>;
  max?: number;
  size?: AvatarSize;
}

export function AvatarGroup({ users, max = 5, size = "sm", className, ...props }: AvatarGroupProps) {
  const visible = users.slice(0, max);
  const extra = Math.max(0, users.length - max);

  return (
    <div className={cn("ui-avatar-group", className)} {...props}>
      {visible.map((user) => (
        <Avatar key={user.id} name={user.name} src={user.src} size={size} />
      ))}
      {extra > 0 ? <span className="ui-avatar-group-extra">+{extra}</span> : null}
    </div>
  );
}
