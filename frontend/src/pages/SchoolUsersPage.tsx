import { FormEvent, useEffect, useMemo, useState } from "react";
import { AppShell } from "../components/layout/AppShell";
import { MeResponse, SchoolUsersQuery, SchoolUsersResponse, usersListSchoolUsers, usersPatchSchoolUser } from "../lib/api";
import { useAuth } from "../state/auth-context";

const EMPTY_RESULT: SchoolUsersResponse = {
  school_id: "",
  users: [],
  total_in_scope: 0,
  filtered_total: 0,
  role: "all",
  status: "all",
  class_id: null,
  search: null
};

function UserRow({
  user,
  canManageStatuses,
  isMutating,
  onActivate,
  onDeactivate
}: {
  user: MeResponse;
  canManageStatuses: boolean;
  isMutating: boolean;
  onActivate: (userId: string) => void;
  onDeactivate: (userId: string) => void;
}) {
  const isManageableRole = ["teacher", "student", "psychologist", "parent"].includes(user.role);
  const canRenderActions = canManageStatuses && isManageableRole;

  return (
    <tr>
      <td>{user.full_name}</td>
      <td>{user.role}</td>
      <td>{user.status}</td>
      <td>{user.email || "N/A"}</td>
      <td>{user.phone || "N/A"}</td>
      <td>
        {canRenderActions && user.status !== "active" ? (
          <button type="button" className="ghost-button table-action" disabled={isMutating} onClick={() => onActivate(user.id)}>
            Активировать
          </button>
        ) : null}
        {canRenderActions && user.status === "active" ? (
          <button type="button" className="ghost-button table-action" disabled={isMutating} onClick={() => onDeactivate(user.id)}>
            Деактивировать
          </button>
        ) : null}
      </td>
    </tr>
  );
}

export function SchoolUsersPage() {
  const { session } = useAuth();
  const [role, setRole] = useState("all");
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [classId, setClassId] = useState("");
  const [result, setResult] = useState<SchoolUsersResponse>(EMPTY_RESULT);
  const [isLoading, setIsLoading] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const roleOptions = useMemo(() => {
    if (session?.me.role === "teacher") {
      return ["all", "student"];
    }
    return ["all", "student", "teacher", "director", "psychologist", "parent"];
  }, [session?.me.role]);

  async function loadUsers() {
    if (!session || !session.me.school_id) {
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const data = await usersListSchoolUsers(session.tokens.access_token, session.me.school_id, {
        role: role as SchoolUsersQuery["role"],
        status: status as SchoolUsersQuery["status"],
        search: search.trim() || undefined,
        class_id: classId.trim() || undefined
      });
      setResult(data);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Не удалось загрузить пользователей.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (!session?.me.school_id) {
      return;
    }
    void loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.me.school_id]);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSuccess(null);
    void loadUsers();
  }

  async function updateStatus(userId: string, statusValue: "active" | "inactive") {
    if (!session || !session.me.school_id) {
      return;
    }
    setIsMutating(true);
    setError(null);
    setSuccess(null);
    try {
      await usersPatchSchoolUser(session.tokens.access_token, session.me.school_id, userId, statusValue);
      setSuccess(`Статус пользователя обновлён: ${statusValue}.`);
      await loadUsers();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Не удалось изменить статус пользователя.");
    } finally {
      setIsMutating(false);
    }
  }

  return (
    <AppShell>
      <section className="content-stack">
        <article className="panel-card">
          <h2>Пользователи школы</h2>
          <p className="panel-note">Role-aware выборка: учитель видит только учеников своих классов.</p>
          <form className="filter-form" onSubmit={onSubmit}>
            <label className="input-field">
              <span className="input-label">Роль</span>
              <select value={role} onChange={(event) => setRole(event.target.value)}>
                {roleOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label className="input-field">
              <span className="input-label">Статус</span>
              <select value={status} onChange={(event) => setStatus(event.target.value)}>
                <option value="all">all</option>
                <option value="active">active</option>
                <option value="inactive">inactive</option>
                <option value="pending_approval">pending_approval</option>
              </select>
            </label>
            <label className="input-field">
              <span className="input-label">Поиск (ФИО)</span>
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Teacher / Student" />
            </label>
            <label className="input-field">
              <span className="input-label">Class ID (опционально)</span>
              <input value={classId} onChange={(event) => setClassId(event.target.value)} placeholder="cls_A_7A" />
            </label>
            <button type="submit" className="primary-button" disabled={isLoading}>
              {isLoading ? "Загрузка..." : "Применить фильтры"}
            </button>
          </form>
          {error ? <div className="error-box">{error}</div> : null}
          {success ? <div className="success-box">{success}</div> : null}
          <div className="metrics-row">
            <span>School: {result.school_id || session?.me.school_id || "N/A"}</span>
            <span>Total in scope: {result.total_in_scope}</span>
            <span>Filtered: {result.filtered_total}</span>
          </div>
        </article>

        <article className="panel-card table-panel">
          <h2>Список</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Имя</th>
                  <th>Роль</th>
                  <th>Статус</th>
                  <th>Email</th>
                  <th>Телефон</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {result.users.length ? (
                  result.users.map((user) => (
                    <UserRow
                      key={user.id}
                      user={user}
                      canManageStatuses={session?.me.role === "director"}
                      isMutating={isMutating}
                      onActivate={(userId) => {
                        void updateStatus(userId, "active");
                      }}
                      onDeactivate={(userId) => {
                        void updateStatus(userId, "inactive");
                      }}
                    />
                  ))
                ) : (
                  <tr>
                    <td colSpan={6}>Нет данных по текущему фильтру.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </article>
      </section>
    </AppShell>
  );
}
