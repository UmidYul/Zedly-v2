import { FormEvent, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ApiError } from "../lib/api";
import { buildDevTelegramAuthData } from "../lib/telegram-dev";
import { useAuth } from "../state/auth-context";
import { AuthShell } from "../components/layout/AuthShell";
import { InputField } from "../components/ui/InputField";

const DEV_BOT_TOKEN = import.meta.env.VITE_DEV_TELEGRAM_BOT_TOKEN as string | undefined;
const DEV_TELEGRAM_LOGIN_ID = Number(import.meta.env.VITE_DEV_TELEGRAM_LOGIN_ID || "1110001");

export function LoginPage() {
  const navigate = useNavigate();
  const { signIn, signInTelegram, error: authError, clearError } = useAuth();

  const [login, setLogin] = useState("teacher.a.schoola.1");
  const [password, setPassword] = useState("teacher-pass");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [telegramHint, setTelegramHint] = useState<string | null>(null);

  const canUseDevTelegram = useMemo(() => Boolean(DEV_BOT_TOKEN), []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setTelegramHint(null);
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

  async function onTelegramLogin() {
    if (!DEV_BOT_TOKEN) {
      setTelegramHint("Установите приложение Telegram, затем вернитесь сюда.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setTelegramHint(null);
    clearError();
    try {
      const authData = await buildDevTelegramAuthData({
        telegramId: DEV_TELEGRAM_LOGIN_ID,
        firstName: "Zedly",
        username: "zedly_user",
        botToken: DEV_BOT_TOKEN
      });
      const response = await signInTelegram(authData);
      if (response) {
        setTelegramHint(response.message);
        return;
      }
      navigate("/dashboard", { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Не удалось выполнить вход через Telegram");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell title="Вход в Zedly" subtitle="Введите логин и пароль, выданный администратором">
      <form className="stack-form" onSubmit={onSubmit}>
        <InputField
          label="Логин"
          value={login}
          placeholder="ali.karimov.9a.47"
          autoComplete="username"
          onChange={setLogin}
          disabled={submitting}
        />
        <InputField
          label="Пароль"
          type="password"
          value={password}
          placeholder="Введите пароль"
          autoComplete="current-password"
          onChange={setPassword}
          disabled={submitting}
        />
        <button type="submit" className="primary-button" disabled={submitting}>
          {submitting ? "Входим..." : "Войти"}
        </button>
      </form>

      <div className="auth-divider">или</div>

      <div className="telegram-box">
        <h3>Быстрый вход через Telegram</h3>
        <p>Нажмите кнопку, подтвердите действие в Telegram и вернитесь в Zedly.</p>
        <button type="button" className="secondary-button" onClick={() => void onTelegramLogin()} disabled={submitting}>
          Войти через Telegram
        </button>
        {!canUseDevTelegram && (
          <small>Установите приложение Telegram, затем вернитесь сюда.</small>
        )}
      </div>

      {(error || authError || telegramHint) && (
        <div className="error-box" role="alert">
          {error || authError || telegramHint}
        </div>
      )}

      <div className="inline-links">
        <Link to="/forgot-password">Забыли пароль?</Link>
      </div>
    </AuthShell>
  );
}
