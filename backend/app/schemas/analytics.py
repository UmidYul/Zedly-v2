from __future__ import annotations

from pydantic import BaseModel


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
