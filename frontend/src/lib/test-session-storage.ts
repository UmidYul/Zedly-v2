import type { FinishSessionResponse, StartSessionResponse } from "./api";

export interface SessionQuestion {
  question_id: string;
  text: string;
  topic: string;
  answers: Array<{
    answer_id: string;
    text: string;
  }>;
}

export interface ActiveSessionSnapshot {
  session_id: string;
  test_id: string;
  assignment_id: string;
  test_title: string;
  mode: "standard" | "ntt";
  started_at: string;
  expires_at: string;
  questions: SessionQuestion[];
  answers_by_question: Record<string, string>;
}

export interface RecentTestCard {
  id: string;
  title: string;
  subject: string;
  teacher_name: string;
  test_id: string;
  assignment_id: string;
  deadline: string;
  questions_count: number;
  mode: "standard" | "ntt";
  status: "active" | "completed" | "overdue";
  progress_answered: number;
}

const ACTIVE_SESSION_PREFIX = "zedly.activeSession.";
const RESULT_PREFIX = "zedly.sessionResult.";
const RECENT_TESTS_KEY = "zedly.recentTests";

function safeParse<T>(raw: string | null): T | null {
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function buildSnapshotFromStartedSession(input: {
  started: StartSessionResponse;
  questions: SessionQuestion[];
  testId: string;
  assignmentId: string;
  testTitle: string;
  mode: "standard" | "ntt";
}): ActiveSessionSnapshot {
  return {
    session_id: input.started.session_id,
    test_id: input.testId,
    assignment_id: input.assignmentId,
    test_title: input.testTitle,
    mode: input.mode,
    started_at: new Date().toISOString(),
    expires_at: input.started.expires_at,
    questions: input.questions,
    answers_by_question: {}
  };
}

export function saveActiveSession(snapshot: ActiveSessionSnapshot) {
  window.sessionStorage.setItem(`${ACTIVE_SESSION_PREFIX}${snapshot.session_id}`, JSON.stringify(snapshot));
}

export function loadActiveSession(sessionId: string): ActiveSessionSnapshot | null {
  return safeParse<ActiveSessionSnapshot>(window.sessionStorage.getItem(`${ACTIVE_SESSION_PREFIX}${sessionId}`));
}

export function updateActiveSessionAnswers(sessionId: string, answers: Record<string, string>) {
  const snapshot = loadActiveSession(sessionId);
  if (!snapshot) {
    return;
  }
  snapshot.answers_by_question = answers;
  saveActiveSession(snapshot);
}

export function clearActiveSession(sessionId: string) {
  window.sessionStorage.removeItem(`${ACTIVE_SESSION_PREFIX}${sessionId}`);
}

export function saveSessionResult(sessionId: string, result: FinishSessionResponse) {
  window.sessionStorage.setItem(`${RESULT_PREFIX}${sessionId}`, JSON.stringify(result));
}

export function loadSessionResult(sessionId: string): FinishSessionResponse | null {
  return safeParse<FinishSessionResponse>(window.sessionStorage.getItem(`${RESULT_PREFIX}${sessionId}`));
}

export function loadRecentTests(): RecentTestCard[] {
  return safeParse<RecentTestCard[]>(window.localStorage.getItem(RECENT_TESTS_KEY)) || [];
}

export function upsertRecentTest(test: RecentTestCard) {
  const current = loadRecentTests();
  const next = [test, ...current.filter((item) => item.id !== test.id)].slice(0, 40);
  window.localStorage.setItem(RECENT_TESTS_KEY, JSON.stringify(next));
}

export function patchRecentTestByAssignment(assignmentId: string, patch: Partial<RecentTestCard>) {
  const current = loadRecentTests();
  const next = current.map((item) => (item.assignment_id === assignmentId ? { ...item, ...patch } : item));
  window.localStorage.setItem(RECENT_TESTS_KEY, JSON.stringify(next));
}

