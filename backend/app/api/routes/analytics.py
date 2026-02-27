from __future__ import annotations

from fastapi import APIRouter, Depends, Query, Request

from app.core.errors import AppError
from app.core.settings import settings
from app.core.types import ErrorCode
from app.middleware.chain import AuthContext, audit_trail, enforce_feature, require_permission
from app.schemas.analytics import DirectorDashboardResponse, TeacherDashboardResponse
from app.services.analytics_service import service as analytics_service


router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/teacher/dashboard", response_model=TeacherDashboardResponse)
def teacher_dashboard(
    request: Request,
    period: str = Query(default="month"),
    class_id: str | None = Query(default=None),
    auth: AuthContext = Depends(require_permission("view_class_analytics")),
) -> TeacherDashboardResponse:
    if not settings.feature_analytics_snapshots_enabled:
        raise AppError(status_code=403, code=ErrorCode.ROLE_FORBIDDEN.value, message="Analytics snapshots feature is disabled")
    payload = analytics_service.teacher_dashboard(current_user=auth.user, period=period, class_id=class_id)
    audit_trail(event="analytics.teacher.dashboard", auth=auth, resource_id=class_id, request=request)
    return TeacherDashboardResponse(**payload)


@router.get("/director/dashboard", response_model=DirectorDashboardResponse)
def director_dashboard(
    request: Request,
    period: str = Query(default="month"),
    auth: AuthContext = Depends(require_permission("view_school_analytics")),
) -> DirectorDashboardResponse:
    if not settings.feature_analytics_snapshots_enabled:
        raise AppError(status_code=403, code=ErrorCode.ROLE_FORBIDDEN.value, message="Analytics snapshots feature is disabled")
    enforce_feature("DIRECTOR_SCHOOL_ANALYTICS", auth)
    payload = analytics_service.director_dashboard(current_user=auth.user, period=period)
    audit_trail(event="analytics.director.dashboard", auth=auth, resource_id=auth.user.school_id, request=request)
    return DirectorDashboardResponse(**payload)
