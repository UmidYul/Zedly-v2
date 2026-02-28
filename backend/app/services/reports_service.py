from __future__ import annotations

import uuid
from datetime import timedelta
from typing import Any

from app.core.errors import AppError
from app.core.types import ErrorCode, Role
from app.repositories.exceptions import BackendUnavailableError
from app.repositories.models import ReportJob, User, now_utc
from app.repositories.runtime import get_data_store


def _service_unavailable() -> AppError:
    return AppError(status_code=503, code=ErrorCode.SERVICE_UNAVAILABLE.value, message="Storage backend unavailable")


class ReportsService:
    def _save_job(self, job: ReportJob) -> None:
        try:
            get_data_store().save_report_job(job)
        except BackendUnavailableError as exc:
            raise _service_unavailable() from exc

    def _get_job(self, report_id: str) -> ReportJob:
        try:
            job = get_data_store().get_report_job(report_id)
        except BackendUnavailableError as exc:
            raise _service_unavailable() from exc
        if not job:
            raise AppError(status_code=404, code=ErrorCode.RESOURCE_NOT_FOUND.value, message="Report not found")
        return job

    def _ensure_scope_access(self, *, current_user: User, scope_level: str, scope_id: str) -> tuple[str | None, str]:
        if current_user.role == Role.INSPECTOR:
            if scope_level != "district":
                raise AppError(status_code=403, code=ErrorCode.ROLE_FORBIDDEN.value, message="Inspector can generate only district reports")
            if current_user.district_id and scope_id != current_user.district_id:
                raise AppError(status_code=403, code=ErrorCode.SCHOOL_ACCESS_FORBIDDEN.value, message="Inspector cannot access another district")
            return None, scope_id
        if current_user.role == Role.DIRECTOR:
            if scope_level != "school":
                raise AppError(status_code=403, code=ErrorCode.ROLE_FORBIDDEN.value, message="Director can generate only school reports")
            if scope_id != (current_user.school_id or ""):
                raise AppError(status_code=403, code=ErrorCode.SCHOOL_ACCESS_FORBIDDEN.value, message="Cross-school report access denied")
            return current_user.school_id, scope_id
        if current_user.role == Role.MINISTRY:
            if scope_level != "national":
                raise AppError(status_code=403, code=ErrorCode.ROLE_FORBIDDEN.value, message="Ministry can generate only national reports")
            return None, scope_id
        if current_user.role == Role.SUPERADMIN:
            return current_user.school_id, scope_id
        raise AppError(status_code=403, code=ErrorCode.ROLE_FORBIDDEN.value, message="Role cannot generate reports")

    def _ensure_job_access(self, *, current_user: User, job: ReportJob) -> None:
        if current_user.role == Role.SUPERADMIN:
            return
        if current_user.id != job.requested_by_user_id:
            raise AppError(status_code=403, code=ErrorCode.ROLE_FORBIDDEN.value, message="Report belongs to another user")

    def _advance_state_machine(self, job: ReportJob) -> ReportJob:
        if job.status == "queued":
            job.status = "processing"
            job.started_at = now_utc()
            self._save_job(job)
            return job

        if job.status == "processing":
            checks = int(job.params_json.get("status_checks", 0))
            checks += 1
            job.params_json["status_checks"] = checks
            if checks >= 1:
                job.status = "completed"
                job.completed_at = now_utc()
                job.expires_at = job.completed_at + timedelta(days=7)
                job.result_url = f"https://r2.zedly.local/reports/{job.id}.{job.format}"
            self._save_job(job)
        return job

    def generate_report(
        self,
        *,
        current_user: User,
        scope_level: str,
        scope_id: str,
        template_key: str,
        format: str,
        params: dict[str, Any] | None,
    ) -> ReportJob:
        school_id, normalized_scope_id = self._ensure_scope_access(
            current_user=current_user,
            scope_level=scope_level,
            scope_id=scope_id,
        )
        created_at = now_utc()
        job = ReportJob(
            id=f"rpt_{uuid.uuid4().hex[:12]}",
            school_id=school_id,
            requested_by_user_id=current_user.id,
            scope_level=scope_level,
            scope_id=normalized_scope_id,
            template_key=template_key,
            format=format,
            status="queued",
            params_json={**(params or {}), "status_checks": 0},
            created_at=created_at,
        )
        self._save_job(job)
        return job

    def get_status(self, *, current_user: User, report_id: str) -> dict[str, Any]:
        job = self._get_job(report_id)
        self._ensure_job_access(current_user=current_user, job=job)
        job = self._advance_state_machine(job)
        return {
            "report_id": job.id,
            "status": job.status,
            "scope_level": job.scope_level,
            "scope_id": job.scope_id,
            "format": job.format,
            "created_at": job.created_at.isoformat(),
            "started_at": job.started_at.isoformat() if job.started_at else None,
            "completed_at": job.completed_at.isoformat() if job.completed_at else None,
            "expires_at": job.expires_at.isoformat() if job.expires_at else None,
            "download_url": f"/reports/{job.id}/download" if job.status == "completed" else None,
            "error_code": job.error_code,
        }

    def get_download_url(self, *, current_user: User, report_id: str) -> str:
        job = self._get_job(report_id)
        self._ensure_job_access(current_user=current_user, job=job)
        job = self._advance_state_machine(job)
        if job.status != "completed" or not job.result_url:
            raise AppError(
                status_code=409,
                code=ErrorCode.VALIDATION_ERROR.value,
                message="Report is not ready",
                details={"status": job.status, "poll_url": f"/reports/{job.id}/status"},
            )
        if job.expires_at and job.expires_at <= now_utc():
            raise AppError(status_code=404, code=ErrorCode.RESOURCE_NOT_FOUND.value, message="Report is expired")
        return job.result_url


service = ReportsService()
