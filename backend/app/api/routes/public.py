from __future__ import annotations

from fastapi import APIRouter

from app.core.types import Role
from app.repositories.runtime import get_data_store
from app.schemas.public import LandingStatsPayload, LandingStatsResponse, PublicFeedbackRequest


router = APIRouter(prefix="/api/public", tags=["public"])


@router.get("/landing-stats", response_model=LandingStatsResponse)
def get_landing_stats() -> LandingStatsResponse:
    data_store = get_data_store()
    schools = data_store.list_schools()
    total_schools = len(schools)

    total_users = 0
    class_ids: set[str] = set()

    for school in schools:
        users = data_store.list_users_by_school(school.id)
        total_users += len(users)
        for user in users:
            if user.role != Role.TEACHER:
                continue
            for school_class in data_store.list_classes_by_teacher(user.id):
                class_ids.add(school_class.id)

    return LandingStatsResponse(
        stats=LandingStatsPayload(
            total_users=total_users,
            total_schools=total_schools,
            total_classes=len(class_ids),
        )
    )


@router.post("/feedback", status_code=202)
def submit_public_feedback(payload: PublicFeedbackRequest) -> dict[str, str]:
    _ = payload
    return {"status": "accepted"}

