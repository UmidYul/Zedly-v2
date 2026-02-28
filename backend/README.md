# Zedly Backend (Wave 1 + P0 Test Engine + Hierarchical Account Provisioning)

Docs-first backend core implementation for:
- Auth lifecycle (login/first-password-change/telegram/refresh/logout/logout-all)
- Hierarchical account provisioning (`/users/provision`) with generated login + OTP
- First login OTP flow with mandatory password replacement
- Profile login methods (`/users/me/login-methods/*`) for Google/Telegram quick sign-in
- RBAC permissions with canonical + alias mapping
- School isolation hardening (resource-level 403 + audit + IP blocking)
- Test engine APIs:
  - `POST /tests`
  - `GET /tests/{test_id}`
  - `POST /tests/{test_id}/assign`
  - `POST /tests/{test_id}/sessions`
  - `POST /sessions/{session_id}/answers`
  - `POST /sessions/{session_id}/finish`
  - `GET /tests/{test_id}/offline-bundle`
  - `POST /sessions/{session_id}/sync`
- Analytics snapshot APIs:
  - `GET /analytics/teacher/dashboard`
  - `GET /analytics/director/dashboard`
- RLS SQL baseline (`sql/001_rls_policies.sql`)
- Runtime switchable backends: `memory` or `postgres` for data, `memory` or `redis` for sessions/rate-limits
- Worker loop for expired sessions + analytics recalculation (`worker.py`)

## Run

```bash
cd backend
python -m uvicorn app.main:app --reload
```

## Docker Compose (staging-ready local stack)

```bash
cd backend
docker compose up --build
```

Stack:
- `postgres` (state + RLS)
- `redis` (sessions, rate-limits, streams)
- `api` (FastAPI)
- `worker` (expired sessions + analytics stream consumer)
- `frontend` (React build served by Nginx with `/api` proxy to backend)

After startup:
- frontend: `http://localhost:5173`
- backend API: `http://localhost:8000`

## Configuration

Default mode (for local tests) is fully in-memory:

```bash
ZEDLY_STORAGE_BACKEND=memory
ZEDLY_SESSIONS_BACKEND=memory
```

PostgreSQL + Redis mode:

```bash
ZEDLY_STORAGE_BACKEND=postgres
POSTGRES_PASSWORD=<local-dev-password>
ZEDLY_DATABASE_URL=postgresql://postgres:<local-dev-password>@localhost:5432/zedly
ZEDLY_SESSIONS_BACKEND=redis
ZEDLY_REDIS_URL=redis://localhost:6379/0
```

Auth refresh-cookie defaults:

```bash
ZEDLY_AUTH_REFRESH_COOKIE_NAME=zedly_rt
ZEDLY_AUTH_REFRESH_COOKIE_SECURE=false
ZEDLY_AUTH_REFRESH_COOKIE_SAMESITE=lax
ZEDLY_AUTH_REFRESH_COOKIE_PATH=/
ZEDLY_AUTH_REFRESH_COOKIE_DOMAIN=
```

Bootstrap SQL:

```bash
export ZEDLY_DATABASE_URL=postgresql://postgres:<local-dev-password>@localhost:5432/zedly
python scripts/run_sql_migrations.py
python scripts/run_sql_migrations.py --check
```

OpenAPI route-contract check:

```bash
python scripts/verify_openapi_contract.py
```

OpenAPI lint (Spectral):

```bash
npx -y @stoplight/spectral-cli lint --fail-severity=warn ../docs/07_api/openapi.yaml
```

Migration discipline:
- Migration filename format: `NNN_description.sql` (example: `002_add_indexes.sql`).
- Sequence must be continuous and start from `000`.
- Applied migrations are tracked in `schema_migrations` with SHA-256 checksum.
- Applied migration files are immutable (checksum mismatch is a hard error).
- CI validates sequential apply on a clean PostgreSQL and then runs `--check`.

## Test

```bash
cd backend
python -m pytest -q
```

## Notes

- Access token TTL: 15m
- Refresh token TTL: 30d
- First password change challenge TTL: 15m (one-time use)
- Invite TTL: 72h (class distribution flow)
- Refresh token rotation + family revoke on reuse is implemented.
- `login/refresh/password-change-first/telegram(login)` set httpOnly refresh cookie (`cookie-first` web flow).
- `refresh/logout` prefer refresh token from cookie and fallback to body (for Telegram Mini App).
- Login rate-limit and lockout are enforced by both identity and IP counters.
- Account creation is hierarchical only: superadmin -> ministry -> inspector(РОНО) -> director -> teacher/student.
- `GET /api/v1/users/me` for teacher now includes `teacher_classes` for class-scoped UI actions.
- `GET /api/v1/schools/{school_id}/users` supports filters: `role`, `status`, `search`, `class_id`.
- `GET/POST /api/v1/users/me/login-methods*` expose and connect quick login options.
- `POST /api/v1/sessions/{session_id}/finish` returns `topic_breakdown` (per-topic totals/correct/score%).
- OpenAPI baseline contract is stored in `docs/07_api/openapi.yaml` and checked in CI against live `/api/v1/*` routes.
- In Postgres mode each DB transaction sets:
  - `app.current_school_id`
  - `app.current_user_id`
  - `app.current_role`
- Source of truth for requirements: `docs/*`
