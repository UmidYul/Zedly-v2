from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    email: str
    password: str


class TelegramAuthRequest(BaseModel):
    auth_data: dict[str, Any] = Field(default_factory=dict)
    role_hint: str | None = None


class RefreshRequest(BaseModel):
    refresh_token: str | None = None


class LogoutRequest(BaseModel):
    refresh_token: str


class InviteAcceptRequest(BaseModel):
    invite_code: str
    full_name: str
    telegram_id: int | None = None


class AuthSuccessResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in_seconds: int = 900


class TelegramPendingApprovalResponse(BaseModel):
    status: str = "pending_approval"
    message: str


class TelegramOnboardingRequiredResponse(BaseModel):
    status: str = "onboarding_required"
    telegram_id: int
    onboarding_token: str
    expires_in_seconds: int
