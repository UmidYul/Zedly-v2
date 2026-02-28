from __future__ import annotations

import os
from dataclasses import dataclass


def _to_bool(value: str | None, *, default: bool) -> bool:
    if value is None:
        return default
    normalized = value.strip().lower()
    if normalized in {"1", "true", "yes", "on"}:
        return True
    if normalized in {"0", "false", "no", "off"}:
        return False
    return default


@dataclass(frozen=True, slots=True)
class Settings:
    storage_backend: str
    sessions_backend: str
    database_url: str | None
    redis_url: str | None
    postgres_connect_timeout_seconds: int
    postgres_statement_timeout_ms: int
    redis_default_ttl_seconds: int
    security_alert_threshold_per_5m: int
    security_ip_block_seconds: int
    debug_sql: bool
    feature_offline_enabled: bool
    feature_analytics_snapshots_enabled: bool
    auth_refresh_cookie_name: str
    auth_refresh_cookie_secure: bool
    auth_refresh_cookie_samesite: str
    auth_refresh_cookie_path: str
    auth_refresh_cookie_domain: str | None


def load_settings() -> Settings:
    raw_samesite = os.getenv("ZEDLY_AUTH_REFRESH_COOKIE_SAMESITE", "lax").strip().lower()
    allowed_samesite = {"lax", "strict", "none"}
    normalized_samesite = raw_samesite if raw_samesite in allowed_samesite else "lax"
    cookie_domain = os.getenv("ZEDLY_AUTH_REFRESH_COOKIE_DOMAIN")
    if cookie_domain is not None:
        cookie_domain = cookie_domain.strip() or None

    return Settings(
        storage_backend=os.getenv("ZEDLY_STORAGE_BACKEND", "memory").strip().lower(),
        sessions_backend=os.getenv("ZEDLY_SESSIONS_BACKEND", "memory").strip().lower(),
        database_url=os.getenv("ZEDLY_DATABASE_URL"),
        redis_url=os.getenv("ZEDLY_REDIS_URL"),
        postgres_connect_timeout_seconds=int(os.getenv("ZEDLY_PG_CONNECT_TIMEOUT_SECONDS", "5")),
        postgres_statement_timeout_ms=int(os.getenv("ZEDLY_PG_STATEMENT_TIMEOUT_MS", "5000")),
        redis_default_ttl_seconds=int(os.getenv("ZEDLY_REDIS_DEFAULT_TTL_SECONDS", "2592000")),
        security_alert_threshold_per_5m=int(os.getenv("ZEDLY_SECURITY_ALERT_THRESHOLD_PER_5M", "10")),
        security_ip_block_seconds=int(os.getenv("ZEDLY_SECURITY_IP_BLOCK_SECONDS", "86400")),
        debug_sql=_to_bool(os.getenv("ZEDLY_DEBUG_SQL"), default=False),
        feature_offline_enabled=_to_bool(os.getenv("ZEDLY_FEATURE_OFFLINE_ENABLED"), default=True),
        feature_analytics_snapshots_enabled=_to_bool(os.getenv("ZEDLY_FEATURE_ANALYTICS_SNAPSHOTS_ENABLED"), default=True),
        auth_refresh_cookie_name=os.getenv("ZEDLY_AUTH_REFRESH_COOKIE_NAME", "zedly_rt").strip() or "zedly_rt",
        auth_refresh_cookie_secure=_to_bool(os.getenv("ZEDLY_AUTH_REFRESH_COOKIE_SECURE"), default=False),
        auth_refresh_cookie_samesite=normalized_samesite,
        auth_refresh_cookie_path=os.getenv("ZEDLY_AUTH_REFRESH_COOKIE_PATH", "/").strip() or "/",
        auth_refresh_cookie_domain=cookie_domain,
    )


settings = load_settings()
