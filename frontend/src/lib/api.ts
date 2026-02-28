export type UserRole =
  | "student"
  | "teacher"
  | "director"
  | "psychologist"
  | "parent"
  | "inspector"
  | "ministry"
  | "superadmin";

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in_seconds: number;
}

export interface PasswordChangeRequired {
  status: "password_change_required";
  challenge_token: string;
  expires_in_seconds: number;
}

export interface LoginMethodsPrompt extends AuthTokens {
  status: "login_methods_prompt";
  google_connect_url: string;
  telegram_connect_url: string;
  skip_label: string;
}

export interface TelegramNotConnected {
  status: "telegram_not_connected";
  message: string;
}

export interface MeResponse {
  id: string;
  school_id: string | null;
  role: UserRole;
  full_name: string;
  login: string;
  email: string | null;
  phone: string | null;
  status: string;
  language: string;
  avatar_url?: string | null;
  teacher_classes?: TeacherClassRef[] | null;
  login_methods?: string[];
}

export interface TeacherClassRef {
  class_id: string;
  class_name: string;
}

export interface PatchMePayload {
  full_name?: string;
  language?: string;
  avatar_url?: string;
}

export interface SchoolUsersQuery {
  role?: "all" | UserRole;
  status?: "all" | "active" | "inactive" | "pending_approval" | "blocked";
  search?: string;
  class_id?: string;
}

export interface SchoolUsersResponse {
  school_id: string;
  users: MeResponse[];
  total_in_scope: number;
  filtered_total: number;
  role: string;
  status: string;
  class_id: string | null;
  search: string | null;
}

export type SchoolUserStatus = "active" | "inactive" | "pending_approval";

export interface ClassInviteResponse {
  class_id: string;
  code: string;
  expires_at: string;
}

export interface LoginMethodsResponse {
  google_connected: boolean;
  telegram_connected: boolean;
}

export interface TestAnswerInput {
  answer_id: string;
  text: string;
  is_correct?: boolean;
}

export interface TestQuestionInput {
  question_id: string;
  text: string;
  topic: string;
  points?: number;
  answers: TestAnswerInput[];
}

export interface TestCreatePayload {
  title: string;
  subject: string;
  mode: "standard" | "ntt";
  status: "draft" | "published";
  questions: TestQuestionInput[];
}

export interface TestCreateResponse {
  id: string;
  title: string;
  subject: string;
  school_id: string;
  teacher_id: string;
  mode: string;
  status: string;
  questions_count: number;
}

export interface AssignTestResponse {
  test_id: string;
  assignments_created: Array<{
    assignment_id: string;
    class_id: string;
    deadline: string;
    status: string;
  }>;
}

export interface TestDetailsResponse {
  id: string;
  title: string;
  subject: string;
  school_id: string;
  teacher_id: string;
  mode: string;
  status: string;
  show_answers: string;
  questions: Array<{
    question_id: string;
    text: string;
    topic: string;
    points: number;
    answers: Array<{
      answer_id: string;
      text: string;
      is_correct?: boolean;
      explanation?: string | null;
    }>;
  }>;
  assignment: {
    assignment_id: string;
    deadline: string;
    status: string;
  } | null;
}

export interface StartSessionResponse {
  session_id: string;
  assignment_id: string;
  status: string;
  expires_at: string;
  question_order: string[];
  answer_shuffles: Record<string, string[]>;
  questions: Array<{
    question_id: string;
    text: string;
    topic: string;
    answers: Array<{
      answer_id: string;
      text: string;
    }>;
  }> | null;
}

export interface SubmitAnswersResponse {
  session_id: string;
  answers_saved: number;
  total_answered: number;
  status: string;
  per_answer_result?: Array<{
    question_id: string;
    is_correct: boolean | null;
    correct_answer_id: string | null;
  }> | null;
}

export interface TopicBreakdownItem {
  topic: string;
  total_questions: number;
  answered_questions: number;
  correct_answers: number;
  score_percent: number;
}

export interface FinishSessionResponse {
  session_id: string;
  assignment_id: string;
  status: string;
  score_percent: number | null;
  total_questions: number;
  answered_questions: number;
  correct_answers: number;
  late_submission: boolean;
  topic_breakdown: TopicBreakdownItem[];
}

