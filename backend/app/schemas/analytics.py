from __future__ import annotations

from pydantic import BaseModel, Field


class TeacherDashboardResponse(BaseModel):
    teacher_id: str
    school_id: str
    period: str
    class_average: float
    completed_sessions: int
    weak_topics: list[dict]
    snapshot_updated_at: str


class DirectorDashboardResponse(BaseModel):
    director_id: str
    school_id: str
    period: str
    school_average: float
    active_teachers_rate: float
    conversion_trigger: bool
    conversion_message: str | None = None
    snapshot_updated_at: str


class InspectorRankingItem(BaseModel):
    school_id: str
    school_name: str
    score: float


class InspectorDashboardResponse(BaseModel):
    inspector_id: str
    district_id: str
    period: str
    schools_total: int
    schools_with_data: int
    district_average: float
    ranking: list[InspectorRankingItem]
    snapshot_updated_at: str


class ReportGenerateRequest(BaseModel):
    scope_level: str
    scope_id: str
    template_key: str
    format: str = "pdf"
    params: dict = Field(default_factory=dict)


class ReportGenerateResponse(BaseModel):
    report_id: str
    status: str
    poll_url: str


class ReportStatusResponse(BaseModel):
    report_id: str
    status: str
    scope_level: str
    scope_id: str
    format: str
    created_at: str
    started_at: str | None = None
    completed_at: str | None = None
    expires_at: str | None = None
    download_url: str | None = None
    error_code: str | None = None
