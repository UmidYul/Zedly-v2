from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import timedelta

from app.core.constants import INVITE_TTL_HOURS
from app.core.errors import AppError
from app.core.security import generate_code, now_utc
from app.core.types import ErrorCode, Role, UserStatus
from app.repositories.exceptions import BackendUnavailableError
from app.repositories.models import InviteCode, SchoolClass, TestResource, User
from app.repositories.runtime import get_data_store
from app.services.audit_service import service as audit


def _service_unavailable() -> AppError:
    return AppError(status_code=503, code=ErrorCode.SERVICE_UNAVAILABLE.value, message="Storage backend unavailable")


ALLOWED_SCHOOL_USER_ROLES = {role.value for role in Role}
ALLOWED_STATUS_FILTERS = {"all", "active", "inactive", "pending_approval", "blocked"}


@dataclass(slots=True)
class SchoolUserListResult:
    users: list[User]
    total_in_scope: int
    filtered_total: int


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

    def list_teacher_classes(self, *, user: User) -> list[SchoolClass]:
        if user.role != Role.TEACHER:
            return []
        try:
            return get_data_store().list_classes_by_teacher(user.id)
        except BackendUnavailableError as exc:
            raise _service_unavailable() from exc

    def _normalize_school_user_role_filter(self, role_filter: str) -> str:
        normalized = role_filter.strip().lower() if role_filter else "all"
        if normalized == "all":
            return normalized
        if normalized not in ALLOWED_SCHOOL_USER_ROLES:
            raise AppError(status_code=400, code=ErrorCode.VALIDATION_ERROR.value, message="Unsupported role filter")
        return normalized

    def _normalize_school_user_status_filter(self, status_filter: str) -> str:
        normalized = status_filter.strip().lower() if status_filter else "all"
        if normalized not in ALLOWED_STATUS_FILTERS:
            raise AppError(status_code=400, code=ErrorCode.VALIDATION_ERROR.value, message="Unsupported status filter")
        return normalized

    def _validate_search_filter(self, search: str | None) -> str | None:
        if search is None:
            return None
        normalized = search.strip().lower()
        if not normalized:
            return None
        if len(normalized) < 2:
            raise AppError(status_code=400, code=ErrorCode.VALIDATION_ERROR.value, message="Search query must contain at least 2 characters")
        return normalized

    def _filter_school_users(
        self,
        *,
        users: list[User],
        role_filter: str,
        status_filter: str,
        search_filter: str | None,
    ) -> list[User]:
        filtered = users
        if role_filter != "all":
            filtered = [user for user in filtered if user.role.value == role_filter]
        if status_filter != "all":
            filtered = [user for user in filtered if user.status.value == status_filter]
        if search_filter:
            filtered = [user for user in filtered if search_filter in user.full_name.lower()]
        return filtered

    def list_school_users(
        self,
        *,
        current_user: User,
        school_id: str,
        role_filter: str,
        status_filter: str,
        search: str | None,
        class_id: str | None,
    ) -> SchoolUserListResult:
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

        normalized_role = self._normalize_school_user_role_filter(role_filter)
        normalized_status = self._normalize_school_user_status_filter(status_filter)
        normalized_search = self._validate_search_filter(search)
        normalized_class_id = class_id.strip() if class_id else None

        if current_user.role == Role.DIRECTOR:
            try:
                if normalized_class_id:
                    school_class = data_store.get_class_by_id(normalized_class_id)
                    if not school_class:
                        raise AppError(status_code=404, code=ErrorCode.RESOURCE_NOT_FOUND.value, message="Class not found")
                    if school_class.school_id != school_id:
                        raise AppError(status_code=403, code=ErrorCode.SCHOOL_ACCESS_FORBIDDEN.value, message="Cross-school access denied")
                    if normalized_role not in {"all", Role.STUDENT.value}:
                        raise AppError(
                            status_code=400,
                            code=ErrorCode.VALIDATION_ERROR.value,
                            message="class_id filter supports only role=all or role=student",
                        )
                    users = data_store.list_students_by_class(normalized_class_id)
                else:
                    users = data_store.list_users_by_school(school_id)
            except BackendUnavailableError as exc:
                raise _service_unavailable() from exc
            filtered_users = self._filter_school_users(
                users=users,
                role_filter=normalized_role,
                status_filter=normalized_status,
                search_filter=normalized_search,
            )
            return SchoolUserListResult(
                users=filtered_users,
                total_in_scope=len(users),
                filtered_total=len(filtered_users),
            )

        if current_user.role == Role.TEACHER:
            if normalized_role not in {"all", Role.STUDENT.value}:
                raise AppError(status_code=403, code=ErrorCode.ROLE_FORBIDDEN.value, message="Teacher can only view students")
            try:
                if normalized_class_id:
                    has_access = data_store.has_teacher_class_assignment(teacher_id=current_user.id, class_id=normalized_class_id)
                    if not has_access:
                        raise AppError(status_code=403, code=ErrorCode.ROLE_FORBIDDEN.value, message="Class assignment required")
                    school_class = data_store.get_class_by_id(normalized_class_id)
                    if not school_class:
                        raise AppError(status_code=404, code=ErrorCode.RESOURCE_NOT_FOUND.value, message="Class not found")
                    if school_class.school_id != school_id:
                        raise AppError(status_code=403, code=ErrorCode.SCHOOL_ACCESS_FORBIDDEN.value, message="Cross-school access denied")
                    users = data_store.list_students_by_class(normalized_class_id)
                else:
                    users = data_store.list_students_by_teacher(current_user.id)
            except BackendUnavailableError as exc:
                raise _service_unavailable() from exc
            filtered_users = self._filter_school_users(
                users=users,
                role_filter=Role.STUDENT.value,
                status_filter=normalized_status,
                search_filter=normalized_search,
            )
            return SchoolUserListResult(
                users=filtered_users,
                total_in_scope=len(users),
                filtered_total=len(filtered_users),
            )

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

    def update_school_user_status(self, *, current_user: User, school_id: str, user_id: str, status: str) -> User:
        if current_user.role != Role.DIRECTOR:
            raise AppError(status_code=403, code=ErrorCode.ROLE_FORBIDDEN.value, message="Only director can update school users")
        if current_user.school_id != school_id:
            raise AppError(status_code=403, code=ErrorCode.SCHOOL_ACCESS_FORBIDDEN.value, message="Cross-school access denied")

        normalized_status = status.strip().lower()
        if normalized_status not in {"active", "inactive", "pending_approval"}:
            raise AppError(status_code=400, code=ErrorCode.VALIDATION_ERROR.value, message="Unsupported status value")

        try:
            data_store = get_data_store()
            target_user = data_store.get_user_by_id(user_id)
        except BackendUnavailableError as exc:
            raise _service_unavailable() from exc
        if not target_user:
            raise AppError(status_code=404, code=ErrorCode.RESOURCE_NOT_FOUND.value, message="User not found")
        if target_user.school_id != school_id:
            raise AppError(status_code=403, code=ErrorCode.SCHOOL_ACCESS_FORBIDDEN.value, message="Cross-school access denied")
        if target_user.role not in (Role.TEACHER, Role.STUDENT, Role.PSYCHOLOGIST, Role.PARENT):
            raise AppError(status_code=403, code=ErrorCode.ROLE_FORBIDDEN.value, message="Cannot update this role")

        status_map = {
            "active": UserStatus.ACTIVE,
            "inactive": UserStatus.INACTIVE,
            "pending_approval": UserStatus.PENDING_APPROVAL,
        }
        target_user.status = status_map[normalized_status]
        try:
            data_store.save_user(target_user)
        except BackendUnavailableError as exc:
            raise _service_unavailable() from exc
        return target_user

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
