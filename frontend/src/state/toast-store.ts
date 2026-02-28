import { create } from "zustand";

export type ToastType = "success" | "error" | "warning" | "info";

export interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  durationMs: number;
  createdAt: number;
}

interface ToastStoreState {
  toasts: ToastItem[];
  pushToast: (input: Omit<ToastItem, "id" | "createdAt" | "durationMs"> & { durationMs?: number }) => void;
  dismissToast: (id: string) => void;
  clearToasts: () => void;
}

const DEFAULT_DURATIONS: Record<ToastType, number> = {
  success: 3000,
  info: 4000,
  warning: 4500,
  error: 6000
};

function buildToastId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export const useToastStore = create<ToastStoreState>((set) => ({
  toasts: [],
  pushToast: (input) =>
    set((state) => {
      const toast: ToastItem = {
        id: buildToastId(),
        type: input.type,
        title: input.title,
        message: input.message,
        durationMs: input.durationMs ?? DEFAULT_DURATIONS[input.type],
        createdAt: Date.now()
      };
      const next = [toast, ...state.toasts];
      return { toasts: next.slice(0, 5) };
    }),
  dismissToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((item) => item.id !== id)
    })),
  clearToasts: () => set({ toasts: [] })
}));
