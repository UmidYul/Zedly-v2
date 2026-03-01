import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { AppShell } from "../../components/layout/AppShell";
import { QuestionEditor } from "../../components/teacher/QuestionEditor";
import { TestPreview } from "../../components/teacher/TestPreview";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Checkbox, Input, RadioGroup, Select } from "../../components/ui/FormFields";
import { testsAssign, testsCreate, usersMe, type TeacherClassRef, type TestQuestionInput } from "../../lib/api";
import { useToastStore } from "../../state/toast-store";
import { useAuth } from "../../state/auth-context";
import { useTestBuilderStore } from "../../stores/testBuilder.store";
import type { BuilderQuestion } from "../../types/teacher";

const SUBJECTS = [
  "Математика",
  "Физика",
  "Химия",
  "Биология",
  "История",
  "Узбекский язык",
  "Русский язык",
  "Литература",
  "Информатика",
  "Английский язык",
  "География"
];

function toDateInput(iso: string): string {
  const date = new Date(iso);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

function validateStep1(input: {
  title: string;
  subject: string;
  classIds: string[];
  timeLimitMinutes: number | null;
  certificateThreshold: number | null;
}): Record<string, string> {
  const errors: Record<string, string> = {};
  if (input.title.trim().length < 3) {
    errors.title = "Минимум 3 символа";
  }
  if (input.title.trim().length > 120) {
    errors.title = "Максимум 120 символов";
  }
  if (!input.subject.trim()) {
    errors.subject = "Выберите предмет";
  }
  if (!input.classIds.length) {
    errors.classIds = "Выберите хотя бы один класс";
  }
  if (input.timeLimitMinutes !== null && (input.timeLimitMinutes < 5 || input.timeLimitMinutes > 180)) {
    errors.timeLimitMinutes = "От 5 до 180 минут";
  }
  if (input.certificateThreshold !== null && (input.certificateThreshold < 1 || input.certificateThreshold > 100)) {
    errors.certificateThreshold = "От 1 до 100";
  }
  return errors;
}

function isValidQuestion(question: BuilderQuestion): boolean {
  if (!question.text.trim()) {
    return false;
  }
  if (question.type === "open_text") {
    return true;
  }
  if (question.options.length < 2) {
    return false;
  }
  const correctCount = question.options.filter((item) => item.isCorrect).length;
  return correctCount > 0;
}

function questionToApiInput(question: BuilderQuestion): TestQuestionInput {
  if (question.type === "open_text") {
    return {
      question_id: question.id,
      text: question.text,
      topic: question.topic || "general",
      points: question.points,
      answers: []
    };
  }

  return {
    question_id: question.id,
    text: question.text,
    topic: question.topic || "general",
    points: question.points,
    answers: question.options.map((option) => ({
      answer_id: option.id,
      text: option.text,
      is_correct: option.isCorrect
    }))
  };
}

export function TestBuilderPage() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams();
  const pushToast = useToastStore((state) => state.pushToast);

  const {
    title,
    subject,
    classIds,
    timeLimitMinutes,
    showAnswersAfter,
    certificateThreshold,
    shuffleQuestions,
    shuffleAnswers,
    questions,
    currentStep,
    assignment,
    lastSavedAt,
    setField,
    setAssignmentField,
    addQuestion,
    duplicateQuestion,
    updateQuestion,
    removeQuestion,
    reorderQuestions,
    nextStep,
    prevStep,
    persistToSession,
    hydrateFromSession,
    reset
  } = useTestBuilderStore();

  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(questions[0]?.id || null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const accessToken = session?.tokens.access_token || "";

  const meQuery = useQuery({
    queryKey: ["teacher", "builder", "me"],
    enabled: Boolean(session),
    queryFn: () => usersMe(accessToken)
  });

  useEffect(() => {
    if (id) {
      setField("id", id);
    }
  }, [id, setField]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const hasDraft = window.sessionStorage.getItem("zedly.teacher.test-builder.draft");
    if (!id && hasDraft) {
      const proceed = window.confirm("Продолжить черновик?");
      if (proceed) {
        hydrateFromSession();
      }
    }
  }, [hydrateFromSession, id]);

  useEffect(() => {
    const timerId = window.setInterval(() => {
      persistToSession();
    }, 30_000);
    return () => window.clearInterval(timerId);
  }, [persistToSession]);

  useEffect(() => {
    if (!activeQuestionId && questions[0]) {
      setActiveQuestionId(questions[0].id);
    }
    if (activeQuestionId && !questions.some((item) => item.id === activeQuestionId)) {
      setActiveQuestionId(questions[0]?.id || null);
    }
  }, [activeQuestionId, questions]);

  const validQuestionsCount = useMemo(() => questions.filter(isValidQuestion).length, [questions]);
  const totalPoints = useMemo(() => questions.reduce((sum, item) => sum + item.points, 0), [questions]);

  const createAssignMutation = useMutation({
    mutationFn: async () => {
      if (!session) {
        throw new Error("Сессия истекла");
      }
      const validQuestions = questions.filter(isValidQuestion);
      if (validQuestions.length === 0) {
        throw new Error("Добавьте минимум один валидный вопрос");
      }
      const deadline = new Date(assignment.deadlineAt).toISOString();
      const startAt = assignment.startsMode === "scheduled" ? new Date(assignment.startAt).toISOString() : null;
      if (new Date(deadline).getTime() <= Date.now()) {
        throw new Error("Дедлайн должен быть в будущем");
      }
      if (startAt && new Date(startAt).getTime() >= new Date(deadline).getTime()) {
        throw new Error("Дата начала должна быть раньше дедлайна");
      }

      const created = await testsCreate(session.tokens.access_token, {
        title: title.trim(),
        subject: subject.trim(),
        class_ids: classIds,
        time_limit_minutes: timeLimitMinutes,
        questions: validQuestions.map(questionToApiInput),
        status: "draft"
      });

      const assigned = await testsAssign(session.tokens.access_token, created.id, {
        class_ids: assignment.classIds.length ? assignment.classIds : classIds,
        start_at: startAt,
        deadline_at: deadline,
        attempt_limit: assignment.attemptLimit,
        shuffle_questions: shuffleQuestions,
        shuffle_answers: shuffleAnswers,
        request_id: `publish_${created.id}_${Date.now()}`
      });

      return {
        created,
        assigned
      };
    },
    onSuccess: ({ created, assigned }) => {
      const firstClassId = classIds[0] || assignment.classIds[0] || "";
      const notified = (assigned.assignments_created || []).length;

      pushToast({
        type: "success",
        title: "Тест назначен",
        message: `Уведомлено ${notified} групп(ы)`
      });
      reset();
      navigate(`/results/${created.id}?class_id=${firstClassId}`);
    },
    onError: (error) => {
      pushToast({
        type: "error",
        title: "Ошибка публикации",
        message: error instanceof Error ? error.message : "Не удалось опубликовать тест"
      });
    }
  });

  if (!session) {
    return null;
  }

  const classes = ((meQuery.data?.teacher_classes || []) as TeacherClassRef[]).map((item, index) => ({
    id: String(item.id || item.class_id || `class_${index + 1}`),
    name: String(item.name || item.class_name || item.id || item.class_id || "Класс")
  }));

  const activeQuestion = questions.find((item) => item.id === activeQuestionId) || null;

  function onStep1Next() {
    const nextErrors = validateStep1({
      title,
      subject,
      classIds,
      timeLimitMinutes,
      certificateThreshold
    });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    if (!assignment.classIds.length) {
      setAssignmentField("classIds", classIds);
    }
    nextStep();
  }

  function onPublishClick() {
    if (createAssignMutation.isPending) {
      return;
    }
    createAssignMutation.mutate();
  }

  return (
    <AppShell>
      <section className="content-stack teacher-builder-stack">
        <Card>
          <Card.Body>
            <h2>{id ? "Редактировать тест" : "Создать тест"}</h2>
            <div className="teacher-stepper">
              <span className={currentStep >= 1 ? "active" : ""}>Настройки</span>
              <span className={currentStep >= 2 ? "active" : ""}>Вопросы</span>
              <span className={currentStep >= 3 ? "active" : ""}>Публикация</span>
            </div>
            {lastSavedAt ? <p className="panel-note">Автосохранение: {new Date(lastSavedAt).toLocaleTimeString("ru-RU")}</p> : null}
          </Card.Body>
        </Card>

        {currentStep === 1 ? (
          <Card>
            <Card.Header>
              <h3>Настройки теста</h3>
            </Card.Header>
            <Card.Body className="teacher-builder-form-grid">
              <Input
                label="Название теста"
                value={title}
                onChange={(event) => setField("title", event.target.value)}
                onBlur={() => setErrors((prev) => ({ ...prev, ...validateStep1({ title, subject, classIds, timeLimitMinutes, certificateThreshold }) }))}
                error={errors.title}
              />

              <Select
                label="Предмет"
                value={subject}
                onChange={(event) => setField("subject", event.target.value)}
                options={[{ value: "", label: "Выберите предмет" }, ...SUBJECTS.map((item) => ({ value: item, label: item }))]}
                error={errors.subject}
              />

              <div className="teacher-multi-class-picker">
                <p>Классы</p>
                <div>
                  {classes.map((item) => (
                    <Checkbox
                      key={item.id}
                      checked={classIds.includes(item.id)}
                      onChange={(event) => {
                        const next = event.target.checked
                          ? Array.from(new Set([...classIds, item.id]))
                          : classIds.filter((classId) => classId !== item.id);
                        setField("classIds", next);
                        setAssignmentField("classIds", next);
                      }}
                      label={item.name}
                    />
                  ))}
                </div>
                {errors.classIds ? <small className="ui-field-error">{errors.classIds}</small> : null}
              </div>

              <Input
                label="Лимит времени (мин)"
                type="number"
                min={5}
                max={180}
                value={timeLimitMinutes || ""}
                onChange={(event) => setField("timeLimitMinutes", event.target.value ? Number(event.target.value) : null)}
                error={errors.timeLimitMinutes}
              />

              <Input
                label="Порог сертификата (%)"
                type="number"
                min={1}
                max={100}
                value={certificateThreshold || ""}
                onChange={(event) => setField("certificateThreshold", event.target.value ? Number(event.target.value) : null)}
                error={errors.certificateThreshold}
              />

              <RadioGroup
                label="Показывать правильные ответы"
                name="show-answers-after"
                value={showAnswersAfter}
                onChange={(value) => setField("showAnswersAfter", value as typeof showAnswersAfter)}
                options={[
                  { value: "immediately", label: "Сразу" },
                  { value: "after_deadline", label: "После дедлайна" },
                  { value: "never", label: "Никогда" }
                ]}
              />

              <Checkbox
                label="Случайный порядок вопросов"
                checked={shuffleQuestions}
                onChange={(event) => setField("shuffleQuestions", event.target.checked)}
              />
              <Checkbox
                label="Случайный порядок ответов"
                checked={shuffleAnswers}
                onChange={(event) => setField("shuffleAnswers", event.target.checked)}
              />
            </Card.Body>
            <Card.Footer>
              <Button onClick={onStep1Next}>Далее: Вопросы →</Button>
            </Card.Footer>
          </Card>
        ) : null}

        {currentStep === 2 ? (
          <Card>
            <Card.Header>
              <h3>Вопросы ({questions.length})</h3>
            </Card.Header>
            <Card.Body className="teacher-question-layout">
              <aside className="teacher-question-list">
                {questions.map((question, index) => (
                  <article
                    key={question.id}
                    className={`teacher-question-list-row ${question.id === activeQuestionId ? "active" : ""}`}
                    onClick={() => setActiveQuestionId(question.id)}
                  >
                    <div>
                      <strong>
                        {index + 1}. {question.text || "Новый вопрос"}
                      </strong>
                      <p>{isValidQuestion(question) ? "✅ Готов" : "⚠️ Неполный"}</p>
                    </div>
                    <div className="teacher-question-row-actions">
                      <button type="button" onClick={() => duplicateQuestion(question.id)}>
                        Дубль
                      </button>
                      <button type="button" onClick={() => removeQuestion(question.id)}>
                        Удалить
                      </button>
                      <button type="button" onClick={() => reorderQuestions(index, Math.max(0, index - 1))}>
                        ↑
                      </button>
                      <button type="button" onClick={() => reorderQuestions(index, Math.min(questions.length - 1, index + 1))}>
                        ↓
                      </button>
                    </div>
                  </article>
                ))}
                <Button variant="secondary" onClick={addQuestion}>
                  + Добавить вопрос
                </Button>
              </aside>

              <QuestionEditor question={activeQuestion} onUpdate={updateQuestion} />
            </Card.Body>
            <Card.Footer>
              <div className="teacher-builder-footer-row">
                <span>
                  Итого: {questions.length} вопросов · {totalPoints} баллов
                </span>
                <div>
                  <Button variant="ghost" onClick={prevStep}>
                    ← Назад
                  </Button>
                  <Button onClick={nextStep} disabled={validQuestionsCount === 0}>
                    Далее: Публикация →
                  </Button>
                </div>
              </div>
            </Card.Footer>
          </Card>
        ) : null}

        {currentStep === 3 ? (
          <section className="content-stack">
            <TestPreview
              draft={{
                id,
                title,
                subject,
                classIds,
                timeLimitMinutes,
                showAnswersAfter,
                certificateThreshold,
                shuffleQuestions,
                shuffleAnswers,
                questions,
                currentStep,
                isSaving: false,
                lastSavedAt,
                assignment
              }}
            />

            <Card>
              <Card.Header>
                <h3>Назначение</h3>
              </Card.Header>
              <Card.Body className="teacher-builder-form-grid">
                <div className="teacher-multi-class-picker">
                  <p>Классы</p>
                  <div>
                    {classes.map((item) => (
                      <Checkbox
                        key={`assign_${item.id}`}
                        checked={assignment.classIds.includes(item.id)}
                        onChange={(event) => {
                          const next = event.target.checked
                            ? Array.from(new Set([...assignment.classIds, item.id]))
                            : assignment.classIds.filter((classId) => classId !== item.id);
                          setAssignmentField("classIds", next);
                        }}
                        label={item.name}
                      />
                    ))}
                  </div>
                </div>

                <RadioGroup
                  label="Начало доступа"
                  name="start-mode"
                  value={assignment.startsMode}
                  onChange={(value) => setAssignmentField("startsMode", value as typeof assignment.startsMode)}
                  options={[
                    { value: "immediately", label: "Сразу" },
                    { value: "scheduled", label: "Запланировать" }
                  ]}
                />

                {assignment.startsMode === "scheduled" ? (
                  <Input label="Дата начала" type="datetime-local" value={toDateInput(assignment.startAt)} onChange={(event) => setAssignmentField("startAt", new Date(event.target.value).toISOString())} />
                ) : null}

                <Input
                  label="Дедлайн"
                  type="datetime-local"
                  value={toDateInput(assignment.deadlineAt)}
                  onChange={(event) => setAssignmentField("deadlineAt", new Date(event.target.value).toISOString())}
                />

                <RadioGroup
                  label="Количество попыток"
                  name="attempt-limit"
                  value={assignment.attemptLimit === 1 ? "one" : "unlimited"}
                  onChange={(value) => setAssignmentField("attemptLimit", value === "one" ? 1 : null)}
                  options={[
                    { value: "one", label: "1 попытка" },
                    { value: "unlimited", label: "Без ограничений" }
                  ]}
                />
              </Card.Body>
              <Card.Footer>
                <div className="teacher-builder-footer-row">
                  <Button variant="ghost" onClick={prevStep}>
                    ← Назад
                  </Button>
                  <div>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        persistToSession();
                        pushToast({ type: "success", title: "Черновик сохранён" });
                      }}
                    >
                      Сохранить черновик
                    </Button>
                    <Button
                      onClick={onPublishClick}
                      loading={createAssignMutation.isPending}
                      disabled={
                        createAssignMutation.isPending ||
                        (assignment.classIds.length === 0 && classIds.length === 0) ||
                        validQuestionsCount === 0
                      }
                    >
                      {createAssignMutation.isPending ? "Публикую..." : "Опубликовать и назначить →"}
                    </Button>
                  </div>
                </div>
              </Card.Footer>
            </Card>

            {createAssignMutation.isError ? (
              <Alert
                variant="danger"
                title="Не удалось опубликовать"
                message={createAssignMutation.error instanceof Error ? createAssignMutation.error.message : "Ошибка"}
              />
            ) : null}
          </section>
        ) : null}
      </section>
    </AppShell>
  );
}
