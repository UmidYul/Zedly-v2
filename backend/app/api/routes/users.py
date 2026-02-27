from __future__ import annotations

from fastapi import APIRouter, Depends, Request

from app.middleware.chain import (
    AuthContext,
    audit_trail,
    authenticate,
    enforce_assignment_scope,
    enforce_feature,
    enforce_school_scope,
    require_permission,
)
from app.schemas.users import (
    ClassInviteResponse,
    PatchMeRequest,
    SchoolUsersResponse,
    TestCreateRequest,
    TestCreateResponse,
    UserResponse,
)
from app.services.users_service import service as users_service


router = APIRouter(tags=["users"])


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


@router.post("/tests", response_model=TestCreateResponse)
def create_test(
    payload: TestCreateRequest,
    request: Request,
    auth: AuthContext = Depends(require_permission("create_test")),
) -> TestCreateResponse:
    # Cross-school body field is intentionally ignored; source of truth is JWT school_id.
    test = users_service.create_test(current_user=auth.user, title=payload.title, mode=payload.mode)
    enforce_school_scope(auth=auth, target_school_id=test.school_id, resource_id=test.id, request=request)
    audit_trail(event="test.created", auth=auth, resource_id=test.id, request=request)
    return TestCreateResponse(
        id=test.id,
        title=test.title,
        school_id=test.school_id,
        teacher_id=test.teacher_id,
        mode=test.mode,
        status=test.status,
    )
