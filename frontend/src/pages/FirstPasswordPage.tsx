import { FormEvent, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ApiError } from "../lib/api";
import { AuthShell } from "../components/layout/AuthShell";
import { InputField } from "../components/ui/InputField";
import { useAuth } from "../state/auth-context";

type Step = "password" | "methods";

export function FirstPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { completeFirstPasswordChange, connectGoogleLogin, connectTelegramLogin } = useAuth();
  const challengeToken = useMemo(() => searchParams.get("challenge_token") || "", [searchParams]);

  const [step, setStep] = useState<Step>("password");
  const [newPassword, setNewPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function onChangePassword(event: FormEvent) {
    event.preventDefault();
    if (!challengeToken) {
      navigate("/login", { replace: true });
      return;
    }
    if (newPassword.length < 8 || !/\d/.test(newPassword)) {
      setError("Пароль должен содержать минимум 8 символов и хотя бы одну цифру.");
      return;
    }
    if (newPassword !== repeatPassword) {
      setError("Пароли не совпадают.");
      return;
    }
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      await completeFirstPasswordChange(challengeToken, newPassword, repeatPassword);
      setStep("methods");
      setSuccess("Пароль обновлён.");
    } catch (requestError) {
      if (requestError instanceof ApiError) {
        setError(requestError.message);
      } else {
        setError("Не удалось сменить пароль.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function onConnectGoogle() {
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      await connectGoogleLogin();
      setSuccess("Google подключен.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Не удалось подключить Google.");
    } finally {
      setSubmitting(false);
    }
  }

  async function onConnectTelegram() {
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      await connectTelegramLogin();
      setSuccess("Telegram подключен.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Не удалось подключить Telegram.");
    } finally {
      setSubmitting(false);
    }
  }

  if (step === "methods") {
    return (
      <AuthShell title="Быстрый вход" subtitle="Хотите добавить быстрый вход?">
        <div className="stack-form">
          <button type="button" className="secondary-button" onClick={() => void onConnectGoogle()} disabled={submitting}>
            Подключить Google
          </button>
          <button type="button" className="secondary-button" onClick={() => void onConnectTelegram()} disabled={submitting}>
            Подключить Telegram
          </button>
          <button type="button" className="ghost-button" onClick={() => navigate("/dashboard", { replace: true })} disabled={submitting}>
            Пропустить — сделаю позже
          </button>
        </div>
        {error ? <div className="error-box">{error}</div> : null}
        {success ? <div className="success-box">{success}</div> : null}
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Придумайте свой пароль" subtitle="Одноразовый пароль нужно заменить перед началом работы">
      <form className="stack-form" onSubmit={(event) => void onChangePassword(event)}>
        <InputField
          label="Новый пароль"
          type="password"
          value={newPassword}
          onChange={setNewPassword}
          placeholder="Минимум 8 символов и 1 цифра"
          autoComplete="new-password"
          disabled={submitting}
        />
        <InputField
          label="Повторите пароль"
          type="password"
          value={repeatPassword}
          onChange={setRepeatPassword}
          placeholder="Повторите новый пароль"
          autoComplete="new-password"
          disabled={submitting}
        />
        <button type="submit" className="primary-button" disabled={submitting}>
          {submitting ? "Сохраняем..." : "Сохранить и продолжить"}
        </button>
      </form>
      {error ? <div className="error-box">{error}</div> : null}
      {success ? <div className="success-box">{success}</div> : null}
    </AuthShell>
  );
}
