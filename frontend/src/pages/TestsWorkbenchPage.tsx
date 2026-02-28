import { FormEvent, useMemo, useState } from "react";
import { AppShell } from "../components/layout/AppShell";
import {
  ClassResultsResponse,
  FinishSessionResponse,
  StartSessionResponse,
  sessionsFinish,
  testsClassResults,
  testsAssign,
  testsCreate,
  testsGet,
  testsStartSession
} from "../lib/api";
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
  const [deadline, setDeadline] = useState(new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString());
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
      const assigned = await testsAssign(accessToken, created.id, classId.trim(), deadline);
      const assignment = assigned.assignments_created[0];
      setTeacherInfo(`Создан test_id=${created.id}, assignment_id=${assignment.assignment_id}`);
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
          test.questions.map((q) => ({
            question_id: q.question_id,
            text: q.text,
            topic: q.topic,
            answers: q.answers.map((a) => ({ answer_id: a.answer_id, text: a.text }))
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
      const finalAnswers = questions.map((q) => ({
        question_id: q.question_id,
        answer_id: answersByQuestion[q.question_id] || null,
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

  return (
    <AppShell>
      <section className="content-stack">
        <article className="panel-card">
          <h2>Teacher Test Builder MVP</h2>
          <p className="panel-note">Create + assign через `/tests` и `/tests/{'{id}'}/assign`.</p>
          <form className="stack-form" onSubmit={(event) => void onTeacherCreateAssign(event)}>
            <label className="input-field">
              <span className="input-label">Title</span>
              <input value={testTitle} onChange={(event) => setTestTitle(event.target.value)} />
            </label>
            <label className="input-field">
              <span className="input-label">Subject</span>
              <input value={subject} onChange={(event) => setSubject(event.target.value)} />
            </label>
            <label className="input-field">
              <span className="input-label">Question</span>
              <input value={questionText} onChange={(event) => setQuestionText(event.target.value)} />
            </label>
            <label className="input-field">
              <span className="input-label">Topic</span>
              <input value={topic} onChange={(event) => setTopic(event.target.value)} />
            </label>
            <label className="input-field">
              <span className="input-label">Correct answer</span>
              <input value={correctAnswerText} onChange={(event) => setCorrectAnswerText(event.target.value)} />
            </label>
            <label className="input-field">
              <span className="input-label">Wrong answer</span>
              <input value={wrongAnswerText} onChange={(event) => setWrongAnswerText(event.target.value)} />
            </label>
            {teacherClasses.length ? (
              <label className="input-field">
                <span className="input-label">Class</span>
                <select value={classId} onChange={(event) => setClassId(event.target.value)}>
                  {teacherClasses.map((item) => (
                    <option key={item.class_id} value={item.class_id}>
                      {item.class_name} ({item.class_id})
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <label className="input-field">
              <span className="input-label">Class ID</span>
              <input value={classId} onChange={(event) => setClassId(event.target.value)} />
            </label>
            <label className="input-field">
              <span className="input-label">Deadline (ISO)</span>
              <input value={deadline} onChange={(event) => setDeadline(event.target.value)} />
            </label>
            {teacherError ? <div className="error-box">{teacherError}</div> : null}
            {teacherInfo ? <div className="success-box">{teacherInfo}</div> : null}
            <button type="submit" className="primary-button" disabled={isTeacherBusy || !isTeacher}>
              {isTeacherBusy ? "Создание..." : "Create + Assign"}
            </button>
          </form>
        </article>

        <article className="panel-card">
          <h2>Student Test Screen + Result</h2>
          <p className="panel-note">Start session, choose answers, finish и получить результат с breakdown.</p>
          <form className="stack-form" onSubmit={(event) => void onStudentStart(event)}>
            <label className="input-field">
              <span className="input-label">Test ID</span>
              <input value={studentTestId} onChange={(event) => setStudentTestId(event.target.value)} />
            </label>
            <label className="input-field">
              <span className="input-label">Assignment ID</span>
              <input value={studentAssignmentId} onChange={(event) => setStudentAssignmentId(event.target.value)} />
            </label>
            {studentError ? <div className="error-box">{studentError}</div> : null}
            <button type="submit" className="primary-button" disabled={isStudentBusy || !isStudent}>
              {isStudentBusy ? "Старт..." : "Start Session"}
            </button>
          </form>

          {questions.length ? (
            <div className="content-stack" style={{ marginTop: 14 }}>
              {questions.map((q) => (
                <article key={q.question_id} className="panel-card">
                  <h3>{q.text}</h3>
                  <p className="panel-note">Topic: {q.topic}</p>
                  <div className="stack-form">
                    {q.answers.map((a) => (
                      <label key={a.answer_id} className="input-field">
                        <span className="input-label">
                          <input
                            type="radio"
                            name={`question_${q.question_id}`}
                            checked={answersByQuestion[q.question_id] === a.answer_id}
                            onChange={() =>
                              setAnswersByQuestion((prev) => ({
                                ...prev,
                                [q.question_id]: a.answer_id
                              }))
                            }
                          />{" "}
                          {a.text}
                        </span>
                      </label>
                    ))}
                  </div>
                </article>
              ))}
              <button type="button" className="secondary-button" onClick={() => void onStudentFinish()} disabled={isStudentBusy || !isStudent}>
                {isStudentBusy ? "Завершение..." : "Finish Session"}
              </button>
            </div>
          ) : null}

          {finishResult ? (
            <article className="panel-card" style={{ marginTop: 14 }}>
              <h3>Result Screen</h3>
              <dl className="kv-grid">
                <dt>Status</dt>
                <dd>{finishResult.status}</dd>
                <dt>Score %</dt>
                <dd>{finishResult.score_percent ?? "N/A"}</dd>
                <dt>Answered</dt>
                <dd>
                  {finishResult.answered_questions}/{finishResult.total_questions}
                </dd>
                <dt>Correct</dt>
                <dd>{finishResult.correct_answers}</dd>
                <dt>Late</dt>
                <dd>{finishResult.late_submission ? "yes" : "no"}</dd>
              </dl>
              <div className="table-wrap" style={{ marginTop: 12 }}>
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
                    {finishResult.topic_breakdown.map((item) => (
                      <tr key={item.topic}>
                        <td>{item.topic}</td>
                        <td>{item.total_questions}</td>
                        <td>{item.answered_questions}</td>
                        <td>{item.correct_answers}</td>
                        <td>{item.score_percent}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
          ) : null}
        </article>

        <article className="panel-card">
          <h2>Class Results</h2>
          <p className="panel-note">Teacher-scoped list через `/tests/{'{test_id}'}/results?class_id=...`.</p>
          <form className="stack-form" onSubmit={(event) => void onLoadClassResults(event)}>
            <label className="input-field">
              <span className="input-label">Test ID</span>
              <input value={reportTestId} onChange={(event) => setReportTestId(event.target.value)} />
            </label>
            <label className="input-field">
              <span className="input-label">Class ID</span>
              <input value={reportClassId} onChange={(event) => setReportClassId(event.target.value)} />
            </label>
            {reportError ? <div className="error-box">{reportError}</div> : null}
            <button type="submit" className="ghost-button" disabled={isReportBusy || !isTeacher}>
              {isReportBusy ? "Загрузка..." : "Load Class Results"}
            </button>
          </form>

          {classResults ? (
            <div className="content-stack" style={{ marginTop: 12 }}>
              <dl className="kv-grid">
                <dt>Total students</dt>
                <dd>{classResults.total_students}</dd>
                <dt>Sessions total</dt>
                <dd>{classResults.sessions_total}</dd>
                <dt>Completed sessions</dt>
                <dd>{classResults.completed_sessions}</dd>
                <dt>Average score</dt>
                <dd>{classResults.average_score}</dd>
              </dl>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>Status</th>
                      <th>Score %</th>
                      <th>Answered</th>
                      <th>Correct</th>
                      <th>Late</th>
                    </tr>
                  </thead>
                  <tbody>
                    {classResults.students.map((item) => (
                      <tr key={item.student_id}>
                        <td>{item.student_name}</td>
                        <td>{item.status}</td>
                        <td>{item.score_percent ?? "N/A"}</td>
                        <td>
                          {item.answered_questions}/{item.total_questions}
                        </td>
                        <td>{item.correct_answers}</td>
                        <td>{item.late_submission ? "yes" : "no"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </article>
      </section>
    </AppShell>
  );
}
