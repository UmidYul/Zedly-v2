# План Разработки Zedly v2: Full-stack P0/P1 (2-недельные спринты)

## Краткое резюме
Цель: довести продукт до «базового максимума» по P0/P1 из `docs/14_acceptance_criteria/core_scenarios.md` с production-ориентированным стеком (`Postgres + Redis first`), реальной Telegram-интеграцией, единым web/Telegram Mini App shell и строгим контрактом `API v1`.

Порядок: сначала фиксируем фундамент (контракты, миграции, безопасность, файл статуса), затем закрываем вертикально Auth/Users/Isolation → Test Engine/Offline/NTT → Analytics/Reports → Telegram P1 → стабилизация и релиз.

---

## Scope и границы
In scope (текущий цикл):
1. Полный P0/P1 для backend + frontend.
2. API-совместимость через `versioned v1`: новый канонический `/api/v1/*` + временные адаптеры для текущих маршрутов.
3. Реальные Telegram login/bot/уведомления; биллинг (Payme/Click) через mock checkout-провайдер.
4. Лог прогресса в корне: `PROJECT_STATUS.md`.

Out of scope (после текущего цикла):
1. Marketplace API (AC-20, уже помечено как «Отложено»).
2. Реальные платежные провайдеры (оставляем адаптер и mock).
3. Нативные мобильные приложения (только web PWA + Telegram Mini App).

---

## Важные изменения API/интерфейсов/типов (обязательные)
1. Канонический префикс: все публичные endpoint’ы переводятся в `/api/v1/*`.
2. Унификация ответа `v1`: `{"ok": true, "data": ...}` и `{"ok": false, "error": {...}}`.
3. Стандартизация кодов ошибок под `docs/07_api/*` и `core_scenarios`.
4. Добавление недостающих P0/P1 endpoint’ов по матрице AC (auth/users/tests/analytics/reports).
5. WebSocket канал прогресса теста: `/ws/tests/{test_id}/progress`.
6. Слой compatibility: старые пути остаются на переходный период 2 спринта с deprecation-заголовками.

---

## План по спринтам (2 недели каждый)

### Спринт 1: Фундамент и управляемость
1. Создать `PROJECT_STATUS.md` и внедрить правило обновления файла при каждом завершённом блоке работ.
2. Запустить `frontend/` на `React + Vite + PWA` (единый shell для web и TMA).
3. Ввести `API v1` роутинг и единый response/error формат.
4. Зафиксировать миграционную дисциплину БД (последовательные SQL migration-файлы + CI-проверка применения).
5. Перенести текущие тесты на `v1` контракты (или добавить параллельные contract tests).

DoD спринта:
1. `PROJECT_STATUS.md` существует и заполнен стартовым шаблоном.
2. `/api/v1/health` и базовые v1-маршруты активны.
3. CI гоняет unit + integration + contract baseline.

---

### Спринт 2: Auth P1-hardening + Teacher onboarding
1. Довести `/auth/login|telegram|refresh|logout|logout-all` до спецификаций P1.
2. Реализовать refresh rotation/family revoke/reuse detection в production-виде (cookie-first для web).
3. Закрыть onboarding поток `/auth/telegram -> /users/register -> pending_approval -> activation`.
4. Добавить rate-limits (IP + identity), login lockouts, audit events, blacklist `jti`.
5. UI: экраны Login/Register/Forgot + onboarding teacher.

DoD спринта:
1. AC-17 проходит полностью.
2. E2E auth flow (web + telegram login) зеленый.
3. Нет регрессии cross-school security на auth-endpoints.

---

### Спринт 3: Users + School isolation + RBAC
1. Завершить `/users/me` (GET/PATCH), `/schools/{school_id}/users`, `/classes/{class_id}/invite`.
2. Реализовать role-aware выборку (teacher: свои классы; director: вся школа).
3. Усилить school isolation (middleware + RLS + audit + anti-enumeration + IP block).
4. Полная синхронизация permission checks с `docs/09_permissions/permissions_matrix.md`.
5. UI: профиль, список пользователей школы, генерация invite-кодов.

DoD спринта:
1. AC-18 и AC-19 покрыты автотестами.
2. Cross-school запросы ведут к ожидаемым кодам и логируются.
3. Директор может активировать `pending_approval` учителя через UI.

---

### Спринт 4: Test Engine Core (P0)
1. Закрыть `/tests`, `/tests/{id}`, `/tests/{id}/assign`, `/tests/{id}/sessions`, `/sessions/{id}/answers`, `/sessions/{id}/finish`.
2. Добавить строгие валидации публикации теста, дедлайнов, повторных сессий, assignment scope.
3. Реализовать результат с breakdown по темам и корректным `late_submission`.
4. UI: Teacher Test Builder + Student Test Screen + Result Screen + Class Results MVP.
5. Подключить event stream для `test_started/answer_submitted/session_finalized`.

DoD спринта:
1. AC-1, AC-2, AC-4 (изоляция), AC-5 (offline подготовка) по backend ядру закрыты.
2. UI-цепочка teacher create/assign -> student pass -> teacher see results работает end-to-end.

