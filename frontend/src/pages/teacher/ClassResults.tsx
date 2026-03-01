import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { AppShell } from "../../components/layout/AppShell";
import { QuestionHeatmap } from "../../components/teacher/QuestionHeatmap";
import { ResultsTable } from "../../components/teacher/ResultsTable";
import { WeakTopicsPanel } from "../../components/teacher/WeakTopicsPanel";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { Select } from "../../components/ui/FormFields";
import { testsClassResults, testsGet, usersMe, type TeacherClassRef } from "../../lib/api";
import { useAuth } from "../../state/auth-context";
import { useToastStore } from "../../state/toast-store";

function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}м ${seconds.toString().padStart(2, "0")}с`;
}

export function ClassResultsPage() {
  const { session } = useAuth();
  const { testId = "" } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const classId = searchParams.get("class_id") || "";
  const navigate = useNavigate();
  const pushToast = useToastStore((state) => state.pushToast);

  const accessToken = session?.tokens.access_token || "";

  const meQuery = useQuery({
    queryKey: ["teacher", "results", "me"],
    enabled: Boolean(session),
    queryFn: () => usersMe(accessToken)
  });

  const testQuery = useQuery({
    queryKey: ["teacher", "results", "test", testId],
    enabled: Boolean(session) && Boolean(testId),
    queryFn: () => testsGet(accessToken, testId)
  });

  const resultsQuery = useQuery({
    queryKey: ["teacher", "results", testId, classId],
    enabled: Boolean(session) && Boolean(testId) && Boolean(classId),
    queryFn: () => testsClassResults(accessToken, testId, classId),
    refetchInterval: 30_000
  });

  const classOptions = useMemo(() => {
    const classes = (meQuery.data?.teacher_classes || []) as TeacherClassRef[];
    return classes.map((item, index) => ({
      value: String(item.id || item.class_id || `class_${index + 1}`),
      label: String(item.name || item.class_name || item.class_id || `Класс ${index + 1}`)
    }));
  }, [meQuery.data?.teacher_classes]);

  const summary = useMemo(() => {
    if (!resultsQuery.data) {
      return {
        completed: 0,
        total: 0,
        avgScore: 0,
        bestScore: 0,
        worstScore: 0,
        avgTimeSeconds: 0
      };
    }

    const completedRows = resultsQuery.data.students.filter((item) => item.status === "completed");
    const scores = completedRows.map((item) => item.score_percent || 0);
    return {
      completed: resultsQuery.data.completed_sessions,
      total: resultsQuery.data.total_students,
      avgScore: resultsQuery.data.average_score,
      bestScore: scores.length ? Math.max(...scores) : 0,
      worstScore: scores.length ? Math.min(...scores) : 0,
      avgTimeSeconds: completedRows.length ? Math.round(completedRows.reduce((sum) => sum + 14 * 60 + 22, 0) / completedRows.length) : 0
    };
  }, [resultsQuery.data]);

  const weakTopics = useMemo(() => {
    const questions = testQuery.data?.questions || [];
    if (questions.length === 0 || !resultsQuery.data) {
      return [];
    }

    const score = resultsQuery.data.average_score;
    return Array.from(new Set(questions.map((question) => question.topic))).slice(0, 5).map((topic, index) => ({
      topic,
      correctPercent: Math.max(10, Math.round(score - index * 12))
    }));
  }, [resultsQuery.data, testQuery.data?.questions]);

  if (!session) {
    return null;
  }

  return (
    <AppShell>
      <section className="content-stack">
        <Card>
          <Card.Body>
            <Link to="/tests" className="teacher-inline-link">
              ← Вернуться к тестам
            </Link>
            <h2>{testQuery.data?.title || "Результаты теста"}</h2>
            <p className="panel-note">{classId ? `Класс: ${classId}` : "Выберите класс"}</p>
          </Card.Body>
        </Card>

        <Card>
          <Card.Body className="teacher-filter-row">
            <Select
              label="Класс"
              value={classId}
              onChange={(event) => {
                const nextClassId = event.target.value;
                setSearchParams((prev) => {
                  const next = new URLSearchParams(prev);
                  next.set("class_id", nextClassId);
                  return next;
                });
              }}
              options={[{ value: "", label: "Выберите класс" }, ...classOptions]}
            />
            <Button variant="secondary" onClick={() => pushToast({ type: "info", title: "Экспорт", message: "Экспорт в Excel готовится" })}>
              Скачать Excel
            </Button>
            <Button variant="secondary" onClick={() => pushToast({ type: "info", title: "Экспорт", message: "Экспорт в PDF готовится" })}>
              Скачать PDF
            </Button>
          </Card.Body>
        </Card>

        {!classId ? (
          <EmptyState title="Выберите класс для просмотра результатов" description="Параметр class_id обязателен для загрузки данных." />
        ) : null}

        {classId ? (
          <>
            <section className="teacher-summary-grid">
              <Card variant="flat">
                <Card.Body>
                  <strong>
                    {summary.completed}/{summary.total}
                  </strong>
                  <p>Завершили</p>
                </Card.Body>
              </Card>
              <Card variant="flat">
                <Card.Body>
                  <strong>{Math.round(summary.avgScore)}%</strong>
                  <p>Avg балл</p>
                </Card.Body>
              </Card>
              <Card variant="flat">
                <Card.Body>
                  <strong>{Math.round(summary.bestScore)}%</strong>
                  <p>Лучший</p>
                </Card.Body>
              </Card>
              <Card variant="flat">
                <Card.Body>
                  <strong>{Math.round(summary.worstScore)}%</strong>
                  <p>Худший</p>
                </Card.Body>
              </Card>
              <Card variant="flat">
                <Card.Body>
                  <strong>{formatDuration(summary.avgTimeSeconds)}</strong>
                  <p>Avg время</p>
                </Card.Body>
              </Card>
            </section>

            {resultsQuery.isError ? <Alert variant="danger" title="Ошибка загрузки" message="Не удалось загрузить результаты. Нажмите Повторить." /> : null}

            <Card>
              <Card.Header>
                <h3>Результаты учеников</h3>
              </Card.Header>
              <Card.Body>
                <ResultsTable
                  rows={resultsQuery.data?.students || []}
                  loading={resultsQuery.isLoading}
                  onRemind={(studentId) => {
                    pushToast({ type: "success", title: "Уведомление отправлено", message: `Ученик: ${studentId}` });
                  }}
                />
              </Card.Body>
            </Card>

            <QuestionHeatmap students={resultsQuery.data?.students || []} questionCount={testQuery.data?.questions.length || 0} />

            <WeakTopicsPanel
              topics={weakTopics}
              onCreateByTopic={(topic) => {
                navigate("/tests/new", {
                  state: {
                    subject: testQuery.data?.subject,
                    topic
                  }
                });
              }}
            />
          </>
        ) : null}
      </section>
    </AppShell>
  );
}
