from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class TeacherClassRef(BaseModel):
    class_id: str
    class_name: str


class UserResponse(BaseModel):
    id: str
    school_id: str | None
    role: str
    full_name: str
    login: str
    email: str | None = None
    phone: str | None = None
    status: str
    language: str = "uz"
    avatar_url: str | None = None
    teacher_classes: list[TeacherClassRef] | None = None
    login_methods: list[str] = Field(default_factory=list)


class PatchMeRequest(BaseModel):
    model_config = {"extra": "forbid"}

    full_name: str | None = None
    language: str | None = None
    avatar_url: str | None = None


class SchoolUsersResponse(BaseModel):
    school_id: str
    users: list[UserResponse]
    total_in_scope: int
    filtered_total: int
    role: str = "all"
    status: str = "all"
    class_id: str | None = None
    search: str | None = None


class SchoolUserPatchRequest(BaseModel):
    model_config = {"extra": "forbid"}

    status: str


class ClassInviteResponse(BaseModel):
    class_id: str
    code: str
    expires_at: str


class AccountProvisionRequest(BaseModel):
    role: str
    full_name: str
    school_id: str | None = None
    district_id: str | None = None
    class_id: str | None = None
    class_name: str | None = None
    subject: str | None = None
    email: str | None = None
    phone: str | None = None


class AccountProvisionResponse(BaseModel):
    user_id: str
    role: str
    login: str
    otp_password: str
    school_id: str | None
    district_id: str | None = None
    class_id: str | None = None
    status: str = "active"
    message: str | None = "Account provisioned"


class LoginMethodsResponse(BaseModel):
    google_connected: bool
    telegram_connected: bool


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
