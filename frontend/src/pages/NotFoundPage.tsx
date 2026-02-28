import { Link } from "react-router-dom";
import { AuthShell } from "../components/layout/AuthShell";

export function NotFoundPage() {
  return (
    <AuthShell title="404" subtitle="Страница не найдена">
      <div className="error-box">
        Маршрут не существует. Вернитесь к странице входа.
      </div>
      <Link className="primary-button as-link" to="/login">
        Открыть Login
      </Link>
    </AuthShell>
  );
}
