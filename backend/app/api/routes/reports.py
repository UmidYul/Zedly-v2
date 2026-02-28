from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from fastapi.responses import RedirectResponse

from app.core.errors import AppError
from app.core.types import ErrorCode
from app.middleware.chain import AuthContext, audit_trail, authenticate
from app.schemas.analytics import ReportGenerateRequest, ReportGenerateResponse, ReportStatusResponse
from app.services.reports_service import service as reports_service


router = APIRouter(prefix="/reports", tags=["reports"])


def _assert_report_generation_permission(auth: AuthContext) -> None:
    allowed = {"generate_roono_report", "generate_school_report", "generate_national_report"}
    if auth.permissions.isdisjoint(allowed):
        raise AppError(status_code=403, code=ErrorCode.ROLE_FORBIDDEN.value, message="Report generation is forbidden for role")


@router.post("/generate", response_model=ReportGenerateResponse, status_code=202)
def generate_report(
    payload: ReportGenerateRequest,
    request: Request,
    auth: AuthContext = Depends(authenticate),
) -> ReportGenerateResponse:
    _assert_report_generation_permission(auth)
    job = reports_service.generate_report(
        current_user=auth.user,
        scope_level=payload.scope_level,
        scope_id=payload.scope_id,
        template_key=payload.template_key,
        format=payload.format,
        params=payload.params,
    )
    audit_trail(event="reports.generate", auth=auth, resource_id=job.id, request=request, details={"scope_level": payload.scope_level})
    return ReportGenerateResponse(
        report_id=job.id,
        status=job.status,
        poll_url=f"/reports/{job.id}/status",
    )


@router.get("/{report_id}/status", response_model=ReportStatusResponse)
def report_status(
    report_id: str,
    request: Request,
    auth: AuthContext = Depends(authenticate),
) -> ReportStatusResponse:
    payload = reports_service.get_status(current_user=auth.user, report_id=report_id)
    audit_trail(event="reports.status", auth=auth, resource_id=report_id, request=request, details={"status": payload["status"]})
    return ReportStatusResponse(**payload)


@router.get("/{report_id}/download")
def report_download(
    report_id: str,
    request: Request,
    auth: AuthContext = Depends(authenticate),
):
    url = reports_service.get_download_url(current_user=auth.user, report_id=report_id)
    audit_trail(event="reports.download", auth=auth, resource_id=report_id, request=request)
    return RedirectResponse(url=url, status_code=302)
