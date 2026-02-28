# Auth API (v1)

Статус: актуально на 2026-02-28.  
Источник истины для контрактов: `docs/07_api/openapi.yaml`.

## Принципы

- Самостоятельной регистрации нет.
- Аккаунты создаются через иерархический `POST /users/provision`.
- Первый вход выполняется по `login + OTP`, после чего пароль обязательно меняется.
- Быстрый вход через Google/Telegram подключается после первого входа или в профиле.

## Эндпоинты

### 1) `POST /api/v1/auth/login`

Вход по `login` и `password`.

- Если пароль постоянный: возвращает access/refresh token.
- Если это OTP первого входа: возвращает `status=password_change_required` и `challenge_token`.

### 2) `POST /api/v1/auth/password/change-first`

Обязательная смена OTP-пароля на постоянный.

- Принимает `challenge_token`, `new_password`, `repeat_password`.
- Требования к паролю: минимум 8 символов и минимум 1 цифра.
- Возвращает токены и `status=login_methods_prompt` с ссылками для подключения Google/Telegram.

### 3) `POST /api/v1/auth/telegram`

Вход через Telegram после подключения способа входа в профиле.

- Если Telegram ещё не подключён, возвращает `status=telegram_not_connected`.
- Если подключён, возвращает access/refresh token.

### 4) `POST /api/v1/auth/refresh`

Обновление access token (refresh rotation включен).

### 5) `POST /api/v1/auth/logout`

Выход из текущей сессии.

### 6) `POST /api/v1/auth/logout-all`

Выход из всех сессий пользователя.

### 7) `POST /api/v1/auth/password/forgot`

Запрос на восстановление пароля.

## Что удалено из публичного auth-flow

- Любые invite/self-signup/onboarding-token registration сценарии.
