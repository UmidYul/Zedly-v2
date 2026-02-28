import { FormEvent, useState } from "react";
import { ApiError, forgotPassword } from "../lib/api";
import { AuthShell } from "../components/layout/AuthShell";
import { InputField } from "../components/ui/InputField";

export function ForgotPasswordPage() {
  const [login, setLogin] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await forgotPassword(login);
      setSuccess(response.message || "Если аккаунт существует, инструкция отправлена.");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Не удалось обработать запрос");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell title="Забыли пароль" subtitle="Введите ваш логин, выданный администратором">
      <form className="stack-form" onSubmit={onSubmit}>
        <InputField
          label="Логин"
          value={login}
          onChange={setLogin}
          placeholder="ali.karimov.9a.47"
          disabled={submitting}
        />
        <button type="submit" className="primary-button" disabled={submitting}>
          {submitting ? "Отправляем..." : "Отправить ссылку"}
        </button>
      </form>
      {error && <div className="error-box">{error}</div>}
      {success && <div className="success-box">{success}</div>}
    </AuthShell>
  );
}
