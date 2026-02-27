# Attendance — Посещаемость (QR + Manual + Partial Audit)

**Файл:** `docs/03_features/attendance.md`  
**Приоритет:** Phase 1  
**Статус:** Production Blueprint

---

## 1. Каналы фиксации

1. QR-отметка учеником.
2. Ручная отметка учителем.
3. Корректировка директором (с аудитом).

Статусы:
- `present`
- `late`
- `absent`
- `excused`

---

## 2. Data model

- `attendance_sessions`
- `attendance_records`
- `attendance_audit_log`
- `parent_notifications`
- `parent_notification_settings`

---

## 3. QR безопасность

- QR выдаётся на конкретный урок.
- В токене зашиты `session_id`, `class_id`, `subject_id`, `nonce`, `expires_at`.
- Сервер хранит hash токена (`qr_token_hash`), не raw token.
- Повторное сканирование одного ученика — idempotent ответ без дубля.
- Проверка принадлежности ученика к классу обязательна.

---

## 4. Manual flow

- Учитель отмечает весь класс или выборочно.
- Может менять статус (`late -> present`).
- Любое изменение пишет запись в `attendance_audit_log`.

---

## 5. Partial audit

Добавляется `requires_review` если:
- частые изменения `absent -> present`,
- аномально высокий % корректировок по одному учителю/классу.

Director видит отчёт по корректировкам.

---

## 6. Parent notifications

Триггер:
- при статусе `late` или `absent`.

Каналы:
- Telegram (primary),
- Push,
- Email (fallback).

Настройки:
- instant/daily digest,
- opt-out per channel.

---

## 7. Analytics

Считаем через snapshots, не в realtime:
- % посещаемости по ученику,
- % посещаемости по классу,
- % посещаемости по предмету,
- корреляция attendance ↔ performance.
