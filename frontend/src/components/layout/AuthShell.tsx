import { Link } from "react-router-dom";
import { CheckCircle2, Layers3, MessageCircle } from "lucide-react";
import { useState } from "react";
import { ThemeToggleButton } from "../ui/ThemeToggleButton";
import { useThemeMode } from "../../lib/theme";

interface AuthShellProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function AuthShell({ title, subtitle, children, footer }: AuthShellProps) {
  const { theme, toggleTheme } = useThemeMode();
  const [lang, setLang] = useState<"ru" | "uz">("ru");

  return (
    <div className="auth-shell auth-shell-v2 login-page">
      <aside className="auth-hero auth-hero-v2 login-left">
        <div className="login-left-visual" aria-hidden="true">
          <div className="visual-grid" />
          <div className="visual-orbit visual-orbit-1" />
          <div className="visual-orbit visual-orbit-2" />
          <div className="visual-orbit visual-orbit-3" />
          <span className="visual-tag tag-algebra">Algebra</span>
          <span className="visual-tag tag-physics">Physics</span>
          <span className="visual-tag tag-code">Code</span>
          <span className="visual-tag tag-language">Language</span>
        </div>
        <span className="auth-chip">Algebra</span>
        <span className="auth-chip auth-chip-right">Physics</span>
        <span className="auth-chip auth-chip-bottom">Language</span>
        <div className="auth-brand-row">
          <div className="auth-brandmark">Z</div>
          <strong>ZEDLY</strong>
        </div>
        <h1>Добро пожаловать</h1>
        <p>Современная образовательная платформа для школ Узбекистана</p>
        <ul className="auth-feature-list login-features">
          <li className="feature-item">
            <CheckCircle2 size={18} />
            <span>Безопасная аутентификация</span>
          </li>
          <li className="feature-item">
            <Layers3 size={18} />
            <span>Доступ для всех ролей</span>
          </li>
          <li className="feature-item">
            <MessageCircle size={18} />
            <span>24/7 Поддержка</span>
          </li>
        </ul>
      </aside>
      <section className="auth-panel auth-panel-v2 login-right">
        <div className="auth-panel-topbar login-header">
          <div className="auth-lang-group">
            <button
              type="button"
              className={`auth-lang-pill ${lang === "ru" ? "auth-lang-pill-active" : ""}`}
              onClick={() => setLang("ru")}
              aria-pressed={lang === "ru"}
            >
              RU
            </button>
            <button
              type="button"
              className={`auth-lang-pill ${lang === "uz" ? "auth-lang-pill-active" : ""}`}
              onClick={() => setLang("uz")}
              aria-pressed={lang === "uz"}
            >
              UZ
            </button>
          </div>
          <ThemeToggleButton theme={theme} onToggle={toggleTheme} />
        </div>
        <div className="login-form-container">
        <header className="auth-panel-header login-form-header">
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </header>
        {children}
        {footer ?? (
          <footer className="auth-footer">
            <Link to="/">На главную</Link>
            <Link to="/login">Войти</Link>
            <Link to="/forgot-password">Забыли пароль</Link>
          </footer>
        )}
        </div>
      </section>
    </div>
  );
}
