from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    login: str
    password: str


class TelegramAuthRequest(BaseModel):
    auth_data: dict[str, Any] = Field(default_factory=dict)


class RefreshRequest(BaseModel):
    refresh_token: str | None = None


class LogoutRequest(BaseModel):
    refresh_token: str | None = None


class ForgotPasswordRequest(BaseModel):
    login: str


class FirstPasswordChangeRequest(BaseModel):
    challenge_token: str
    new_password: str
    repeat_password: str


class LoginMethodsChoiceRequest(BaseModel):
    connect_google: bool = False
    connect_telegram: bool = False


class AuthSuccessResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in_seconds: int = 900


class TelegramNotConnectedResponse(BaseModel):
    status: str = "telegram_not_connected"
    message: str


class PasswordChangeRequiredResponse(BaseModel):
    status: str = "password_change_required"
    challenge_token: str
    expires_in_seconds: int


class LoginMethodsPromptResponse(BaseModel):
    status: str = "login_methods_prompt"
    google_connect_url: str
    telegram_connect_url: str
    skip_label: str = "Пропустить — сделаю позже"
