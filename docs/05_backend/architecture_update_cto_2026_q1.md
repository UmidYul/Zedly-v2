# docs/05_backend/architecture_update_cto_2026_q1.md

---
title: Zedly — CTO Architecture Update (Roles, Data Model, Subscription, New Modules)
version: 2.0
date: 2026-02-27
status: Approved Architecture Blueprint
scope: Масштабирование до 1000 школ без ломки multi-tenant модели
---

## 1. Архитектурные изменения

### 1.1 Целевой принцип (не ломаем текущую multi-tenant модель)
- Изоляция данных остаётся на `school_id + RLS` для всех school-scoped сущностей.
- Биллинг выносится на уровень `user_id` (Student/Teacher), **без участия `school_id`**.
- Доступ к функциям разделяется на 2 контура:
  - **RBAC**: «кто ты» (role: student/teacher/director/psychologist/parent/inspector/ministry/superadmin).
  - **Subscription/Features**: «что тебе можно» (feature flags, лимиты, квоты).
- Аналитика остаётся snapshot-based (batch/near-real-time), без тяжёлых online-агрегаций по сырым ответам.

### 1.2 Модульная декомпозиция (Modular Monolith)
Добавляются bounded contexts:
1. **Identity & RBAC** (расширение): Psychologist, SuperAdmin, scoped permissions.
2. **School Structure** (новый): classes/subjects/assignments/academic_year.
3. **Career Guidance** (новый): профориентационные тесты, профиль, рекомендации, PDF.
4. **Subscription & Entitlements** (новый): user-based планы, фичи, лимиты.
5. **Journal** (новый): оценки, посещаемость, комментарии, четверти.
6. **Attendance** (новый): QR/manual marking, audit, parent notifications.
7. **Schedule** (новый): уроки, связка teacher-subject-class, интеграция с attendance/journal.
8. **Global Admin** (новый): SuperAdmin панель, cross-school ops без обхода RLS.

### 1.3 Сервисные слои доступа (обязательные middleware)
Порядок проверки каждого защищённого endpoint:
1. `authenticate()` — валидный JWT/session.
2. `enforce_school_scope()` — если endpoint school-scoped, сверка `jwt.school_id` и ресурса.
3. `enforce_role(permission)` — RBAC.
4. `enforce_feature(feature_code)` — подписка + feature flags + лимиты.
5. `enforce_assignment_scope()` — teacher/psychologist access по назначению (class/subject/test).
6. `audit_trail()` — лог действия (особенно корректировки оценок и посещаемости).

---

## 2. Изменения в модели данных (таблицы)

## 2.1 Обновления существующих сущностей

### `users`
- Расширить `role`:
  - добавить `psychologist`, `superadmin`.
- Ограничения:
  - `psychologist` обязательно имеет `school_id`.
  - `superadmin` всегда `school_id IS NULL`.
- Для MVP подписок допустимы поля:
  - `subscription_tier` (`free`/`premium`/`pro`),
  - `subscription_expires_at`.

### `tests`
- Добавить `test_type`:
  - `academic`, `psychological`, `career_guidance`, `ntt_simulation`.
- Добавить `visibility_scope`:
  - `class`, `school`, `private`.
- Для `psychological` и `career_guidance` запрещаем привязку к академическим журналам.

### `schools`
- Добавить `status`:
  - `active`, `blocked` (для операций SuperAdmin).
- Биллинг-поля школы считаются legacy и выводятся из core billing flow.

## 2.2 Новые таблицы — School Structure

### `academic_years`
- `id`, `school_id`, `name` (`2026/2027`), `starts_on`, `ends_on`, `is_active`, `is_closed`.

### `classes`
- `id`, `school_id`, `academic_year_id`, `grade_level` (1..11), `letter` (A/Б...), `name` (11A), `homeroom_teacher_id`, `status`.
- Уникальность: `(school_id, academic_year_id, grade_level, letter)`.

### `subjects`
- `id`, `school_id`, `code`, `name`, `is_core`, `is_active`.
- Уникальность: `(school_id, code)`.

### `teacher_subjects`
- `id`, `school_id`, `teacher_id`, `subject_id`, `academic_year_id`, `is_primary`.
- Уникальность: `(school_id, teacher_id, subject_id, academic_year_id)`.

