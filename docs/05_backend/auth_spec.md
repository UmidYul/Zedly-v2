# docs/05_backend/auth_spec.md

> **Проект:** Zedly  
> **Модуль:** Authentication & Authorization  
> **Статус:** Актуальная спецификация (после перехода на иерархическое создание аккаунтов)

---

## 1. Ключевые принципы

- Самостоятельная регистрация пользователей отключена.
- Аккаунты создаются только иерархически через `POST /api/v1/users/provision`.
- Первый вход выполняется по `login + OTP` и всегда требует смены одноразового пароля.
- Быстрый вход через Google/Telegram подключается в профиле пользователя.

---

## 2. Актуальные auth endpoints

- `POST /api/v1/auth/login`
- `POST /api/v1/auth/password/change-first`
- `POST /api/v1/auth/telegram`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`
- `POST /api/v1/auth/logout-all`
- `POST /api/v1/auth/password/forgot`

Актуальные users/auth first-access endpoints:
- `POST /api/v1/users/provision`
- `GET /api/v1/users/me/login-methods`
- `POST /api/v1/users/me/login-methods/google/connect`
- `POST /api/v1/users/me/login-methods/telegram/connect`

---

## 3. Первый вход (обязательный flow)

1. Пользователь вводит `login + OTP` на `zedly.uz`.
2. `POST /auth/login` возвращает `status=password_change_required` и `challenge_token`.
3. Пользователь задаёт новый пароль (`>=8` символов + `>=1` цифра).
4. `POST /auth/password/change-first`:
   - сохраняет постоянный пароль,
   - снимает флаг временного пароля,
   - выдаёт access/refresh token,
   - возвращает `status=login_methods_prompt`.
5. Пользователь подключает Google/Telegram или пропускает шаг.

---

## 4. Telegram вход

- Пользователь не вводит технические идентификаторы вручную.
- Telegram вход доступен только после подключения в разделе `Способы входа`.
- Если Telegram не подключён, система возвращает `status=telegram_not_connected`.

---

## 5. Токены и сессии

- Access token TTL: 15 минут.
- Refresh token TTL: 30 дней.
- Refresh rotation: включена.
- Повторное использование refresh token: revoke всей family.
- `logout-all` инвалидирует все refresh-токены пользователя и текущую access-сессию.

---

## 6. Контракт и проверка

Источник API-контракта:
- `docs/07_api/openapi.yaml`

Проверка соответствия live routes и OpenAPI:
- `python backend/scripts/verify_openapi_contract.py`
