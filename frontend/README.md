# Zedly Frontend

React + Vite + PWA shell for desktop web and Telegram Mini App-adjacent flows.

## Run

```bash
cd frontend
npm install
npm run dev
```

Default URL: `http://localhost:5173`.

## Docker

Frontend is included in the main compose stack (`backend/docker-compose.yml`):

```bash
cd backend
docker compose up --build
```

Frontend URL in Docker: `http://localhost:5173` (served by Nginx, `/api` is proxied to backend container).

## Environment

Copy `.env.example` to `.env.local` and adjust values:

```bash
VITE_API_BASE_URL=/api/v1
VITE_DEV_TELEGRAM_BOT_TOKEN=dev-bot-token
```

`VITE_DEV_TELEGRAM_BOT_TOKEN` is optional and used only for local Telegram dev login HMAC generation.

## E2E (Playwright)

```bash
cd frontend
npm run e2e:install
npm run e2e
```

Current smoke coverage:
- teacher login -> dashboard -> profile -> class invite generation.
- director login -> school users page -> role filter.
- first login by OTP -> mandatory password change -> optional quick-login step -> dashboard.
- cookie lifecycle: login -> refresh(cookie) -> logout -> refresh=401.
- logout-all lifecycle: current access token revoked, refresh flow rejected.

## Sprint 2-4 scope covered

- Login (`/login`) with `login + password` API v1 integration.
- First password setup (`/first-password`) after temporary OTP login.
- Optional quick-login setup (`Google` / `Telegram`) immediately after first password change.
- Forgot Password UI (`/forgot-password`) with graceful fallback.
- Authenticated dashboard shell (`/dashboard`) with logout / logout-all controls.
- Profile page (`/profile`) with editable fields via `PATCH /api/v1/users/me`.
- Profile section `Способы входа` via `/api/v1/users/me/login-methods*`.
- School users page (`/school-users`) with role/status/search/class filters.
- Class invite page (`/class-invites`) for teacher invite-code generation.
- Tests Workbench page (`/tests-workbench`) with:
  - teacher create + assign test MVP,
  - student start + finish + result breakdown MVP,
  - teacher class-results summary via analytics.
- PWA setup via `vite-plugin-pwa` and runtime cache rule for offline test bundles.
