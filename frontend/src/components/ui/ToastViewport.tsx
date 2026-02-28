import { useEffect } from "react";
import { cn } from "../../lib/cn";
import { useToastStore } from "../../state/toast-store";

const TOAST_TYPE_CLASS: Record<string, string> = {
  success: "toast-success",
  error: "toast-error",
  warning: "toast-warning",
  info: "toast-info"
};

export function ToastViewport() {
  const toasts = useToastStore((state) => state.toasts);
  const dismissToast = useToastStore((state) => state.dismissToast);

  useEffect(() => {
    const timers = toasts.map((toast) =>
      window.setTimeout(() => {
        dismissToast(toast.id);
      }, toast.durationMs)
    );
    return () => {
      timers.forEach((timerId) => window.clearTimeout(timerId));
    };
  }, [dismissToast, toasts]);

  return (
    <div className="toast-viewport" aria-live="polite" aria-atomic="false">
      {toasts.map((toast) => (
        <article key={toast.id} className={cn("toast", TOAST_TYPE_CLASS[toast.type])} role="status">
          <div className="toast-header">
            <strong>{toast.title}</strong>
            <button type="button" className="toast-close" onClick={() => dismissToast(toast.id)} aria-label="Dismiss">
              x
            </button>
          </div>
          {toast.message ? <p>{toast.message}</p> : null}
        </article>
      ))}
    </div>
  );
}