export interface ClassResultStudentRow {
  student_id: string;
  student_name: string;
  session_id: string | null;
  status: string;
  score_percent: number | null;
  answered_questions: number;
  total_questions: number;
  correct_answers: number;
  late_submission: boolean;
  completed_at: string | null;
}

export interface ClassResultsResponse {
  test_id: string;
  class_id: string;
  total_students: number;
  sessions_total: number;
  completed_sessions: number;
  average_score: number;
  students: ClassResultStudentRow[];
}

export interface TeacherDashboardResponse {
  teacher_id: string;
  school_id: string;
  period: string;
  class_average: number;
  completed_sessions: number;
  weak_topics: Array<Record<string, unknown>>;
  snapshot_updated_at: string;
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH";
  body?: unknown;
  accessToken?: string;
  signal?: AbortSignal;
}

interface ApiEnvelopeError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: Record<string, unknown>;

  constructor(status: number, code: string, message: string, details?: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const API_BASE = (import.meta.env.VITE_API_BASE_URL || "/api/v1").replace(/\/+$/, "");

function toApiPath(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE}${normalized}`;
}

async function parseJson(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return null;
  }
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  if (options.accessToken) {
    headers.Authorization = `Bearer ${options.accessToken}`;
  }

  const response = await fetch(toApiPath(path), {
    method: options.method || "GET",
    headers,
    credentials: "include",
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    signal: options.signal
  });

  const payload = (await parseJson(response)) as
    | { ok?: boolean; data?: unknown; error?: ApiEnvelopeError }
    | null;

  if (!response.ok) {
    const error = payload?.error;
    throw new ApiError(
      response.status,
      error?.code || "HTTP_ERROR",
      error?.message || `Request failed with status ${response.status}`,
      error?.details
    );
  }

  if (payload && payload.ok === true) {
    return payload.data as T;
  }

  return (payload as T) || (undefined as T);
}

export async function authLogin(login: string, password: string): Promise<AuthTokens | PasswordChangeRequired> {
  return request<AuthTokens | PasswordChangeRequired>("/auth/login", {
    method: "POST",
    body: { login, password }
  });
}

export async function authTelegram(auth_data: Record<string, string>): Promise<AuthTokens | TelegramNotConnected> {
  return request<AuthTokens | TelegramNotConnected>("/auth/telegram", {
    method: "POST",
    body: { auth_data }
  });
}

export async function authChangeFirstPassword(
  challengeToken: string,
  newPassword: string,
  repeatPassword: string
): Promise<LoginMethodsPrompt> {
  return request<LoginMethodsPrompt>("/auth/password/change-first", {
    method: "POST",
    body: {
      challenge_token: challengeToken,
      new_password: newPassword,
      repeat_password: repeatPassword
    }
  });
}

export async function authRefresh(refreshToken?: string): Promise<AuthTokens> {
  return request<AuthTokens>("/auth/refresh", {
    method: "POST",
    body: refreshToken ? { refresh_token: refreshToken } : {}
  });
}

export async function authLogout(accessToken: string, refreshToken?: string): Promise<{ status: string; sessions_terminated: number }> {
  return request<{ status: string; sessions_terminated: number }>("/auth/logout", {
    method: "POST",
    accessToken,
    body: refreshToken ? { refresh_token: refreshToken } : {}
  });
}

export async function authLogoutAll(accessToken: string): Promise<{ status: string; sessions_terminated: number }> {
  return request<{ status: string; sessions_terminated: number }>("/auth/logout-all", {
    method: "POST",
    accessToken
  });
}

export async function usersMe(accessToken: string): Promise<MeResponse> {
  return request<MeResponse>("/users/me", { accessToken });
}

export async function usersPatchMe(accessToken: string, payload: PatchMePayload): Promise<MeResponse> {
  return request<MeResponse>("/users/me", {
    method: "PATCH",
    accessToken,
    body: payload
  });
}

export async function usersGetLoginMethods(accessToken: string): Promise<LoginMethodsResponse> {
  return request<LoginMethodsResponse>("/users/me/login-methods", { accessToken });
}

export async function usersConnectGoogle(accessToken: string): Promise<LoginMethodsResponse> {
  return request<LoginMethodsResponse>("/users/me/login-methods/google/connect", {
    method: "POST",
    accessToken
  });
}

export async function usersConnectTelegram(accessToken: string): Promise<LoginMethodsResponse> {
  return request<LoginMethodsResponse>("/users/me/login-methods/telegram/connect", {
    method: "POST",
    accessToken
  });
}

export async function usersListSchoolUsers(
  accessToken: string,
  schoolId: string,
  params: SchoolUsersQuery = {}
): Promise<SchoolUsersResponse> {
  const query = new URLSearchParams();
  if (params.role) {
    query.set("role", params.role);
  }
  if (params.status) {
    query.set("status", params.status);
  }
  if (params.search) {
    query.set("search", params.search);
  }
  if (params.class_id) {
    query.set("class_id", params.class_id);
  }
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return request<SchoolUsersResponse>(`/schools/${schoolId}/users${suffix}`, { accessToken });
}

export async function classesCreateInvite(accessToken: string, classId: string): Promise<ClassInviteResponse> {
  return request<ClassInviteResponse>(`/classes/${classId}/invite`, {
    method: "POST",
    accessToken
  });
}

export async function usersPatchSchoolUser(
  accessToken: string,
  schoolId: string,
  userId: string,
  status: SchoolUserStatus
): Promise<MeResponse> {
  return request<MeResponse>(`/schools/${schoolId}/users/${userId}`, {
    method: "PATCH",
    accessToken,
    body: { status }
  });
}

export async function forgotPassword(login: string): Promise<{ status: "accepted"; message: string }> {
  try {
    const response = await request<{ status: "accepted"; message: string }>("/auth/password/forgot", {
      method: "POST",
      body: { login }
    });
    return response;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return {
        status: "accepted",
        message: "Если аккаунт существует, инструкции отправлены."
      };
    }
    throw error;
  }
}

export async function testsCreate(accessToken: string, payload: TestCreatePayload): Promise<TestCreateResponse> {
  return request<TestCreateResponse>("/tests", {
    method: "POST",
    accessToken,
    body: payload
  });
}

export async function testsAssign(accessToken: string, testId: string, classId: string, deadline: string): Promise<AssignTestResponse> {
  return request<AssignTestResponse>(`/tests/${testId}/assign`, {
    method: "POST",
    accessToken,
    body: {
      assignments: [{ class_id: classId, deadline }]
    }
  });
}

export async function testsGet(accessToken: string, testId: string): Promise<TestDetailsResponse> {
  return request<TestDetailsResponse>(`/tests/${testId}`, { accessToken });
}

export async function testsClassResults(
  accessToken: string,
  testId: string,
  classId: string
): Promise<ClassResultsResponse> {
  const query = new URLSearchParams({ class_id: classId });
  return request<ClassResultsResponse>(`/tests/${testId}/results?${query.toString()}`, { accessToken });
}

export async function testsStartSession(
  accessToken: string,
  testId: string,
  assignmentId: string,
  offlineMode: boolean
): Promise<StartSessionResponse> {
  return request<StartSessionResponse>(`/tests/${testId}/sessions`, {
    method: "POST",
    accessToken,
    body: { assignment_id: assignmentId, offline_mode: offlineMode }
  });
}

export async function sessionsSubmitAnswers(
  accessToken: string,
  sessionId: string,
  answers: Array<{ question_id: string; answer_id: string | null; answered_at: string }>
): Promise<SubmitAnswersResponse> {
  return request<SubmitAnswersResponse>(`/sessions/${sessionId}/answers`, {
    method: "POST",
    accessToken,
    body: { answers }
  });
}

export async function sessionsFinish(
  accessToken: string,
  sessionId: string,
  finalAnswers: Array<{ question_id: string; answer_id: string | null; answered_at: string }>
): Promise<FinishSessionResponse> {
  return request<FinishSessionResponse>(`/sessions/${sessionId}/finish`, {
    method: "POST",
    accessToken,
    body: { final_answers: finalAnswers }
  });
}

export async function analyticsTeacherDashboard(
  accessToken: string,
  params: { period?: string; class_id?: string } = {}
): Promise<TeacherDashboardResponse> {
  const query = new URLSearchParams();
  if (params.period) {
    query.set("period", params.period);
  }
  if (params.class_id) {
    query.set("class_id", params.class_id);
  }
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return request<TeacherDashboardResponse>(`/analytics/teacher/dashboard${suffix}`, { accessToken });
}
