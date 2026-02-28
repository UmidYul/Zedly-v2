from __future__ import annotations

import re
import secrets
import uuid
from dataclasses import dataclass
from typing import Any

from app.core.constants import ACCESS_TOKEN_TTL, LOCKOUT_SECONDS, LOGIN_WINDOW_SECONDS, MAX_LOGIN_ATTEMPTS_PER_WINDOW, REFRESH_TOKEN_TTL
from app.core.errors import AppError
from app.core.permissions import canonical_payload_permissions, canonical_role
from app.core.security import (
    create_access_token,
    generate_refresh_token,
    hash_password,
    hash_refresh_token,
    now_utc,
    to_unix,
    verify_password,
)
from app.core.telegram import validate_telegram_auth
from app.core.types import ErrorCode, Role, UserStatus
from app.repositories.exceptions import BackendUnavailableError
from app.repositories.models import RefreshRecord, SchoolClass, User
from app.repositories.runtime import get_data_store, get_session_store
from app.services.audit_service import service as audit


FIRST_PASSWORD_CHALLENGE_TTL_SECONDS = 900


@dataclass(slots=True)
class TokenPair:
    access_token: str
    refresh_token: str


def _service_unavailable() -> AppError:
    return AppError(status_code=503, code=ErrorCode.SERVICE_UNAVAILABLE.value, message="Storage backend unavailable")


