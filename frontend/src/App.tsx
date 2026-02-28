import { Navigate, Route, Routes } from "react-router-dom";
import { AdminCategoriesPage } from "./pages/AdminCategoriesPage";
import { AdminHubPage } from "./pages/AdminHubPage";
import { AdminJobsPage } from "./pages/AdminJobsPage";
import { AdminLogsPage } from "./pages/AdminLogsPage";
import { AdminModerationPage } from "./pages/AdminModerationPage";
import { AdminMonitoringPage } from "./pages/AdminMonitoringPage";
import { AdminSchoolsPage } from "./pages/AdminSchoolsPage";
import { AdminSettingsPage } from "./pages/AdminSettingsPage";
import { AdminTestsPage } from "./pages/AdminTestsPage";
import { AdminUsersPage } from "./pages/AdminUsersPage";
import { AnalyticsResultsPage } from "./pages/AnalyticsResultsPage";
import { AnalyticsOverviewPage } from "./pages/AnalyticsOverviewPage";
import { ClassInvitesPage } from "./pages/ClassInvitesPage";
import { DashboardPage } from "./pages/DashboardPage";
import { FirstPasswordPage } from "./pages/FirstPasswordPage";
import { ForgotPasswordPage } from "./pages/ForgotPasswordPage";
import { ForbiddenPage } from "./pages/ForbiddenPage";
import { LoginPage } from "./pages/LoginPage";
import { LandingPage } from "./pages/LandingPage";
import { MyResultsPage } from "./pages/MyResultsPage";
import { MyTestsPage } from "./pages/MyTestsPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { ProfilePage } from "./pages/ProfilePage";
import { SchoolUsersPage } from "./pages/SchoolUsersPage";
import { TestResultPage } from "./pages/TestResultPage";
import { TestSessionPage } from "./pages/TestSessionPage";
import { TestsWorkbenchPage } from "./pages/TestsWorkbenchPage";
import { AdminRoute, getDefaultRouteByRole, ProtectedRoute, PublicOnlyRoute, RoleRoute } from "./router/guards";
import { useAuth } from "./state/auth-context";

function RootRoute() {
  const { session, isBootstrapping } = useAuth();

  if (isBootstrapping) {
    return <div className="boot-screen">Инициализация...</div>;
  }
  if (!session) {
    return <Navigate to="/" replace />;
  }
  return <Navigate to={getDefaultRouteByRole(session.me.role)} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/home" element={<RootRoute />} />
      <Route path="/403" element={<ForbiddenPage />} />
      <Route
        path="/login"
        element={
          <PublicOnlyRoute>
            <LoginPage />
          </PublicOnlyRoute>
        }
      />
      <Route
        path="/forgot-password"
        element={
          <PublicOnlyRoute>
            <ForgotPasswordPage />
          </PublicOnlyRoute>
        }
      />
      <Route path="/first-password" element={<FirstPasswordPage />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard/admin"
        element={
          <ProtectedRoute>
            <AdminRoute>
              <AdminHubPage />
            </AdminRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard/admin/schools"
        element={
          <ProtectedRoute>
            <AdminRoute>
              <AdminSchoolsPage />
            </AdminRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard/admin/users"
        element={
          <ProtectedRoute>
            <AdminRoute>
              <AdminUsersPage />
            </AdminRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard/admin/tests"
        element={
          <ProtectedRoute>
            <AdminRoute>
              <AdminTestsPage />
            </AdminRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard/admin/categories"
        element={
          <ProtectedRoute>
            <AdminRoute>
              <AdminCategoriesPage />
            </AdminRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard/admin/jobs"
        element={
          <ProtectedRoute>
            <AdminRoute>
              <AdminJobsPage />
            </AdminRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard/admin/moderation"
        element={
          <ProtectedRoute>
            <AdminRoute>
              <AdminModerationPage />
            </AdminRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard/admin/logs"
        element={
          <ProtectedRoute>
            <AdminRoute>
              <AdminLogsPage />
            </AdminRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard/admin/settings"
        element={
          <ProtectedRoute>
            <AdminRoute>
              <AdminSettingsPage />
            </AdminRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard/admin/monitoring"
        element={
          <ProtectedRoute>
            <AdminRoute>
              <AdminMonitoringPage />
            </AdminRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <ProfilePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/school-users"
        element={
          <ProtectedRoute>
            <RoleRoute roles={["director", "teacher"]}>
              <SchoolUsersPage />
            </RoleRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/users"
        element={
          <ProtectedRoute>
            <RoleRoute roles={["director", "teacher"]}>
              <SchoolUsersPage />
            </RoleRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/class-invites"
        element={
          <ProtectedRoute>
            <RoleRoute roles={["teacher", "director"]}>
              <ClassInvitesPage />
            </RoleRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/classes"
        element={
          <ProtectedRoute>
            <RoleRoute roles={["teacher", "director"]}>
              <ClassInvitesPage />
            </RoleRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/tests-workbench"
        element={
          <ProtectedRoute>
            <RoleRoute roles={["teacher", "student"]}>
              <TestsWorkbenchPage />
            </RoleRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/my-tests"
        element={
          <ProtectedRoute>
            <RoleRoute roles={["student"]}>
              <MyTestsPage />
            </RoleRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/my-results"
        element={
          <ProtectedRoute>
            <RoleRoute roles={["student"]}>
              <MyResultsPage />
            </RoleRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/test-session/:sessionId"
        element={
          <ProtectedRoute>
            <RoleRoute roles={["student"]}>
              <TestSessionPage />
            </RoleRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/test-result/:sessionId"
        element={
          <ProtectedRoute>
            <RoleRoute roles={["student"]}>
              <TestResultPage />
            </RoleRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/analytics/results"
        element={
          <ProtectedRoute>
            <RoleRoute roles={["teacher"]}>
              <AnalyticsResultsPage />
            </RoleRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/analytics"
        element={
          <ProtectedRoute>
            <RoleRoute roles={["director", "teacher"]}>
              <AnalyticsOverviewPage />
            </RoleRoute>
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