### `teacher_class_assignments`
- `id`, `school_id`, `teacher_id`, `subject_id`, `class_id`, `academic_year_id`, `hours_per_week`.
- Уникальность: `(school_id, teacher_id, subject_id, class_id, academic_year_id)`.

### `student_class_enrollments`
- `id`, `school_id`, `student_id`, `class_id`, `academic_year_id`, `enrollment_status`, `started_at`, `ended_at`.
- Ограничение: один студент = один активный класс в учебном году (partial unique index по `enrollment_status='active'`).

## 2.3 Новые таблицы — Career Guidance

### `career_profiles`
- `id`, `school_id`, `student_id`, `academic_year_id`, `profile_code`, `profile_name`, `confidence_score`, `generated_by` (`rules`/`ai`/`hybrid`), `created_at`.

### `career_recommendations`
- `id`, `school_id`, `career_profile_id`, `recommendation_type` (`subject`/`track`/`next_step`), `payload_json`, `source` (`rules_engine`/`llm`), `created_at`.

### `career_reports`
- `id`, `school_id`, `student_id`, `career_profile_id`, `pdf_url`, `version`, `generated_at`.

## 2.4 Новые таблицы — User-based Subscription

### `plans`
- `id`, `role_type` (`student`/`teacher`), `name`, `price`, `billing_period`, `is_active`.

### `subscriptions`
- `id`, `user_id`, `plan_id`, `started_at`, `expires_at`, `status` (`active`/`expired`/`canceled`).

### `feature_flags`
- `id`, `feature_code`, `description`, `is_metered`.

### `plan_features`
- `plan_id`, `feature_id`, `limit_value`, `is_enabled`.

### `usage_counters`
- `id`, `user_id`, `feature_code`, `period_month`, `used_value`, `updated_at`.
- Уникальность: `(user_id, feature_code, period_month)`.

## 2.5 Новые таблицы — Journal

### `grading_rules`
- `id`, `school_id`, `rule_name`, `min_percent`, `max_percent`, `grade_5`, `is_default`.
- По умолчанию единая 5-балльная шкала.

### `journal_terms`
- `id`, `school_id`, `academic_year_id`, `name` (`Q1..Q4`), `starts_on`, `ends_on`.

### `journal_entries`
- `id`, `school_id`, `student_id`, `class_id`, `subject_id`, `teacher_id`, `term_id`, `entry_type` (`lesson_grade`/`exam_grade`/`comment`), `raw_score_percent`, `grade_5`, `comment`, `source` (`manual`/`test_auto`), `created_at`.

## 2.6 Новые таблицы — Attendance (QR + Manual + Partial Audit)

### `attendance_sessions`
- `id`, `school_id`, `class_id`, `subject_id`, `teacher_id`, `schedule_id`, `lesson_date`, `starts_at`, `qr_token_hash`, `qr_expires_at`, `is_canceled`, `created_at`.

### `attendance_records`
- `id`, `school_id`, `session_id`, `student_id`, `status` (`present`/`late`/`absent`/`excused`), `marked_by_type` (`teacher`/`system`/`director`), `marked_by_user_id`, `marked_at`, `requires_review`.
- Уникальность: `(session_id, student_id)`.

### `attendance_audit_log`
- `id`, `school_id`, `attendance_record_id`, `changed_by`, `old_status`, `new_status`, `changed_at`, `reason`.

### `parent_notifications`
- `id`, `school_id`, `student_id`, `type` (`late`/`absent`), `attendance_record_id`, `channel` (`telegram`/`push`/`email`), `sent_at`, `delivery_status`, `provider_response`.

### `parent_notification_settings`
- `id`, `school_id`, `parent_id`, `channel`, `is_enabled`, `digest_mode` (`instant`/`daily_digest`).

## 2.7 Новые таблицы — Schedule

### `schedules`
- `id`, `school_id`, `academic_year_id`, `class_id`, `subject_id`, `teacher_id`, `weekday`, `lesson_number`, `starts_at`, `ends_at`, `room`, `is_active`.
- Уникальности:
  - `(school_id, class_id, weekday, lesson_number, academic_year_id)`
  - `(school_id, teacher_id, weekday, lesson_number, academic_year_id)`

## 2.8 Новые таблицы — Analytics Aggregates

