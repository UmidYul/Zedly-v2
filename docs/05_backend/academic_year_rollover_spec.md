# Academic Year Rollover Spec

**Файл:** `docs/05_backend/academic_year_rollover_spec.md`  
**Статус:** Production Blueprint

---

## 1. Цель

Автоматический перевод классов в конце учебного года:
- 10 -> 11,
- 11 -> выпуск,
- архивирование прошлогодних данных без потери истории.

---

## 2. Сущности

- `academic_years`
- `classes`
- `student_class_enrollments`
- архивные snapshot-таблицы аналитики

---

## 3. Процесс rollover

1. Создать новый `academic_year` (status=active, старый -> closing).
2. Для каждого активного класса:
   - если `grade_level < 11` создать новый класс следующей параллели;
   - если `grade_level = 11` пометить как graduated.
3. Закрыть активные `student_class_enrollments` старого года.
4. Создать новые enrollments для повышенных классов.
5. Перенести teacher assignments по policy (copy-forward с валидацией).
6. Зафиксировать audit-event `year_rollover_completed`.

---

## 4. Cron-задача

- Планировщик: ежегодно (настраиваемая дата).
- Обязательный dry-run за 7 дней с отчётом директору.
- Выполнение в транзакции по каждой школе (tenant-by-tenant), чтобы сбой одной школы не ломал остальные.

---

## 5. Защита от потерь данных

- No hard delete для historical записей.
- Идемпотентный `rollover_job_id`.
- Резервная копия и сверка row-count до/после.
