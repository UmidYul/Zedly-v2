from __future__ import annotations

import uuid
from abc import ABC, abstractmethod
from contextlib import contextmanager
import json

from app.core.settings import settings
from app.core.types import Role, UserStatus
from app.db.request_context import RequestRlsContext, get_request_rls_context
from app.db.rls_context import RlsContext, build_rls_set_local_statements
from app.repositories.exceptions import BackendUnavailableError
from app.repositories.memory_store import store
from app.repositories.models import AuditEvent, InviteCode, School, SchoolClass, TestResource, User

try:
    import psycopg
    from psycopg.rows import dict_row
except Exception:  # pragma: no cover - optional dependency in memory mode
    psycopg = None
    dict_row = None


class DataStore(ABC):
    @abstractmethod
    def get_user_by_id(self, user_id: str) -> User | None:
        raise NotImplementedError

    @abstractmethod
    def find_user_by_email(self, email: str) -> User | None:
        raise NotImplementedError

    @abstractmethod
    def find_user_by_telegram_id(self, telegram_id: int) -> User | None:
        raise NotImplementedError

    @abstractmethod
    def save_user(self, user: User) -> None:
        raise NotImplementedError

    @abstractmethod
    def get_school_by_id(self, school_id: str) -> School | None:
        raise NotImplementedError

    @abstractmethod
    def list_users_by_school(self, school_id: str) -> list[User]:
        raise NotImplementedError

    @abstractmethod
    def list_students_by_teacher(self, teacher_id: str) -> list[User]:
        raise NotImplementedError

    @abstractmethod
    def count_students_for_teacher(self, teacher_id: str) -> int:
        raise NotImplementedError

    @abstractmethod
    def get_class_by_id(self, class_id: str) -> SchoolClass | None:
        raise NotImplementedError

    @abstractmethod
    def save_invite(self, invite: InviteCode) -> None:
        raise NotImplementedError

    @abstractmethod
    def get_invite(self, invite_code: str) -> InviteCode | None:
        raise NotImplementedError

    @abstractmethod
    def increment_invite_usage(self, invite_code: str) -> None:
        raise NotImplementedError

    @abstractmethod
    def add_student_to_class(self, class_id: str, student_id: str) -> None:
        raise NotImplementedError

    @abstractmethod
    def save_test(self, test: TestResource) -> None:
        raise NotImplementedError

    @abstractmethod
    def add_audit_event(self, event: AuditEvent) -> None:
        raise NotImplementedError

    @abstractmethod
    def add_security_alert(self, event: AuditEvent) -> None:
        raise NotImplementedError

    @abstractmethod
    def reset(self) -> None:
        raise NotImplementedError


class InMemoryDataStore(DataStore):
    def get_user_by_id(self, user_id: str) -> User | None:
        return store.users.get(user_id)

    def find_user_by_email(self, email: str) -> User | None:
        return next((user for user in store.users.values() if user.email == email), None)

    def find_user_by_telegram_id(self, telegram_id: int) -> User | None:
        return next((user for user in store.users.values() if user.telegram_id == telegram_id), None)

    def save_user(self, user: User) -> None:
        store.users[user.id] = user

    def get_school_by_id(self, school_id: str) -> School | None:
        return store.schools.get(school_id)

    def list_users_by_school(self, school_id: str) -> list[User]:
        return [user for user in store.users.values() if user.school_id == school_id]

    def list_students_by_teacher(self, teacher_id: str) -> list[User]:
        allowed_classes = [value.id for value in store.classes.values() if value.teacher_id == teacher_id]
        allowed_students: set[str] = set()
        for class_id in allowed_classes:
            allowed_students.update(store.class_students.get(class_id, set()))
        return [store.users[user_id] for user_id in sorted(allowed_students) if user_id in store.users]

    def count_students_for_teacher(self, teacher_id: str) -> int:
        return len(self.list_students_by_teacher(teacher_id))

    def get_class_by_id(self, class_id: str) -> SchoolClass | None:
        return store.classes.get(class_id)

    def save_invite(self, invite: InviteCode) -> None:
        store.invite_codes[invite.code] = invite

    def get_invite(self, invite_code: str) -> InviteCode | None:
        return store.invite_codes.get(invite_code)

    def increment_invite_usage(self, invite_code: str) -> None:
        invite = store.invite_codes.get(invite_code)
        if invite:
            invite.usage_count += 1

    def add_student_to_class(self, class_id: str, student_id: str) -> None:
        store.class_students.setdefault(class_id, set()).add(student_id)

    def save_test(self, test: TestResource) -> None:
        store.tests[test.id] = test

    def add_audit_event(self, event: AuditEvent) -> None:
        store.audit_log.append(event)

    def add_security_alert(self, event: AuditEvent) -> None:
        store.security_alerts.append(event)

    def reset(self) -> None:
        store.reset()