### `analytics_attendance_snapshots`
- `id`, `school_id`, `snapshot_date`, `student_id`, `class_id`, `subject_id`, `attendance_pct`, `late_count`, `absent_count`.

### `analytics_performance_snapshots`
- добавить поля: `region`, `grade_level`, `subject_id`, `avg_grade_5`, `avg_score_percent`.

### `analytics_career_snapshots`
- `id`, `school_id`, `snapshot_date`, `grade_level`, `track_code`, `students_count`.

---

## 3. Изменения в RBAC

## 3.1 Новые роли

### Psychologist
- Может:
  - создавать `psychological` и `career_guidance` тесты;
  - просматривать результаты психологических/профориентационных тестов по своей школе;
  - генерировать/просматривать карьерные отчёты.
- Не может:
  - видеть академические оценки, журнал и exam-grade аналитику;
  - управлять school structure.
- Scope: только `school_id` своей школы.

### SuperAdmin
- Глобальный scope (`school_id = NULL`), только через отдельный admin-контур.
- Может:
  - создавать/блокировать школы,
  - управлять планами и подписками,
  - смотреть глобальные агрегаты без PII,
  - форсировать downgrade/upgrade plan mappings.
- Не должен читать школьные PII-таблицы напрямую.

## 3.2 Обновления текущих ролей
- **Director**: полный доступ внутри `school_id`; управляет users/classes/subjects/assignments/attendance overrides.
- **Teacher**: видит только назначенные `subject_id + class_id` в рамках `teacher_class_assignments`.
- **Student**: видит только свой класс, свои тесты/оценки/посещаемость.
- **Parent**: видит только связанного ребёнка, включая attendance и career report (если доступно по плану ребёнка).

## 3.3 Permissions
Добавить permission-коды:
- `create_psychological_test`
- `view_psychological_results`
- `view_career_guidance_report`
- `manage_school_users`
- `manage_school_structure`
- `mark_attendance`
- `override_attendance`
- `view_attendance_audit`
- `manage_subscriptions_global`

И feature-коды:
- `AI_TEST_GENERATION`
- `CAREER_GUIDANCE`
- `EXTENDED_ANALYTICS`
- `PDF_REPORTS`
- `UNLIMITED_TESTS`

---

## 4. Новые модули

## 4.1 Career Guidance
**Решение:** отдельный модуль, но поверх Test Engine.
- Почему: reuse движка вопросов/сессий/оценки + отдельная доменная логика профилей.
- Pipeline:
  1. Student проходит `career_guidance` тест.
  2. Rules engine вычисляет baseline профиль.
  3. AI enrichment дополняет рекомендации (subject/track/next-steps).
  4. Генерация PDF и сохранение в `career_reports`.

## 4.2 Journal
**Решение:** отдельный модуль domain-gradebook (не часть Test Core).
- Причина: оценки и посещаемость имеют отдельный жизненный цикл и compliance.
- Интеграция:
  - `source=test_auto`: оценка импортирована из test result;
  - `source=manual`: ручная оценка учителя.

## 4.3 Attendance
**Решение:** отдельный модуль, тесно связан с Schedule и Journal.
- Manual + QR + Offline sync.
- Audit-first подход: любое изменение статуса логируется.

## 4.4 Schedule
**Решение:** отдельный модуль расписания с выдачей «урок-слота» как источника истины для attendance_sessions.

## 4.5 SuperAdmin Console
- Отдельная admin-панель (другой frontend entrypoint + отдельный backend namespace `/admin/*`).
- Только aggregated read для школьных данных, детальные PII по школам запрещены по умолчанию.

---

## 5. Изменения в аналитике

## 5.1 Новые измерения фильтрации
- По региону: берём из `schools.region`, денормализуем в snapshot таблицы.
- По параллели: `classes.grade_level` (например, все 10-е классы).
- По предмету: `subject_id` в snapshots.

## 5.2 Новые витрины
1. Attendance KPI:
   - `% attendance` по student/class/subject.
2. Корреляция посещаемости и успеваемости:
   - join `analytics_attendance_snapshots` + `analytics_performance_snapshots` на student/time bucket.
3. Career distribution:
   - распределение профилей по школе/региону/параллели.
4. Psychologist dashboard:
   - только psych/career метрики, без academic grades.

