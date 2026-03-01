import { Plus, Trash2 } from "lucide-react";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Input, Textarea } from "../ui/FormFields";
import type { BuilderQuestion } from "../../types/teacher";

interface QuestionEditorProps {
  question: BuilderQuestion | null;
  onUpdate: (questionId: string, updates: Partial<BuilderQuestion>) => void;
}

function updateSingleCorrect(question: BuilderQuestion, optionId: string): BuilderQuestion["options"] {
  return question.options.map((option) => ({
    ...option,
    isCorrect: option.id === optionId
  }));
}

export function QuestionEditor({ question, onUpdate }: QuestionEditorProps) {
  if (!question) {
    return (
      <Card variant="flat">
        <Card.Body>
          <p className="panel-note">Выберите вопрос в списке слева.</p>
        </Card.Body>
      </Card>
    );
  }

  return (
    <Card>
      <Card.Header>
        <h3>Редактор вопроса</h3>
      </Card.Header>
      <Card.Body className="content-stack">
        <Textarea
          label="Текст вопроса"
          value={question.text}
          onChange={(event) => onUpdate(question.id, { text: event.target.value })}
          rows={3}
        />

        <fieldset className="teacher-inline-radio">
          <legend>Тип вопроса</legend>
          <label>
            <input
              type="radio"
              checked={question.type === "mcq_single"}
              onChange={() => onUpdate(question.id, { type: "mcq_single" })}
            />
            Один правильный
          </label>
          <label>
            <input
              type="radio"
              checked={question.type === "mcq_multiple"}
              onChange={() => onUpdate(question.id, { type: "mcq_multiple" })}
            />
            Несколько правильных
          </label>
          <label>
            <input type="radio" checked={question.type === "open_text"} onChange={() => onUpdate(question.id, { type: "open_text" })} />
            Открытый ответ
          </label>
        </fieldset>

        {question.type !== "open_text" ? (
          <section className="content-stack">
            <h4>Варианты ответов</h4>
            {question.options.map((option) => (
              <div key={option.id} className="teacher-option-row">
                <input
                  type={question.type === "mcq_single" ? "radio" : "checkbox"}
                  checked={option.isCorrect}
                  onChange={(event) => {
                    if (question.type === "mcq_single") {
                      onUpdate(question.id, { options: updateSingleCorrect(question, option.id) });
                      return;
                    }
                    onUpdate(question.id, {
                      options: question.options.map((item) =>
                        item.id === option.id
                          ? {
                              ...item,
                              isCorrect: event.target.checked
                            }
                          : item
                      )
                    });
                  }}
                />
                <input
                  className="ui-field-control"
                  value={option.text}
                  placeholder="Текст варианта"
                  onChange={(event) =>
                    onUpdate(question.id, {
                      options: question.options.map((item) =>
                        item.id === option.id
                          ? {
                              ...item,
                              text: event.target.value
                            }
                          : item
                      )
                    })
                  }
                />
                <button
                  type="button"
                  className="teacher-icon-btn"
                  onClick={() =>
                    onUpdate(question.id, {
                      options: question.options.filter((item) => item.id !== option.id)
                    })
                  }
                  disabled={question.options.length <= 2}
                  aria-label="Удалить вариант"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() =>
                onUpdate(question.id, {
                  options: [
                    ...question.options,
                    {
                      id: `opt_${Date.now()}_${Math.random().toString(16).slice(2)}`,
                      text: "",
                      isCorrect: false
                    }
                  ]
                })
              }
              disabled={question.options.length >= 6}
            >
              <Plus size={14} /> Добавить вариант
            </Button>
          </section>
        ) : null}

        <Input
          label="Тема"
          value={question.topic}
          onChange={(event) => onUpdate(question.id, { topic: event.target.value })}
          placeholder="Например: Квадратные уравнения"
        />
        <Textarea
          label="Объяснение"
          value={question.explanation || ""}
          onChange={(event) => onUpdate(question.id, { explanation: event.target.value })}
          rows={2}
        />
        <Input
          label="Баллы"
          type="number"
          min={1}
          max={10}
          value={question.points}
          onChange={(event) => onUpdate(question.id, { points: Number(event.target.value || 1) })}
        />
      </Card.Body>
    </Card>
  );
}
