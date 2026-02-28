# Implementation Readiness Review (2026-02-28)

## Цель
Проверить, что уже реализовано **на уровне промптов/спецификаций в `/docs`**, и оценить, как усилить реализацию для практической разработки и масштабирования.

## Метод
- Проверен состав документов в `docs/*` по слоям: vision, роли, features, backend, API, data model, security, analytics, acceptance, roadmap.
- Для каждого слоя оценена зрелость артефакта:
  - `Done` — слой описан и пригоден как вход в разработку.
  - `Partial` — описание есть, но не хватает формальных контрактов/трассировки для исполнения.
  - `Missing` — слой не покрыт в виде исполнимого артефакта.

## Что уже реализовано в `/docs`

| Слой | Статус | Что уже есть | Комментарий |
|---|---|---|---|
| Product vision и positioning | Done | `docs/01_vision/*` | Достаточно для Problem Framing и alignment.
| Роли и права доступа | Done | `docs/02_roles/*`, `docs/09_permissions/permissions_matrix.md` | После аудита 2026-02-27 терминология выровнена.
| Feature-level требования | Done | `docs/03_features/*` | Широкое покрытие фич (журнал, тесты, аналитика, Telegram и др.).
| User flows | Partial | `docs/04_user_flows/*` | Есть ключевые флоу, но не для всех feature-сценариев.
| Backend domain/spec | Partial | `docs/05_backend/*` | Хороший уровень концептов, но не хватает ADR и event contracts.
| Frontend spec | Partial | `docs/06_frontend/*` | Есть карта экранов и компоненты, нет state-contract и UX acceptance по экранам.
| API contracts | Partial | `docs/07_api/*` | Endpoint-уровень есть, но отсутствует формальный OpenAPI как single source of truth.
| Data model | Partial | `docs/08_data_model/entities.md` | Базовый словарь сущностей есть, но нужны DDL-миграции и versioning policy.
| Security | Partial | `docs/11_security/security_policy.md` | Политики есть, но нет threat model + control matrix по сервисам.
| NFR/SLA/scaling | Partial | `docs/12_non_functional/*`, `docs/13_scaling/*` | Есть требования, но нет SLO runbook + error budget-процесса.
| Acceptance criteria | Done | `docs/14_acceptance_criteria/core_scenarios.md` | Ядро приемки описано, покрытие улучшено предыдущим аудитом.
| Roadmap | Done | `docs/15_roadmap/product_roadmap.md` | Хорошая процессная рамка по стадиям.
| Government analytics | Partial | `docs/16_government/*` | Доменные требования есть, но нет data-sharing контракта и governance workflow.

## Главный вывод
Документация зрелая как **продуктово-архитектурный foundation**, но пока остаётся в формате «prompt/spec layer». Для реальной реализации не хватает перехода к **исполняемым контрактам**, **трассировке требований до задач**, и **операционных артефактов эксплуатации**.

## Где можно улучшить (приоритетно)

### P0 — перевести спецификации в исполняемые контракты
1. Ввести `openapi.yaml` для всех API из `docs/07_api/*`.
2. Ввести JSON Schema/Proto для ключевых событий (analytics, reports, notifications).
3. Для `docs/08_data_model/entities.md` добавить миграционный baseline (`/migrations`) и правила совместимости схем.

### P1 — построить сквозную трассировку
1. Добавить единый `traceability_matrix.md`:
   - `Feature -> User flow -> API endpoint -> Entity -> AC -> KPI`.
2. Пронумеровать requirement IDs (например `REQ-AUTH-001`, `REQ-TEST-014`) во всех ключевых документах.
3. Для каждого acceptance-сценария указать минимальный тестовый набор (unit/integration/e2e).

### P1 — усилить эксплуатационную готовность
1. Добавить `runbooks/` для инцидентов: auth degradation, report queue lag, analytics latency.
2. Зафиксировать SLI/SLO + error budget policy как обязательный релизный gate.
3. Добавить release checklist с проверками безопасности и rollback.

### P2 — расширение функционала на будущее
1. **Feature flags framework**: soft-launch новых модулей (например career guidance/marketplace).
2. **Multitenancy hardening**: tenant-aware audit logs и policy-as-code проверки изоляции школ.
3. **AI governance**: для AI-generated тестов добавить explainability metadata + quality feedback loop.
4. **Data products для министерства**: версионированные витрины, SLA на обновление, lineage.

## Рекомендуемый план развития (90 дней)

### Этап 1 (недели 1–3): Contract-first foundation
- Подготовить OpenAPI v1 и согласовать breaking-change policy.
- Утвердить схему событий и версионирование.
- Выпустить первую трассировочную матрицу по 3 критичным фичам: Auth, Test Engine, Analytics.

### Этап 2 (недели 4–8): Delivery hardening
- Привязать AC к тест-пакету и CI-gates.
- Ввести runbooks и SLO-dashboard.
- Добавить security control matrix (по сервисам и ролям).

### Этап 3 (недели 9–12): Scale-ready extension
- Включить feature flags для новых модулей.
- Подготовить government data-sharing contracts.
- Провести architecture review по multitenancy + analytics pipeline.

## Быстрые улучшения уже сейчас (low effort / high impact)
1. Создать `docs/traceability_matrix.md` хотя бы для top-20 endpoint’ов.
2. Добавить `docs/07_api/openapi_todo.md` с поэтапной миграцией endpoint-описаний в OpenAPI.
3. Добавить в `docs/14_acceptance_criteria/core_scenarios.md` поле `test-level` (`unit/integration/e2e`).
4. Ввести единый changelog для спецификаций (`docs/spec_changelog.md`).

## KPI зрелости документации (предлагаемые)
- `% endpoint’ов, покрытых OpenAPI`.
- `% AC, имеющих прямую связь с автотестами`.
- `% сущностей с утверждённой миграционной стратегией`.
- `MTTR по инцидентам из runbook-категорий`.
- `% продуктовых KPI из feature docs, нормализованных в metrics_definition`.
