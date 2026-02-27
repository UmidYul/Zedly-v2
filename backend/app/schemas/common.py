from __future__ import annotations

from pydantic import BaseModel, Field


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in_seconds: int = Field(default=900)


class MessageResponse(BaseModel):
    message: str
