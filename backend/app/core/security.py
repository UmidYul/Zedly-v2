from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timezone
from typing import Any

import bcrypt
import jwt

from app.core.constants import JWT_ALGORITHM, JWT_SECRET
from app.core.errors import AppError
from app.core.types import ErrorCode


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def to_unix(dt: datetime) -> int:
    return int(dt.timestamp())


def hash_password(plain_password: str) -> str:
    return bcrypt.hashpw(plain_password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))


def create_access_token(payload: dict[str, Any]) -> str:
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_access_token(token: str) -> dict[str, Any]:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError as exc:
        raise AppError(status_code=401, code=ErrorCode.TOKEN_EXPIRED.value, message="Access token expired") from exc
    except jwt.PyJWTError as exc:
        raise AppError(status_code=401, code=ErrorCode.UNAUTHORIZED.value, message="Invalid access token") from exc


def generate_refresh_token() -> str:
    return secrets.token_urlsafe(48)


def hash_refresh_token(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def generate_code(length: int = 6) -> str:
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    return "".join(secrets.choice(alphabet) for _ in range(length))
