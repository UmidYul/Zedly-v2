from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import timedelta
from typing import Any

from app.core.constants import ACCESS_TOKEN_TTL, FREEMIUM_STUDENT_LIMIT_PER_TEACHER, LOCKOUT_SECONDS, LOGIN_WINDOW_SECONDS, MAX_LOGIN_ATTEMPTS_PER_WINDOW, ONBOARDING_TOKEN_TTL, REFRESH_TOKEN_TTL
from app.core.errors import AppError
from app.core.permissions import canonical_payload_permissions
from app.core.settings import settings
from app.core.security import (
    create_access_token,
    generate_refresh_token,
    hash_refresh_token,
    hash_password,
    now_utc,
    to_unix,
    verify_password,
)
from app.core.telegram import validate_telegram_auth
from app.core.types import ErrorCode, Role, UserStatus
from app.repositories.exceptions import BackendUnavailableError
from app.repositories.models import RefreshRecord, School, SchoolClass, User
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
        _ = role_hint
        if not settings.feature_telegram_onboarding_token_flow_enabled:
            raise AppError(status_code=403, code=ErrorCode.ROLE_FORBIDDEN.value, message="Telegram onboarding flow is disabled")
        is_valid, reason = validate_telegram_auth(auth_data, bot_token=bot_token, max_age_seconds=86400)
        if not is_valid:
            if reason == "expired":
                raise AppError(
                    status_code=401,
                    code=ErrorCode.TELEGRAM_AUTH_EXPIRED.value,
                    message="Telegram auth data is expired",
                )
            raise AppError(
                status_code=401,
                code=ErrorCode.TELEGRAM_HASH_INVALID.value,
                message="Invalid Telegram signature",
            )

        telegram_id_raw = auth_data.get("id")
        if telegram_id_raw is None:
            raise AppError(status_code=400, code=ErrorCode.VALIDATION_ERROR.value, message="Telegram id is required")

        telegram_id = int(telegram_id_raw)
        user = self._find_user_by_telegram_id(telegram_id)
        if user:
            if user.status == UserStatus.PENDING_APPROVAL:
                return {
                    "status": "pending_approval",
                    "message": "Your account is pending school approval",
                }
            self._ensure_user_active(user)
            pair = self._issue_token_pair(user)
            audit.record(event="auth.telegram.login.success", user_id=user.id, school_id=user.school_id, ip=ip)
            return {
                "access_token": pair.access_token,
                "refresh_token": pair.refresh_token,
                "expires_in_seconds": 900,
            }

        onboarding_token = f"onb_{uuid.uuid4().hex}"
        payload = {
            "telegram_id": telegram_id,
            "first_name": str(auth_data.get("first_name") or "Telegram User"),
            "username": auth_data.get("username"),
            "auth_date": int(auth_data.get("auth_date") or 0),
        }
        try:
            get_session_store().save_onboarding_token(
                onboarding_token,
                payload,
                ttl_seconds=int(ONBOARDING_TOKEN_TTL.total_seconds()),
            )
        except BackendUnavailableError as exc:
            raise _service_unavailable() from exc
        audit.record(event="auth.telegram.onboarding_token.issued", user_id=None, school_id=None, ip=ip, details={"telegram_id": telegram_id})
        return {
            "status": "onboarding_required",
            "telegram_id": telegram_id,
            "onboarding_token": onboarding_token,
            "expires_in_seconds": int(ONBOARDING_TOKEN_TTL.total_seconds()),
        }

    def register_teacher(
        self,
        *,
        full_name: str,
        email: str,
        password: str,
        subject: str,
        school_id: str | None,
        school_name: str | None,
        onboarding_token: str | None,
        ip: str | None,
    ) -> User:
        if onboarding_token and not settings.feature_telegram_onboarding_token_flow_enabled:
            raise AppError(status_code=403, code=ErrorCode.ROLE_FORBIDDEN.value, message="Telegram onboarding flow is disabled")
        identity = email.lower().strip()
        if self._find_user_by_email(identity):
            raise AppError(status_code=409, code=ErrorCode.VALIDATION_ERROR.value, message="Email already in use")

        onboarding_payload: dict[str, Any] | None = None
        if onboarding_token:
            try:
                onboarding_payload = get_session_store().pop_onboarding_token(onboarding_token)
            except BackendUnavailableError as exc:
                raise _service_unavailable() from exc
            if not onboarding_payload:
                raise AppError(
                    status_code=400,
                    code=ErrorCode.ONBOARDING_TOKEN_INVALID.value,
                    message="Onboarding token is invalid or expired",
                )

        try:
            data_store = get_data_store()
        except BackendUnavailableError as exc:
            raise _service_unavailable() from exc

        resolved_school_id = school_id
        if resolved_school_id:
            school = data_store.get_school_by_id(resolved_school_id)
            if not school:
                raise AppError(status_code=400, code=ErrorCode.VALIDATION_ERROR.value, message="School not found")
        else:
            if not school_name:
                raise AppError(status_code=400, code=ErrorCode.VALIDATION_ERROR.value, message="School name is required for new school")
            resolved_school_id = f"school_{uuid.uuid4().hex[:8]}"
            data_store.save_school(School(id=resolved_school_id, name=school_name, subscription_plan="freemium"))

        telegram_id = int(onboarding_payload["telegram_id"]) if onboarding_payload and onboarding_payload.get("telegram_id") else None
        if telegram_id is not None and self._find_user_by_telegram_id(telegram_id):
            raise AppError(status_code=409, code=ErrorCode.VALIDATION_ERROR.value, message="Telegram account already linked")

        user = User(
            id=f"usr_{uuid.uuid4().hex[:10]}",
            school_id=resolved_school_id,
            role=Role.TEACHER,
            full_name=full_name,
            status=UserStatus.PENDING_APPROVAL,
            email=identity,
            password_hash=hash_password(password),
            telegram_id=telegram_id,
        )
        data_store.save_user(user)

        # Bootstrap teacher default class/assignment so the teacher can start immediately.
        class_id = f"cls_{uuid.uuid4().hex[:8]}"
        data_store.save_class(
            SchoolClass(
                id=class_id,
                school_id=resolved_school_id,
                teacher_id=user.id,
                name="Default",
            )
        )
        data_store.save_teacher_subject(teacher_id=user.id, school_id=resolved_school_id, subject_code=subject)
        data_store.save_teacher_class_assignment(
            teacher_id=user.id,
            school_id=resolved_school_id,
            class_id=class_id,
            subject_code=subject,
        )

        audit.record(
            event="auth.register.teacher.success",
            user_id=user.id,
            school_id=user.school_id,
            ip=ip,
            details={"onboarding_token_used": bool(onboarding_token)},
        )
        return user

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

        teacher = data.get_user_by_id(invite.teacher_id)
        if teacher and teacher.role == Role.TEACHER:
            teacher_students_count = data.count_students_for_teacher(invite.teacher_id)
            if teacher_students_count >= FREEMIUM_STUDENT_LIMIT_PER_TEACHER:
                raise AppError(
                    status_code=403,
                    code=ErrorCode.CLASS_LIMIT_REACHED.value,
                    message="Class student limit reached for freemium teacher",
                )

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
