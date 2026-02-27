# Zedly Backend Wave 1

Docs-first backend core implementation for:
- Auth lifecycle (login/telegram/refresh/logout/logout-all/invite accept)
- RBAC permissions with canonical + alias mapping
- School isolation hardening (resource-level 404 + audit + IP blocking)
- Base APIs (`/users/me`, `/schools/{school_id}/users`, `/classes/{class_id}/invite`, `/tests`)
- RLS SQL baseline (`sql/001_rls_policies.sql`)
- Runtime switchable backends: `memory` or `postgres` for data, `memory` or `redis` for sessions/rate-limits

## Run

```bash
cd backend
python -m uvicorn app.main:app --reload
```

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
psql "$ZEDLY_DATABASE_URL" -f sql/000_bootstrap.sql
psql "$ZEDLY_DATABASE_URL" -f sql/001_rls_policies.sql
```

## Test

```bash
cd backend
python -m pytest -q
```

## Notes

- Access token TTL: 15m
- Refresh token TTL: 30d
- Refresh token rotation + family revoke on reuse is implemented.
- In Postgres mode each DB transaction sets:
  - `app.current_school_id`
  - `app.current_user_id`
  - `app.current_role`
- Source of truth for requirements: `docs/*`
