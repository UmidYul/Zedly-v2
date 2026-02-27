from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

from app.core.types import Role, UserStatus

__test__ = False


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


@dataclass(slots=True)
class User:
    id: str
    school_id: str | None
    role: Role
    full_name: str
    status: UserStatus
    email: str | None = None
    phone: str | None = None
    telegram_id: int | None = None
    password_hash: str | None = None
    language: str = "uz"
    avatar_url: str | None = None
    subscription_tier: str = "free"
    subscription_expires_at: datetime | None = None
    district_id: str | None = None
    last_active_at: datetime | None = None
    session_invalidated_at: int = 0


@dataclass(slots=True)
class School:
    id: str
    name: str
    subscription_plan: str = "freemium"


@dataclass(slots=True)
class SchoolClass:
    id: str
    school_id: str
    teacher_id: str
    name: str


@dataclass(slots=True)
class InviteCode:
    code: str
    school_id: str
    class_id: str
    teacher_id: str
    expires_at: datetime
    usage_count: int = 0


@dataclass(slots=True)
class TestResource:
    id: str
    school_id: str
    teacher_id: str
    title: str
    subject: str = "general"
    mode: str = "standard"
    status: str = "draft"
    show_answers: str = "after_deadline"
    shuffle_questions: bool = True
    shuffle_answers: bool = True
    time_limit_minutes: int = 30
    allow_retakes: bool = False
    questions: list["TestQuestion"] = field(default_factory=list)
    published_at: datetime | None = None


@dataclass(slots=True)
class RefreshRecord:
    token_hash: str
    user_id: str
    family_id: str
    device_id: str
    issued_at: datetime
    expires_at: datetime


@dataclass(slots=True)
class AuditEvent:
    event: str
    user_id: str | None
    school_id: str | None
    resource_id: str | None
    ip: str | None
    details: dict[str, Any] = field(default_factory=dict)
    created_at: datetime = field(default_factory=now_utc)


@dataclass(slots=True)
class TestAnswerOption:
    answer_id: str
    text: str
    is_correct: bool = False
    explanation: str | None = None


@dataclass(slots=True)
class TestQuestion:
    question_id: str
    text: str
    topic: str
    points: int = 1
    answers: list[TestAnswerOption] = field(default_factory=list)


@dataclass(slots=True)
class TestAssignment:
    id: str
    test_id: str
    class_id: str
    school_id: str
    teacher_id: str
    deadline: datetime
    status: str = "assigned"


@dataclass(slots=True)
class SessionAnswer:
    id: str
    session_id: str
    question_id: str
    answer_id: str | None
    answered_at: datetime
    server_answered_at: datetime
    time_spent_seconds: int | None = None
    is_late: bool = False
    source: str = "online"
    is_correct: bool | None = None
    points_awarded: int = 0


@dataclass(slots=True)
class TestSessionResource:
    id: str
    test_id: str
    assignment_id: str
    student_id: str
    school_id: str
    mode: str
    status: str
    started_at: datetime
    expires_at: datetime
    question_order: list[str] = field(default_factory=list)
    answer_shuffles: dict[str, list[str]] = field(default_factory=dict)
    completed_at: datetime | None = None
    score_percent: float | None = None
    late_submission: bool = False


@dataclass(slots=True)
class AnalyticsSnapshot:
    id: str
    school_id: str | None
    entity_type: str
    entity_id: str
    metric_name: str
    period_type: str
    period_start: datetime
    value_json: dict[str, Any]
    updated_at: datetime = field(default_factory=now_utc)


@dataclass(slots=True)
class OnboardingTokenRecord:
    token: str
    telegram_id: int
    first_name: str
    username: str | None
    created_at: datetime
    expires_at: datetime
