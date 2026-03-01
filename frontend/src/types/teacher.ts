export type TeacherEventType = "test_completed" | "test_overdue" | "test_started";

export interface TeacherClassInfo {
  id: string;
  name: string;
  studentsCount: number;
  lastActivity?: string;
}

export interface TeacherKpiData {
  activeTestsCount: number;
  studentsCompletedToday: number;
  avgScore7d: number;
  testsCompletedMonth: number;
}

export interface TeacherActiveTest {
  id: string;
  title: string;
  classId: string;
  className: string;
  completedCount: number;
  totalCount: number;
  progressPercent: number;
  deadlineAt?: string | null;
  startsNow?: boolean;
}

export interface TeacherEventItem {
  id: string;
  type: TeacherEventType;
  studentName: string;
  testTitle?: string;
  score?: number;
  timestamp: string;
}

export interface TeacherDashboardViewModel {
  kpis: TeacherKpiData;
  classes: TeacherClassInfo[];
  activeTests: TeacherActiveTest[];
  events: TeacherEventItem[];
}

export type QuestionType = "mcq_single" | "mcq_multiple" | "open_text";

export interface QuestionOption {
  id: string;
  text: string;
  isCorrect: boolean;
}

export interface BuilderQuestion {
  id: string;
  text: string;
  imageUrl?: string;
  type: QuestionType;
  options: QuestionOption[];
  topic: string;
  explanation?: string;
  points: number;
}

export interface AssignmentDraft {
  classIds: string[];
  startsMode: "immediately" | "scheduled";
  startAt: string;
  deadlineAt: string;
  attemptLimit: number | null;
}

export interface TestDraft {
  id?: string;
  title: string;
  subject: string;
  classIds: string[];
  timeLimitMinutes: number | null;
  showAnswersAfter: "immediately" | "after_deadline" | "never";
  certificateThreshold: number | null;
  shuffleQuestions: boolean;
  shuffleAnswers: boolean;
  questions: BuilderQuestion[];
  currentStep: 1 | 2 | 3;
  isSaving: boolean;
  lastSavedAt: string | null;
  assignment: AssignmentDraft;
}

export interface MarketplaceTest {
  id: string;
  title: string;
  subject: string;
  gradeLabel: string;
  questionsCount: number;
  durationMinutes: number;
  authorName: string;
  rating: number;
  ratingCount: number;
  usageCount: number;
  language: "ru" | "uz";
}
