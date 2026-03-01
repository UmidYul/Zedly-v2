import { useMemo } from "react";
import { useLocation } from "react-router-dom";

interface BreadcrumbItem {
  label: string;
  to?: string;
  current: boolean;
}

const ROUTE_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  admin: "Admin",
  users: "Пользователи",
  profile: "Профиль",
  classes: "Классы",
  "class-invites": "Классы",
  analytics: "Аналитика",
  results: "Результаты",
  tests: "Тесты",
  new: "Новый тест",
  "tests-workbench": "Мои тесты",
  "my-tests": "Мои тесты",
  "my-results": "История",
  logs: "Логи",
  settings: "Настройки"
};

function labelFromSegment(segment: string) {
  return ROUTE_LABELS[segment] || decodeURIComponent(segment);
}

export function useBreadcrumbs() {
  const location = useLocation();

  return useMemo<BreadcrumbItem[]>(() => {
    const parts = location.pathname.split("/").filter(Boolean);
    if (parts.length === 0) {
      return [{ label: "Home", current: true }];
    }

    return parts.map((part, index) => {
      const isLast = index === parts.length - 1;
      return {
        label: labelFromSegment(part),
        to: isLast ? undefined : `/${parts.slice(0, index + 1).join("/")}`,
        current: isLast
      };
    });
  }, [location.pathname]);
}
