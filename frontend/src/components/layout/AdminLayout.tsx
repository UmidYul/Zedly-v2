import type { ReactNode } from "react";
import { AppShell } from "./AppShell";

interface AdminLayoutProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
}

export function AdminLayout({ title, subtitle, children }: AdminLayoutProps) {
  return (
    <AppShell>
      <section className="content-stack">
        <header className="admin-page-header">
          <h1>{title}</h1>
          {subtitle ? <p>{subtitle}</p> : null}
        </header>
        {children}
      </section>
    </AppShell>
  );
}
