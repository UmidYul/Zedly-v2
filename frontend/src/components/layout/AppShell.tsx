import * as React from "react";
import { cn } from "../../lib/cn";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [collapsed, setCollapsed] = React.useState<boolean>(() => {
    if (typeof window === "undefined") {
      return false;
    }
    return window.localStorage.getItem("zedly.sidebar.collapsed") === "1";
  });

  React.useEffect(() => {
    window.localStorage.setItem("zedly.sidebar.collapsed", collapsed ? "1" : "0");
  }, [collapsed]);

  return (
    <div className={cn("app-shell-academic", collapsed && "sidebar-collapsed")}>
      <Sidebar collapsed={collapsed} onToggleCollapse={() => setCollapsed((prev) => !prev)} />
      <div className="app-main">
        <Topbar onToggleSidebar={() => setCollapsed((prev) => !prev)} />
        <main className="app-content-academic">{children}</main>
      </div>
    </div>
  );
}
