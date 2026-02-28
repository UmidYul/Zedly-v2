import { AppShell } from "../components/layout/AppShell";
import { useAuth } from "../state/auth-context";

export function DashboardPage() {
  const { session } = useAuth();

  return (
    <AppShell>
      <section className="panel-grid">
        <article className="panel-card">
          <h2>Профиль</h2>
          <dl>
            <dt>Имя</dt>
            <dd>{session?.me.full_name}</dd>
            <dt>Роль</dt>
            <dd>{session?.me.role}</dd>
            <dt>Школа</dt>
            <dd>{session?.me.school_id || "N/A"}</dd>
            <dt>Email</dt>
            <dd>{session?.me.email || "N/A"}</dd>
          </dl>
        </article>
        <article className="panel-card">
          <h2>Sprint 2-3 Status</h2>
          <ul>
            <li>Cookie-first refresh/logout enabled</li>
            <li>Dual lockout by identity + IP enabled</li>
            <li>Role-aware school users listing enabled</li>
          </ul>
        </article>
        <article className="panel-card">
          <h2>Новые разделы</h2>
          <ul>
            <li>Profile: редактирование `/users/me`</li>
            <li>School Users: фильтры role/status/search</li>
            <li>Class Invites: генерация кода для класса</li>
          </ul>
        </article>
      </section>
    </AppShell>
  );
}
