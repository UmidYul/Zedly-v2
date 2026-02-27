from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import timedelta
from typing import Any

from app.core.constants import ACCESS_TOKEN_TTL, LOCKOUT_SECONDS, LOGIN_WINDOW_SECONDS, MAX_LOGIN_ATTEMPTS_PER_WINDOW, REFRESH_TOKEN_TTL
from app.core.errors import AppError
from app.core.permissions import canonical_payload_permissions, canonical_role
from app.core.security import (
    create_access_token,
    generate_refresh_token,
    hash_refresh_token,
    now_utc,
    to_unix,
    verify_password,
)
from app.core.telegram import verify_telegram_auth
from app.core.types import ErrorCode, Role, UserStatus
from app.repositories.exceptions import BackendUnavailableError
from app.repositories.models import RefreshRecord, User
from app.repositories.runtime import get_data_store, get_session_store
from app.services.audit_service import service as audit


@dataclass(slots=True)
class TokenPair:
    access_token: str
    refresh_token: str


def _service_unavailable() -> AppError:
    return AppError(status_code=503, code=ErrorCode.SERVICE_UNAVAILABLE.value, message="Storage backend unavailable")


class AuthService:
    def _find_user_by_email(self, email: str) -> User | None:
        try:
            return get_data_store().find_user_by_email(email)
        except BackendUnavailableError as exc:
            raise _service_unavailable() from exc

    def _find_user_by_telegram_id(self, telegram_id: int) -> User | None:
        try:
            return get_data_store().find_user_by_telegram_id(telegram_id)
        except BackendUnavailableError as exc:
            raise _service_unavailable() from exc

    def _save_user(self, user: User) -> None:
        try:
            get_data_store().save_user(user)
        except BackendUnavailableError as exc:
            raise _service_unavailable() from exc

    def _ensure_user_active(self, user: User) -> None:
        if user.status == UserStatus.PENDING_APPROVAL:
            raise AppError(
                status_code=403,
                code=ErrorCode.ACCOUNT_PENDING_APPROVAL.value,
                message="Account pending school approval",
            )
        if user.status in (UserStatus.INACTIVE, UserStatus.BLOCKED):
            raise AppError(
                status_code=403,
                code=ErrorCode.ACCOUNT_DISABLED.value,
                message="Account disabled",
            )

    def _enforce_login_limit(self, identity: str) -> None:
        try:
            attempts = get_session_store().get_recent_login_attempts(identity, window_seconds=LOGIN_WINDOW_SECONDS)
        except BackendUnavailableError as exc:
            raise _service_unavailable() from exc

        if len(attempts) >= MAX_LOGIN_ATTEMPTS_PER_WINDOW:
            retry_after = attempts[0] + LOCKOUT_SECONDS - int(now_utc().timestamp())
            raise AppError(
                status_code=429,
                code=ErrorCode.TOO_MANY_REQUESTS.value,
                message="Too many login attempts",
                details={"retry_after_seconds": max(retry_after, 1)},
            )

    def _record_failed_login(self, identity: str) -> None:
        try:
            get_session_store().record_failed_login(identity)
        except BackendUnavailableError as exc:
            raise _service_unavailable() from exc

    def _clear_failed_logins(self, identity: str) -> None:
        try:
            get_session_store().clear_failed_logins(identity)
        except BackendUnavailableError as exc:
            raise _service_unavailable() from exc

    def _issue_token_pair(self, user: User, family_id: str | None = None) -> TokenPair:
        issued_at = now_utc()
        iat = to_unix(issued_at)
        exp = to_unix(issued_at + ACCESS_TOKEN_TTL)

        token_payload = {
            "sub": user.id,
            "school_id": user.school_id,
            "role": user.role.value,
            "permissions": canonical_payload_permissions(user.role),
            "telegram_id": user.telegram_id,
            "iat": iat,
            "exp": exp,
            "jti": str(uuid.uuid4()),
        }
        access_token = create_access_token(token_payload)

        refresh_token = generate_refresh_token()
        refresh_hash = hash_refresh_token(refresh_token)
        family = family_id or str(uuid.uuid4())

        refresh_record = RefreshRecord(
            token_hash=refresh_hash,
            user_id=user.id,
            family_id=family,
            device_id=str(uuid.uuid4()),
            issued_at=issued_at,
            expires_at=issued_at + REFRESH_TOKEN_TTL,
        )
        try:
            get_session_store().save_refresh_record(refresh_record)
        except BackendUnavailableError as exc:
            raise _service_unavailable() from exc
        return TokenPair(access_token=access_token, refresh_token=refresh_token)

    def _revoke_refresh_hash(self, refresh_hash: str) -> None:
        try:
            sessions = get_session_store()
            record = sessions.pop_refresh_record(refresh_hash)
            if not record:
                return
            sessions.mark_refresh_used(refresh_hash, record.family_id)
        except BackendUnavailableError as exc:
            raise _service_unavailable() from exc

    def _revoke_family(self, family_id: str) -> None:
        try:
            sessions = get_session_store()
            data = get_data_store()
            hashes = list(sessions.list_family_tokens(family_id))
            for token_hash in hashes:
                record = sessions.get_refresh_record(token_hash)
                if record:
                    user = data.get_user_by_id(record.user_id)
                    if user:
                        user.session_invalidated_at = to_unix(now_utc())
                        data.save_user(user)
                self._revoke_refresh_hash(token_hash)
            sessions.mark_family_revoked(family_id)
        except BackendUnavailableError as exc:
            raise _service_unavailable() from exc

    def login(self, *, email: str, password: str, ip: str | None) -> TokenPair:
        identity = email.lower().strip()
        self._enforce_login_limit(identity)

        user = self._find_user_by_email(identity)
        if not user or not user.password_hash or not verify_password(password, user.password_hash):
            self._record_failed_login(identity)
            audit.record(
                event="auth.login.failed",
                user_id=user.id if user else None,
                school_id=user.school_id if user else None,
                ip=ip,
            )
            raise AppError(
                status_code=401,
                code=ErrorCode.UNAUTHORIZED.value,
                message="Invalid credentials",
            )

        self._clear_failed_logins(identity)
        self._ensure_user_active(user)

        pair = self._issue_token_pair(user)
        audit.record(event="auth.login.success", user_id=user.id, school_id=user.school_id, ip=ip)
        return pair

    def telegram_login(self, *, auth_data: dict[str, Any], role_hint: str | None, bot_token: str, ip: str | None) -> dict[str, Any]:
        if not verify_telegram_auth(auth_data, bot_token=bot_token):
            raise AppError(
                status_code=401,
                code=ErrorCode.UNAUTHORIZED.value,
                message="Invalid Telegram signature",
            )

        telegram_id_raw = auth_data.get("id")
        if telegram_id_raw is None:
            raise AppError(status_code=400, code=ErrorCode.VALIDATION_ERROR.value, message="Telegram id is required")

        telegram_id = int(telegram_id_raw)
        user = self._find_user_by_telegram_id(telegram_id)
        if user:
            self._ensure_user_active(user)
            pair = self._issue_token_pair(user)
            audit.record(event="auth.telegram.login.success", user_id=user.id, school_id=user.school_id, ip=ip)
            return {
                "access_token": pair.access_token,
                "refresh_token": pair.refresh_token,
                "expires_in_seconds": 900,
            }

        if role_hint is None:
            return {
                "status": "onboarding_required",
                "message": "Telegram account is verified; onboarding role is required",
            }

        role_key = canonical_role(role_hint)
        try:
            role = Role(role_key)
        except ValueError as exc:
            raise AppError(
                status_code=400,
                code=ErrorCode.VALIDATION_ERROR.value,
                message="Unsupported role",
                details={"role_hint": role_hint},
            ) from exc

        new_user_id = f"usr_{uuid.uuid4().hex[:10]}"
        status = UserStatus.PENDING_APPROVAL if role == Role.TEACHER else UserStatus.ACTIVE
        new_user = User(
            id=new_user_id,
            school_id=None,
            role=role,
            full_name=str(auth_data.get("first_name") or "Telegram User"),
            status=status,
            telegram_id=telegram_id,
            email=None,
            password_hash=None,
        )
        self._save_user(new_user)

        if status == UserStatus.PENDING_APPROVAL:
            audit.record(event="auth.telegram.pending_approval", user_id=new_user.id, school_id=None, ip=ip)
            return {
                "status": "pending_approval",
                "message": "Account created and awaiting school admin approval",
            }

        pair = self._issue_token_pair(new_user)
        audit.record(event="auth.telegram.login.success", user_id=new_user.id, school_id=new_user.school_id, ip=ip)
        return {
            "access_token": pair.access_token,
            "refresh_token": pair.refresh_token,
            "expires_in_seconds": 900,
        }

    def refresh(self, *, refresh_token: str, ip: str | None) -> TokenPair:
        token_hash = hash_refresh_token(refresh_token)
        try:
            sessions = get_session_store()
            data = get_data_store()
            used_family = sessions.get_used_refresh_family(token_hash)
        except BackendUnavailableError as exc:
            raise _service_unavailable() from exc

        if used_family:
            self._revoke_family(used_family)
            audit.record(event="auth.refresh.token_reuse_detected", user_id=None, school_id=None, ip=ip)
            raise AppError(
                status_code=401,
                code=ErrorCode.TOKEN_REUSE_DETECTED.value,
                message="Refresh token reuse detected",
            )

        try:
            record = sessions.get_refresh_record(token_hash)
        except BackendUnavailableError as exc:
            raise _service_unavailable() from exc

        if not record:
            raise AppError(status_code=401, code=ErrorCode.REFRESH_EXPIRED.value, message="Refresh token not found")

        try:
            if sessions.is_family_revoked(record.family_id):
                raise AppError(status_code=401, code=ErrorCode.REFRESH_EXPIRED.value, message="Refresh family revoked")
        except BackendUnavailableError as exc:
            raise _service_unavailable() from exc

        if now_utc() >= record.expires_at:
            self._revoke_refresh_hash(token_hash)
            raise AppError(status_code=401, code=ErrorCode.REFRESH_EXPIRED.value, message="Refresh token expired")

        try:
            user = data.get_user_by_id(record.user_id)
        except BackendUnavailableError as exc:
            raise _service_unavailable() from exc
        if not user:
            self._revoke_refresh_hash(token_hash)
            raise AppError(status_code=401, code=ErrorCode.REFRESH_EXPIRED.value, message="User not found")

        self._ensure_user_active(user)
        self._revoke_refresh_hash(token_hash)

        pair = self._issue_token_pair(user, family_id=record.family_id)
        audit.record(event="auth.refresh.success", user_id=user.id, school_id=user.school_id, ip=ip)
        return pair

    def logout(self, *, refresh_token: str, user: User, ip: str | None, access_jti: str | None = None, access_exp: int | None = None) -> int:
        token_hash = hash_refresh_token(refresh_token)
        try:
            sessions = get_session_store()
            record = sessions.get_refresh_record(token_hash)
        except BackendUnavailableError as exc:
            raise _service_unavailable() from exc

        if not record:
            return 0
        if record.user_id != user.id:
            raise AppError(status_code=401, code=ErrorCode.UNAUTHORIZED.value, message="Refresh token mismatch")

        self._revoke_refresh_hash(token_hash)

        if access_jti and access_exp:
            ttl = max(access_exp - int(now_utc().timestamp()), 1)
            try:
                sessions.blacklist_access_token(access_jti, ttl_seconds=ttl)
            except BackendUnavailableError as exc:
                raise _service_unavailable() from exc

        audit.record(event="auth.logout", user_id=user.id, school_id=user.school_id, ip=ip)
        return 1

    def logout_all(self, *, user: User, ip: str | None) -> int:
        try:
            sessions = get_session_store()
            hashes = list(sessions.list_user_tokens(user.id))
        except BackendUnavailableError as exc:
            raise _service_unavailable() from exc

        for token_hash in hashes:
            self._revoke_refresh_hash(token_hash)
        user.session_invalidated_at = to_unix(now_utc())
        self._save_user(user)
        audit.record(event="auth.logout_all", user_id=user.id, school_id=user.school_id, ip=ip, details={"count": len(hashes)})
        return len(hashes)

    def accept_invite(self, *, invite_code: str, full_name: str, telegram_id: int | None, ip: str | None) -> TokenPair:
        try:
            data = get_data_store()
            invite = data.get_invite(invite_code)
        except BackendUnavailableError as exc:
            raise _service_unavailable() from exc
        if not invite:
            raise AppError(status_code=400, code=ErrorCode.INVITE_NOT_FOUND.value, message="Invite code not found")

        if now_utc() >= invite.expires_at:
            raise AppError(status_code=410, code=ErrorCode.INVITE_EXPIRED.value, message="Invite code expired")

        if telegram_id is not None and self._find_user_by_telegram_id(telegram_id):
            raise AppError(status_code=409, code=ErrorCode.VALIDATION_ERROR.value, message="Telegram account already linked")

        new_user_id = f"usr_{uuid.uuid4().hex[:10]}"
        new_student = User(
            id=new_user_id,
            school_id=invite.school_id,
            role=Role.STUDENT,
            full_name=full_name,
            status=UserStatus.ACTIVE,
            telegram_id=telegram_id,
            password_hash=None,
        )
        self._save_user(new_student)
        try:
            data.add_student_to_class(invite.class_id, new_user_id)
            data.increment_invite_usage(invite.code)
        except BackendUnavailableError as exc:
            raise _service_unavailable() from exc

        pair = self._issue_token_pair(new_student)
        audit.record(event="auth.invite.accepted", user_id=new_user_id, school_id=invite.school_id, ip=ip)
        return pair


service = AuthService()
