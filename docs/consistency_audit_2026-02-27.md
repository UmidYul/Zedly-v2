# Consistency Audit (2026-02-27)

> Статус: **Resolved in docs v1.1**. Первичные расхождения устранены в связанных спецификациях.

## Что исправлено

1. **RBAC terminology alignment**
   - Добавлен канонический словарь permission-key и алиасы в `docs/09_permissions/permissions_matrix.md`.
   - В role-документы добавлена пометка, что каноника берётся из permission matrix.
   - Для директора явно зафиксировано платное ограничение на школьную аналитику.

2. **User flow vs acceptance (Telegram onboarding)**
   - Onboarding учителя приведён к жизненному циклу `pending_approval -> active` до выдачи JWT.
   - Сценарий «школа не найдена» синхронизирован: инструкция + поддержка, без обходного demo-пути.

3. **Backend tables vs canonical entities**
   - В `docs/08_data_model/entities.md` добавлена таблица `report_jobs`.

4. **API endpoints coverage in acceptance**
   - В acceptance criteria добавлена матрица покрытия endpoint’ов и доп. сценарии AC-17..AC-21 для auth/users/marketplace/reports status-download.

5. **KPI vs metrics dictionary**
   - В `docs/10_analytics/metrics_definition.md` добавлен нормализованный реестр продуктовых KPI с metric-key и формулами.

## Следующий шаг

Для поддержки консистентности при будущих изменениях: любые новые permission-key, endpoint’ы и KPI сначала добавлять в канонические реестры (`permissions_matrix.md`, `core_scenarios.md`, `metrics_definition.md`), затем в feature/role документы.
