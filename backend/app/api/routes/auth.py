from __future__ import annotations

import os

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse

from app.core.constants import REFRESH_TOKEN_TTL
from app.core.errors import error_payload
from app.core.settings import settings
from app.middleware.chain import AuthContext, authenticate, get_client_ip
from app.schemas.auth import (
    ForgotPasswordRequest,
    FirstPasswordChangeRequest,
    LoginRequest,
    LogoutRequest,
    RefreshRequest,
    TelegramAuthRequest,
)
from app.services.auth_service import TokenPair, service as auth_service


router = APIRouter(prefix="/auth", tags=["auth"])


def _set_refresh_cookie(response: JSONResponse, refresh_token: str) -> None:
    response.set_cookie(
        key=settings.auth_refresh_cookie_name,
        value=refresh_token,
        max_age=int(REFRESH_TOKEN_TTL.total_seconds()),
        httponly=True,
        secure=settings.auth_refresh_cookie_secure,
        samesite=settings.auth_refresh_cookie_samesite,
        path=settings.auth_refresh_cookie_path,
        domain=settings.auth_refresh_cookie_domain,
    )


def _clear_refresh_cookie(response: JSONResponse) -> None:
    response.delete_cookie(
        key=settings.auth_refresh_cookie_name,
        path=settings.auth_refresh_cookie_path,
        domain=settings.auth_refresh_cookie_domain,
    )
    if settings.auth_refresh_cookie_name != "refresh_token":
        response.delete_cookie(key="refresh_token", path="/")


def _auth_success_response(*, access_token: str, refresh_token: str, expires_in_seconds: int = 900) -> JSONResponse:
    response = JSONResponse(
        content={
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "expires_in_seconds": expires_in_seconds,
        }
    )
    _set_refresh_cookie(response, refresh_token)
    return response


@router.post("/login")
def login(payload: LoginRequest, request: Request):
    result = auth_service.login(login=payload.login, password=payload.password, ip=get_client_ip(request))
    if isinstance(result, TokenPair):
        return _auth_success_response(access_token=result.access_token, refresh_token=result.refresh_token)
    return result


@router.post("/telegram")
def telegram(payload: TelegramAuthRequest, request: Request):
    bot_token = os.getenv("ZEDLY_TELEGRAM_BOT_TOKEN", "dev-bot-token")
    response = auth_service.telegram_login(
        auth_data=payload.auth_data,
        bot_token=bot_token,
        ip=get_client_ip(request),
    )
    if "access_token" in response:
        response["token_type"] = "bearer"
        json_response = JSONResponse(content=response)
        _set_refresh_cookie(json_response, response["refresh_token"])
        return json_response
    return response


@router.post("/refresh")
def refresh(payload: RefreshRequest, request: Request):
    refresh_token = request.cookies.get(settings.auth_refresh_cookie_name) or request.cookies.get("refresh_token")
    if not refresh_token:
        refresh_token = payload.refresh_token
    if not refresh_token:
        return JSONResponse(
            status_code=401,
            content=error_payload("REFRESH_EXPIRED", "Refresh token not provided"),
        )

    pair = auth_service.refresh(refresh_token=refresh_token, ip=get_client_ip(request))
    return _auth_success_response(access_token=pair.access_token, refresh_token=pair.refresh_token)


@router.post("/logout")
def logout(payload: LogoutRequest, request: Request, auth: AuthContext = Depends(authenticate)):
    refresh_token = request.cookies.get(settings.auth_refresh_cookie_name) or request.cookies.get("refresh_token")
    if not refresh_token:
        refresh_token = payload.refresh_token
    if not refresh_token:
        return JSONResponse(
            status_code=401,
            content=error_payload("REFRESH_EXPIRED", "Refresh token not provided"),
        )

    terminated = auth_service.logout(
        refresh_token=refresh_token,
        user=auth.user,
        ip=get_client_ip(request),
        access_jti=auth.jti,
        access_exp=auth.exp,
    )
    response = JSONResponse(content={"status": "ok", "sessions_terminated": terminated})
    _clear_refresh_cookie(response)
    return response


@router.post("/logout-all")
def logout_all(request: Request, auth: AuthContext = Depends(authenticate)):
    terminated = auth_service.logout_all(
        user=auth.user,
        ip=get_client_ip(request),
        access_jti=auth.jti,
        access_exp=auth.exp,
    )
    response = JSONResponse(content={"status": "ok", "sessions_terminated": terminated})
    _clear_refresh_cookie(response)
    return response


@router.post("/password/change-first")
def password_change_first(payload: FirstPasswordChangeRequest, request: Request):
    response_payload = auth_service.complete_first_password_change(
        challenge_token=payload.challenge_token,
        new_password=payload.new_password,
        repeat_password=payload.repeat_password,
        ip=get_client_ip(request),
    )
    if "access_token" in response_payload and "refresh_token" in response_payload:
        response = JSONResponse(content=response_payload)
        _set_refresh_cookie(response, str(response_payload["refresh_token"]))
        return response
    return response_payload


@router.post("/password/forgot")
def forgot_password(payload: ForgotPasswordRequest, request: Request):
    return auth_service.request_password_reset(login=payload.login, ip=get_client_ip(request))
