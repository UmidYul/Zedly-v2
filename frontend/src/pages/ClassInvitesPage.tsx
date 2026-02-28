import { FormEvent, useEffect, useMemo, useState } from "react";
import { AppShell } from "../components/layout/AppShell";
import { ClassInviteResponse, classesCreateInvite } from "../lib/api";
import { useAuth } from "../state/auth-context";

export function ClassInvitesPage() {
  const { session } = useAuth();
  const [classId, setClassId] = useState(session?.me.teacher_classes?.[0]?.class_id || "");
  const [invite, setInvite] = useState<ClassInviteResponse | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const classOptions = useMemo(() => session?.me.teacher_classes || [], [session?.me.teacher_classes]);

  useEffect(() => {
    if (!classId && classOptions.length) {
      setClassId(classOptions[0].class_id);
    }
  }, [classId, classOptions]);

  if (!session) {
    return null;
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session) {
      return;
    }
    if (!classId.trim()) {
      setError("Укажите class_id.");
      return;
    }
    setIsCreating(true);
    setError(null);
    setInvite(null);
    try {
      const response = await classesCreateInvite(session.tokens.access_token, classId.trim());
      setInvite(response);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Не удалось создать invite.");
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <AppShell>
      <section className="content-stack">
        <article className="panel-card">
          <h2>Invite-код класса</h2>
          <p className="panel-note">POST `/api/v1/classes/{'{class_id}'}/invite`.</p>
          {session.me.role !== "teacher" ? (
            <div className="error-box">Эта операция доступна только роли teacher.</div>
          ) : (
            <form className="stack-form" onSubmit={onSubmit}>
              {classOptions.length ? (
                <label className="input-field">
                  <span className="input-label">Класс</span>
                  <select value={classId} onChange={(event) => setClassId(event.target.value)}>
                    {classOptions.map((item) => (
                      <option key={item.class_id} value={item.class_id}>
                        {item.class_name} ({item.class_id})
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <label className="input-field">
                <span className="input-label">Class ID</span>
                <input value={classId} onChange={(event) => setClassId(event.target.value)} placeholder="cls_A_7A" />
              </label>
              {error ? <div className="error-box">{error}</div> : null}
              <button type="submit" className="primary-button" disabled={isCreating}>
                {isCreating ? "Создание..." : "Сгенерировать invite"}
              </button>
            </form>
          )}
        </article>

        {invite ? (
          <article className="panel-card">
            <h2>Invite создан</h2>
            <dl className="kv-grid">
              <dt>Class ID</dt>
              <dd>{invite.class_id}</dd>
              <dt>Code</dt>
              <dd>
                <strong>{invite.code}</strong>
              </dd>
              <dt>Expires</dt>
              <dd>{new Date(invite.expires_at).toLocaleString()}</dd>
              <dt>Telegram Link</dt>
              <dd>{`https://t.me/ZedlyBot?start=inv_${invite.code}`}</dd>
            </dl>
          </article>
        ) : null}
      </section>
    </AppShell>
  );
}
