import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AlertTriangle, CheckCircle2, Clock3 } from "lucide-react";
import { AppShell } from "../components/layout/AppShell";
import { Alert } from "../components/ui/Alert";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { Modal } from "../components/ui/Modal";
import { ProgressBar } from "../components/ui/ProgressBar";
import { sessionsFinish, sessionsSubmitAnswers } from "../lib/api";
import {
  clearActiveSession,
  loadActiveSession,
  patchRecentTestByAssignment,
  saveSessionResult,
  updateActiveSessionAnswers
} from "../lib/test-session-storage";
import { useAuth } from "../state/auth-context";
import { useToastStore } from "../state/toast-store";

function formatCountdown(msLeft: number) {
  const safe = Math.max(0, msLeft);
  const totalSeconds = Math.floor(safe / 1000);
  const mm = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const ss = (totalSeconds % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}

export function TestSessionPage() {
  const { sessionId = "" } = useParams();
  const navigate = useNavigate();
  const { session } = useAuth();
  const pushToast = useToastStore((state) => state.pushToast);

  const [snapshot] = useState(() => (sessionId ? loadActiveSession(sessionId) : null));
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answersByQuestion, setAnswersByQuestion] = useState<Record<string, string>>(snapshot?.answers_by_question || {});
  const [remainingMs, setRemainingMs] = useState(() => {
    if (!snapshot?.expires_at) {
      return 0;
    }
    return Math.max(0, new Date(snapshot.expires_at).getTime() - Date.now());
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const currentQuestion = snapshot?.questions[questionIndex];
  const answeredCount = useMemo(() => Object.keys(answersByQuestion).length, [answersByQuestion]);
  const totalQuestions = snapshot?.questions.length || 0;
  const progress = totalQuestions > 0 ? Math.round((answeredCount / totalQuestions) * 100) : 0;
  const isCriticalTime = remainingMs < 1000 * 60 * 5;

  useEffect(() => {
    if (!snapshot) {
      return;
    }
    const timer = window.setInterval(() => {
      const next = Math.max(0, new Date(snapshot.expires_at).getTime() - Date.now());
      setRemainingMs(next);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [snapshot]);

  useEffect(() => {
    if (remainingMs > 0 || !snapshot || isFinishing) {
      return;
    }
    void onFinish(true);
  }, [remainingMs, snapshot, isFinishing]);

  useEffect(() => {
    function onBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  useEffect(() => {
    if (!sessionId) {
      return;
    }
    updateActiveSessionAnswers(sessionId, answersByQuestion);
  }, [answersByQuestion, sessionId]);

  if (!session || !snapshot) {
    return (
      <AppShell>
        <section className="content-stack">
          <EmptyState title="Сессия не найдена" description="Запустите тест заново из раздела 'Мои тесты'." />
        </section>
      </AppShell>
    );
  }

  if (!currentQuestion) {
    return (
      <AppShell>
        <section className="content-stack">
          <EmptyState title="Вопросы не найдены" description="Сессия не содержит вопросов или повреждена." />
        </section>
      </AppShell>
    );
  }
  const accessToken = session.tokens.access_token;
  const activeSnapshot = snapshot;

  async function saveProgress() {
    setIsSaving(true);
    try {
      const answersPayload = activeSnapshot.questions.map((question) => ({
        question_id: question.question_id,
        answer_id: answersByQuestion[question.question_id] || null,
        answered_at: new Date().toISOString()
      }));
      await sessionsSubmitAnswers(accessToken, activeSnapshot.session_id, answersPayload);
      pushToast({
        type: "success",
        title: "Прогресс сохранён",
        message: `Ответов: ${answeredCount}/${totalQuestions}`
      });
    } catch (error) {
      pushToast({
        type: "error",
        title: "Не удалось сохранить прогресс",
        message: error instanceof Error ? error.message : "Повторите попытку позже."
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function onFinish(auto = false) {
    setIsFinishing(true);
    try {
      const payload = activeSnapshot.questions.map((question) => ({
        question_id: question.question_id,
        answer_id: answersByQuestion[question.question_id] || null,
        answered_at: new Date().toISOString()
      }));
      const result = await sessionsFinish(accessToken, activeSnapshot.session_id, payload);
      saveSessionResult(activeSnapshot.session_id, result);
      patchRecentTestByAssignment(activeSnapshot.assignment_id, {
        status: "completed",
        progress_answered: answeredCount
      });
      clearActiveSession(activeSnapshot.session_id);
      navigate(`/test-result/${activeSnapshot.session_id}`, { replace: true });
      if (auto) {
        pushToast({
          type: "warning",
          title: "Таймер завершён",
          message: "Тест завершён автоматически."
        });
      }
    } catch (error) {
      pushToast({
        type: "error",
        title: "Не удалось завершить тест",
        message: error instanceof Error ? error.message : "Повторите попытку."
      });
    } finally {
      setIsFinishing(false);
    }
  }

  const questionNumber = questionIndex + 1;

  return (
    <AppShell>
      <section className="content-stack">
        <Card>
          <Card.Header>
            <div className="session-header">
              <div>
                <h2>{snapshot.test_title}</h2>
                <p className="panel-note">
                  Вопрос {questionNumber}/{totalQuestions}
                </p>
              </div>
              <div className="session-header-meta">
                <span className={isCriticalTime ? "session-timer-critical" : "session-timer"}>
                  <Clock3 size={15} /> {formatCountdown(remainingMs)}
                </span>
              </div>
            </div>
          </Card.Header>
          <Card.Body className="content-stack">
            <ProgressBar value={progress} labeled />
            {snapshot.mode === "ntt" ? (
              <Alert
                variant="warning"
                title="NTT режим"
                message="Кнопка назад отключена, автозавершение по таймеру включено."
              />
            ) : null}
          </Card.Body>
        </Card>

        <section className="session-layout">
          <Card>
            <Card.Header>
              <h3>Навигация</h3>
            </Card.Header>
            <Card.Body>
              <div className="session-questions-grid">
                {snapshot.questions.map((question, idx) => {
                  const selected = idx === questionIndex;
                  const answered = Boolean(answersByQuestion[question.question_id]);
                  return (
                    <button
                      key={question.question_id}
                      type="button"
                      className={`session-question-nav ${selected ? "active" : ""}`}
                      onClick={() => setQuestionIndex(idx)}
                    >
                      {idx + 1}
                      {answered ? <CheckCircle2 size={12} /> : null}
                    </button>
                  );
                })}
              </div>
            </Card.Body>
          </Card>

          <Card>
            <Card.Header>
              <h3>{currentQuestion?.text}</h3>
            </Card.Header>
            <Card.Body className="content-stack">
              <p className="panel-note">Тема: {currentQuestion?.topic}</p>
              {currentQuestion?.answers.map((answer) => (
                <label key={answer.answer_id} className="session-answer-item">
                  <input
                    type="radio"
                    name={`question-${currentQuestion.question_id}`}
                    checked={answersByQuestion[currentQuestion.question_id] === answer.answer_id}
                    onChange={() =>
                      setAnswersByQuestion((prev) => ({
                        ...prev,
                        [currentQuestion.question_id]: answer.answer_id
                      }))
                    }
                  />
                  <span>{answer.text}</span>
                </label>
              ))}
              <div className="row-actions">
                <Button variant="secondary" onClick={() => void saveProgress()} loading={isSaving}>
                  Сохранить
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setQuestionIndex((prev) => Math.max(0, prev - 1))}
                  disabled={questionIndex === 0 || snapshot.mode === "ntt"}
                >
                  Назад
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setQuestionIndex((prev) => Math.min(totalQuestions - 1, prev + 1))}
                  disabled={questionIndex >= totalQuestions - 1}
                >
                  Вперёд
                </Button>
                <Button variant="primary" onClick={() => setConfirmOpen(true)} loading={isFinishing}>
                  Завершить тест
                </Button>
              </div>
            </Card.Body>
          </Card>
        </section>

        <Modal
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title="Подтверждение завершения"
          footer={
            <>
              <Button variant="secondary" onClick={() => setConfirmOpen(false)}>
                Отмена
              </Button>
              <Button
                onClick={() => {
                  setConfirmOpen(false);
                  void onFinish(false);
                }}
              >
                Подтвердить
              </Button>
            </>
          }
        >
          <div className="content-stack">
            <p className="panel-note">
              Отвечено: {answeredCount} из {totalQuestions}
            </p>
            <p className="panel-note">Пропущено: {Math.max(0, totalQuestions - answeredCount)}</p>
            {Math.max(0, totalQuestions - answeredCount) > 0 ? (
              <Alert
                variant="warning"
                title="Есть пропущенные вопросы"
                message="После завершения вернуться к тесту будет нельзя."
              />
            ) : (
              <Alert variant="info" title="Все вопросы заполнены" />
            )}
            {snapshot.mode === "ntt" ? (
              <p className="panel-note">
                <AlertTriangle size={14} /> NTT режим: перезапуск сессии недоступен.
              </p>
            ) : null}
          </div>
        </Modal>
      </section>
    </AppShell>
  );
}
