import type { ButtonHTMLAttributes } from "react";
import { cn } from "../../lib/cn";

type TabsVariant = "line" | "segment";

export interface TabItem {
  id: string;
  label: string;
}

interface TabsProps {
  items: TabItem[];
  activeId: string;
  onChange: (id: string) => void;
  variant?: TabsVariant;
}

export function Tabs({ items, activeId, onChange, variant = "line" }: TabsProps) {
  return (
    <div className={cn("ui-tabs", `ui-tabs-${variant}`)} role="tablist">
      {items.map((item) => (
        <TabButton
          key={item.id}
          selected={item.id === activeId}
          onClick={() => onChange(item.id)}
          role="tab"
          aria-selected={item.id === activeId}
        >
          {item.label}
        </TabButton>
      ))}
    </div>
  );
}

function TabButton({ selected, className, ...props }: { selected: boolean } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" className={cn("ui-tab", selected && "ui-tab-active", className)} {...props} />;
}
