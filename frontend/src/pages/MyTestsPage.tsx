import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Clock3, PlayCircle } from "lucide-react";
import { AppShell } from "../components/layout/AppShell";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { Input, Select } from "../components/ui/FormFields";
import { ProgressBar } from "../components/ui/ProgressBar";
import { Tabs } from "../components/ui/Tabs";
import { testsGet, testsStartSession } from "../lib/api";
import {
  buildSnapshotFromStartedSession,
  loadRecentTests,
  type RecentTestCard,
  saveActiveSession,
  upsertRecentTest
} from "../lib/test-session-storage";
import { useAuth } from "../state/auth-context";
import { useToastStore } from "../state/toast-store";

type TabId = "active" | "completed" | "overdue";

function deriveTestStatus(deadline: string, sourceStatus: RecentTestCard["status"]): RecentTestCard["status"] {
  if (sourceStatus === "completed") {
    return "completed";
  }
  return new Date(deadline).getTime() < Date.now() ? "overdue" : "active";
}

export function MyTestsPage() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const pushToast = useToastStore((state) => state.pushToast);

  const [tab, setTab] = useState<TabId>("active");
  const [testId, setTestId] = useState("");
  const [assignmentId, setAssignmentId] = useState("");
  const [title, setTitle] = useState("Новый тест");
  const [subject, setSubject] = useState("general");
  const [mode, setMode] = useState<"standard" | "ntt">("standard");
  const [startingId, setStartingId] = useState<string | null>(null);
  const [storageRevision, setStorageRevision] = useState(0);
  const cards = useMemo(
    () => loadRecentTests().map((item) => ({ ...item, status: deriveTestStatus(item.deadline, item.status) })),
    [storageRevision]
  );

  const filteredCards = useMemo(() => cards.filter((item) => item.status === tab), [cards, tab]);

  useEffect(() => {
    function onStorage() {
      setStorageRevision((prev) => prev + 1);
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  if (!session) {
    return null;
  }
  const accessToken = session.tokens.access_token;

  async function startSessionByCard(card: RecentTestCard) {
    setStartingId(card.id);
    try {
      const started = await testsStartSession(accessToken, card.test_id, card.assignment_id, true);
      const testDetails = await testsGet(accessToken, card.test_id);
      const questions =
        started.questions && started.questions.length
          ? started.questions
          : testDetails.questions.map((question) => ({
              question_id: question.question_id,
              text: question.text,
              topic: question.topic,
              answers: question.answers.map((answer) => ({ answer_id: answer.answer_id, text: answer.text }))
            }));
      const snapshot = buildSnapshotFromStartedSession({
        started,
        questions,
        testId: card.test_id,
        assignmentId: card.assignment_id,
        testTitle: card.title,
        mode: card.mode
      });
      saveActiveSession(snapshot);
      navigate(`/test-session/${started.session_id}`);
    } catch (error) {
      pushToast({
        type: "error",
        title: "Не удалось запустить тест",
        message: error instanceof Error ? error.message : "Проверьте идентификаторы теста и назначения."
      });
    } finally {
      setStartingId(null);
      setStorageRevision((prev) => prev + 1);
    }
  }

  async function onQuickStart() {
    if (!testId.trim() || !assignmentId.trim()) {
      pushToast({
        type: "warning",
        title: "Не хватает данных",
        message: "Введите test_id и assignment_id для запуска."
      });
      return;
    }
    const quickCard: RecentTestCard = {
      id: `${testId.trim()}_${assignmentId.trim()}`,
      title: title.trim() || "Тест",
      subject: subject.trim() || "general",
      teacher_name: "teacher",
      test_id: testId.trim(),
      assignment_id: assignmentId.trim(),
      deadline: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
      questions_count: 0,
      mode,
      status: "active",
      progress_answered: 0
    };
    upsertRecentTest(quickCard);
    await startSessionByCard(quickCard);
  }

  return (
    <AppShell>
      <section className="content-stack">
        <Card>
          <Card.Header>
            <h2>Мои тесты</h2>
          </Card.Header>
          <Card.Body className="content-stack">
            <Tabs
              variant="line"
              activeId={tab}
              onChange={(next) => setTab(next as TabId)}
              items={[
                { id: "active", label: "Активные" },
                { id: "completed", label: "Завершённые" },
                { id: "overdue", label: "Просроченные" }
              ]}
            />
            <p className="panel-note">
              Для старта по API используйте quick start или карточки тестов из локального списка, созданные после назначения теста.
            </p>
          </Card.Body>
        </Card>

        <Card>
          <Card.Header>
            <h3>Quick Start</h3>
          </Card.Header>
          <Card.Body className="content-stack">
            <section className="filter-form">
              <Input label="Test ID" value={testId} onChange={(event) => setTestId(event.target.value)} placeholder="test_..." />
              <Input
                label="Assignment ID"
                value={assignmentId}
                onChange={(event) => setAssignmentId(event.target.value)}
                placeholder="asg_..."
              />
              <Input label="Название" value={title} onChange={(event) => setTitle(event.target.value)} />
              <Input label="Предмет" value={subject} onChange={(event) => setSubject(event.target.value)} />
            </section>
            <section className="row-actions">
              <Select
                label="Режим"
                value={mode}
                onChange={(event) => setMode(event.target.value as "standard" | "ntt")}
                options={[
                  { value: "standard", label: "Standard" },
                  { value: "ntt", label: "NTT" }
                ]}
              />
              <Button onClick={() => void onQuickStart()} loading={Boolean(startingId)}>
                Запустить тест
              </Button>
            </section>
          </Card.Body>
        </Card>

        <section className="tests-grid">
          {filteredCards.length ? (
            filteredCards.map((card) => (
              <Card key={card.id}>
                <Card.Body className="content-stack">
                  <div className="test-card-header">
                    <Badge variant="info">{card.subject}</Badge>
                    <Badge variant={card.mode === "ntt" ? "warning" : "outline"}>{card.mode.toUpperCase()}</Badge>
                  </div>
                  <h3>{card.title}</h3>
                  <p className="panel-note">Учитель: {card.teacher_name}</p>
                  <div className="test-card-meta">
                    <span>
                      <Clock3 size={14} /> Дедлайн: {new Date(card.deadline).toLocaleString()}
                    </span>
                    <span>Вопросов: {card.questions_count || "N/A"}</span>
                  </div>
                  <ProgressBar value={card.progress_answered} labeled />
                  <Button
                    onClick={() => void startSessionByCard(card)}
                    loading={startingId === card.id}
                  >
                    {card.progress_answered > 0 ? "Продолжить" : "Начать"}
                  </Button>
                </Card.Body>
              </Card>
            ))
          ) : (
            <EmptyState
              title="Пока нет тестов в выбранной вкладке"
              description="После назначения теста преподавателем карточки появятся здесь."
              icon={PlayCircle}
            />
          )}
        </section>
      </section>
    </AppShell>
  );
}
