import { Card } from "../ui/Card";
import type { TestDraft } from "../../types/teacher";

interface TestPreviewProps {
  draft: TestDraft;
}

function difficultyLabel(questionCount: number): string {
  if (questionCount <= 8) {
    return "низкая";
  }
  if (questionCount <= 18) {
    return "средняя";
  }
  return "высокая";
}

export function TestPreview({ draft }: TestPreviewProps) {
  const uniqueTopics = Array.from(new Set(draft.questions.map((item) => item.topic.trim()).filter(Boolean)));

  return (
    <Card>
      <Card.Header>
        <h2>Предпросмотр теста</h2>
      </Card.Header>
      <Card.Body className="content-stack">
        <div>
          <h3>{draft.title || "Без названия"}</h3>
          <p className="panel-note">
            {draft.subject || "Предмет не выбран"} · {draft.questions.length} вопросов · {draft.timeLimitMinutes || "—"} минут · Сложность: {difficultyLabel(draft.questions.length)}
          </p>
          <p className="panel-note">Темы: {uniqueTopics.length ? uniqueTopics.join(", ") : "—"}</p>
        </div>

        <section className="teacher-preview-questions">
          {draft.questions.slice(0, 3).map((question, index) => (
            <article key={question.id} className="teacher-preview-question">
              <strong>
                Вопрос {index + 1}: {question.text || "Пустой вопрос"}
              </strong>
              <p>{question.topic || "Без темы"}</p>
            </article>
          ))}
          {draft.questions.length > 3 ? <p className="panel-note">+ ещё {draft.questions.length - 3} вопросов</p> : null}
        </section>
      </Card.Body>
    </Card>
  );
}
