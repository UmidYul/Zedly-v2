import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 45_000,
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure"
  },
  webServer: [
    {
      command: "python -m uvicorn app.main:app --host 127.0.0.1 --port 8000",
      cwd: "../backend",
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: {
        ZEDLY_STORAGE_BACKEND: "memory",
        ZEDLY_SESSIONS_BACKEND: "memory"
      }
    },
    {
      command: "npm run dev -- --host 127.0.0.1 --port 4173",
      cwd: ".",
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: {
        VITE_DEV_TELEGRAM_BOT_TOKEN: "dev-bot-token",
        VITE_API_BASE_URL: "/api/v1"
      }
    }
  ]
});
