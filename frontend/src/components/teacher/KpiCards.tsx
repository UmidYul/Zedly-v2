import { BarChart3, CheckCircle2, ClipboardList, Trophy } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Card } from "../ui/Card";
import { Skeleton } from "../ui/Skeleton";
import type { TeacherKpiData } from "../../types/teacher";

interface KpiCardsProps {
  data: TeacherKpiData;
  loading?: boolean;
}

interface Item {
  id: string;
  icon: LucideIcon;
  label: string;
  value: string;
}

export function KpiCards({ data, loading = false }: KpiCardsProps) {
  const items: Item[] = [
    {
      id: "active_tests",
      icon: ClipboardList,
      label: "Активных тестов",
      value: String(data.activeTestsCount || 0)
    },
    {
      id: "completed_today",
      icon: CheckCircle2,
      label: "Прошли сегодня",
      value: String(data.studentsCompletedToday || 0)
    },
    {
      id: "avg_7d",
      icon: BarChart3,
      label: "Avg балл (7д)",
      value: `${Math.round(data.avgScore7d || 0)}%`
    },
    {
      id: "tests_month",
      icon: Trophy,
      label: "Тестов за месяц",
      value: String(data.testsCompletedMonth || 0)
    }
  ];

  return (
    <section className="teacher-kpi-grid" aria-label="Teacher KPIs">
      {items.map((item) => (
        <Card key={item.id} className="teacher-kpi-card" variant="flat">
          <Card.Body>
            <div className="teacher-kpi-icon">
              <item.icon size={16} />
            </div>
            <p className="teacher-kpi-label">{item.label}</p>
            {loading ? <Skeleton variant="text" className="teacher-kpi-skeleton" /> : <strong className="teacher-kpi-value">{item.value}</strong>}
          </Card.Body>
        </Card>
      ))}
    </section>
  );
}
