import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { Award, BarChart3 } from "lucide-react";
import { AppShell } from "../components/layout/AppShell";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { ProgressBar } from "../components/ui/ProgressBar";
import { loadSessionResult } from "../lib/test-session-storage";

function scoreVariant(scorePercent: number | null): "success" | "warning" | "danger" {
  if (!scorePercent) {
    return "danger";
  }
  if (scorePercent >= 75) {
    return "success";
  }
  if (scorePercent >= 50) {
    return "warning";
  }
  return "danger";
}

export function TestResultPage() {
  const { sessionId = "" } = useParams();
  const result = useMemo(() => (sessionId ? loadSessionResult(sessionId) : null), [sessionId]);

  if (!result) {
    return (
      <AppShell>
        <section className="content-stack">
          <EmptyState title="Результат не найден" description="Завершите тест заново, чтобы получить отчёт." />
        </section>
      </AppShell>
    );
  }

  const score = result.score_percent ?? 0;
  const wrong = Math.max(0, result.answered_questions - result.correct_answers);
  const skipped = Math.max(0, result.total_questions - result.answered_questions);

  return (
    <AppShell>
      <section className="content-stack">
        <Card>
          <Card.Body className="result-hero">
            <div className="result-circle-wrap">
              <div className={`result-circle result-circle-${scoreVariant(score)}`}>
                <strong>{Math.round(score)}%</strong>
              </div>
            </div>
            <div className="result-hero-meta">
              <h2>Тест завершён</h2>
              <p className="panel-note">
                {result.correct_answers} из {result.total_questions} правильно
              </p>
              <div className="result-summary-grid">
                <article>
                  <span>Правильных</span>
                  <strong>{result.correct_answers}</strong>
                </article>
                <article>
                  <span>Неправильных</span>
                  <strong>{wrong}</strong>
                </article>
                <article>
                  <span>Пропущено</span>
                  <strong>{skipped}</strong>
                </article>
              </div>
            </div>
          </Card.Body>
        </Card>

        <Card>
          <Card.Header>
            <h3>
              <BarChart3 size={16} /> По темам
            </h3>
          </Card.Header>
          <Card.Body className="content-stack">
            {result.topic_breakdown.map((topic) => (
              <div key={topic.topic} className="result-topic-row">
                <div>
                  <strong>{topic.topic}</strong>
                  <p className="panel-note">
                    {topic.correct_answers}/{topic.total_questions}
                  </p>
                </div>
                <ProgressBar value={topic.score_percent} labeled variant={scoreVariant(topic.score_percent)} />
              </div>
            ))}
          </Card.Body>
        </Card>

        <section className="row-actions">
          <Link to="/my-tests">
            <Button>К моим тестам</Button>
          </Link>
          <Link to="/my-results">
            <Button variant="secondary">
              <Award size={14} /> История результатов
            </Button>
          </Link>
        </section>
      </section>
    </AppShell>
  );
}
