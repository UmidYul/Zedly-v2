# Current Sprint
Sprint 4: Test Engine Core (P0)

# Completed
- Введён канонический namespace `/api/v1/*` + envelope `ok/data` и `ok/error`.
- Введены deprecation-заголовки для legacy-роутов и baseline contract tests.
- Усилена миграционная дисциплина SQL + CI gate (`backend-migrations.yml`) + policy-документ.
- Sprint 2 auth hardening закрыт: cookie-first refresh/logout, dual lockout (identity+IP), `logout-all` blacklist `jti`, `POST /api/v1/auth/password/forgot`.
- Поднят `frontend/` как `React + Vite + PWA` shell с auth экранами.
- Реализован блок Sprint 3 (backend):
  - `GET /api/v1/users/me` возвращает `avatar_url` и `teacher_classes` для роли teacher.
  - `GET /api/v1/schools/{school_id}/users` поддерживает `role/status/search/class_id` фильтры.
  - Role-aware выборка: teacher видит только students; director видит весь school scope.
  - Добавлены метаданные выборки: `total_in_scope`, `filtered_total`.
  - Добавлен class-level filtering через `list_students_by_class` в data-store (memory + postgres).
- Реализован блок Sprint 3 (frontend):
  - страницы `Profile`, `School Users`, `Class Invites`;
  - формы обновления профиля (`PATCH /users/me`);
  - таблица пользователей школы с фильтрами;
  - генерация invite-кода по class_id.
- Добавлен исполняемый контракт `docs/07_api/openapi.yaml` для всех текущих `/api/v1/*` операций.
- Добавлен route-contract checker `backend/scripts/verify_openapi_contract.py` (live routes vs OpenAPI paths/methods).
- Добавлен CI gate `.github/workflows/backend-contract.yml`:
  - проверка `verify_openapi_contract.py`,
  - прогон `backend/tests/test_v1_contracts.py`.
- Добавлен Playwright smoke suite для web auth/users:
  - конфиг `frontend/playwright.config.ts`,
  - тесты `frontend/e2e/auth-users.spec.ts`,
  - CI workflow `.github/workflows/frontend-e2e.yml`.
- Расширен Playwright auth smoke:
  - сценарий `director provisions account -> first OTP login -> mandatory password change -> dashboard`.
- Добавлен Playwright cookie lifecycle smoke:
  - `login -> refresh(cookie) -> logout -> refresh=401`.
- Добавлен Playwright smoke для `logout-all`:
  - проверка ревокации текущего access token + refresh-flow после `logout-all`.
- В UI `School Users` добавлены director actions для смены статуса пользователя (`active` / `inactive`) через `PATCH /schools/{school_id}/users/{user_id}`.
- `docs/07_api/openapi.yaml` дополнен reusable schema components (`ApiErrorEnvelope`, `TokenPair`, `User`, `SchoolUsersResponseData`, `ClassInviteResponseData`).
- Для Auth/Users в `openapi.yaml` добавлены envelope-референсы в responses (`ok/data/error` через `$ref`).
- Для Tests/Analytics/Reports в `openapi.yaml` добавлены единообразные envelope `$ref` в responses и недостающие schema components.
- Для ключевых Auth/Users/Tests/Reports envelope-схем добавлены `examples` в `openapi.yaml`.
- Добавлен OpenAPI lint в CI через Spectral (`.spectral.yaml`) в `backend-contract.yml` и `release-gate.yml`.
- В `openapi.yaml` добавлены operation-level `tags` + `description` для всех `/api/v1/*` операций и глобальный раздел `tags`.
- Добавлен `CONTRIBUTING.md` с CI merge-gate matrix и локальным preflight набором команд.
- В `openapi.yaml` добавлены `example`/`examples` для всех текущих schema components.
- Sprint 4 progress (backend): `POST /sessions/{session_id}/finish` теперь возвращает `topic_breakdown` (per-topic score breakdown).
- Sprint 4 progress (frontend): добавлена страница `/tests-workbench`:
  - Teacher Test Builder MVP (create + assign),
  - Student Test Screen + Result Screen (start + finish + breakdown),
  - Class Results MVP (summary через `/analytics/teacher/dashboard`).
