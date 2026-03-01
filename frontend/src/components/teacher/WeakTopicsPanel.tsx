import { Card } from "../ui/Card";
import { ProgressBar } from "../ui/ProgressBar";
import { Button } from "../ui/Button";

interface WeakTopicRow {
  topic: string;
  correctPercent: number;
}

interface WeakTopicsPanelProps {
  topics: WeakTopicRow[];
  onCreateByTopic: (topic: string) => void;
}

function topicVariant(percent: number): "danger" | "warning" | "success" {
  if (percent < 50) {
    return "danger";
  }
  if (percent < 75) {
    return "warning";
  }
  return "success";
}

export function WeakTopicsPanel({ topics, onCreateByTopic }: WeakTopicsPanelProps) {
  return (
    <Card>
      <Card.Header>
        <h2>Слабые темы класса</h2>
      </Card.Header>
      <Card.Body className="content-stack">
        {topics.map((item) => (
          <article key={item.topic} className="teacher-weak-topic-row">
            <div>
              <strong>{item.topic}</strong>
              <ProgressBar value={item.correctPercent} variant={topicVariant(item.correctPercent)} labeled />
            </div>
            <Button size="sm" variant="secondary" onClick={() => onCreateByTopic(item.topic)}>
              Создать тест по теме
            </Button>
          </article>
        ))}
        {topics.length === 0 ? <p className="panel-note">Данных по темам пока недостаточно.</p> : null}
      </Card.Body>
    </Card>
  );
}
