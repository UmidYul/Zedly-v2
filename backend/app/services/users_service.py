from __future__ import annotations

import uuid
from datetime import timedelta

from app.core.constants import INVITE_TTL_HOURS
from app.core.errors import AppError
from app.core.security import generate_code, now_utc
from app.core.types import ErrorCode, Role
from app.repositories.exceptions import BackendUnavailableError
from app.repositories.models import InviteCode, TestResource, User
from app.repositories.runtime import get_data_store
from app.services.audit_service import service as audit


def _service_unavailable() -> AppError:
    return AppError(status_code=503, code=ErrorCode.SERVICE_UNAVAILABLE.value, message="Storage backend unavailable")


class UsersService:
    def get_user(self, user_id: str) -> User:
        try:
            user = get_data_store().get_user_by_id(user_id)
        except BackendUnavailableError as exc:
            raise _service_unavailable() from exc
        if not user:
            raise AppError(status_code=401, code=ErrorCode.UNAUTHORIZED.value, message="User not found")
        return user

    def get_me(self, user: User) -> User:
        return user

    def patch_me(self, *, user: User, payload: dict) -> User:
        for forbidden in ("email", "phone", "password", "password_hash", "role", "school_id"):
            if forbidden in payload:
                raise AppError(
                    status_code=400,
                    code=ErrorCode.VALIDATION_ERROR.value,
                    message=f"Field '{forbidden}' is not patchable",
                )

        if "full_name" in payload and payload["full_name"] is not None:
            user.full_name = str(payload["full_name"])
        if "language" in payload and payload["language"] is not None:
            user.language = str(payload["language"])
        if "avatar_url" in payload and payload["avatar_url"] is not None:
            user.avatar_url = str(payload["avatar_url"])
        try:
            get_data_store().save_user(user)
        except BackendUnavailableError as exc:
            raise _service_unavailable() from exc
        return user

    def list_school_users(self, *, current_user: User, school_id: str) -> list[User]:
        if current_user.school_id != school_id:
            audit.record_cross_school_attempt(
                user_id=current_user.id,
                user_school_id=current_user.school_id,
                target_school_id=school_id,
                resource_id=school_id,
                ip=None,
            )
            raise AppError(status_code=403, code=ErrorCode.SCHOOL_ACCESS_FORBIDDEN.value, message="Cross-school access denied")

        try:
            data_store = get_data_store()
        except BackendUnavailableError as exc:
            raise _service_unavailable() from exc

        if current_user.role == Role.DIRECTOR:
            try:
                return data_store.list_users_by_school(school_id)
            except BackendUnavailableError as exc:
                raise _service_unavailable() from exc

        if current_user.role == Role.TEACHER:
            try:
                return data_store.list_students_by_teacher(current_user.id)
            except BackendUnavailableError as exc:
                raise _service_unavailable() from exc

        raise AppError(status_code=403, code=ErrorCode.ROLE_FORBIDDEN.value, message="Role cannot list school users")

    def create_class_invite(self, *, current_user: User, class_id: str) -> InviteCode:
        try:
            data_store = get_data_store()
            school_class = data_store.get_class_by_id(class_id)
        except BackendUnavailableError as exc:
            raise _service_unavailable() from exc

        if not school_class:
            raise AppError(status_code=404, code=ErrorCode.RESOURCE_NOT_FOUND.value, message="Class not found")

        if school_class.school_id != current_user.school_id:
            audit.record_cross_school_attempt(
                user_id=current_user.id,
                user_school_id=current_user.school_id,
                target_school_id=school_class.school_id,
                resource_id=class_id,
                ip=None,
            )
            raise AppError(status_code=403, code=ErrorCode.SCHOOL_ACCESS_FORBIDDEN.value, message="Cross-school access denied")

        if current_user.role not in (Role.TEACHER, Role.DIRECTOR):
            raise AppError(status_code=403, code=ErrorCode.ROLE_FORBIDDEN.value, message="Role cannot create class invite")

        if current_user.role == Role.TEACHER and school_class.teacher_id != current_user.id:
            raise AppError(status_code=403, code=ErrorCode.ROLE_FORBIDDEN.value, message="Teacher is not assigned to class")

        code = generate_code(6)
        expires_at = now_utc() + timedelta(hours=INVITE_TTL_HOURS)
        invite = InviteCode(
            code=code,
            school_id=school_class.school_id,
            class_id=school_class.id,
            teacher_id=school_class.teacher_id,
            expires_at=expires_at,
        )
        try:
            data_store.save_invite(invite)
        except BackendUnavailableError as exc:
            raise _service_unavailable() from exc
        return invite

    def create_test(self, *, current_user: User, title: str, mode: str) -> TestResource:
        if current_user.role != Role.TEACHER:
            raise AppError(status_code=403, code=ErrorCode.ROLE_FORBIDDEN.value, message="Only teacher can create test")

        test_id = f"tst_{uuid.uuid4().hex[:10]}"
        test = TestResource(
            id=test_id,
            title=title,
            school_id=current_user.school_id or "",
            teacher_id=current_user.id,
            mode=mode,
            status="draft",
        )
        try:
            get_data_store().save_test(test)
        except BackendUnavailableError as exc:
            raise _service_unavailable() from exc
        return test


service = UsersService()