- Sprint 4 progress (backend): добавлен teacher-scoped endpoint `GET /api/v1/tests/{test_id}/results?class_id=...` (список результатов класса по тесту).
- Sprint 4 progress (frontend): виджет `Class Results` на `/tests-workbench` переведён с summary-only на endpoint `/tests/{id}/results` (метрики + таблица учеников).
- OpenAPI: для POST/PATCH endpoint’ов добавлены requestBody schemas + examples; добавлен контракт для `GET /api/v1/tests/{test_id}/results`.
- Добавлен Playwright smoke `tests workbench: teacher create+assign -> student finish -> topic breakdown`.
- Исправлен first-login UX routing: экран «Быстрый вход» после смены OTP больше не редиректится преждевременно на `/dashboard`.
- Frontend добавлен в Docker stack:
  - `frontend/Dockerfile` (multi-stage build: Node -> Nginx),
  - `frontend/nginx.conf` (SPA fallback + `/api` reverse-proxy к backend),
  - сервис `frontend` в `backend/docker-compose.yml` с портом `5173:80`.
- Добавлен единый workflow `.github/workflows/release-gate.yml`:
  - `migrations` (clean PostgreSQL apply + `--check`),
  - `backend-contract` (OpenAPI parity + contract tests),
  - `frontend-e2e` (Playwright smoke),
  - `gate` (агрегированный pass/fail).

# In Progress
- Sprint 4 UI hardening: валидации и UX-доводка для Test Builder / Student flow.

# Blocked
- Нет.

# Next 3 Tasks
- Sprint 5: добавить offline E2E сценарий потери сети и последующего `sync` с проверкой idempotency.
- Sprint 5: покрыть NTT-specific flow (запрет возврата назад + автозавершение + статус `completed`) в web e2e.
- Sprint 5: усилить worker finalize pipeline для истёкших сессий (idempotent retries + метрики исполнения).

# API/DB Changes
- API Users: расширен `GET /users/me` (добавлены `avatar_url`, `teacher_classes`).
- API Users: расширен `GET /schools/{school_id}/users` (query filters + выборочные метаданные).
- DB access layer: добавлен метод `list_students_by_class` для `DataStore` (memory/postgres).
- API remains backward-compatible for existing consumers of previous `users` payload subset.
- API Contract: добавлен `docs/07_api/openapi.yaml` и автоматическая проверка соответствия живым роутам.
- API Tests: `FinishSessionResponse` расширен полем `topic_breakdown` (по темам: total/answered/correct/score%).
- Frontend: добавлены API-клиенты и UI для тестового lifecycle (`testsCreate/assign/start/get`, `sessionsFinish`, teacher analytics summary).
- API Tests: добавлен `GET /tests/{test_id}/results?class_id=...` (teacher-scoped class results list by test/class).
- API Contract: добавлены requestBody schemas/examples для POST/PATCH операций + новый path `/api/v1/tests/{test_id}/results`.
- Frontend: `TestsWorkbench` подключён к `testsClassResults` API (таблица статусов/скоров учеников по классу).

# Test Results
- `python -m pytest backend/tests -q` -> `24 passed` (2026-02-28).
- `npm run build` в `frontend/` -> успешно (Vite production build + PWA artifacts) (2026-02-28).
- `python backend/scripts/verify_openapi_contract.py` -> `OpenAPI contract check passed: 32 /api/v1 operations matched.` (2026-02-28).
- `npx -y @stoplight/spectral-cli lint --fail-severity=warn docs/07_api/openapi.yaml` -> без warning/error (2026-02-28).
- `npm run e2e` в `frontend/` -> `6 passed` (Playwright smoke: auth/users + first-login OTP flow + cookie lifecycle + logout-all revoke + tests-workbench flow) (2026-02-28).
- `docker compose -f backend/docker-compose.yml config` -> валидно, frontend сервис включён (2026-02-28).
- `docker compose -f backend/docker-compose.yml build frontend` -> успешно, образ `backend-frontend` собирается (2026-02-28).
- `python -m pytest backend/tests/test_wave2_test_engine_and_onboarding.py -q` -> `7 passed` (2026-02-28).
