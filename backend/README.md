# Zedly Backend (Wave 1 + P0 Test Engine + Telegram Onboarding)

Docs-first backend core implementation for:
- Auth lifecycle (login/telegram/refresh/logout/logout-all/invite accept)
- Teacher registration with Telegram onboarding token flow (`/auth/telegram` -> `/users/register`)
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

## Configuration

Default mode (for local tests) is fully in-memory:

```bash
ZEDLY_STORAGE_BACKEND=memory
ZEDLY_SESSIONS_BACKEND=memory
```

PostgreSQL + Redis mode:

```bash
ZEDLY_STORAGE_BACKEND=postgres
ZEDLY_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/zedly
ZEDLY_SESSIONS_BACKEND=redis
ZEDLY_REDIS_URL=redis://localhost:6379/0
```

Bootstrap SQL:

```bash
python scripts/run_sql_migrations.py
```

## Test

```bash
cd backend
python -m pytest -q
```

## Notes

- Access token TTL: 15m
- Refresh token TTL: 30d
- Telegram onboarding token TTL: 30m (one-time use)
- Invite TTL: 72h
- Refresh token rotation + family revoke on reuse is implemented.
- Freemium teacher limit (30 students) is enforced on `POST /auth/invite/accept`.
- In Postgres mode each DB transaction sets:
  - `app.current_school_id`
  - `app.current_user_id`
  - `app.current_role`
- Source of truth for requirements: `docs/*`
