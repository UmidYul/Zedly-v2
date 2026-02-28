import { Link } from "react-router-dom";
import { AuthShell } from "../components/layout/AuthShell";

export function ForbiddenPage() {
  return (
    <AuthShell title="403" subtitle="Недостаточно прав">
      <div className="error-box">У вашей роли нет доступа к этой странице.</div>
      <Link className="primary-button as-link" to="/">
        На главную
      </Link>
    </AuthShell>
  );
}
