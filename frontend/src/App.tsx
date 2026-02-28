import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./state/auth-context";
import { ClassInvitesPage } from "./pages/ClassInvitesPage";
import { DashboardPage } from "./pages/DashboardPage";
import { FirstPasswordPage } from "./pages/FirstPasswordPage";
import { ForgotPasswordPage } from "./pages/ForgotPasswordPage";
import { LoginPage } from "./pages/LoginPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { ProfilePage } from "./pages/ProfilePage";
import { SchoolUsersPage } from "./pages/SchoolUsersPage";
import { TestsWorkbenchPage } from "./pages/TestsWorkbenchPage";

function Protected({ children }: { children: React.ReactNode }) {
  const { session, isBootstrapping } = useAuth();
  if (isBootstrapping) {
    return <div className="boot-screen">Загрузка сессии...</div>;
  }
  if (!session) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

function PublicOnly({ children }: { children: React.ReactNode }) {
  const { session, isBootstrapping } = useAuth();
  if (isBootstrapping) {
    return <div className="boot-screen">Загрузка...</div>;
  }
  if (session) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route
        path="/"
        element={<Navigate to="/dashboard" replace />}
      />
      <Route
        path="/login"
        element={
          <PublicOnly>
            <LoginPage />
          </PublicOnly>
        }
      />
      <Route
        path="/forgot-password"
        element={
          <PublicOnly>
            <ForgotPasswordPage />
          </PublicOnly>
        }
      />
      <Route
        path="/first-password"
        element={<FirstPasswordPage />}
      />
      <Route
        path="/dashboard"
        element={
          <Protected>
            <DashboardPage />
          </Protected>
        }
      />
      <Route
        path="/profile"
        element={
          <Protected>
            <ProfilePage />
          </Protected>
        }
      />
      <Route
        path="/school-users"
        element={
          <Protected>
            <SchoolUsersPage />
          </Protected>
        }
      />
      <Route
        path="/class-invites"
        element={
          <Protected>
            <ClassInvitesPage />
          </Protected>
        }
      />
      <Route
        path="/tests-workbench"
        element={
          <Protected>
            <TestsWorkbenchPage />
          </Protected>
        }
      />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
