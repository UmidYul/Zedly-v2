import { Component, ErrorInfo, ReactNode } from "react";

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  hasError: boolean;
}

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("AppErrorBoundary", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="fatal-screen">
          <article className="fatal-card">
            <h1>Что-то пошло не так</h1>
            <p>Попробуйте обновить страницу. Если проблема повторяется, обратитесь к администратору.</p>
            <button
              type="button"
              className="primary-button"
              onClick={() => {
                window.location.reload();
              }}
            >
              Обновить
            </button>
          </article>
        </div>
      );
    }

    return this.props.children;
  }
}
