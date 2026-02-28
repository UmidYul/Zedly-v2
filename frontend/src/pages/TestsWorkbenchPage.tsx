import { FormEvent, useMemo, useState } from "react";
import { CheckCircle2, ClipboardList, FileText, GraduationCap, PlayCircle } from "lucide-react";
import { AppShell } from "../components/layout/AppShell";
import { Alert } from "../components/ui/Alert";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { Input, Select } from "../components/ui/FormFields";
import { ProgressBar } from "../components/ui/ProgressBar";
import { Table, type TableColumn } from "../components/ui/Table";
import {
  ClassResultsResponse,
  FinishSessionResponse,
  StartSessionResponse,
  sessionsFinish,
  testsAssign,
  testsClassResults,
  testsCreate,
  testsGet,
  testsStartSession
} from "../lib/api";
import { upsertRecentTest } from "../lib/test-session-storage";
import { useAuth } from "../state/auth-context";

interface RenderQuestion {
  question_id: string;
  text: string;
  topic: string;
  answers: Array<{
    answer_id: string;
    text: string;
  }>;
}

function toDeadlineInput(iso: string): string {
  const date = new Date(iso);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

function fromDeadlineInput(value: string): string {
  if (!value) {
    return new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
  }
  return new Date(value).toISOString();
}

export function TestsWorkbenchPage() {
  const { session } = useAuth();
  const teacherClasses = useMemo(() => session?.me.teacher_classes || [], [session?.me.teacher_classes]);

  const [testTitle, setTestTitle] = useState("Sprint 4 Test");
  const [subject, setSubject] = useState("physics");
  const [questionText, setQuestionText] = useState("2 + 2 = ?");
  const [topic, setTopic] = useState("arithmetic");
  const [correctAnswerText, setCorrectAnswerText] = useState("4");
  const [wrongAnswerText, setWrongAnswerText] = useState("5");
  const [classId, setClassId] = useState(teacherClasses[0]?.class_id || "cls_A_7A");
  const [deadlineInput, setDeadlineInput] = useState(toDeadlineInput(new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()));
  const [teacherInfo, setTeacherInfo] = useState<string | null>(null);
  const [teacherError, setTeacherError] = useState<string | null>(null);
  const [isTeacherBusy, setIsTeacherBusy] = useState(false);

  const [studentTestId, setStudentTestId] = useState("");
  const [studentAssignmentId, setStudentAssignmentId] = useState("");
  const [sessionState, setSessionState] = useState<StartSessionResponse | null>(null);
  const [questions, setQuestions] = useState<RenderQuestion[]>([]);
  const [answersByQuestion, setAnswersByQuestion] = useState<Record<string, string>>({});
  const [finishResult, setFinishResult] = useState<FinishSessionResponse | null>(null);
  const [studentError, setStudentError] = useState<string | null>(null);
  const [isStudentBusy, setIsStudentBusy] = useState(false);

  const [reportTestId, setReportTestId] = useState("");
  const [reportClassId, setReportClassId] = useState(teacherClasses[0]?.class_id || "cls_A_7A");
  const [classResults, setClassResults] = useState<ClassResultsResponse | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);
  const [isReportBusy, setIsReportBusy] = useState(false);

  if (!session) {
    return null;
  }
  const accessToken = session.tokens.access_token;
  const currentUserName = session.me.full_name;
  const isTeacher = session.me.role === "teacher";
  const isStudent = session.me.role === "student";

  async function onTeacherCreateAssign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isTeacher) {
      setTeacherError("Раздел доступен только teacher.");
      return;
    }
    setIsTeacherBusy(true);
    setTeacherError(null);
    setTeacherInfo(null);
    try {
      const payload = {
        title: testTitle.trim(),
        subject: subject.trim() || "general",
        mode: "standard" as const,
        status: "published" as const,
        questions: [
          {
            question_id: `q_${Date.now()}`,
            text: questionText.trim(),
            topic: topic.trim() || "general",
            answers: [
              { answer_id: "a_correct", text: correctAnswerText.trim(), is_correct: true },
              { answer_id: "a_wrong", text: wrongAnswerText.trim(), is_correct: false }
            ]
          }
        ]
      };

      const created = await testsCreate(accessToken, payload);
      const assigned = await testsAssign(accessToken, created.id, classId.trim(), fromDeadlineInput(deadlineInput));
      const assignment = assigned.assignments_created[0];
      setTeacherInfo(`Создан test_id=${created.id}, assignment_id=${assignment.assignment_id}`);
      upsertRecentTest({
        id: `${created.id}_${assignment.assignment_id}`,
        title: created.title,
        subject: created.subject,
        teacher_name: currentUserName,
        test_id: created.id,
        assignment_id: assignment.assignment_id,
        deadline: assignment.deadline,
        questions_count: created.questions_count,
        mode: payload.mode,
        status: "active",
        progress_answered: 0
      });
      setStudentTestId(created.id);
      setStudentAssignmentId(assignment.assignment_id);
      setReportTestId(created.id);
    } catch (error) {
      setTeacherError(error instanceof Error ? error.message : "Не удалось создать/назначить тест.");
    } finally {
      setIsTeacherBusy(false);
    }
  }

  async function onStudentStart(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isStudent) {
      setStudentError("Раздел доступен только student.");
      return;
    }
    if (!studentTestId.trim() || !studentAssignmentId.trim()) {
      setStudentError("Укажите test_id и assignment_id.");
      return;
    }
    setIsStudentBusy(true);
    setStudentError(null);
    setFinishResult(null);
    try {
      const started = await testsStartSession(accessToken, studentTestId.trim(), studentAssignmentId.trim(), true);
      setSessionState(started);

      if (started.questions && started.questions.length) {
        setQuestions(started.questions);
      } else {
        const test = await testsGet(accessToken, studentTestId.trim());
        setQuestions(
          test.questions.map((question) => ({
            question_id: question.question_id,
            text: question.text,
            topic: question.topic,
            answers: question.answers.map((answer) => ({ answer_id: answer.answer_id, text: answer.text }))
          }))
        );
      }
      setAnswersByQuestion({});
    } catch (error) {
      setStudentError(error instanceof Error ? error.message : "Не удалось стартовать сессию.");
    } finally {
      setIsStudentBusy(false);
    }
  }

  async function onStudentFinish() {
    if (!sessionState) {
      setStudentError("Сначала запустите сессию.");
      return;
    }
    setIsStudentBusy(true);
    setStudentError(null);
    try {
      const finalAnswers = questions.map((question) => ({
        question_id: question.question_id,
        answer_id: answersByQuestion[question.question_id] || null,
        answered_at: new Date().toISOString()
      }));
      const result = await sessionsFinish(accessToken, sessionState.session_id, finalAnswers);
      setFinishResult(result);
    } catch (error) {
      setStudentError(error instanceof Error ? error.message : "Не удалось завершить сессию.");
    } finally {
      setIsStudentBusy(false);
    }
  }

  async function onLoadClassResults(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isTeacher) {
      setReportError("Раздел доступен только teacher.");
      return;
    }
    if (!reportTestId.trim() || !reportClassId.trim()) {
      setReportError("Укажите test_id и class_id.");
      return;
    }
    setIsReportBusy(true);
    setReportError(null);
    try {
      const data = await testsClassResults(accessToken, reportTestId.trim(), reportClassId.trim());
      setClassResults(data);
    } catch (error) {
      setReportError(error instanceof Error ? error.message : "Не удалось загрузить class results.");
    } finally {
      setIsReportBusy(false);
    }
  }

  const classResultColumns: TableColumn<ClassResultsResponse["students"][number]>[] = [
    { id: "name", header: "Student", sortable: true, accessor: (row) => row.student_name, render: (row) => row.student_name },
    {
      id: "status",
      header: "Status",
      sortable: true,
      accessor: (row) => row.status,
      render: (row) => <Badge variant={row.status === "completed" ? "success" : "warning"}>{row.status}</Badge>
    },
    {
      id: "score",
      header: "Score %",
      sortable: true,
      accessor: (row) => row.score_percent ?? -1,
      render: (row) => (row.score_percent === null ? "N/A" : `${row.score_percent}%`)
    },
    {
      id: "answered",
      header: "Answered",
      sortable: true,
      accessor: (row) => row.answered_questions,
      render: (row) => `${row.answered_questions}/${row.total_questions}`
    },
    { id: "correct", header: "Correct", sortable: true, accessor: (row) => row.correct_answers, render: (row) => row.correct_answers },
    {
      id: "late",
      header: "Late",
      sortable: true,
      accessor: (row) => Number(row.late_submission),
      render: (row) => (row.late_submission ? "yes" : "no")
    }
  ];

  return (
    <AppShell>
      <section className="content-stack">
        <Card>
          <Card.Header>
            <h2>Tests Workbench</h2>
          </Card.Header>
          <Card.Body>
            <div className="metrics-row">
              <Badge variant={isTeacher ? "info" : "outline"}>
                <GraduationCap size={12} /> Teacher Scope
              </Badge>
              <Badge variant={isStudent ? "info" : "outline"}>
                <PlayCircle size={12} /> Student Scope
              </Badge>
              <Badge variant="outline">
                <ClipboardList size={12} /> Results Scope
              </Badge>
            </div>
          </Card.Body>
        </Card>

        <section className="panel-grid workbench-grid">
          <Card>
            <Card.Header>
              <h3>
                <FileText size={16} /> Teacher Test Builder MVP
              </h3>
            </Card.Header>
            <Card.Body className="content-stack">
              <form className="stack-form" onSubmit={(event) => void onTeacherCreateAssign(event)}>
                <Input label="Title" value={testTitle} onChange={(event) => setTestTitle(event.target.value)} />
                <Input label="Subject" value={subject} onChange={(event) => setSubject(event.target.value)} />
                <Input label="Question" value={questionText} onChange={(event) => setQuestionText(event.target.value)} />
                <Input label="Topic" value={topic} onChange={(event) => setTopic(event.target.value)} />
                <Input label="Correct answer" value={correctAnswerText} onChange={(event) => setCorrectAnswerText(event.target.value)} />
                <Input label="Wrong answer" value={wrongAnswerText} onChange={(event) => setWrongAnswerText(event.target.value)} />
                {teacherClasses.length ? (
                  <Select
                    label="Class"
                    value={classId}
                    onChange={(event) => setClassId(event.target.value)}
                    options={teacherClasses.map((item) => ({
                      value: item.class_id,
                      label: `${item.class_name} (${item.class_id})`
                    }))}
                  />
                ) : null}
                <Input label="Class ID" value={classId} onChange={(event) => setClassId(event.target.value)} />
                <Input
                  label="Deadline (ISO)"
                  type="datetime-local"
                  value={deadlineInput}
                  onChange={(event) => setDeadlineInput(event.target.value)}
                />
                {teacherError ? <Alert variant="danger" title={teacherError} /> : null}
                {teacherInfo ? <Alert variant="success" title={teacherInfo} /> : null}
                <Button type="submit" loading={isTeacherBusy} disabled={!isTeacher}>
                  {isTeacherBusy ? "Создание..." : "Create + Assign"}
                </Button>
              </form>
            </Card.Body>
          </Card>

          <Card>
            <Card.Header>
              <h3>
                <PlayCircle size={16} /> Student Test Screen + Result
              </h3>
            </Card.Header>
            <Card.Body className="content-stack">
              <form className="stack-form" onSubmit={(event) => void onStudentStart(event)}>
                <Input label="Test ID" value={studentTestId} onChange={(event) => setStudentTestId(event.target.value)} />
                <Input label="Assignment ID" value={studentAssignmentId} onChange={(event) => setStudentAssignmentId(event.target.value)} />
                {studentError ? <Alert variant="danger" title={studentError} /> : null}
                <Button type="submit" loading={isStudentBusy} disabled={!isStudent}>
                  {isStudentBusy ? "Старт..." : "Start Session"}
                </Button>
              </form>

              {questions.length ? (
                <section className="content-stack">
                  {questions.map((question) => (
                    <Card key={question.question_id} variant="flat">
                      <Card.Body className="content-stack">
                        <h3>{question.text}</h3>
                        <p className="panel-note">Topic: {question.topic}</p>
                        {question.answers.map((answer) => (
                          <label key={answer.answer_id} className="session-answer-item">
                            <input
                              type="radio"
                              name={`question_${question.question_id}`}
                              checked={answersByQuestion[question.question_id] === answer.answer_id}
                              onChange={() =>
                                setAnswersByQuestion((prev) => ({
                                  ...prev,
                                  [question.question_id]: answer.answer_id
                                }))
                              }
                            />
                            <span>{answer.text}</span>
                          </label>
                        ))}
                      </Card.Body>
                    </Card>
                  ))}
                  <Button variant="secondary" onClick={() => void onStudentFinish()} loading={isStudentBusy} disabled={!isStudent}>
                    {isStudentBusy ? "Завершение..." : "Finish Session"}
                  </Button>
                </section>
              ) : (
                <EmptyState title="Session not started" description="Введите test/assignment и нажмите Start Session." />
              )}

              {finishResult ? (
                <Card variant="flat">
                  <Card.Header>
                    <h3>Result Screen</h3>
                  </Card.Header>
                  <Card.Body className="content-stack">
                    <div className="metrics-row">
                      <span>Status: {finishResult.status}</span>
                      <span>Score: {finishResult.score_percent ?? "N/A"}%</span>
                      <span>
                        Answered: {finishResult.answered_questions}/{finishResult.total_questions}
                      </span>
                      <span>Correct: {finishResult.correct_answers}</span>
                    </div>
                    {finishResult.topic_breakdown.map((topicItem) => (
                      <div key={topicItem.topic} className="result-topic-row">
                        <strong>{topicItem.topic}</strong>
                        <ProgressBar value={topicItem.score_percent} labeled />
                      </div>
                    ))}
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>Topic</th>
                            <th>Total</th>
                            <th>Answered</th>
                            <th>Correct</th>
                            <th>Score %</th>
                          </tr>
                        </thead>
                        <tbody>
                          {finishResult.topic_breakdown.map((topicItem) => (
                            <tr key={`tbl_${topicItem.topic}`}>
                              <td>{topicItem.topic}</td>
                              <td>{topicItem.total_questions}</td>
                              <td>{topicItem.answered_questions}</td>
                              <td>{topicItem.correct_answers}</td>
                              <td>{topicItem.score_percent}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Card.Body>
                </Card>
              ) : null}
            </Card.Body>
          </Card>
        </section>

        <Card>
          <Card.Header>
            <h3>Class Results</h3>
          </Card.Header>
          <Card.Body className="content-stack">
            <form className="filter-form" onSubmit={(event) => void onLoadClassResults(event)}>
              <Input label="Test ID" value={reportTestId} onChange={(event) => setReportTestId(event.target.value)} />
              <Input label="Class ID" value={reportClassId} onChange={(event) => setReportClassId(event.target.value)} />
              <div className="row-actions">
                <Button type="submit" variant="ghost" loading={isReportBusy} disabled={!isTeacher}>
                  {isReportBusy ? "Загрузка..." : "Load Class Results"}
                </Button>
              </div>
            </form>

            {reportError ? <Alert variant="danger" title={reportError} /> : null}

            {classResults ? (
              <>
                <section className="panel-grid">
                  <Card variant="flat">
                    <Card.Body>
                      <strong>{classResults.total_students}</strong>
                      <p className="panel-note">Total students</p>
                    </Card.Body>
                  </Card>
                  <Card variant="flat">
                    <Card.Body>
                      <strong>{classResults.sessions_total}</strong>
                      <p className="panel-note">Sessions total</p>
                    </Card.Body>
                  </Card>
                  <Card variant="flat">
                    <Card.Body>
                      <strong>{classResults.completed_sessions}</strong>
                      <p className="panel-note">Completed sessions</p>
                    </Card.Body>
                  </Card>
                  <Card variant="flat">
                    <Card.Body>
                      <strong>{classResults.average_score}%</strong>
                      <p className="panel-note">Average score</p>
                    </Card.Body>
                  </Card>
                </section>
                <Table
                  columns={classResultColumns}
                  rows={classResults.students}
                  rowKey={(row) => row.student_id}
                  emptyTitle="No student rows"
                />
              </>
            ) : (
              <EmptyState title="Class results are empty" description="Загрузите результаты по test_id и class_id." />
            )}
          </Card.Body>
        </Card>
      </section>
    </AppShell>
  );
}
