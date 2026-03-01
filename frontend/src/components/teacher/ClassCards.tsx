import { Card } from "../ui/Card";
import { EmptyState } from "../ui/EmptyState";
import { Button } from "../ui/Button";
import type { TeacherClassInfo } from "../../types/teacher";

interface ClassCardsProps {
  classes: TeacherClassInfo[];
  onAssignClick: (classId: string) => void;
}

function formatStudents(count: number): string {
  const suffix = count === 1 ? "ученик" : count > 1 && count < 5 ? "ученика" : "учеников";
  return `${count} ${suffix}`;
}

export function ClassCards({ classes, onAssignClick }: ClassCardsProps) {
  if (classes.length === 0) {
    return (
      <Card>
        <Card.Header>
          <h2>Мои классы</h2>
        </Card.Header>
        <Card.Body>
          <EmptyState title="Пока нет классов" description="Обратитесь к администратору школы для привязки класса." />
        </Card.Body>
      </Card>
    );
  }

  return (
    <Card>
      <Card.Header>
        <h2>Мои классы</h2>
      </Card.Header>
      <Card.Body>
        <div className="teacher-class-grid">
          {classes.map((item) => (
            <article key={item.id} className="teacher-class-card">
              <h3>{item.name}</h3>
              <p>{formatStudents(item.studentsCount)}</p>
              <small>Актив: {item.lastActivity || "сегодня"}</small>
              <Button size="sm" variant="secondary" onClick={() => onAssignClick(item.id)}>
                Назначить тест
              </Button>
            </article>
          ))}
        </div>
      </Card.Body>
    </Card>
  );
}
