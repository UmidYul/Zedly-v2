# Current Sprint
Sprint 1: Фундамент и управляемость

# Completed
- Прочитан и зафиксирован roadmap из `PLAN2.md`.
- Включён канонический API-префикс `/api/v1/*` для текущих публичных роутов через dual-routing.
- Добавлен `v1` response-contract для успешных JSON-ответов: `{"ok": true, "data": ...}`.
- Формат ошибок приведён к `{"ok": false, "error": {...}}` с сохранением совместимого поля `error`.
- Добавлены deprecation-заголовки для legacy-роутов (`Deprecation`, `Sunset`, `Link`).
- Добавлен `v1` health endpoint: `/api/v1/health`.
- Добавлены baseline contract tests для `v1` и проверка deprecation-заголовков legacy.
- Прогнан backend test-suite: `17 passed`.
- Усилен SQL migrator (`backend/scripts/run_sql_migrations.py`): строгий формат `NNN_description.sql`, непрерывная последовательность, таблица `schema_migrations`, checksum immutability, режим `--check`.
- Добавлен CI gate `.github/workflows/backend-migrations.yml` для последовательного применения миграций на чистой PostgreSQL и последующей проверки `--check`.
- Добавлена policy-документация по миграциям: `docs/08_data_model/migration_compatibility_policy.md`.
- Добавлены low-effort/high-impact артефакты из readiness review:
  - `docs/traceability_matrix.md`
  - `docs/07_api/openapi_todo.md`
  - `docs/spec_changelog.md`

# In Progress
- Подготовка следующего блока Sprint 1: перевод существующих integration/contract тестов на канонические `/api/v1` пути.

# Blocked
- Нет.

# Next 3 Tasks
- Перевести текущие backend-тесты на `/api/v1/*` как канонический API, legacy оставить только как compatibility checks.
- Начать черновой `docs/07_api/openapi.yaml` и заполнить Auth + Users как первый пакет.
- Добавить минимальный CI gate на сверку маршрутов `/api/v1/*` с OpenAPI (после появления `openapi.yaml`).

# API/DB Changes
- API: добавлен namespace `/api/v1` для всех текущих публичных backend-роутов.
- API: для `/api/v1/*` успешные JSON-ответы автоматически оборачиваются в `ok/data`.
- API: error payload унифицирован до `ok=false`.
- API: legacy пути помечаются заголовками deprecation с sunset-датой.
- DB toolchain: введён контроль цепочки SQL миграций и неизменяемости применённых файлов через `schema_migrations`.

# Test Results
- `python -m pytest backend/tests -q` -> `17 passed` (2026-02-28).
- `python backend/scripts/run_sql_migrations.py --help` локально не выполнен: отсутствует модуль `psycopg` в текущем Python окружении.