class AuthService:
    def _data_store(self):
        try:
            return get_data_store()
        except BackendUnavailableError as exc:
            raise _service_unavailable() from exc

    def _session_store(self):
        try:
            return get_session_store()
        except BackendUnavailableError as exc:
            raise _service_unavailable() from exc

    def _find_user_by_email(self, email: str) -> User | None:
        try:
            return get_data_store().find_user_by_email(email)
        except BackendUnavailableError as exc:
            raise _service_unavailable() from exc

    def _find_user_by_login(self, login: str) -> User | None:
        try:
            return get_data_store().find_user_by_login(login)
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

    def _enforce_login_limit(self, identity: str, ip: str | None) -> None:
        checks: list[tuple[str, str]] = [("identity", identity)]
        normalized_ip = ip.strip() if ip else ""
        if normalized_ip and normalized_ip != "unknown":
            checks.append(("ip", f"ip:{normalized_ip}"))

        try:
            session_store = get_session_store()
            now_ts = int(now_utc().timestamp())
        except BackendUnavailableError as exc:
            raise _service_unavailable() from exc

        for scope, key in checks:
            try:
                attempts = session_store.get_recent_login_attempts(key, window_seconds=LOGIN_WINDOW_SECONDS)
            except BackendUnavailableError as exc:
                raise _service_unavailable() from exc

            if len(attempts) >= MAX_LOGIN_ATTEMPTS_PER_WINDOW:
                retry_after = attempts[0] + LOCKOUT_SECONDS - now_ts
                retry_after_seconds = max(retry_after, 1)
                audit.record(
                    event="auth.login.rate_limited",
                    user_id=None,
                    school_id=None,
                    ip=ip,
                    details={
                        "scope": scope,
                        "identity": identity if scope == "identity" else None,
                        "retry_after_seconds": retry_after_seconds,
                    },
                )
                raise AppError(
                    status_code=429,
                    code=ErrorCode.TOO_MANY_REQUESTS.value,
                    message="Too many login attempts",
                    details={"retry_after_seconds": retry_after_seconds, "scope": scope},
                )

    def _record_failed_login(self, identity: str, ip: str | None) -> None:
        keys = [identity]
        normalized_ip = ip.strip() if ip else ""
        if normalized_ip and normalized_ip != "unknown":
            keys.append(f"ip:{normalized_ip}")

        try:
            session_store = get_session_store()
            for key in keys:
                session_store.record_failed_login(key)
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

    def _is_password_valid(self, password: str) -> bool:
        return len(password) >= 8 and any(char.isdigit() for char in password)

    def _generate_otp_password(self, *, length: int = 8) -> str:
        alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*"
        return "".join(secrets.choice(alphabet) for _ in range(length))

    def _slug_name(self, full_name: str) -> str:
        normalized = re.sub(r"[^a-zA-Z0-9]+", ".", full_name.strip().lower())
        normalized = re.sub(r"\.+", ".", normalized).strip(".")
        return normalized or "user"

    def _generate_login(self, *, full_name: str, school_id: str | None, class_id: str | None) -> str:
        base_name = self._slug_name(full_name)
        school_fragment = (school_id or "zedly").replace("school_", "").replace("-", "").lower()
        class_fragment = (class_id or "gen").replace("cls_", "").replace("-", "").lower()

        for _ in range(100):
            suffix = secrets.randbelow(90) + 10
            candidate = f"{base_name}.{class_fragment}.{school_fragment}.{suffix}"
            if not self._find_user_by_login(candidate):
                return candidate
        raise AppError(status_code=500, code=ErrorCode.SERVICE_UNAVAILABLE.value, message="Unable to generate unique login")

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

    def _issue_first_password_challenge(self, *, user: User) -> dict[str, Any]:
        token = f"pwd_{uuid.uuid4().hex}"
        payload = {"user_id": user.id, "purpose": "first_password_change"}
        try:
            get_session_store().save_onboarding_token(
                token,
                payload,
                ttl_seconds=FIRST_PASSWORD_CHALLENGE_TTL_SECONDS,
            )
        except BackendUnavailableError as exc:
            raise _service_unavailable() from exc
        return {
            "status": "password_change_required",
            "challenge_token": token,
            "expires_in_seconds": FIRST_PASSWORD_CHALLENGE_TTL_SECONDS,
        }

    def _normalize_role(self, role: str) -> Role:
        raw = canonical_role(role.strip().lower())
        try:
            return Role(raw)
        except ValueError as exc:
            raise AppError(status_code=400, code=ErrorCode.VALIDATION_ERROR.value, message="Unsupported role value") from exc

    def _normalize_email(self, email: str | None) -> str | None:
        if email is None:
            return None
        normalized = email.strip().lower()
        return normalized or None

    def _resolve_hierarchy_scope(
        self,
        *,
        actor: User,
        target_role: Role,
        school_id: str | None,
        district_id: str | None,
    ) -> tuple[str | None, str | None]:
        data_store = self._data_store()

        if actor.role == Role.SUPERADMIN:
            if target_role != Role.MINISTRY:
                raise AppError(status_code=403, code=ErrorCode.ROLE_FORBIDDEN.value, message="Superadmin can create only ministry accounts")
            return None, district_id.strip() if district_id else None

        if actor.role == Role.MINISTRY:
            if target_role != Role.INSPECTOR:
                raise AppError(status_code=403, code=ErrorCode.ROLE_FORBIDDEN.value, message="Ministry can create only RONO accounts")
            normalized_district = district_id.strip() if district_id else ""
            if not normalized_district:
                raise AppError(status_code=400, code=ErrorCode.VALIDATION_ERROR.value, message="district_id is required for RONO account")
            return None, normalized_district

        if actor.role == Role.INSPECTOR:
            if target_role != Role.DIRECTOR:
                raise AppError(status_code=403, code=ErrorCode.ROLE_FORBIDDEN.value, message="RONO can create only director accounts")
            normalized_school = school_id.strip() if school_id else ""
            if not normalized_school:
                raise AppError(status_code=400, code=ErrorCode.VALIDATION_ERROR.value, message="school_id is required for director account")
            school = data_store.get_school_by_id(normalized_school)
            if not school:
                raise AppError(status_code=404, code=ErrorCode.RESOURCE_NOT_FOUND.value, message="School not found")
            if actor.district_id and school.district_id and school.district_id != actor.district_id:
                raise AppError(status_code=403, code=ErrorCode.SCHOOL_ACCESS_FORBIDDEN.value, message="Cross-district access denied")
            return school.id, school.district_id or actor.district_id

        if actor.role == Role.DIRECTOR:
            if target_role not in {Role.TEACHER, Role.STUDENT, Role.PSYCHOLOGIST, Role.PARENT}:
                raise AppError(status_code=403, code=ErrorCode.ROLE_FORBIDDEN.value, message="Director can create only school user accounts")
            if not actor.school_id:
                raise AppError(status_code=403, code=ErrorCode.ROLE_FORBIDDEN.value, message="Director school is required")
            if school_id and school_id != actor.school_id:
                raise AppError(status_code=403, code=ErrorCode.SCHOOL_ACCESS_FORBIDDEN.value, message="Cross-school account provisioning denied")
            school = data_store.get_school_by_id(actor.school_id)
            if not school:
                raise AppError(status_code=404, code=ErrorCode.RESOURCE_NOT_FOUND.value, message="School not found")
            return school.id, school.district_id

        raise AppError(status_code=403, code=ErrorCode.ROLE_FORBIDDEN.value, message="Role cannot provision accounts")

    def login(self, *, login: str, password: str, ip: str | None) -> TokenPair | dict[str, Any]:
        identity = login.lower().strip()
        self._enforce_login_limit(identity, ip)

        user = self._find_user_by_login(identity)
        if not user or not user.password_hash or not verify_password(password, user.password_hash):
            self._record_failed_login(identity, ip)
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

        if user.password_temporary:
            audit.record(
                event="auth.login.password_change_required",
                user_id=user.id,
                school_id=user.school_id,
                ip=ip,
            )
            return self._issue_first_password_challenge(user=user)

        pair = self._issue_token_pair(user)
        audit.record(event="auth.login.success", user_id=user.id, school_id=user.school_id, ip=ip)
        return pair

    def complete_first_password_change(
        self,
        *,
        challenge_token: str,
        new_password: str,
        repeat_password: str,
        ip: str | None,
    ) -> dict[str, Any]:
        if new_password != repeat_password:
            raise AppError(status_code=400, code=ErrorCode.VALIDATION_ERROR.value, message="Passwords do not match")
        if not self._is_password_valid(new_password):
            raise AppError(
                status_code=400,
                code=ErrorCode.VALIDATION_ERROR.value,
                message="Password must be at least 8 characters and contain at least one digit",
            )

        try:
            payload = get_session_store().pop_onboarding_token(challenge_token)
        except BackendUnavailableError as exc:
            raise _service_unavailable() from exc
        if not payload or payload.get("purpose") != "first_password_change":
            raise AppError(status_code=400, code=ErrorCode.VALIDATION_ERROR.value, message="Password change challenge is invalid or expired")

        user_id = str(payload.get("user_id") or "")
        try:
            user = self._data_store().get_user_by_id(user_id)
        except BackendUnavailableError as exc:
            raise _service_unavailable() from exc
        if not user:
            raise AppError(status_code=404, code=ErrorCode.RESOURCE_NOT_FOUND.value, message="User not found")
        self._ensure_user_active(user)

        user.password_hash = hash_password(new_password)
        user.password_temporary = False
        self._save_user(user)

        pair = self._issue_token_pair(user)
        audit.record(event="auth.password.first_change.success", user_id=user.id, school_id=user.school_id, ip=ip)
        return {
            "status": "login_methods_prompt",
            "google_connect_url": "/api/v1/users/me/login-methods/google/connect",
            "telegram_connect_url": "/api/v1/users/me/login-methods/telegram/connect",
            "skip_label": "Пропустить — сделаю позже",
            "access_token": pair.access_token,
            "refresh_token": pair.refresh_token,
            "token_type": "bearer",
            "expires_in_seconds": int(ACCESS_TOKEN_TTL.total_seconds()),
        }

    def request_password_reset(self, *, login: str, ip: str | None) -> dict[str, Any]:
        identity = login.lower().strip()
        user = self._find_user_by_login(identity) or self._find_user_by_email(identity)

        if user and user.password_hash:
            reset_token = f"pwd_{uuid.uuid4().hex}"
            try:
                get_session_store().save_onboarding_token(
                    reset_token,
                    {"user_id": user.id, "purpose": "password_reset"},
                    ttl_seconds=900,
                )
            except BackendUnavailableError as exc:
                raise _service_unavailable() from exc

        audit.record(
            event="auth.password_reset.requested",
            user_id=user.id if user else None,
            school_id=user.school_id if user else None,
            ip=ip,
        )

        return {
            "status": "accepted",
            "message": "If account exists, reset instructions were sent",
        }

    def telegram_login(self, *, auth_data: dict[str, Any], bot_token: str, ip: str | None) -> dict[str, Any]:
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
            raise AppError(status_code=400, code=ErrorCode.VALIDATION_ERROR.value, message="Telegram auth id is required")

        user = self._find_user_by_telegram_id(int(telegram_id_raw))
        if not user or not user.telegram_linked:
            return {
                "status": "telegram_not_connected",
                "message": "Telegram пока не подключен. Войдите по логину и подключите его в разделе «Способы входа».",
            }

        self._ensure_user_active(user)
        if user.password_temporary:
            return {
                "status": "telegram_not_connected",
                "message": "Сначала завершите первый вход: смените одноразовый пароль в Zedly.",
            }

        pair = self._issue_token_pair(user)
        audit.record(event="auth.telegram.login.success", user_id=user.id, school_id=user.school_id, ip=ip)
        return {
            "access_token": pair.access_token,
            "refresh_token": pair.refresh_token,
            "token_type": "bearer",
            "expires_in_seconds": int(ACCESS_TOKEN_TTL.total_seconds()),
        }

    def provision_account(
        self,
        *,
        actor: User,
        role: str,
        full_name: str,
        school_id: str | None,
        district_id: str | None,
        class_id: str | None,
        class_name: str | None,
        subject: str | None,
        email: str | None,
        phone: str | None,
        ip: str | None,
    ) -> dict[str, Any]:
        try:
            normalized_name = full_name.strip()
            if not normalized_name:
                raise AppError(status_code=400, code=ErrorCode.VALIDATION_ERROR.value, message="full_name is required")

            target_role = self._normalize_role(role)
            resolved_school_id, resolved_district_id = self._resolve_hierarchy_scope(
                actor=actor,
                target_role=target_role,
                school_id=school_id,
                district_id=district_id,
            )

            normalized_email = self._normalize_email(email)
            if normalized_email and self._find_user_by_email(normalized_email):
                raise AppError(status_code=409, code=ErrorCode.VALIDATION_ERROR.value, message="Email already in use")

            data_store = self._data_store()
            normalized_class_id = class_id.strip() if class_id else None
            if actor.role == Role.DIRECTOR and target_role == Role.STUDENT:
                if not normalized_class_id:
                    raise AppError(status_code=400, code=ErrorCode.VALIDATION_ERROR.value, message="class_id is required for student account")
                school_class = data_store.get_class_by_id(normalized_class_id)
                if not school_class:
                    raise AppError(status_code=404, code=ErrorCode.RESOURCE_NOT_FOUND.value, message="Class not found")
                if school_class.school_id != resolved_school_id:
                    raise AppError(status_code=403, code=ErrorCode.SCHOOL_ACCESS_FORBIDDEN.value, message="Cross-school class assignment denied")

            if actor.role == Role.DIRECTOR and target_role == Role.TEACHER and normalized_class_id:
                school_class = data_store.get_class_by_id(normalized_class_id)
                if not school_class:
                    raise AppError(status_code=404, code=ErrorCode.RESOURCE_NOT_FOUND.value, message="Class not found")
                if school_class.school_id != resolved_school_id:
                    raise AppError(status_code=403, code=ErrorCode.SCHOOL_ACCESS_FORBIDDEN.value, message="Cross-school class assignment denied")

            login_value = self._generate_login(
                full_name=normalized_name,
                school_id=resolved_school_id,
                class_id=normalized_class_id,
            )
            otp_password = self._generate_otp_password()

            user = User(
                id=f"usr_{uuid.uuid4().hex[:10]}",
                school_id=resolved_school_id,
                district_id=resolved_district_id,
                role=target_role,
                full_name=normalized_name,
                status=UserStatus.ACTIVE,
                login=login_value,
                email=normalized_email,
                phone=phone.strip() if phone else None,
                password_hash=hash_password(otp_password),
                password_temporary=True,
            )
            self._save_user(user)

            assigned_class_id: str | None = None

            if actor.role == Role.DIRECTOR and target_role == Role.TEACHER:
                subject_code = (subject or "general").strip().lower() or "general"
                data_store.save_teacher_subject(teacher_id=user.id, school_id=resolved_school_id or "", subject_code=subject_code)

                if class_name and class_name.strip():
                    assigned_class_id = f"cls_{uuid.uuid4().hex[:8]}"
                    data_store.save_class(
                        SchoolClass(
                            id=assigned_class_id,
                            school_id=resolved_school_id or "",
                            teacher_id=user.id,
                            name=class_name.strip(),
                        )
                    )
                elif normalized_class_id:
                    assigned_class_id = normalized_class_id

                if assigned_class_id:
                    data_store.save_teacher_class_assignment(
                        teacher_id=user.id,
                        school_id=resolved_school_id or "",
                        class_id=assigned_class_id,
                        subject_code=subject_code,
                    )

            if actor.role == Role.DIRECTOR and target_role == Role.STUDENT:
                data_store.add_student_to_class(normalized_class_id, user.id)
                assigned_class_id = normalized_class_id

            audit.record(
                event="auth.account.provisioned",
                user_id=user.id,
                school_id=user.school_id,
                ip=ip,
                details={
                    "created_by": actor.id,
                    "created_by_role": actor.role.value,
                    "target_role": user.role.value,
                    "class_id": assigned_class_id,
                },
            )
            return {
                "user_id": user.id,
                "role": user.role.value,
                "login": user.login,
                "otp_password": otp_password,
                "school_id": user.school_id,
                "district_id": user.district_id,
                "class_id": assigned_class_id,
                "status": user.status.value,
                "message": "Account provisioned",
            }
        except BackendUnavailableError as exc:
            raise _service_unavailable() from exc

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

    def logout_all(
        self,
        *,
        user: User,
        ip: str | None,
        access_jti: str | None = None,
        access_exp: int | None = None,
    ) -> int:
        try:
            sessions = get_session_store()
            hashes = list(sessions.list_user_tokens(user.id))
        except BackendUnavailableError as exc:
            raise _service_unavailable() from exc

        for token_hash in hashes:
            self._revoke_refresh_hash(token_hash)
        user.session_invalidated_at = to_unix(now_utc())
        self._save_user(user)

        if access_jti and access_exp:
            ttl = max(access_exp - int(now_utc().timestamp()), 1)
            try:
                sessions.blacklist_access_token(access_jti, ttl_seconds=ttl)
            except BackendUnavailableError as exc:
                raise _service_unavailable() from exc

        audit.record(event="auth.logout_all", user_id=user.id, school_id=user.school_id, ip=ip, details={"count": len(hashes)})
        return len(hashes)


service = AuthService()
