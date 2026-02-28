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

# In Progress
- Подготовка следующего блока Sprint 1: миграционная дисциплина и CI-проверка применения SQL migration.

# Blocked
- Нет.

# Next 3 Tasks
- Добавить/проверить единый механизм применения SQL migration по шагам (`000`, `001`, ...).
- Добавить CI-check, который поднимает чистую БД и прогоняет все migrations последовательно.
- Начать перевод существующих integration/contract-тестов на `v1` пути как канонический API.

# API/DB Changes
- API: добавлен namespace `/api/v1` для всех текущих публичных backend-роутов.
- API: для `/api/v1/*` успешные JSON-ответы автоматически оборачиваются в `ok/data`.
- API: error payload унифицирован до `ok=false`.
- API: legacy пути помечаются заголовками deprecation с sunset-датой.
- DB: изменений в схеме на этом шаге нет.

# Test Results
- `python -m pytest backend/tests -q` -> `17 passed` (2026-02-28).
