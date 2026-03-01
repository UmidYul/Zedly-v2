import { CheckCircle2, Clock, PlayCircle } from "lucide-react";
import { Card } from "../ui/Card";
import type { TeacherEventItem } from "../../types/teacher";

interface EventFeedProps {
  events: TeacherEventItem[];
}

function relativeTime(iso: string): string {
  const date = new Date(iso);
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) {
    return "только что";
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes} мин назад`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours} ч назад`;
  }
  const days = Math.floor(hours / 24);
  return `${days} д назад`;
}

function eventCopy(item: TeacherEventItem): string {
  if (item.type === "test_overdue") {
    return `${item.studentName} просрочил тест «${item.testTitle || "без названия"}»`;
  }
  if (item.type === "test_started") {
    return `${item.studentName} начал тест`;
  }
  return `${item.studentName} завершил тест — ${item.score || 0}%`;
}

function EventIcon({ type }: { type: TeacherEventItem["type"] }) {
  if (type === "test_overdue") {
    return <Clock className="teacher-event-icon teacher-event-warning" size={16} />;
  }
  if (type === "test_started") {
    return <PlayCircle className="teacher-event-icon teacher-event-info" size={16} />;
  }
  return <CheckCircle2 className="teacher-event-icon teacher-event-success" size={16} />;
}

export function EventFeed({ events }: EventFeedProps) {
  return (
    <Card className="teacher-events-card">
      <Card.Header>
        <h2>Последние события</h2>
      </Card.Header>
      <Card.Body className="teacher-events-list">
        {events.slice(0, 15).map((item) => (
          <article key={item.id} className="teacher-event-row">
            <EventIcon type={item.type} />
            <div>
              <p>{eventCopy(item)}</p>
              <small>{relativeTime(item.timestamp)}</small>
            </div>
          </article>
        ))}
        {events.length === 0 ? <p className="panel-note">Новых событий пока нет.</p> : null}
      </Card.Body>
    </Card>
  );
}