class PostgresDataStore(DataStore):
    def __init__(self, database_url: str) -> None:
        if psycopg is None or dict_row is None:
            raise BackendUnavailableError("psycopg is not installed")
        self.database_url = database_url

    def _map_user(self, row: dict | None) -> User | None:
        if not row:
            return None
        return User(
            id=row["id"],
            school_id=row["school_id"],
            district_id=row.get("district_id"),
            role=Role(row["role"]),
            full_name=row["full_name"],
            status=UserStatus(row["status"]),
            email=row.get("email"),
            phone=row.get("phone"),
            telegram_id=row.get("telegram_id"),
            password_hash=row.get("password_hash"),
            language=row.get("language") or "uz",
            avatar_url=row.get("avatar_url"),
            subscription_tier=row.get("subscription_tier") or "free",
            subscription_expires_at=row.get("subscription_expires_at"),
            last_active_at=row.get("last_active_at"),
            session_invalidated_at=int(row.get("session_invalidated_at") or 0),
        )

    def _map_school(self, row: dict | None) -> School | None:
        if not row:
            return None
        return School(
            id=row["id"],
            name=row["name"],
            subscription_plan=row.get("subscription_plan") or "freemium",
        )

    def _map_class(self, row: dict | None) -> SchoolClass | None:
        if not row:
            return None
        return SchoolClass(
            id=row["id"],
            school_id=row["school_id"],
            teacher_id=row["teacher_id"],
            name=row["name"],
        )

    def _map_invite(self, row: dict | None) -> InviteCode | None:
        if not row:
            return None
        return InviteCode(
            code=row["code"],
            school_id=row["school_id"],
            class_id=row["class_id"],
            teacher_id=row["teacher_id"],
            expires_at=row["expires_at"],
            usage_count=int(row.get("usage_count") or 0),
        )

    def _request_context(self) -> RequestRlsContext:
        current = get_request_rls_context()
        if current is not None:
            return current
        return RequestRlsContext(school_id=None, user_id="service_user", role="service")

    @contextmanager
    def _connection(self):
        try:
            with psycopg.connect(
                self.database_url,
                connect_timeout=settings.postgres_connect_timeout_seconds,
                row_factory=dict_row,
            ) as conn:
                with conn.transaction():
                    with conn.cursor() as cur:
                        cur.execute(f"SET LOCAL statement_timeout = {int(settings.postgres_statement_timeout_ms)}")
                        rls_context = self._request_context()
                        statements = build_rls_set_local_statements(
                            RlsContext(
                                school_id=rls_context.school_id,
                                user_id=rls_context.user_id,
                                role=rls_context.role,
                            )
                        )
                        for statement in statements:
                            cur.execute(statement)
                    yield conn
        except Exception as exc:  # pragma: no cover - integration failure path
            raise BackendUnavailableError(f"postgres unavailable: {exc}") from exc

    def get_user_by_id(self, user_id: str) -> User | None:
        with self._connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT * FROM users WHERE id = %s LIMIT 1", (user_id,))
                row = cur.fetchone()
                return self._map_user(row)

    def find_user_by_email(self, email: str) -> User | None:
        with self._connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT * FROM users WHERE lower(email) = lower(%s) LIMIT 1", (email,))
                return self._map_user(cur.fetchone())

    def find_user_by_telegram_id(self, telegram_id: int) -> User | None:
        with self._connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT * FROM users WHERE telegram_id = %s LIMIT 1", (telegram_id,))
                return self._map_user(cur.fetchone())

    def save_user(self, user: User) -> None:
        with self._connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO users (
                        id, school_id, district_id, role, full_name, status, email, phone, telegram_id,
                        password_hash, language, avatar_url, subscription_tier, subscription_expires_at,
                        last_active_at, session_invalidated_at
                    ) VALUES (
                        %(id)s, %(school_id)s, %(district_id)s, %(role)s, %(full_name)s, %(status)s, %(email)s, %(phone)s, %(telegram_id)s,
                        %(password_hash)s, %(language)s, %(avatar_url)s, %(subscription_tier)s, %(subscription_expires_at)s,
                        %(last_active_at)s, %(session_invalidated_at)s
                    )
                    ON CONFLICT (id) DO UPDATE SET
                        school_id = EXCLUDED.school_id,
                        district_id = EXCLUDED.district_id,
                        role = EXCLUDED.role,
                        full_name = EXCLUDED.full_name,
                        status = EXCLUDED.status,
                        email = EXCLUDED.email,
                        phone = EXCLUDED.phone,
                        telegram_id = EXCLUDED.telegram_id,
                        password_hash = EXCLUDED.password_hash,
                        language = EXCLUDED.language,
                        avatar_url = EXCLUDED.avatar_url,
                        subscription_tier = EXCLUDED.subscription_tier,
                        subscription_expires_at = EXCLUDED.subscription_expires_at,
                        last_active_at = EXCLUDED.last_active_at,
                        session_invalidated_at = EXCLUDED.session_invalidated_at
                    """,
                    {
                        "id": user.id,
                        "school_id": user.school_id,
                        "district_id": user.district_id,
                        "role": user.role.value,
                        "full_name": user.full_name,
                        "status": user.status.value,
                        "email": user.email,
                        "phone": user.phone,
                        "telegram_id": user.telegram_id,
                        "password_hash": user.password_hash,
                        "language": user.language,
                        "avatar_url": user.avatar_url,
                        "subscription_tier": user.subscription_tier,
                        "subscription_expires_at": user.subscription_expires_at,
                        "last_active_at": user.last_active_at,
                        "session_invalidated_at": user.session_invalidated_at,
                    },
                )

    def get_school_by_id(self, school_id: str) -> School | None:
        with self._connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT * FROM schools WHERE id = %s LIMIT 1", (school_id,))
                return self._map_school(cur.fetchone())

    def list_users_by_school(self, school_id: str) -> list[User]:
        with self._connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT * FROM users WHERE school_id = %s ORDER BY id", (school_id,))
                return [self._map_user(row) for row in cur.fetchall() if row is not None]

    def list_students_by_teacher(self, teacher_id: str) -> list[User]:
        with self._connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT u.*
                    FROM users u
                    JOIN class_students cs ON cs.student_id = u.id
                    JOIN classes c ON c.id = cs.class_id
                    WHERE c.teacher_id = %s
                    ORDER BY u.id
                    """,
                    (teacher_id,),
                )
                return [self._map_user(row) for row in cur.fetchall() if row is not None]

    def count_students_for_teacher(self, teacher_id: str) -> int:
        with self._connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT COUNT(DISTINCT cs.student_id) AS cnt
                    FROM class_students cs
                    JOIN classes c ON c.id = cs.class_id
                    WHERE c.teacher_id = %s
                    """,
                    (teacher_id,),
                )
                row = cur.fetchone()
                return int(row["cnt"]) if row else 0

    def get_class_by_id(self, class_id: str) -> SchoolClass | None:
        with self._connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT * FROM classes WHERE id = %s LIMIT 1", (class_id,))
                return self._map_class(cur.fetchone())

    def save_invite(self, invite: InviteCode) -> None:
        with self._connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO invite_codes (code, school_id, class_id, teacher_id, expires_at, usage_count)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    ON CONFLICT (code) DO UPDATE SET
                        school_id = EXCLUDED.school_id,
                        class_id = EXCLUDED.class_id,
                        teacher_id = EXCLUDED.teacher_id,
                        expires_at = EXCLUDED.expires_at,
                        usage_count = EXCLUDED.usage_count
                    """,
                    (
                        invite.code,
                        invite.school_id,
                        invite.class_id,
                        invite.teacher_id,
                        invite.expires_at,
                        invite.usage_count,
                    ),
                )

    def get_invite(self, invite_code: str) -> InviteCode | None:
        with self._connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT * FROM invite_codes WHERE code = %s LIMIT 1", (invite_code,))
                return self._map_invite(cur.fetchone())

    def increment_invite_usage(self, invite_code: str) -> None:
        with self._connection() as conn:
            with conn.cursor() as cur:
                cur.execute("UPDATE invite_codes SET usage_count = usage_count + 1 WHERE code = %s", (invite_code,))

    def add_student_to_class(self, class_id: str, student_id: str) -> None:
        mapping_id = f"clsmap_{uuid.uuid4().hex[:10]}"
        with self._connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT school_id FROM classes WHERE id = %s LIMIT 1",
                    (class_id,),
                )
                class_row = cur.fetchone()
                if not class_row:
                    return
                cur.execute(
                    """
                    INSERT INTO class_students (id, class_id, student_id, school_id)
                    VALUES (%s, %s, %s, %s)
                    ON CONFLICT (class_id, student_id) DO NOTHING
                    """,
                    (mapping_id, class_id, student_id, class_row["school_id"]),
                )

    def save_test(self, test: TestResource) -> None:
        with self._connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO tests (id, school_id, teacher_id, title, mode, status)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    ON CONFLICT (id) DO UPDATE SET
                        school_id = EXCLUDED.school_id,
                        teacher_id = EXCLUDED.teacher_id,
                        title = EXCLUDED.title,
                        mode = EXCLUDED.mode,
                        status = EXCLUDED.status
                    """,
                    (test.id, test.school_id, test.teacher_id, test.title, test.mode, test.status),
                )

    def add_audit_event(self, event: AuditEvent) -> None:
        with self._connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO audit_logs (
                        id, school_id, user_id, event_type, entity_type, entity_id, old_value, new_value, ip_address,
                        user_agent, result, error_code, created_at
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s::jsonb, %s::jsonb, %s, %s, %s, %s, %s)
                    """,
                    (
                        f"aud_{uuid.uuid4().hex[:12]}",
                        event.school_id,
                        event.user_id,
                        event.event,
                        "api",
                        event.resource_id,
                        "{}",
                        json.dumps(event.details or {}),
                        event.ip,
                        None,
                        "success",
                        None,
                        event.created_at,
                    ),
                )

    def add_security_alert(self, event: AuditEvent) -> None:
        with self._connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO audit_logs (
                        id, school_id, user_id, event_type, entity_type, entity_id, old_value, new_value, ip_address,
                        user_agent, result, error_code, created_at
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s::jsonb, %s::jsonb, %s, %s, %s, %s, %s)
                    """,
                    (
                        f"aud_{uuid.uuid4().hex[:12]}",
                        event.school_id,
                        event.user_id,
                        event.event,
                        "security",
                        event.resource_id,
                        "{}",
                        json.dumps(event.details or {}),
                        event.ip,
                        None,
                        "success",
                        None,
                        event.created_at,
                    ),
                )

    def reset(self) -> None:
        # No-op for PostgreSQL backend.
        return None
