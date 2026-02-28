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
from app.repositories.models import (
    AnalyticsSnapshot,
    AuditEvent,
    InviteCode,
    ReportJob,
    School,
    SessionAnswer,
    SchoolClass,
    TestAnswerOption,
    TestAssignment,
    TestQuestion,
    TestResource,
    TestSessionResource,
    User,
)

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
    def save_school(self, school: School) -> None:
        raise NotImplementedError

    @abstractmethod
    def list_schools(self) -> list[School]:
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
    def save_class(self, school_class: SchoolClass) -> None:
        raise NotImplementedError

    @abstractmethod
    def save_teacher_subject(self, *, teacher_id: str, school_id: str, subject_code: str) -> None:
        raise NotImplementedError

    @abstractmethod
    def save_teacher_class_assignment(self, *, teacher_id: str, school_id: str, class_id: str, subject_code: str) -> None:
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
    def get_test_by_id(self, test_id: str) -> TestResource | None:
        raise NotImplementedError

    @abstractmethod
    def list_tests_by_school(self, school_id: str) -> list[TestResource]:
        raise NotImplementedError

    @abstractmethod
    def save_test_assignment(self, assignment: TestAssignment) -> None:
        raise NotImplementedError

    @abstractmethod
    def find_assignment(self, *, test_id: str, class_id: str) -> TestAssignment | None:
        raise NotImplementedError

    @abstractmethod
    def get_assignment_by_id(self, assignment_id: str) -> TestAssignment | None:
        raise NotImplementedError

    @abstractmethod
    def list_assignments_by_test(self, test_id: str) -> list[TestAssignment]:
        raise NotImplementedError

    @abstractmethod
    def list_assignments_by_class(self, class_id: str) -> list[TestAssignment]:
        raise NotImplementedError

    @abstractmethod
    def save_test_session(self, session: TestSessionResource) -> None:
        raise NotImplementedError

    @abstractmethod
    def get_test_session(self, session_id: str) -> TestSessionResource | None:
        raise NotImplementedError

    @abstractmethod
    def find_student_session(self, *, test_id: str, student_id: str) -> TestSessionResource | None:
        raise NotImplementedError

    @abstractmethod
    def list_expired_sessions(self, now_ts) -> list[TestSessionResource]:
        raise NotImplementedError

    @abstractmethod
    def list_sessions_by_class(self, class_id: str) -> list[TestSessionResource]:
        raise NotImplementedError

    @abstractmethod
    def list_sessions_by_school(self, school_id: str) -> list[TestSessionResource]:
        raise NotImplementedError

    @abstractmethod
    def upsert_session_answer(self, answer: SessionAnswer, *, prefer_earlier: bool) -> bool:
        raise NotImplementedError

    @abstractmethod
    def list_session_answers(self, session_id: str) -> list[SessionAnswer]:
        raise NotImplementedError

    @abstractmethod
    def save_analytics_snapshot(self, snapshot: AnalyticsSnapshot) -> None:
        raise NotImplementedError

    @abstractmethod
    def get_latest_snapshot(self, *, school_id: str | None, entity_type: str, entity_id: str, metric_name: str) -> AnalyticsSnapshot | None:
        raise NotImplementedError

    @abstractmethod
    def list_snapshots(self, *, school_id: str | None, entity_type: str, entity_id: str | None = None) -> list[AnalyticsSnapshot]:
        raise NotImplementedError

    @abstractmethod
    def save_report_job(self, job: ReportJob) -> None:
        raise NotImplementedError

    @abstractmethod
    def get_report_job(self, report_id: str) -> ReportJob | None:
        raise NotImplementedError

    @abstractmethod
    def get_student_class_id(self, student_id: str) -> str | None:
        raise NotImplementedError

    @abstractmethod
    def get_teacher_subjects(self, teacher_id: str) -> set[str]:
        raise NotImplementedError

    @abstractmethod
    def has_teacher_class_assignment(self, *, teacher_id: str, class_id: str, subject: str | None = None) -> bool:
        raise NotImplementedError

    @abstractmethod
    def list_classes_by_teacher(self, teacher_id: str) -> list[SchoolClass]:
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

    def save_school(self, school: School) -> None:
        store.schools[school.id] = school

    def list_schools(self) -> list[School]:
        return list(store.schools.values())

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

    def save_class(self, school_class: SchoolClass) -> None:
        store.classes[school_class.id] = school_class

    def save_teacher_subject(self, *, teacher_id: str, school_id: str, subject_code: str) -> None:
        _ = school_id
        store.teacher_subjects.setdefault(teacher_id, set()).add(subject_code)

    def save_teacher_class_assignment(self, *, teacher_id: str, school_id: str, class_id: str, subject_code: str) -> None:
        _ = school_id
        store.teacher_class_assignments.setdefault(teacher_id, set()).add((class_id, subject_code))

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

    def get_test_by_id(self, test_id: str) -> TestResource | None:
        return store.tests.get(test_id)

    def list_tests_by_school(self, school_id: str) -> list[TestResource]:
        return [value for value in store.tests.values() if value.school_id == school_id]

    def save_test_assignment(self, assignment: TestAssignment) -> None:
        store.test_assignments[assignment.id] = assignment

    def find_assignment(self, *, test_id: str, class_id: str) -> TestAssignment | None:
        for value in store.test_assignments.values():
            if value.test_id == test_id and value.class_id == class_id:
                return value
        return None

    def get_assignment_by_id(self, assignment_id: str) -> TestAssignment | None:
        return store.test_assignments.get(assignment_id)

    def list_assignments_by_test(self, test_id: str) -> list[TestAssignment]:
        return [value for value in store.test_assignments.values() if value.test_id == test_id]

    def list_assignments_by_class(self, class_id: str) -> list[TestAssignment]:
        return [value for value in store.test_assignments.values() if value.class_id == class_id]

    def save_test_session(self, session: TestSessionResource) -> None:
        store.test_sessions[session.id] = session

    def get_test_session(self, session_id: str) -> TestSessionResource | None:
        return store.test_sessions.get(session_id)

    def find_student_session(self, *, test_id: str, student_id: str) -> TestSessionResource | None:
        for session in store.test_sessions.values():
            if session.test_id == test_id and session.student_id == student_id:
                return session
        return None

    def list_expired_sessions(self, now_ts) -> list[TestSessionResource]:
        return [value for value in store.test_sessions.values() if value.status == "in_progress" and value.expires_at <= now_ts]

    def list_sessions_by_class(self, class_id: str) -> list[TestSessionResource]:
        assignment_ids = {value.id for value in store.test_assignments.values() if value.class_id == class_id}
        return [value for value in store.test_sessions.values() if value.assignment_id in assignment_ids]

    def list_sessions_by_school(self, school_id: str) -> list[TestSessionResource]:
        return [value for value in store.test_sessions.values() if value.school_id == school_id]

    def upsert_session_answer(self, answer: SessionAnswer, *, prefer_earlier: bool) -> bool:
        bucket = store.session_answers.setdefault(answer.session_id, {})
        existing = bucket.get(answer.question_id)
        if existing is None:
            bucket[answer.question_id] = answer
            return True
        if prefer_earlier and existing.answered_at <= answer.answered_at:
            return False
        if (not prefer_earlier) and existing.answered_at >= answer.answered_at:
            return False
        bucket[answer.question_id] = answer
        return True

    def list_session_answers(self, session_id: str) -> list[SessionAnswer]:
        return list(store.session_answers.get(session_id, {}).values())

    def save_analytics_snapshot(self, snapshot: AnalyticsSnapshot) -> None:
        key = f"{snapshot.school_id}|{snapshot.entity_type}|{snapshot.entity_id}|{snapshot.metric_name}|{snapshot.period_type}|{snapshot.period_start.isoformat()}"
        store.analytics_snapshots[key] = snapshot

    def get_latest_snapshot(self, *, school_id: str | None, entity_type: str, entity_id: str, metric_name: str) -> AnalyticsSnapshot | None:
        values = [
            value
            for value in store.analytics_snapshots.values()
            if value.school_id == school_id and value.entity_type == entity_type and value.entity_id == entity_id and value.metric_name == metric_name
        ]
        if not values:
            return None
        values.sort(key=lambda x: x.period_start, reverse=True)
        return values[0]

    def list_snapshots(self, *, school_id: str | None, entity_type: str, entity_id: str | None = None) -> list[AnalyticsSnapshot]:
        values = [value for value in store.analytics_snapshots.values() if value.school_id == school_id and value.entity_type == entity_type]
        if entity_id is not None:
            values = [value for value in values if value.entity_id == entity_id]
        values.sort(key=lambda x: x.period_start, reverse=True)
        return values

    def save_report_job(self, job: ReportJob) -> None:
        store.report_jobs[job.id] = job

    def get_report_job(self, report_id: str) -> ReportJob | None:
        return store.report_jobs.get(report_id)

    def get_student_class_id(self, student_id: str) -> str | None:
        return store.student_class_enrollments.get(student_id)

    def get_teacher_subjects(self, teacher_id: str) -> set[str]:
        return set(store.teacher_subjects.get(teacher_id, set()))

    def has_teacher_class_assignment(self, *, teacher_id: str, class_id: str, subject: str | None = None) -> bool:
        assignments = store.teacher_class_assignments.get(teacher_id, set())
        if subject is None:
            return any(class_id == cls for cls, _ in assignments)
        return (class_id, subject) in assignments

    def list_classes_by_teacher(self, teacher_id: str) -> list[SchoolClass]:
        return [value for value in store.classes.values() if value.teacher_id == teacher_id]

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
            district_id=row.get("district_id"),
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

    def _map_test(self, row: dict | None) -> TestResource | None:
        if not row:
            return None
        questions = row.get("questions_json") or []
        parsed_questions = []
        for question in questions:
            answers = question.get("answers", [])
            parsed_questions.append(
                TestQuestion(
                    question_id=question["question_id"],
                    text=question["text"],
                    topic=question.get("topic", "general"),
                    points=int(question.get("points", 1)),
                    answers=[
                        TestAnswerOption(
                            answer_id=ans["answer_id"],
                            text=ans["text"],
                            is_correct=bool(ans.get("is_correct", False)),
                            explanation=ans.get("explanation"),
                        )
                        for ans in answers
                    ],
                )
            )
        return TestResource(
            id=row["id"],
            school_id=row["school_id"],
            teacher_id=row["teacher_id"],
            title=row["title"],
            subject=row.get("subject") or "general",
            mode=row.get("mode") or "standard",
            status=row.get("status") or "draft",
            show_answers=row.get("show_answers") or "after_deadline",
            shuffle_questions=bool(row.get("shuffle_questions", True)),
            shuffle_answers=bool(row.get("shuffle_answers", True)),
            time_limit_minutes=int(row.get("time_limit_minutes") or 30),
            allow_retakes=bool(row.get("allow_retakes", False)),
            questions=parsed_questions,
            published_at=row.get("published_at"),
        )

    def _map_assignment(self, row: dict | None) -> TestAssignment | None:
        if not row:
            return None
        return TestAssignment(
            id=row["id"],
            test_id=row["test_id"],
            class_id=row["class_id"],
            school_id=row["school_id"],
            teacher_id=row["teacher_id"],
            deadline=row["deadline"],
            status=row.get("status") or "assigned",
        )

    def _map_session(self, row: dict | None) -> TestSessionResource | None:
        if not row:
            return None
        return TestSessionResource(
            id=row["id"],
            test_id=row["test_id"],
            assignment_id=row["assignment_id"],
            student_id=row["student_id"],
            school_id=row["school_id"],
            mode=row.get("mode") or "standard",
            status=row.get("status") or "in_progress",
            started_at=row["started_at"],
            expires_at=row["expires_at"],
            question_order=list(row.get("question_order_json") or []),
            answer_shuffles=dict(row.get("answer_shuffles_json") or {}),
            completed_at=row.get("completed_at"),
            score_percent=row.get("score_percent"),
            late_submission=bool(row.get("late_submission", False)),
        )

    def _map_answer(self, row: dict | None) -> SessionAnswer | None:
        if not row:
            return None
        return SessionAnswer(
            id=row["id"],
            session_id=row["session_id"],
            question_id=row["question_id"],
            answer_id=row.get("answer_id"),
            answered_at=row["answered_at"],
            server_answered_at=row["server_answered_at"],
            time_spent_seconds=row.get("time_spent_seconds"),
            is_late=bool(row.get("is_late", False)),
            source=row.get("source") or "online",
            is_correct=row.get("is_correct"),
            points_awarded=int(row.get("points_awarded") or 0),
        )

    def _map_snapshot(self, row: dict | None) -> AnalyticsSnapshot | None:
        if not row:
            return None
        return AnalyticsSnapshot(
            id=row["id"],
            school_id=row.get("school_id"),
            entity_type=row["entity_type"],
            entity_id=row["entity_id"],
            metric_name=row["metric_name"],
            period_type=row["period_type"],
            period_start=row["period_start"],
            value_json=dict(row.get("value_json") or {}),
            updated_at=row.get("updated_at") or row["period_start"],
        )

    def _map_report_job(self, row: dict | None) -> ReportJob | None:
        if not row:
            return None
        return ReportJob(
            id=row["id"],
            school_id=row.get("school_id"),
            requested_by_user_id=row["requested_by_user_id"],
            scope_level=row["scope_level"],
            scope_id=row["scope_id"],
            template_key=row["template_key"],
            format=row["format"],
            status=row.get("status") or "queued",
            params_json=dict(row.get("params_json") or {}),
            result_url=row.get("result_url"),
            expires_at=row.get("expires_at"),
            error_code=row.get("error_code"),
            created_at=row.get("created_at"),
            started_at=row.get("started_at"),
            completed_at=row.get("completed_at"),
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

    def save_school(self, school: School) -> None:
        with self._connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO schools (id, name, subscription_plan, district_id)
                    VALUES (%s, %s, %s, %s)
                    ON CONFLICT (id) DO UPDATE SET
                      name = EXCLUDED.name,
                      subscription_plan = EXCLUDED.subscription_plan,
                      district_id = EXCLUDED.district_id
                    """,
                    (school.id, school.name, school.subscription_plan, school.district_id),
                )

    def list_schools(self) -> list[School]:
        with self._connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT * FROM schools ORDER BY id")
                return [self._map_school(row) for row in cur.fetchall() if row is not None]

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

    def save_class(self, school_class: SchoolClass) -> None:
        with self._connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO classes (id, school_id, teacher_id, name)
                    VALUES (%s, %s, %s, %s)
                    ON CONFLICT (id) DO UPDATE SET
                      school_id = EXCLUDED.school_id,
                      teacher_id = EXCLUDED.teacher_id,
                      name = EXCLUDED.name
                    """,
                    (school_class.id, school_class.school_id, school_class.teacher_id, school_class.name),
                )

    def save_teacher_subject(self, *, teacher_id: str, school_id: str, subject_code: str) -> None:
        with self._connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO teacher_subjects (id, teacher_id, school_id, subject_code)
                    VALUES (%s, %s, %s, %s)
                    ON CONFLICT (teacher_id, school_id, subject_code) DO NOTHING
                    """,
                    (f"ts_{uuid.uuid4().hex[:10]}", teacher_id, school_id, subject_code),
                )

    def save_teacher_class_assignment(self, *, teacher_id: str, school_id: str, class_id: str, subject_code: str) -> None:
        with self._connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO teacher_class_assignments (id, teacher_id, school_id, class_id, subject_code)
                    VALUES (%s, %s, %s, %s, %s)
                    ON CONFLICT (teacher_id, class_id, subject_code) DO NOTHING
                    """,
                    (f"tca_{uuid.uuid4().hex[:10]}", teacher_id, school_id, class_id, subject_code),
                )

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
                questions_json = [
                    {
                        "question_id": question.question_id,
                        "text": question.text,
                        "topic": question.topic,
                        "points": question.points,
                        "answers": [
                            {
                                "answer_id": answer.answer_id,
                                "text": answer.text,
                                "is_correct": answer.is_correct,
                                "explanation": answer.explanation,
                            }
                            for answer in question.answers
                        ],
                    }
                    for question in test.questions
                ]
                cur.execute(
                    """
                    INSERT INTO tests (
                        id, school_id, teacher_id, title, subject, mode, status, show_answers, shuffle_questions,
                        shuffle_answers, time_limit_minutes, allow_retakes, questions_json, published_at
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb, %s)
                    ON CONFLICT (id) DO UPDATE SET
                        school_id = EXCLUDED.school_id,
                        teacher_id = EXCLUDED.teacher_id,
                        title = EXCLUDED.title,
                        subject = EXCLUDED.subject,
                        mode = EXCLUDED.mode,
                        status = EXCLUDED.status,
                        show_answers = EXCLUDED.show_answers,
                        shuffle_questions = EXCLUDED.shuffle_questions,
                        shuffle_answers = EXCLUDED.shuffle_answers,
                        time_limit_minutes = EXCLUDED.time_limit_minutes,
                        allow_retakes = EXCLUDED.allow_retakes,
                        questions_json = EXCLUDED.questions_json,
                        published_at = EXCLUDED.published_at
                    """,
                    (
                        test.id,
                        test.school_id,
                        test.teacher_id,
                        test.title,
                        test.subject,
                        test.mode,
                        test.status,
                        test.show_answers,
                        test.shuffle_questions,
                        test.shuffle_answers,
                        test.time_limit_minutes,
                        test.allow_retakes,
                        json.dumps(questions_json),
                        test.published_at,
                    ),
                )

    def get_test_by_id(self, test_id: str) -> TestResource | None:
        with self._connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT * FROM tests WHERE id = %s LIMIT 1", (test_id,))
                return self._map_test(cur.fetchone())

    def list_tests_by_school(self, school_id: str) -> list[TestResource]:
        with self._connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT * FROM tests WHERE school_id = %s ORDER BY id", (school_id,))
                return [self._map_test(row) for row in cur.fetchall() if row is not None]

    def save_test_assignment(self, assignment: TestAssignment) -> None:
        with self._connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO test_assignments (id, test_id, class_id, school_id, teacher_id, deadline, status)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (id) DO UPDATE SET
                        deadline = EXCLUDED.deadline,
                        status = EXCLUDED.status
                    """,
                    (
                        assignment.id,
                        assignment.test_id,
                        assignment.class_id,
                        assignment.school_id,
                        assignment.teacher_id,
                        assignment.deadline,
                        assignment.status,
                    ),
                )

    def find_assignment(self, *, test_id: str, class_id: str) -> TestAssignment | None:
        with self._connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT * FROM test_assignments WHERE test_id = %s AND class_id = %s LIMIT 1",
                    (test_id, class_id),
                )
                return self._map_assignment(cur.fetchone())

    def get_assignment_by_id(self, assignment_id: str) -> TestAssignment | None:
        with self._connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT * FROM test_assignments WHERE id = %s LIMIT 1", (assignment_id,))
                return self._map_assignment(cur.fetchone())

    def list_assignments_by_test(self, test_id: str) -> list[TestAssignment]:
        with self._connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT * FROM test_assignments WHERE test_id = %s ORDER BY deadline", (test_id,))
                return [self._map_assignment(row) for row in cur.fetchall() if row is not None]

    def list_assignments_by_class(self, class_id: str) -> list[TestAssignment]:
        with self._connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT * FROM test_assignments WHERE class_id = %s ORDER BY deadline", (class_id,))
                return [self._map_assignment(row) for row in cur.fetchall() if row is not None]

    def save_test_session(self, session: TestSessionResource) -> None:
        with self._connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO test_sessions (
                        id, test_id, assignment_id, student_id, school_id, mode, status, started_at, expires_at,
                        question_order_json, answer_shuffles_json, completed_at, score_percent, late_submission
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb, %s::jsonb, %s, %s, %s)
                    ON CONFLICT (id) DO UPDATE SET
                        status = EXCLUDED.status,
                        completed_at = EXCLUDED.completed_at,
                        score_percent = EXCLUDED.score_percent,
                        late_submission = EXCLUDED.late_submission,
                        question_order_json = EXCLUDED.question_order_json,
                        answer_shuffles_json = EXCLUDED.answer_shuffles_json
                    """,
                    (
                        session.id,
                        session.test_id,
                        session.assignment_id,
                        session.student_id,
                        session.school_id,
                        session.mode,
                        session.status,
                        session.started_at,
                        session.expires_at,
                        json.dumps(session.question_order),
                        json.dumps(session.answer_shuffles),
                        session.completed_at,
                        session.score_percent,
                        session.late_submission,
                    ),
                )

    def get_test_session(self, session_id: str) -> TestSessionResource | None:
        with self._connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT * FROM test_sessions WHERE id = %s LIMIT 1", (session_id,))
                return self._map_session(cur.fetchone())

    def find_student_session(self, *, test_id: str, student_id: str) -> TestSessionResource | None:
        with self._connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT * FROM test_sessions
                    WHERE test_id = %s AND student_id = %s
                    ORDER BY started_at DESC
                    LIMIT 1
                    """,
                    (test_id, student_id),
                )
                return self._map_session(cur.fetchone())

    def list_expired_sessions(self, now_ts) -> list[TestSessionResource]:
        with self._connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT * FROM test_sessions
                    WHERE status = 'in_progress' AND expires_at <= %s
                    """,
                    (now_ts,),
                )
                return [self._map_session(row) for row in cur.fetchall() if row is not None]

    def list_sessions_by_class(self, class_id: str) -> list[TestSessionResource]:
        with self._connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT ts.*
                    FROM test_sessions ts
                    JOIN test_assignments ta ON ta.id = ts.assignment_id
                    WHERE ta.class_id = %s
                    ORDER BY ts.started_at DESC
                    """,
                    (class_id,),
                )
                return [self._map_session(row) for row in cur.fetchall() if row is not None]

    def list_sessions_by_school(self, school_id: str) -> list[TestSessionResource]:
        with self._connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT *
                    FROM test_sessions
                    WHERE school_id = %s
                    ORDER BY started_at DESC
                    """,
                    (school_id,),
                )
                return [self._map_session(row) for row in cur.fetchall() if row is not None]

    def upsert_session_answer(self, answer: SessionAnswer, *, prefer_earlier: bool) -> bool:
        with self._connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT answered_at
                    FROM session_answers
                    WHERE session_id = %s AND question_id = %s
                    LIMIT 1
                    """,
                    (answer.session_id, answer.question_id),
                )
                existing = cur.fetchone()
                if existing:
                    existing_answered_at = existing["answered_at"]
                    if prefer_earlier and existing_answered_at <= answer.answered_at:
                        return False
                    if (not prefer_earlier) and existing_answered_at >= answer.answered_at:
                        return False
                cur.execute(
                    """
                    INSERT INTO session_answers (
                        id, session_id, question_id, answer_id, answered_at, server_answered_at, time_spent_seconds,
                        is_late, source, is_correct, points_awarded
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (session_id, question_id) DO UPDATE SET
                        answer_id = EXCLUDED.answer_id,
                        answered_at = EXCLUDED.answered_at,
                        server_answered_at = EXCLUDED.server_answered_at,
                        time_spent_seconds = EXCLUDED.time_spent_seconds,
                        is_late = EXCLUDED.is_late,
                        source = EXCLUDED.source,
                        is_correct = EXCLUDED.is_correct,
                        points_awarded = EXCLUDED.points_awarded
                    """,
                    (
                        answer.id,
                        answer.session_id,
                        answer.question_id,
                        answer.answer_id,
                        answer.answered_at,
                        answer.server_answered_at,
                        answer.time_spent_seconds,
                        answer.is_late,
                        answer.source,
                        answer.is_correct,
                        answer.points_awarded,
                    ),
                )
                return True

    def list_session_answers(self, session_id: str) -> list[SessionAnswer]:
        with self._connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT * FROM session_answers WHERE session_id = %s", (session_id,))
                return [self._map_answer(row) for row in cur.fetchall() if row is not None]

    def save_analytics_snapshot(self, snapshot: AnalyticsSnapshot) -> None:
        with self._connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO analytics_snapshots (
                        id, school_id, entity_type, entity_id, metric_name, period_type, period_start, value_json, updated_at
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s::jsonb, %s)
                    ON CONFLICT (id) DO UPDATE SET
                        value_json = EXCLUDED.value_json,
                        updated_at = EXCLUDED.updated_at
                    """,
                    (
                        snapshot.id,
                        snapshot.school_id,
                        snapshot.entity_type,
                        snapshot.entity_id,
                        snapshot.metric_name,
                        snapshot.period_type,
                        snapshot.period_start,
                        json.dumps(snapshot.value_json),
                        snapshot.updated_at,
                    ),
                )

    def get_latest_snapshot(self, *, school_id: str | None, entity_type: str, entity_id: str, metric_name: str) -> AnalyticsSnapshot | None:
        with self._connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT * FROM analytics_snapshots
                    WHERE school_id IS NOT DISTINCT FROM %s AND entity_type = %s AND entity_id = %s AND metric_name = %s
                    ORDER BY period_start DESC
                    LIMIT 1
                    """,
                    (school_id, entity_type, entity_id, metric_name),
                )
                return self._map_snapshot(cur.fetchone())

    def list_snapshots(self, *, school_id: str | None, entity_type: str, entity_id: str | None = None) -> list[AnalyticsSnapshot]:
        with self._connection() as conn:
            with conn.cursor() as cur:
                if entity_id is None:
                    cur.execute(
                        """
                        SELECT * FROM analytics_snapshots
                        WHERE school_id IS NOT DISTINCT FROM %s AND entity_type = %s
                        ORDER BY period_start DESC
                        """,
                        (school_id, entity_type),
                    )
                else:
                    cur.execute(
                        """
                        SELECT * FROM analytics_snapshots
                        WHERE school_id IS NOT DISTINCT FROM %s AND entity_type = %s AND entity_id = %s
                        ORDER BY period_start DESC
                        """,
                        (school_id, entity_type, entity_id),
                    )
                return [self._map_snapshot(row) for row in cur.fetchall() if row is not None]

    def save_report_job(self, job: ReportJob) -> None:
        with self._connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO report_jobs (
                        id, school_id, requested_by_user_id, scope_level, scope_id, template_key, format, status,
                        params_json, result_url, expires_at, error_code, created_at, started_at, completed_at
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (id) DO UPDATE SET
                        school_id = EXCLUDED.school_id,
                        requested_by_user_id = EXCLUDED.requested_by_user_id,
                        scope_level = EXCLUDED.scope_level,
                        scope_id = EXCLUDED.scope_id,
                        template_key = EXCLUDED.template_key,
                        format = EXCLUDED.format,
                        status = EXCLUDED.status,
                        params_json = EXCLUDED.params_json,
                        result_url = EXCLUDED.result_url,
                        expires_at = EXCLUDED.expires_at,
                        error_code = EXCLUDED.error_code,
                        started_at = EXCLUDED.started_at,
                        completed_at = EXCLUDED.completed_at
                    """,
                    (
                        job.id,
                        job.school_id,
                        job.requested_by_user_id,
                        job.scope_level,
                        job.scope_id,
                        job.template_key,
                        job.format,
                        job.status,
                        json.dumps(job.params_json or {}),
                        job.result_url,
                        job.expires_at,
                        job.error_code,
                        job.created_at,
                        job.started_at,
                        job.completed_at,
                    ),
                )

    def get_report_job(self, report_id: str) -> ReportJob | None:
        with self._connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT * FROM report_jobs WHERE id = %s LIMIT 1", (report_id,))
                return self._map_report_job(cur.fetchone())

    def get_student_class_id(self, student_id: str) -> str | None:
        with self._connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT class_id FROM student_class_enrollments WHERE student_id = %s LIMIT 1", (student_id,))
                row = cur.fetchone()
                return row["class_id"] if row else None

    def get_teacher_subjects(self, teacher_id: str) -> set[str]:
        with self._connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT subject_code FROM teacher_subjects WHERE teacher_id = %s", (teacher_id,))
                return {row["subject_code"] for row in cur.fetchall()}

    def has_teacher_class_assignment(self, *, teacher_id: str, class_id: str, subject: str | None = None) -> bool:
        with self._connection() as conn:
            with conn.cursor() as cur:
                if subject is None:
                    cur.execute(
                        """
                        SELECT 1
                        FROM teacher_class_assignments
                        WHERE teacher_id = %s AND class_id = %s
                        LIMIT 1
                        """,
                        (teacher_id, class_id),
                    )
                else:
                    cur.execute(
                        """
                        SELECT 1
                        FROM teacher_class_assignments
                        WHERE teacher_id = %s AND class_id = %s AND subject_code = %s
                        LIMIT 1
                        """,
                        (teacher_id, class_id, subject),
                    )
                return cur.fetchone() is not None

    def list_classes_by_teacher(self, teacher_id: str) -> list[SchoolClass]:
        with self._connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT * FROM classes WHERE teacher_id = %s ORDER BY id", (teacher_id,))
                return [self._map_class(row) for row in cur.fetchall() if row is not None]

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
