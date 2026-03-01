import { Fragment } from "react";
import { Card } from "../ui/Card";
import { EmptyState } from "../ui/EmptyState";
import type { ClassResultStudentRow } from "../../lib/api";

interface QuestionHeatmapProps {
  students: ClassResultStudentRow[];
  questionCount: number;
}

function cellState(student: ClassResultStudentRow, questionIndex: number): "ok" | "bad" | "none" {
  if (student.status !== "completed" || student.total_questions <= 0) {
    return "none";
  }
  const normalized = (student.score_percent || 0) / 100;
  const threshold = (questionIndex + 1) / Math.max(1, student.total_questions);
  return normalized >= threshold ? "ok" : "bad";
}

export function QuestionHeatmap({ students, questionCount }: QuestionHeatmapProps) {
  if (students.every((item) => item.status !== "completed")) {
    return (
      <Card>
        <Card.Header>
          <h2>Тепловая карта вопросов</h2>
        </Card.Header>
        <Card.Body>
          <EmptyState title="Ученики ещё не начали тест" description="Карта появится после первых ответов." />
        </Card.Body>
      </Card>
    );
  }

  return (
    <Card>
      <Card.Header>
        <h2>Тепловая карта вопросов</h2>
      </Card.Header>
      <Card.Body className="teacher-heatmap-wrap">
        <div className="teacher-heatmap-grid" style={{ gridTemplateColumns: `160px repeat(${students.length}, minmax(36px, 1fr))` }}>
          <div className="teacher-heatmap-head sticky-col">Вопрос</div>
          {students.map((student) => (
            <div key={`head_${student.student_id}`} className="teacher-heatmap-head" title={student.student_name}>
              {student.student_name.split(" ")[0]}
            </div>
          ))}

          {Array.from({ length: Math.max(1, questionCount) }).map((_, qIndex) => (
            <Fragment key={`row_${qIndex}`}>
              <div className="teacher-heatmap-q sticky-col">
                Q{qIndex + 1}
              </div>
              {students.map((student) => {
                const state = cellState(student, qIndex);
                return (
                  <div
                    key={`cell_${student.student_id}_${qIndex}`}
                    className={`teacher-heatmap-cell teacher-heatmap-${state}`}
                    title={`${student.student_name} — Q${qIndex + 1}`}
                  />
                );
              })}
            </Fragment>
          ))}
        </div>
      </Card.Body>
    </Card>
  );
}
