from __future__ import annotations

from functools import lru_cache

from app.core.settings import settings
from app.repositories.data_store import DataStore, InMemoryDataStore, PostgresDataStore
from app.repositories.exceptions import BackendUnavailableError
from app.repositories.session_store import InMemorySessionStore, RedisSessionStore, SessionStore


@lru_cache(maxsize=1)
def get_data_store() -> DataStore:
    backend = settings.storage_backend
    if backend == "postgres":
        if not settings.database_url:
            raise BackendUnavailableError("ZEDLY_DATABASE_URL is required for postgres backend")
        return PostgresDataStore(settings.database_url)
    return InMemoryDataStore()


@lru_cache(maxsize=1)
def get_session_store() -> SessionStore:
    backend = settings.sessions_backend
    if backend == "redis":
        if not settings.redis_url:
            raise BackendUnavailableError("ZEDLY_REDIS_URL is required for redis sessions backend")
        return RedisSessionStore(settings.redis_url)
    return InMemorySessionStore()


def reset_runtime_backends() -> None:
    data = get_data_store()
    sessions = get_session_store()
    data.reset()
    sessions.reset()
