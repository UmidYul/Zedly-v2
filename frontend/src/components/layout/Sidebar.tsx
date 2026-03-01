import {
  BarChart3,
  BookOpen,
  Briefcase,
  Building2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FolderKanban,
  Gauge,
  GraduationCap,
  LayoutDashboard,
  LifeBuoy,
  Logs,
  Settings,
  ShieldCheck,
  TestTube2,
  UserCog,
  Users,
  Wrench
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { Avatar } from "../ui/Avatar";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { useAuth } from "../../state/auth-context";
import { cn } from "../../lib/cn";

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
}

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

type RoleKey = "director" | "teacher" | "student" | "admin";

const NAV_BY_ROLE: Record<RoleKey, NavGroup[]> = {
  director: [
    {
      title: "Школа",
      items: [
        { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
        { to: "/school-users", label: "School Users", icon: Users },
        { to: "/classes", label: "Классы", icon: GraduationCap }
      ]
    },
    {
      title: "Тесты",
      items: [
        { to: "/tests-workbench", label: "Все тесты", icon: TestTube2 },
        { to: "/analytics", label: "Результаты", icon: ClipboardList }
      ]
    },
    {
      title: "Аналитика",
      items: [{ to: "/analytics", label: "Обзор", icon: BarChart3 }]
    }
  ],
  teacher: [
    {
      title: "Рабочее место",
      items: [
        { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
        { to: "/tests", label: "Мои тесты", icon: TestTube2 },
        { to: "/tests/new", label: "Создать тест", icon: BookOpen },
        { to: "/class-invites", label: "Class Invites", icon: GraduationCap }
      ]
    },
    {
      title: "Account",
      items: [{ to: "/profile", label: "Profile", icon: UserCog }]
    },
    {
      title: "Аналитика",
      items: [{ to: "/analytics/results", label: "Результаты", icon: BarChart3 }]
    }
  ],
  student: [
    {
      title: "Обучение",
      items: [
        { to: "/tests-workbench", label: "Tests", icon: BookOpen },
        { to: "/my-tests", label: "Assignments", icon: TestTube2 },
        { to: "/my-results", label: "История", icon: ClipboardList }
      ]
    },
    {
      title: "Account",
      items: [{ to: "/profile", label: "Profile", icon: UserCog }]
    }
  ],
  admin: [
    {
      title: "Платформа",
      items: [
        { to: "/dashboard/admin", label: "Hub", icon: Gauge },
        { to: "/dashboard/admin/schools", label: "Школы", icon: Building2 },
        { to: "/dashboard/admin/users", label: "Пользователи", icon: Users }
      ]
    },
    {
      title: "Контент",
      items: [
        { to: "/dashboard/admin/tests", label: "Тесты", icon: TestTube2 },
        { to: "/dashboard/admin/categories", label: "Категории", icon: FolderKanban }
      ]
    },
    {
      title: "Операции",
      items: [
        { to: "/dashboard/admin/jobs", label: "Задачи", icon: Briefcase },
        { to: "/dashboard/admin/moderation", label: "Модерация", icon: ShieldCheck },
        { to: "/dashboard/admin/logs", label: "Логи", icon: Logs }
      ]
    },
    {
      title: "Система",
      items: [
        { to: "/dashboard/admin/settings", label: "Настройки", icon: Settings },
        { to: "/dashboard/admin/monitoring", label: "Мониторинг", icon: Wrench }
      ]
    }
  ]
};

function resolveRole(role: string | undefined): RoleKey {
  if (role === "director" || role === "teacher" || role === "student") {
    return role;
  }
  if (role === "admin" || role === "superadmin") {
    return "admin";
  }
  return "teacher";
}

export function Sidebar({ collapsed, onToggleCollapse }: SidebarProps) {
  const location = useLocation();
  const { session, signOut, signOutAll } = useAuth();
  const role = resolveRole(session?.me.role);
  const groups = NAV_BY_ROLE[role];

  return (
    <aside className={cn("app-sidebar", collapsed && "app-sidebar-collapsed", role === "admin" && "app-sidebar-admin")}>
      <div className="app-sidebar-header">
        <div className="app-sidebar-brand">
          <span className="brand-pill">ZD</span>
          {!collapsed ? (
            <div>
              <strong>Zedly</strong>
              <small>Academic Suite</small>
            </div>
          ) : null}
        </div>
        <button type="button" className="sidebar-collapse-btn" onClick={onToggleCollapse} aria-label="Toggle sidebar">
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      <nav className="app-sidebar-nav">
        {groups.map((group) => (
          <section key={group.title} className="app-sidebar-group">
            {!collapsed ? <h3>{group.title}</h3> : null}
            {group.items.map((item) => {
              const isActive = location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);
              return (
                <Link key={item.to} to={item.to} className={cn("app-sidebar-link", isActive && "app-sidebar-link-active")}>
                  <item.icon size={16} />
                  {!collapsed ? <span>{item.label}</span> : null}
                </Link>
              );
            })}
          </section>
        ))}
      </nav>

      <footer className="app-sidebar-footer">
        <div className="app-sidebar-user">
          <Avatar name={session?.me.full_name || "Unknown"} src={session?.me.avatar_url} size={collapsed ? "sm" : "md"} />
          {!collapsed ? (
            <div>
              <strong>{session?.me.full_name || "Guest"}</strong>
              <Badge variant="outline">{session?.me.role || "guest"}</Badge>
            </div>
          ) : null}
        </div>
        <div className="app-sidebar-actions">
          <Button variant="ghost" size="sm" aria-label="Logout" onClick={() => void signOut()}>
            {collapsed ? "⎋" : "Выйти"}
          </Button>
          {!collapsed ? (
            <Button variant="ghost" size="sm" aria-label="Logout All" onClick={() => void signOutAll()}>
              Выйти со всех
            </Button>
          ) : null}
        </div>
        {!collapsed ? (
          <div className="app-sidebar-help">
            <LifeBuoy size={14} />
            <span>Support ready</span>
          </div>
        ) : null}
      </footer>
    </aside>
  );
}
