from __future__ import annotations

from fastapi import APIRouter, Depends, Query, Request

from app.core.errors import AppError
from app.core.types import ErrorCode, Role
from app.middleware.chain import (
    AuthContext,
    audit_trail,
    authenticate,
    enforce_assignment_scope,
    enforce_school_scope,
    require_permission,
)
from app.repositories.models import User
from app.schemas.users import (
    AccountProvisionRequest,
    AccountProvisionResponse,
    ClassInviteResponse,
    LoginMethodsResponse,
    PatchMeRequest,
    SchoolUserPatchRequest,
    SchoolUsersResponse,
    TeacherClassRef,
    UserResponse,
)
from app.services.auth_service import service as auth_service
from app.services.users_service import service as users_service


router = APIRouter(tags=["users"])


def _to_user_response(*, user: User, include_teacher_classes: bool = False) -> UserResponse:
    teacher_classes: list[TeacherClassRef] | None = None
    if include_teacher_classes and user.role == Role.TEACHER:
        classes = users_service.list_teacher_classes(user=user)
        teacher_classes = [TeacherClassRef(class_id=value.id, class_name=value.name) for value in classes]
    return UserResponse(
        id=user.id,
        school_id=user.school_id,
        role=user.role.value,
        full_name=user.full_name,
        login=user.login,
        email=user.email,
        phone=user.phone,
        status=user.status.value,
        language=user.language,
        avatar_url=user.avatar_url,
        teacher_classes=teacher_classes,
        login_methods=[
            value
            for value, enabled in (
                ("google", user.google_linked),
                ("telegram", user.telegram_linked),
                ("password", user.password_hash is not None),
            )
            if enabled
        ],
    )


@router.post("/users/provision", response_model=AccountProvisionResponse, status_code=201)
def provision_user(
    payload: AccountProvisionRequest,
    request: Request,
    auth: AuthContext = Depends(authenticate),
) -> AccountProvisionResponse:
    result = auth_service.provision_account(
        actor=auth.user,
        role=payload.role,
        full_name=payload.full_name,
        school_id=payload.school_id,
        district_id=payload.district_id,
        class_id=payload.class_id,
        class_name=payload.class_name,
        subject=payload.subject,
        email=payload.email,
        phone=payload.phone,
        ip=request.client.host if request.client else None,
    )
    return AccountProvisionResponse(**result)


@router.get("/users/me", response_model=UserResponse)
def get_me(auth: AuthContext = Depends(authenticate)) -> UserResponse:
    user = users_service.get_me(auth.user)
    return _to_user_response(user=user, include_teacher_classes=True)


@router.patch("/users/me", response_model=UserResponse)
def patch_me(payload: PatchMeRequest, auth: AuthContext = Depends(authenticate)) -> UserResponse:
    user = users_service.patch_me(user=auth.user, payload=payload.model_dump(exclude_none=False))
    return _to_user_response(user=user, include_teacher_classes=True)


@router.get("/users/me/login-methods", response_model=LoginMethodsResponse)
def get_login_methods(auth: AuthContext = Depends(authenticate)) -> LoginMethodsResponse:
    return LoginMethodsResponse(
        google_connected=bool(auth.user.google_linked),
        telegram_connected=bool(auth.user.telegram_linked),
    )


@router.post("/users/me/login-methods/google/connect", response_model=LoginMethodsResponse)
def connect_google_login(auth: AuthContext = Depends(authenticate)) -> LoginMethodsResponse:
    auth.user.google_linked = True
    users_service.patch_me(user=auth.user, payload={})
    return LoginMethodsResponse(
        google_connected=True,
        telegram_connected=bool(auth.user.telegram_linked),
    )


@router.post("/users/me/login-methods/telegram/connect", response_model=LoginMethodsResponse)
def connect_telegram_login(auth: AuthContext = Depends(authenticate)) -> LoginMethodsResponse:
    auth.user.telegram_linked = True
    users_service.patch_me(user=auth.user, payload={})
    return LoginMethodsResponse(
        google_connected=bool(auth.user.google_linked),
        telegram_connected=True,
    )


@router.get("/schools/{school_id}/users", response_model=SchoolUsersResponse)
def get_school_users(
    school_id: str,
    request: Request,
    role: str = Query(default="all"),
    status: str = Query(default="all"),
    search: str | None = Query(default=None),
    class_id: str | None = Query(default=None),
    auth: AuthContext = Depends(require_permission("view_school_user_list")),
) -> SchoolUsersResponse:
    enforce_school_scope(auth=auth, target_school_id=school_id, resource_id=school_id, request=request)
    result = users_service.list_school_users(
        current_user=auth.user,
        school_id=school_id,
        role_filter=role,
        status_filter=status,
        search=search,
        class_id=class_id,
    )
    audit_trail(
        event="users.school.list",
        auth=auth,
        resource_id=school_id,
        request=request,
        details={
            "role": role,
            "status": status,
            "class_id": class_id,
            "search": search,
            "filtered_total": result.filtered_total,
        },
    )
    return SchoolUsersResponse(
        school_id=school_id,
        users=[_to_user_response(user=user) for user in result.users],
        total_in_scope=result.total_in_scope,
        filtered_total=result.filtered_total,
        role=role,
        status=status,
        class_id=class_id,
        search=search,
    )


@router.post("/classes/{class_id}/invite", response_model=ClassInviteResponse)
def invite_class(
    class_id: str,
    request: Request,
    auth: AuthContext = Depends(require_permission("invite_students_to_class")),
) -> ClassInviteResponse:
    school_class = users_service.create_class_invite(current_user=auth.user, class_id=class_id)
    enforce_school_scope(auth=auth, target_school_id=school_class.school_id, resource_id=class_id, request=request)
    enforce_assignment_scope(auth=auth, class_id=class_id)
    audit_trail(event="class.invite.created", auth=auth, resource_id=class_id, request=request)
    return ClassInviteResponse(
        class_id=class_id,
        code=school_class.code,
        expires_at=school_class.expires_at.isoformat(),
    )


@router.patch("/schools/{school_id}/users/{user_id}", response_model=UserResponse)
def patch_school_user(
    school_id: str,
    user_id: str,
    payload: SchoolUserPatchRequest,
    request: Request,
    auth: AuthContext = Depends(require_permission("manage_school_users")),
) -> UserResponse:
    enforce_school_scope(auth=auth, target_school_id=school_id, resource_id=user_id, request=request)
    updated = users_service.update_school_user_status(
        current_user=auth.user,
        school_id=school_id,
        user_id=user_id,
        status=payload.status,
    )
    audit_trail(event="users.school.patch", auth=auth, resource_id=user_id, request=request, details={"status": updated.status.value})
    return _to_user_response(user=updated)
