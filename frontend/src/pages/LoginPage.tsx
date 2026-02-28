import { FormEvent, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { ApiError } from "../lib/api";
import { useAuth } from "../state/auth-context";
import { AuthShell } from "../components/layout/AuthShell";

export function LoginPage() {
  const navigate = useNavigate();
  const { signIn, error: authError, clearError } = useAuth();

  const [login, setLogin] = useState("teacher.a.schoola.1");
  const [password, setPassword] = useState("teacher-pass");
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    clearError();
    try {
      const challenge = await signIn(login, password);
      if (challenge) {
        navigate(`/first-password?challenge_token=${encodeURIComponent(challenge.challenge_token)}`, { replace: true });
        return;
      }
      navigate("/dashboard", { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Не удалось выполнить вход");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      title="Вход в систему"
      subtitle="Современная образовательная платформа для школ Узбекистана"
      footer={
        <footer className="auth-footer auth-footer-center">
          <Link to="/">← Вернуться на главную</Link>
        </footer>
      }
    >
      <form className="stack-form login-form" onSubmit={onSubmit}>
        <div className="form-group">
          <label htmlFor="username" className="form-label">
            Логин
          </label>
          <input
            id="username"
            name="username"
            type="text"
            className="form-input"
            value={login}
            placeholder="Введите логин"
            autoComplete="username"
            onChange={(event) => setLogin(event.target.value)}
            disabled={submitting}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="password" className="form-label">
            Пароль
          </label>
          <div className="password-input-wrapper auth-password-control-wrap">
            <input
              id="password"
              name="password"
              className="form-input auth-password-control"
              type={showPassword ? "text" : "password"}
              value={password}
              placeholder="Введите пароль"
              autoComplete="current-password"
              onChange={(event) => setPassword(event.target.value)}
              disabled={submitting}
              required
            />
            <button
              type="button"
              className={`password-toggle auth-password-toggle ${showPassword ? "active" : ""}`}
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        <div className="form-group form-checkbox">
          <label className="checkbox-label">
            <input type="checkbox" checked={remember} onChange={() => setRemember((prev) => !prev)} disabled={submitting} />
            <span>Запомнить меня</span>
          </label>
        </div>

        <button type="submit" className="primary-button btn-block" disabled={submitting}>
          <span>{submitting ? "Входим..." : "Войти"}</span>
        </button>
      </form>
      {(error || authError) && (
        <div className="error-box" role="alert">
          {error || authError}
        </div>
      )}
    </AuthShell>
  );
}
