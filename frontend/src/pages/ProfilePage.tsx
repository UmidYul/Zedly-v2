import { FormEvent, useEffect, useState } from "react";
import { AppShell } from "../components/layout/AppShell";
import { InputField } from "../components/ui/InputField";
import { useAuth } from "../state/auth-context";

export function ProfilePage() {
  const { session, updateProfile, reloadMe, getLoginMethods, connectGoogleLogin, connectTelegramLogin } = useAuth();
  const [fullName, setFullName] = useState("");
  const [language, setLanguage] = useState("uz");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [loginMethods, setLoginMethods] = useState<{ google_connected: boolean; telegram_connected: boolean } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!session) {
      return;
    }
    setFullName(session.me.full_name || "");
    setLanguage(session.me.language || "uz");
    setAvatarUrl(session.me.avatar_url || "");
  }, [session]);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!session) {
        return;
      }
      try {
        const methods = await getLoginMethods();
        if (active) {
          setLoginMethods(methods);
        }
      } catch {
        if (active) {
          setLoginMethods(null);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [session, getLoginMethods]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session) {
      return;
    }
    setIsSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await updateProfile({
        full_name: fullName.trim(),
        language,
        avatar_url: avatarUrl.trim() || undefined
      });
      setSuccess("Профиль обновлён.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Не удалось обновить профиль.");
    } finally {
      setIsSaving(false);
    }
  }

  async function onReloadProfile() {
    setError(null);
    setSuccess(null);
    try {
      await reloadMe();
      setSuccess("Данные профиля обновлены с сервера.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Не удалось обновить данные с сервера.");
    }
  }

  async function onConnectGoogle() {
    setError(null);
    setSuccess(null);
    setIsSaving(true);
    try {
      const next = await connectGoogleLogin();
      setLoginMethods(next);
      setSuccess("Google подключен.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Не удалось подключить Google.");
    } finally {
      setIsSaving(false);
    }
  }

  async function onConnectTelegram() {
    setError(null);
    setSuccess(null);
    setIsSaving(true);
    try {
      const next = await connectTelegramLogin();
      setLoginMethods(next);
      setSuccess("Telegram подключен.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Не удалось подключить Telegram.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <AppShell>
      <section className="content-stack">
        <article className="panel-card">
          <h2>Профиль</h2>
          <p className="panel-note">Редактируемые поля доступны через `/api/v1/users/me`.</p>
          <form className="stack-form" onSubmit={(event) => void onSubmit(event)}>
            <InputField
              label="ФИО"
              value={fullName}
              onChange={setFullName}
              placeholder="Ваше имя"
            />
            <label className="input-field">
              <span className="input-label">Язык</span>
              <select value={language} onChange={(event) => setLanguage(event.target.value)}>
                <option value="uz">uz</option>
                <option value="ru">ru</option>
              </select>
            </label>
            <InputField
              label="Avatar URL"
              value={avatarUrl}
              onChange={setAvatarUrl}
              placeholder="https://..."
            />
            {error ? <div className="error-box">{error}</div> : null}
            {success ? <div className="success-box">{success}</div> : null}
            <div className="row-actions">
              <button type="submit" className="primary-button" disabled={isSaving}>
                {isSaving ? "Сохранение..." : "Сохранить"}
              </button>
              <button
                type="button"
                className="ghost-button"
                onClick={() => void onReloadProfile()}
              >
                Обновить с сервера
              </button>
            </div>
          </form>
        </article>

        <article className="panel-card">
          <h2>Способы входа</h2>
          <p className="panel-note">Подключите быстрый вход через Google и Telegram. Можно сделать это в любой момент.</p>
          <ul className="simple-list">
            <li>
              <strong>Google</strong>
              <span>{loginMethods?.google_connected ? "Подключено" : "Не подключено"}</span>
            </li>
            <li>
              <strong>Telegram</strong>
              <span>{loginMethods?.telegram_connected ? "Подключено" : "Не подключено"}</span>
            </li>
          </ul>
          <div className="row-actions">
            <button type="button" className="secondary-button" onClick={() => void onConnectGoogle()} disabled={isSaving}>
              Подключить Google
            </button>
            <button type="button" className="secondary-button" onClick={() => void onConnectTelegram()} disabled={isSaving}>
              Подключить Telegram
            </button>
          </div>
        </article>

        {session?.me.teacher_classes?.length ? (
          <article className="panel-card">
            <h2>Мои классы</h2>
            <ul className="simple-list">
              {session.me.teacher_classes.map((item) => (
                <li key={item.class_id}>
                  <strong>{item.class_name}</strong>
                  <span>{item.class_id}</span>
                </li>
              ))}
            </ul>
          </article>
        ) : null}
      </section>
    </AppShell>
  );
}
