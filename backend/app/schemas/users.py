from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class UserResponse(BaseModel):
    id: str
    school_id: str | None
    role: str
    full_name: str
    email: str | None = None
    phone: str | None = None
    telegram_id: int | None = None
    status: str
    language: str = "uz"


class PatchMeRequest(BaseModel):
    model_config = {"extra": "forbid"}

    full_name: str | None = None
    language: str | None = None
    avatar_url: str | None = None


class SchoolUsersResponse(BaseModel):
    school_id: str
    users: list[UserResponse]


class ClassInviteResponse(BaseModel):
    class_id: str
    code: str
    expires_at: str


class TestCreateRequest(BaseModel):
    title: str
    mode: str = "standard"
    school_id: str | None = None


class TestCreateResponse(BaseModel):
    id: str
    title: str
    school_id: str
    teacher_id: str
    mode: str
    status: str = "draft"
