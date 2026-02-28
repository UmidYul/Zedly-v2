import { Link } from "react-router-dom";
import { useAuth } from "../../state/auth-context";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const { session, signOut, signOutAll } = useAuth();
  const role = session?.me.role;

  return (
    <div className="app-shell">
      <header className="app-topbar">
        <div className="app-brand">
          <span className="brand-pill">ZD</span>
          <div>
            <strong>Zedly</strong>
            <small>Web Shell</small>
          </div>
        </div>
        <nav className="app-nav">
          <Link to="/dashboard">Dashboard</Link>
          <Link to="/profile">Profile</Link>
          {session?.me.school_id ? <Link to="/school-users">School Users</Link> : null}
          {role === "teacher" ? <Link to="/class-invites">Class Invites</Link> : null}
          {role === "teacher" || role === "student" ? <Link to="/tests-workbench">Tests</Link> : null}
        </nav>
        <div className="app-actions">
          <span className="app-role">{session?.me.role || "guest"}</span>
          <button type="button" onClick={() => void signOutAll()} className="ghost-button">
            Logout All
          </button>
          <button type="button" onClick={() => void signOut()} className="primary-button">
            Logout
          </button>
        </div>
      </header>
      <main className="app-content">{children}</main>
    </div>
  );
}
