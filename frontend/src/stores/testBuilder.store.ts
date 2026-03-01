import { create } from "zustand";
import type { BuilderQuestion, QuestionOption, TestDraft } from "../types/teacher";

const STORAGE_KEY = "zedly.teacher.test-builder.draft";

function createId(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Math.random().toString(16).slice(2)}`;
}

function createOption(text = ""): QuestionOption {
  return {
    id: createId("opt"),
    text,
    isCorrect: false
  };
}

function createQuestion(): BuilderQuestion {
  return {
    id: createId("q"),
    text: "",
    type: "mcq_single",
    options: [createOption(), createOption()],
    topic: "",
    points: 1
  };
}

function createInitialDraft(): TestDraft {
  const deadline = new Date(Date.now() + 24 * 60 * 60 * 1000);
  deadline.setHours(23, 59, 0, 0);

  return {
    title: "",
    subject: "",
    classIds: [],
    timeLimitMinutes: 30,
    showAnswersAfter: "after_deadline",
    certificateThreshold: null,
    shuffleQuestions: true,
    shuffleAnswers: true,
    questions: [createQuestion()],
    currentStep: 1,
    isSaving: false,
    lastSavedAt: null,
    assignment: {
      classIds: [],
      startsMode: "immediately",
      startAt: new Date().toISOString(),
      deadlineAt: deadline.toISOString(),
      attemptLimit: 1
    }
  };
}

function normalizeQuestion(question: BuilderQuestion): BuilderQuestion {
  if (question.type === "open_text") {
    return { ...question, options: [] };
  }
  const safeOptions = question.options.length >= 2 ? question.options : [createOption(), createOption()];
  if (question.type === "mcq_single") {
    let seenCorrect = false;
    return {
      ...question,
      options: safeOptions.map((option) => {
        if (!option.isCorrect || seenCorrect) {
          return { ...option, isCorrect: false };
        }
        seenCorrect = true;
        return option;
      })
    };
  }
  return { ...question, options: safeOptions };
}

function normalizeDraft(input: Partial<TestDraft>): TestDraft {
  const base = createInitialDraft();
  const questions = Array.isArray(input.questions) && input.questions.length > 0 ? input.questions.map(normalizeQuestion) : base.questions;
  return {
    ...base,
    ...input,
    classIds: Array.isArray(input.classIds) ? input.classIds : base.classIds,
    questions,
    currentStep: input.currentStep === 2 || input.currentStep === 3 ? input.currentStep : 1,
    assignment: {
      ...base.assignment,
      ...input.assignment,
      classIds: Array.isArray(input.assignment?.classIds) ? input.assignment.classIds : Array.isArray(input.classIds) ? input.classIds : base.assignment.classIds
    }
  };
}

function saveDraftToStorage(draft: TestDraft): void {
  if (typeof window === "undefined") {
    return;
  }
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
}

function loadDraftFromStorage(): TestDraft | null {
  if (typeof window === "undefined") {
    return null;
  }
  const raw = window.sessionStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }
  try {
    return normalizeDraft(JSON.parse(raw) as Partial<TestDraft>);
  } catch {
    return null;
  }
}

interface TestBuilderStore extends TestDraft {
  setField: <K extends keyof TestDraft>(key: K, value: TestDraft[K]) => void;
  setAssignmentField: <K extends keyof TestDraft["assignment"]>(key: K, value: TestDraft["assignment"][K]) => void;
  addQuestion: () => void;
  duplicateQuestion: (questionId: string) => void;
  updateQuestion: (questionId: string, updates: Partial<BuilderQuestion>) => void;
  removeQuestion: (questionId: string) => void;
  reorderQuestions: (fromIndex: number, toIndex: number) => void;
  hydrateFromSession: () => boolean;
  persistToSession: () => void;
  setSaving: (isSaving: boolean) => void;
  nextStep: () => void;
  prevStep: () => void;
  reset: () => void;
}

export const useTestBuilderStore = create<TestBuilderStore>((set, get) => ({
  ...createInitialDraft(),
  setField: (key, value) => set((state) => ({ ...state, [key]: value })),
  setAssignmentField: (key, value) =>
    set((state) => ({
      ...state,
      assignment: {
        ...state.assignment,
        [key]: value
      }
    })),
  addQuestion: () =>
    set((state) => ({
      ...state,
      questions: [...state.questions, createQuestion()]
    })),
  duplicateQuestion: (questionId) =>
    set((state) => {
      const idx = state.questions.findIndex((item) => item.id === questionId);
      if (idx === -1) {
        return state;
      }
      const source = state.questions[idx];
      const copy: BuilderQuestion = {
        ...source,
        id: createId("q"),
        options: source.options.map((option) => ({ ...option, id: createId("opt") }))
      };
      const next = [...state.questions];
      next.splice(idx + 1, 0, copy);
      return { ...state, questions: next };
    }),
  updateQuestion: (questionId, updates) =>
    set((state) => ({
      ...state,
      questions: state.questions.map((question) => {
        if (question.id !== questionId) {
          return question;
        }

        const merged = normalizeQuestion({
          ...question,
          ...updates,
          options: updates.options || question.options
        });
        return merged;
      })
    })),
  removeQuestion: (questionId) =>
    set((state) => {
      const filtered = state.questions.filter((item) => item.id !== questionId);
      return {
        ...state,
        questions: filtered.length > 0 ? filtered : [createQuestion()]
      };
    }),
  reorderQuestions: (fromIndex, toIndex) =>
    set((state) => {
      if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= state.questions.length || toIndex >= state.questions.length) {
        return state;
      }
      const next = [...state.questions];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return { ...state, questions: next };
    }),
  hydrateFromSession: () => {
    const draft = loadDraftFromStorage();
    if (!draft) {
      return false;
    }
    set({ ...draft, isSaving: false });
    return true;
  },
  persistToSession: () => {
    const state = get();
    saveDraftToStorage({
      id: state.id,
      title: state.title,
      subject: state.subject,
      classIds: state.classIds,
      timeLimitMinutes: state.timeLimitMinutes,
      showAnswersAfter: state.showAnswersAfter,
      certificateThreshold: state.certificateThreshold,
      shuffleQuestions: state.shuffleQuestions,
      shuffleAnswers: state.shuffleAnswers,
      questions: state.questions,
      currentStep: state.currentStep,
      isSaving: false,
      lastSavedAt: new Date().toISOString(),
      assignment: state.assignment
    });
    set({ lastSavedAt: new Date().toISOString() });
  },
  setSaving: (isSaving) => set({ isSaving }),
  nextStep: () => set((state) => ({ currentStep: (Math.min(3, state.currentStep + 1) as 1 | 2 | 3) })),
  prevStep: () => set((state) => ({ currentStep: (Math.max(1, state.currentStep - 1) as 1 | 2 | 3) })),
  reset: () => {
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem(STORAGE_KEY);
    }
    set(createInitialDraft());
  }
}));

export { STORAGE_KEY as TEST_BUILDER_STORAGE_KEY };
