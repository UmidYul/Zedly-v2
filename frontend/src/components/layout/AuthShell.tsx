import { Link } from "react-router-dom";

interface AuthShellProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}

export function AuthShell({ title, subtitle, children }: AuthShellProps) {
  return (
    <div className="auth-shell">
      <aside className="auth-hero">
        <div className="auth-brandmark">ZD</div>
        <h1>Zedly Platform</h1>
        <p>Единый web + Telegram Mini App shell для школ, учителей и аналитики в реальном времени.</p>
        <ul>
          <li>Auth lifecycle v1 with cookie-first refresh</li>
          <li>School isolation + audit-ready backend</li>
          <li>PWA foundation for desktop and mobile</li>
        </ul>
      </aside>
      <section className="auth-panel">
        <header className="auth-panel-header">
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </header>
        {children}
        <footer className="auth-footer">
          <Link to="/login">Войти</Link>
          <Link to="/forgot-password">Забыли пароль</Link>
        </footer>
      </section>
    </div>
  );
}
