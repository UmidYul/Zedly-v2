from __future__ import annotations

from pydantic import BaseModel, Field, field_validator


class LandingStatsPayload(BaseModel):
    total_users: int = 0
    total_schools: int = 0
    total_classes: int = 0


class LandingStatsResponse(BaseModel):
    stats: LandingStatsPayload


class PublicFeedbackRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: str = Field(min_length=3, max_length=320)
    message: str = Field(min_length=1, max_length=5000)
    lang: str = Field(default="ru", min_length=2, max_length=5)

    @field_validator("email")
    @classmethod
    def _validate_email(cls, value: str) -> str:
        candidate = value.strip()
        if "@" not in candidate or candidate.startswith("@") or candidate.endswith("@"):
            raise ValueError("Invalid email")
        return candidate
