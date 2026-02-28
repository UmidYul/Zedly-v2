import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { registerSW } from "virtual:pwa-register";
import App from "./App";
import { AppErrorBoundary } from "./components/system/AppErrorBoundary";
import { Skeleton } from "./components/ui/Skeleton";
import { ToastViewport } from "./components/ui/ToastViewport";
import { queryClient } from "./lib/queryClient";
import { AuthProvider } from "./state/auth-context";
import "./styles/tokens.css";
import "./styles/globals.css";

if (typeof document !== "undefined") {
  const initialTheme = window.localStorage.getItem("zedly.theme");
  document.documentElement.setAttribute("data-theme", initialTheme === "light" ? "light" : "dark");
}

registerSW({ immediate: true });

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AppErrorBoundary>
        <BrowserRouter>
          <AuthProvider>
            <React.Suspense
              fallback={
                <div className="boot-screen">
                  <Skeleton variant="card" className="suspense-skeleton" />
                </div>
              }
            >
              <App />
            </React.Suspense>
            <ToastViewport />
          </AuthProvider>
        </BrowserRouter>
      </AppErrorBoundary>
    </QueryClientProvider>
  </React.StrictMode>
);
