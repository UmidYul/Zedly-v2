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


class SchoolUserPatchRequest(BaseModel):
    model_config = {"extra": "forbid"}

    status: str


class ClassInviteResponse(BaseModel):
    class_id: str
    code: str
    expires_at: str


class RegisterSchoolPayload(BaseModel):
    school_id: str | None = None
    name: str | None = None


class RegisterUserRequest(BaseModel):
    role: str = "teacher"
    full_name: str
    email: str
    password: str
    subject: str = "general"
    school: RegisterSchoolPayload = Field(default_factory=RegisterSchoolPayload)
    onboarding_token: str | None = None


class RegisterUserResponse(BaseModel):
    user_id: str
    role: str
    school_id: str | None
    status: str
    message: str | None = None
    access_token: str | None = None
    refresh_token: str | None = None
    token_type: str = "bearer"
    expires_in_seconds: int = 900


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
