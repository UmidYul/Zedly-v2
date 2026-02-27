# School Structure & Assignment Access Spec

**Файл:** `docs/05_backend/school_structure_and_access_spec.md`  
**Статус:** Production Blueprint

---

## 1. Управление внутри школы

Tenant создаёт только SuperAdmin. Внутри существующего tenant управление делает Director:
- создание учителей/учеников;
- создание классов;
- назначение классного руководителя;
- назначение предметов учителям;
- назначение учителя на конкретный класс+предмет.

---

## 2. Таблицы

### `academic_years`
- `id`, `school_id`, `name`, `starts_on`, `ends_on`, `is_active`.

### `classes`
- `id`, `school_id`, `academic_year_id`, `grade_level`, `letter`, `name`, `homeroom_teacher_id`.

### `subjects`
- `id`, `school_id`, `code`, `name`, `is_active`.

### `teacher_subjects`
- `id`, `school_id`, `teacher_id`, `subject_id`, `academic_year_id`.

### `teacher_class_assignments`
- `id`, `school_id`, `teacher_id`, `subject_id`, `class_id`, `academic_year_id`.

### `student_class_enrollments`
- `id`, `school_id`, `student_id`, `class_id`, `academic_year_id`, `enrollment_status`.

---

## 3. Ограничения

- Один ученик — один активный класс в рамках `academic_year`.
- Один класс — много предметов.
- Один предмет — несколько учителей (опционально).
- Все таблицы имеют `school_id` и защищены RLS.

---

## 4. RBAC

- Director: полный доступ внутри своей школы.
- Teacher: только assigned `subject_id + class_id`.
- Student: только собственный активный класс.

---

## 5. Middleware-checks

Для teacher endpoints:
1. Проверить `school_id` ресурса.
2. Проверить существование assignment в `teacher_class_assignments`.
3. Проверить соответствие `academic_year_id`.

```sql
SELECT 1
FROM teacher_class_assignments
WHERE school_id = :school_id
  AND teacher_id = :teacher_id
  AND class_id = :class_id
  AND subject_id = :subject_id
  AND academic_year_id = :academic_year_id;
```