---

### Спринт 5: Offline + NTT simulator (P0)
1. `offline-bundle` + sync в полном offline-first сценарии (IndexedDB + Service Worker).
2. Конфликт-резолв sync (timestamp policy), idempotent sync, late flags.
3. NTT режим: 90 мин, запрет возврата назад, автозавершение как `completed`.
4. Worker hardening: надёжное завершение истекших сессий, повторяемость без дублей.
5. UI: offline banners, NTT launcher, NTT result and history MVP.

DoD спринта:
1. AC-3 и AC-5 закрыты полностью.
2. Отдельные E2E тесты на потерю сети и восстановление.
3. P95 submit/finish в рамках SLA для MVP.

---

### Спринт 6: Analytics + Reports (P1)
1. Расширить snapshot pipeline (class/school/district), weak topics, teacher/director/inspector dashboards.
2. Реализовать conversion trigger для директора (freemium + active_teachers_rate threshold).
3. Закрыть `/reports/generate`, `/reports/{id}/status`, `/reports/{id}/download` как async pipeline.
4. Генерация PDF/XLSX через очередь worker’ов; хранение в object storage; expiry policy.
5. UI: dashboards по ролям + report center.

DoD спринта:
1. AC-6, AC-9, AC-10, AC-21 закрыты.
2. Inspector видит только свой district.
3. Report jobs имеют корректный state machine и защищённый download.

---

### Спринт 7: Telegram P1 + Mini App shell
1. Реальный Telegram bot webhook, teacher/student onboarding через Telegram.
2. Реальные Telegram-уведомления (результаты, алерты, статус доставки, retry queue).
3. Адаптация frontend shell под Telegram Mini App контекст (без отдельного клиента).
4. Quiet-hours и anti-spam правила уведомлений.
5. UI-потоки TMA для P0/P1 сценариев.

DoD спринта:
1. Сценарии 7 и 8 из acceptance закрыты end-to-end.
2. Базовые тестовые сценарии Telegram Integration проходят стабильно.
3. Single codebase обслуживает web и TMA.

---

### Спринт 8: Stabilization + Release gate
1. Закрыть security checklist (IDOR/RLS/token abuse/rate-limit).
2. Нагрузочные тесты по SLA (пиковые окна, queue pressure, reports).
3. Regression pack по AC P0/P1 + contract freeze `v1`.
4. Observability: метрики, алерты, structured logging, incident runbook.
5. Подготовка controlled rollout и rollback-плана.

DoD спринта:
1. Полный P0/P1 test report.
2. Нет P0/P1 дефектов в release candidate.
3. Rollout-ready релизная ветка.

---

## Что улучшаем в уже реализованном коде (приоритетно)
1. Приводим текущие маршруты к контрактам `v1` (сейчас есть расхождения в форме ответов и полях).
2. Укрепляем безопасность cookie/token path (сейчас refresh часто передаётся в body).
3. Уплотняем RLS + middleware поведение в единый стандарт на всех эндпоинтах.
4. Расширяем аналитику с минимального набора до role-specific dashboard payloads.
5. Переводим reports из «упрощённой state-machine» в полноценный async job pipeline.
6. Расширяем тестовое покрытие с текущих 13 тестов до полного AC-пакета P0/P1.

---

## Тестовые сценарии и критерии приёмки
1. Contract tests: 100% покрытие endpoint-матрицы AC P0/P1.
2. Integration tests: auth lifecycle, school isolation, test lifecycle, offline sync, analytics snapshots, reports pipeline.
3. E2E tests (Playwright): teacher flow, student flow, director flow, inspector flow, telegram onboarding flow.
4. Security tests: IDOR, token reuse, brute-force/rate-limit, cross-school enumeration.
5. Performance tests (k6): dashboard/read path, answers submit, report generation queue.
6. Release gate: AC 1–10 + AC 17–19 + AC 21 must-pass.

---

## Файл статуса для следующего ИИ-чата
Файл: `PROJECT_STATUS.md` (корень репозитория).

Шаблон разделов:
1. `Current Sprint`
2. `Completed`
3. `In Progress`
4. `Blocked`
5. `Next 3 Tasks`
6. `API/DB Changes`
7. `Test Results`

Правило ведения:
1. Обновление после каждого завершённого крупного блока.
2. Записи короткие, фактологичные, без планов «на потом» в разделе `Completed`.
3. В `Blocked` всегда указывать причину и владельца решения.

---

## Явные допущения и выбранные defaults
1. Scope: `Full-stack P0/P1`.
2. Sprint cadence: `2 недели`.
3. Runtime target: `Postgres + Redis first`; in-memory только для быстрых unit-тестов.
4. API strategy: `Versioned v1` + временная обратная совместимость.
5. Integrations: `Real Telegram + mock billing`.
6. Frontend: `React + Vite PWA`, `single app shell` для web и Telegram Mini App.
7. Marketplace остаётся вне текущего цикла (как отложено в acceptance).
8. Каноника при конфликте документов: `docs/05_backend/* + docs/14_acceptance_criteria/*`; затем синхронизация остальных docs под канон.