## 5.3 Performance стратегия
- OLTP (PostgreSQL): только запись транзакций + чтение operational screens.
- Агрегаты:
  - до ~300 школ: Postgres materialized snapshots.
  - 300–1000 школ: вынести heavy analytics в ClickHouse ingestion по cron/CDC.
- Индексы:
  - композитные `(school_id, academic_year_id, class_id, subject_id)`;
  - партиционирование snapshot-таблиц по `snapshot_date` (month).

---

## 6. Потенциальные риски

1. **Смешение RBAC и подписки**
   - Риск: feature gates проверяются не везде.
   - Мера: единый `entitlement middleware` + contract tests.

2. **PII утечка через SuperAdmin**
   - Риск: глобальные запросы в пользовательские таблицы.
   - Мера: отдельные `admin_*` views без персональных данных.

3. **RLS обход в batch jobs**
   - Риск: ETL сервис-аккаунт читает лишнее.
   - Мера: dedicated DB role + security definer functions с whitelisting.

4. **QR replay/fraud**
   - Риск: пересылка скриншота QR.
   - Мера: токен на урок+окно времени+одноразовая фиксация per student.

5. **Рост write-нагрузки attendance/journal**
   - Мера: батчевые upsert-операции, background notifications, snapshot-подсчёты.

---

## 7. Что можно реализовать быстро (MVP)

1. Добавить роли `psychologist` и `superadmin` + базовые permissions.
2. Добавить `test_type` (`psychological`, `career_guidance`).
3. Ввести упрощённую user-subscription:
   - поля в `users`: `subscription_tier`, `subscription_expires_at`.
4. Feature checks через enum + runtime limit counters без сложного billing engine.
5. Journal MVP:
   - только `journal_entries` + 5-балльная оценка.
6. Attendance MVP:
   - manual marking + audit log + parent notifications (telegram first).
7. Schedule MVP:
   - базовое weekly расписание, без сложных замен.
8. Year rollover MVP:
   - cron + dry-run report + transaction-safe promote/archive.

---

## 8. Что отложить

1. Полноценный payment/billing orchestration и invoicing.
2. Сложная AI-персонализация (оставить hybrid rules + bounded AI prompts).
3. Real-time attendance analytics (оставить snapshot-подход).
4. Полный cross-school benchmarking на PII-уровне.
5. Автоматические расписания с оптимизацией (solver).

---

## 9. Поток QR-проверки (step-by-step)

1. Teacher открывает урок из `schedules`.
2. Backend создаёт `attendance_session`:
   - генерирует payload `{session_id, class_id, subject_id, ts, nonce}`,
   - подписывает HMAC/JWT,
   - хранит только `qr_token_hash`, `qr_expires_at`.
3. На экране учителя показывается QR (валидность 10–15 минут).
4. Student сканирует QR в мобильном интерфейсе.
5. API `POST /attendance/scan` выполняет проверки:
   - токен валиден и не истёк,
   - session активна и не отменена,
   - `student.school_id == session.school_id`,
   - студент активен в `student_class_enrollments` для `session.class_id`,
   - запись `(session_id, student_id)` ещё не существует.
6. При успехе создаётся/апдейтится `attendance_record` со статусом `present` и `marked_by_type=system`.
7. При повторном скане:
   - возвращаем idempotent `200 already_marked` (без дубля).
8. Teacher может вручную менять статусы (например `late`/`absent`).
9. Любое изменение статуса пишет `attendance_audit_log`; при suspicious pattern ставится `requires_review=true`.
10. Триггер уведомлений:
   - если итоговый статус `late` или `absent`, создаётся `parent_notifications` и отправка в канал по приоритету Telegram → Push → Email.
11. Для offline-кейса teacher app сохраняет локальные события, сервер принимает batched sync с дедупликацией по `client_event_id`.

---

## Дополнительные инварианты (обязательные)
- Tenant (school) создаётся только SuperAdmin.
- Director не создаёт school, только управляет внутренней структурой.
- Подписка всегда привязана к `user_id`, сохраняется при смене школы.
- При истечении подписки автоматический downgrade до Free по role-type.
- 5-балльная система обязательна:
  - хранить `raw_score_percent` + `grade_5` для обратной совместимости и аналитики.
- Для старых тестов без `grade_5` — backfill через `grading_rules` (migration script).

