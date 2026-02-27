# User-Based Subscription Model

**Файл:** `docs/05_backend/user_subscription_model.md`  
**Статус:** Production Blueprint

---

## 1. Принципы

- Биллинг привязан к `user_id`, а не к `school_id`.
- `school_id` используется только для tenant-изоляции данных (RLS).
- RBAC отвечает за идентичность роли, subscription — за функциональные права.

---

## 2. Планы

### Student
- **Free Student**: тесты, базовый результат, ограниченная история и аналитика.
- **Student Premium**: расширенная аналитика, профориентация, AI-рекомендации, PDF-отчёты, полная история.

### Teacher
- **Free Teacher**: создание тестов с лимитами (tests/month, active students), базовая аналитика.
- **Teacher Pro**: безлимит тестов, расширенная аналитика, AI-генерация, продвинутые отчёты/фильтры.

---

## 3. Таблицы

### `plans`
- `id`, `role_type`, `name`, `price`, `billing_period`, `is_active`.

### `subscriptions`
- `id`, `user_id`, `plan_id`, `started_at`, `expires_at`, `status`.

### `feature_flags`
- `id`, `feature_code`, `description`.

### `plan_features`
- `plan_id`, `feature_id`, `limit_value`, `is_enabled`.

### `usage_counters`
- `user_id`, `feature_code`, `period_month`, `used_value`.

---

## 4. Middleware-порядок

1. `authenticate()`
2. `enforce_role()`
3. `resolve_active_subscription(user_id)`
4. `enforce_feature(feature_code)`
5. `enforce_limit(feature_code)`

Примеры:
- `AI_TEST_GENERATION` → только Teacher Pro.
- `CAREER_GUIDANCE` → только Student Premium.
- `EXTENDED_ANALYTICS` → Premium/Pro.

---

## 5. Edge Cases

- Смена школы: подписка остаётся за `user_id`.
- Истечение подписки: automatic downgrade на Free-план роли.
- Teacher Pro перешёл в другую школу: entitlements сохраняются.
- Parent в MVP не имеет подписки.

---

## 6. MVP-режим

До 500+ платящих пользователей допускается упрощение:
- `users.subscription_tier`
- `users.subscription_expires_at`
- feature-check через enum
- лимиты считаются в runtime
