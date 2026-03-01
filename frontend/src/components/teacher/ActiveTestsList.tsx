import { AlertCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "../ui/Badge";
import { Card } from "../ui/Card";
import { EmptyState } from "../ui/EmptyState";
import { ProgressBar } from "../ui/ProgressBar";
import type { TeacherActiveTest } from "../../types/teacher";

interface ActiveTestsListProps {
  tests: TeacherActiveTest[];
}

function deadlineSoon(deadlineAt?: string | null): boolean {
  if (!deadlineAt) {
    return false;
  }
  const delta = new Date(deadlineAt).getTime() - Date.now();
  return delta > 0 && delta <= 24 * 60 * 60 * 1000;
}

function progressVariant(progress: number): "warning" | "success" | "default" {
  if (progress < 30) {
    return "warning";
  }
  if (progress > 70) {
    return "success";
  }
  return "default";
}

export function ActiveTestsList({ tests }: ActiveTestsListProps) {
  if (tests.length === 0) {
    return (
      <Card>
        <Card.Header>
          <h2>Активные тесты</h2>
        </Card.Header>
        <Card.Body>
          <EmptyState
            title="Нет активных тестов"
            description="Создайте и назначьте первый тест."
            actionLabel="Создать тест"
            onAction={() => {
              window.location.href = "/tests/new";
            }}
          />
        </Card.Body>
      </Card>
    );
  }

  return (
    <Card>
      <Card.Header>
        <h2>Активные тесты</h2>
      </Card.Header>
      <Card.Body className="teacher-active-list">
        {tests.map((item) => (
          <article key={`${item.id}_${item.classId}`} className="teacher-active-row">
            <header>
              <div>
                <h3>{item.title}</h3>
                <p>
                  {item.className} · {item.completedCount} из {item.totalCount} учеников
                </p>
              </div>
              <Link to={`/results/${item.id}?class_id=${item.classId}`} className="teacher-inline-link">
                Смотреть →
              </Link>
            </header>

            <p className="teacher-active-meta">
              {item.startsNow ? <Badge variant="success">Идёт прямо сейчас</Badge> : null}
              {item.deadlineAt ? (
                <span className={deadlineSoon(item.deadlineAt) ? "teacher-deadline-soon" : undefined}>
                  {deadlineSoon(item.deadlineAt) ? <AlertCircle size={14} /> : null}
                  Дедлайн: {new Date(item.deadlineAt).toLocaleString("ru-RU")}
                </span>
              ) : null}
            </p>
            <ProgressBar value={item.progressPercent} variant={progressVariant(item.progressPercent)} labeled />
          </article>
        ))}
      </Card.Body>
    </Card>
  );
}
