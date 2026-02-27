from __future__ import annotations

import os

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse

from app.core.errors import error_payload
from app.middleware.chain import AuthContext, authenticate
from app.schemas.auth import (
    InviteAcceptRequest,
    LoginRequest,
    LogoutRequest,
    RefreshRequest,
    TelegramAuthRequest,
)
from app.services.auth_service import service as auth_service


router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login")
def login(payload: LoginRequest, request: Request) -> dict:
    pair = auth_service.login(email=payload.email, password=payload.password, ip=request.client.host if request.client else None)
    return {
        "access_token": pair.access_token,
        "refresh_token": pair.refresh_token,
        "token_type": "bearer",
        "expires_in_seconds": 900,
    }


@router.post("/telegram")
def telegram(payload: TelegramAuthRequest, request: Request) -> dict:
    bot_token = os.getenv("ZEDLY_TELEGRAM_BOT_TOKEN", "dev-bot-token")
    response = auth_service.telegram_login(
        auth_data=payload.auth_data,
        role_hint=payload.role_hint,
        bot_token=bot_token,
        ip=request.client.host if request.client else None,
    )
    if "access_token" in response:
        response["token_type"] = "bearer"
    return response


@router.post("/refresh")
def refresh(payload: RefreshRequest, request: Request) -> dict:
    refresh_token = payload.refresh_token
    if not refresh_token:
        cookie_token = request.cookies.get("refresh_token")
        refresh_token = cookie_token
    if not refresh_token:
        return JSONResponse(
            status_code=401,
            content=error_payload("REFRESH_EXPIRED", "Refresh token not provided"),
        )

    pair = auth_service.refresh(refresh_token=refresh_token, ip=request.client.host if request.client else None)
    return {
        "access_token": pair.access_token,
        "refresh_token": pair.refresh_token,
        "token_type": "bearer",
        "expires_in_seconds": 900,
    }


@router.post("/logout")
def logout(payload: LogoutRequest, request: Request, auth: AuthContext = Depends(authenticate)) -> dict:
    terminated = auth_service.logout(
        refresh_token=payload.refresh_token,
        user=auth.user,
        ip=request.client.host if request.client else None,
        access_jti=auth.jti,
        access_exp=auth.exp,
    )
    return {"status": "ok", "sessions_terminated": terminated}


@router.post("/logout-all")
def logout_all(request: Request, auth: AuthContext = Depends(authenticate)) -> dict:
    terminated = auth_service.logout_all(user=auth.user, ip=request.client.host if request.client else None)
    return {"status": "ok", "sessions_terminated": terminated}


@router.post("/invite/accept")
def invite_accept(payload: InviteAcceptRequest, request: Request) -> dict:
    pair = auth_service.accept_invite(
        invite_code=payload.invite_code,
        full_name=payload.full_name,
        telegram_id=payload.telegram_id,
        ip=request.client.host if request.client else None,
    )
    return {
        "access_token": pair.access_token,
        "refresh_token": pair.refresh_token,
        "token_type": "bearer",
        "expires_in_seconds": 900,
    }
