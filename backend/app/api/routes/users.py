from __future__ import annotations

from fastapi import APIRouter, Depends, Request

from app.core.errors import AppError
from app.middleware.chain import (
    AuthContext,
    audit_trail,
    authenticate,
    enforce_assignment_scope,
    enforce_school_scope,
    require_permission,
)
from app.core.types import ErrorCode
from app.schemas.users import (
    ClassInviteResponse,
    PatchMeRequest,
    RegisterUserRequest,
    RegisterUserResponse,
    SchoolUserPatchRequest,
    SchoolUsersResponse,
    UserResponse,
)
from app.services.auth_service import service as auth_service
from app.services.users_service import service as users_service


router = APIRouter(tags=["users"])


@router.post("/users/register", response_model=RegisterUserResponse, status_code=201)
def register_user(payload: RegisterUserRequest, request: Request) -> RegisterUserResponse:
    if payload.role != "teacher":
        raise AppError(status_code=400, code=ErrorCode.VALIDATION_ERROR.value, message="Only teacher registration is supported")
    user = auth_service.register_teacher(
        full_name=payload.full_name,
        email=payload.email,
        password=payload.password,
        subject=payload.subject,
        school_id=payload.school.school_id,
        school_name=payload.school.name,
        onboarding_token=payload.onboarding_token,
        ip=request.client.host if request.client else None,
    )
    return RegisterUserResponse(
        user_id=user.id,
        role=user.role.value,
        school_id=user.school_id,
        status=user.status.value,
        message="Registration submitted. Wait for school approval.",
    )


@router.get("/users/me", response_model=UserResponse)
def get_me(auth: AuthContext = Depends(authenticate)) -> UserResponse:
    user = users_service.get_me(auth.user)
    return UserResponse(
        id=user.id,
        school_id=user.school_id,
        role=user.role.value,
        full_name=user.full_name,
        email=user.email,
        phone=user.phone,
        telegram_id=user.telegram_id,
        status=user.status.value,
        language=user.language,
    )


@router.patch("/users/me", response_model=UserResponse)
def patch_me(payload: PatchMeRequest, auth: AuthContext = Depends(authenticate)) -> UserResponse:
    user = users_service.patch_me(user=auth.user, payload=payload.model_dump(exclude_none=False))
    return UserResponse(
        id=user.id,
        school_id=user.school_id,
        role=user.role.value,
        full_name=user.full_name,
        email=user.email,
        phone=user.phone,
        telegram_id=user.telegram_id,
        status=user.status.value,
        language=user.language,
    )


@router.get("/schools/{school_id}/users", response_model=SchoolUsersResponse)
def get_school_users(
    school_id: str,
    request: Request,
    auth: AuthContext = Depends(require_permission("view_school_user_list")),
) -> SchoolUsersResponse:
    enforce_school_scope(auth=auth, target_school_id=school_id, resource_id=school_id, request=request)
    users = users_service.list_school_users(current_user=auth.user, school_id=school_id)
    audit_trail(event="users.school.list", auth=auth, resource_id=school_id, request=request)
    return SchoolUsersResponse(
        school_id=school_id,
        users=[
            UserResponse(
                id=user.id,
                school_id=user.school_id,
                role=user.role.value,
                full_name=user.full_name,
                email=user.email,
                phone=user.phone,
                telegram_id=user.telegram_id,
                status=user.status.value,
                language=user.language,
            )
            for user in users
        ],
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
    return UserResponse(
        id=updated.id,
        school_id=updated.school_id,
        role=updated.role.value,
        full_name=updated.full_name,
        email=updated.email,
        phone=updated.phone,
        telegram_id=updated.telegram_id,
        status=updated.status.value,
        language=updated.language,
    )
