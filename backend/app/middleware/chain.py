from __future__ import annotations

import time
from dataclasses import dataclass

from fastapi import Depends, Header, Request

from app.core.errors import AppError
from app.core.permissions import canonical_permission
from app.core.security import decode_access_token, now_utc, to_unix
from app.core.types import ErrorCode, Role
from app.db.request_context import RequestRlsContext, set_request_rls_context
from app.repositories.exceptions import BackendUnavailableError
from app.repositories.models import User
from app.repositories.runtime import get_data_store, get_session_store
from app.services.audit_service import service as audit


@dataclass(slots=True)
class AuthContext:
    user: User
    permissions: set[str]
    jti: str
    iat: int
    exp: int


def _service_unavailable() -> AppError:
    return AppError(status_code=503, code=ErrorCode.SERVICE_UNAVAILABLE.value, message="Storage backend unavailable")


def get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client and request.client.host:
        return request.client.host
    return "unknown"


def _extract_bearer_token(authorization: str | None) -> str:
    if not authorization:
        raise AppError(status_code=401, code=ErrorCode.UNAUTHORIZED.value, message="Authorization header missing")
    parts = authorization.split(" ")
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise AppError(status_code=401, code=ErrorCode.UNAUTHORIZED.value, message="Invalid Authorization header")
    return parts[1]


def authenticate(
    request: Request,
    authorization: str | None = Header(default=None),
) -> AuthContext:
    ip = get_client_ip(request)
    try:
        sessions = get_session_store()
        blocked_until = sessions.get_blocked_ip_until(ip)
    except BackendUnavailableError as exc:
        raise _service_unavailable() from exc

    if blocked_until and blocked_until > time.time():
        raise AppError(status_code=429, code=ErrorCode.TOO_MANY_REQUESTS.value, message="IP temporarily blocked")

    token = _extract_bearer_token(authorization)
    payload = decode_access_token(token)

    user_id = str(payload.get("sub"))
    try:
        data_store = get_data_store()
        user = data_store.get_user_by_id(user_id)
    except BackendUnavailableError as exc:
        raise _service_unavailable() from exc

    if not user:
        raise AppError(status_code=401, code=ErrorCode.UNAUTHORIZED.value, message="User not found")

    issued_at = int(payload.get("iat", 0))
    if issued_at <= user.session_invalidated_at:
        raise AppError(status_code=401, code=ErrorCode.UNAUTHORIZED.value, message="Session invalidated")

    jti = str(payload.get("jti"))
    try:
        if sessions.is_access_token_blacklisted(jti):
            raise AppError(status_code=401, code=ErrorCode.UNAUTHORIZED.value, message="Token revoked")
    except BackendUnavailableError as exc:
        raise _service_unavailable() from exc

    role_from_token = payload.get("role")
    if role_from_token != user.role.value:
        raise AppError(status_code=401, code=ErrorCode.UNAUTHORIZED.value, message="Role changed, re-login required")

    permissions = {canonical_permission(value) for value in payload.get("permissions", [])}

    set_request_rls_context(
        RequestRlsContext(
            school_id=user.school_id,
            user_id=user.id,
            role=user.role.value,
        )
    )

    return AuthContext(
        user=user,
        permissions=permissions,
        jti=jti,
        iat=issued_at,
        exp=int(payload.get("exp", to_unix(now_utc()))),
    )


def enforce_school_scope(*, auth: AuthContext, target_school_id: str | None, resource_id: str | None, request: Request) -> None:
    if target_school_id is None:
        return
    if auth.user.role in (Role.INSPECTOR, Role.MINISTRY, Role.SUPERADMIN):
        return
    if auth.user.school_id == target_school_id:
        return

    audit.record_cross_school_attempt(
        user_id=auth.user.id,
        user_school_id=auth.user.school_id,
        target_school_id=target_school_id,
        resource_id=resource_id,
        ip=get_client_ip(request),
    )
    raise AppError(status_code=403, code=ErrorCode.SCHOOL_ACCESS_FORBIDDEN.value, message="Cross-school access denied")


def require_permission(permission_key: str):
    canonical = canonical_permission(permission_key)

    def dependency(auth: AuthContext = Depends(authenticate)) -> AuthContext:
        if canonical not in auth.permissions:
            raise AppError(
                status_code=403,
                code=ErrorCode.ROLE_FORBIDDEN.value,
                message=f"Permission '{canonical}' is required",
            )
        return auth

    return dependency


def enforce_feature(feature_code: str, auth: AuthContext) -> None:
    if feature_code != "DIRECTOR_SCHOOL_ANALYTICS":
        return
    if not auth.user.school_id:
        return
    try:
        school = get_data_store().get_school_by_id(auth.user.school_id)
    except BackendUnavailableError as exc:
        raise _service_unavailable() from exc
    if school and school.subscription_plan == "freemium":
        raise AppError(
            status_code=402,
            code=ErrorCode.PLAN_UPGRADE_REQUIRED.value,
            message="Director dashboard requires a paid plan",
        )


def enforce_assignment_scope(*, auth: AuthContext, class_id: str | None, subject: str | None = None) -> None:
    if auth.user.role != Role.TEACHER or not class_id:
        return
    try:
        data_store = get_data_store()
        has_assignment = data_store.has_teacher_class_assignment(
            teacher_id=auth.user.id,
            class_id=class_id,
            subject=subject,
        )
    except BackendUnavailableError as exc:
        raise _service_unavailable() from exc
    if not has_assignment:
        raise AppError(status_code=403, code=ErrorCode.ROLE_FORBIDDEN.value, message="Class assignment required")


def audit_trail(*, event: str, auth: AuthContext, resource_id: str | None, request: Request, details: dict | None = None) -> None:
    audit.record(
        event=event,
        user_id=auth.user.id,
        school_id=auth.user.school_id,
        resource_id=resource_id,
        ip=get_client_ip(request),
        details=details,
    )
