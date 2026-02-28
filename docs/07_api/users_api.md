# Users API (v1)

Статус: актуально на 2026-02-28.  
Источник истины для контрактов: `docs/07_api/openapi.yaml`.

## Базовые правила

- Публичной регистрации нет.
- Создание аккаунтов выполняется только через `POST /users/provision`.
- Иерархия создания:
  - `superadmin -> ministry`
  - `ministry -> inspector (РОНО)`
  - `inspector -> director`
  - `director -> teacher/student/psychologist/parent`

## Эндпоинты

### 1) `POST /api/v1/users/provision`

Иерархическое создание аккаунта с генерацией:

- `login` (авто)
- `otp_password` (авто, одноразовый)

Ответ включает `user_id`, `role`, `login`, `otp_password`, `school_id/district_id/class_id`.

### 2) `GET /api/v1/users/me`

Профиль текущего пользователя.

### 3) `PATCH /api/v1/users/me`

Редактирование профиля (только разрешённые поля).

### 4) `GET /api/v1/users/me/login-methods`

Состояние быстрых способов входа:

- `google_connected`
- `telegram_connected`

### 5) `POST /api/v1/users/me/login-methods/google/connect`

Подключить Google быстрый вход.

### 6) `POST /api/v1/users/me/login-methods/telegram/connect`

Подключить Telegram быстрый вход.

Пользователь не вводит технические данные вручную.

### 7) `GET /api/v1/schools/{school_id}/users`

Список пользователей школы (с фильтрами).

### 8) `PATCH /api/v1/schools/{school_id}/users/{user_id}`

Обновление статуса пользователя школы (RBAC + school-scope).

### 9) `POST /api/v1/classes/{class_id}/invite`

Генерация class invite code для классного распределения.

## Что удалено

- Публичный self-signup учителей и учеников.
- Любые сценарии самостоятельной регистрации внутри продукта.
