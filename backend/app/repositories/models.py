from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

from app.core.types import Role, UserStatus


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
    mode: str = "standard"
    status: str = "draft"


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
