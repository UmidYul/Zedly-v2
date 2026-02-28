import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import type { UserRole } from "../lib/api";
import { useAuth } from "../state/auth-context";

type AppRole = UserRole | "admin";

const ADMIN_ROLES = new Set<AppRole>(["admin", "superadmin"]);

export function getDefaultRouteByRole(role: AppRole | null | undefined): string {
  if (!role) {
    return "/dashboard";
  }
  if (ADMIN_ROLES.has(role)) {
    return "/dashboard/admin";
  }
  if (role === "student") {
    return "/my-tests";
  }
  return "/dashboard";
}

interface GuardProps {
  children: ReactNode;
}

export function ProtectedRoute({ children }: GuardProps) {
  const { session, isBootstrapping } = useAuth();
  const location = useLocation();

  if (isBootstrapping) {
    return <div className="boot-screen">Загрузка сессии...</div>;
  }

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <>{children}</>;
}

export function PublicOnlyRoute({ children }: GuardProps) {
  const { session, isBootstrapping } = useAuth();

  if (isBootstrapping) {
    return <div className="boot-screen">Загрузка...</div>;
  }
  if (session) {
    return <Navigate to={getDefaultRouteByRole(session.me.role as AppRole)} replace />;
  }
  return <>{children}</>;
}

interface RoleRouteProps extends GuardProps {
  roles: AppRole[];
}

export function RoleRoute({ roles, children }: RoleRouteProps) {
  const { session } = useAuth();
  const role = session?.me.role as AppRole | undefined;

  if (!role || !roles.includes(role)) {
    return <Navigate to="/403" replace />;
  }

  return <>{children}</>;
}

export function AdminRoute({ children }: GuardProps) {
  const { session } = useAuth();
  const role = session?.me.role as AppRole | undefined;

  if (!role || !ADMIN_ROLES.has(role)) {
    return <Navigate to="/403" replace />;
  }

  return <>{children}</>;
}
