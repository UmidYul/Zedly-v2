from __future__ import annotations

from enum import Enum


class Role(str, Enum):
    STUDENT = "student"
    TEACHER = "teacher"
    DIRECTOR = "director"
    PSYCHOLOGIST = "psychologist"
    PARENT = "parent"
    INSPECTOR = "inspector"
    MINISTRY = "ministry"
    SUPERADMIN = "superadmin"


class UserStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    BLOCKED = "blocked"
    PENDING_APPROVAL = "pending_approval"


class SessionStatus(str, Enum):
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    EXPIRED = "expired"
    SYNCING = "syncing"


class ErrorCode(str, Enum):
    UNAUTHORIZED = "UNAUTHORIZED"
    TOKEN_EXPIRED = "TOKEN_EXPIRED"
    REFRESH_EXPIRED = "REFRESH_EXPIRED"
    SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE"
    ACCOUNT_DISABLED = "ACCOUNT_DISABLED"
    ACCOUNT_PENDING_APPROVAL = "ACCOUNT_PENDING_APPROVAL"
    ROLE_FORBIDDEN = "ROLE_FORBIDDEN"
    PLAN_UPGRADE_REQUIRED = "PLAN_UPGRADE_REQUIRED"
    SCHOOL_ACCESS_FORBIDDEN = "SCHOOL_ACCESS_FORBIDDEN"
    RESOURCE_NOT_FOUND = "RESOURCE_NOT_FOUND"
    VALIDATION_ERROR = "VALIDATION_ERROR"
    TOO_MANY_REQUESTS = "TOO_MANY_REQUESTS"
    TOKEN_REUSE_DETECTED = "TOKEN_REUSE_DETECTED"
    INVITE_NOT_FOUND = "INVITE_NOT_FOUND"
    INVITE_EXPIRED = "INVITE_EXPIRED"
