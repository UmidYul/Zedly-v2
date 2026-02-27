from __future__ import annotations

import json
import time
from abc import ABC, abstractmethod
from datetime import datetime, timezone

from app.core.constants import REFRESH_TOKEN_TTL
from app.repositories.exceptions import BackendUnavailableError
from app.repositories.memory_store import store
from app.repositories.models import RefreshRecord

try:
    import redis
except Exception:  # pragma: no cover - optional dependency in memory mode
    redis = None


def _dt_to_unix(value: datetime) -> int:
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return int(value.timestamp())


def _unix_to_dt(value: str | int | float) -> datetime:
    return datetime.fromtimestamp(int(float(value)), tz=timezone.utc)


class SessionStore(ABC):
    @abstractmethod
    def get_blocked_ip_until(self, ip: str) -> int | None:
        raise NotImplementedError

    @abstractmethod
    def block_ip(self, ip: str, block_seconds: int) -> None:
        raise NotImplementedError

    @abstractmethod
    def record_cross_school_attempt(self, ip: str, *, window_seconds: int = 300) -> int:
        raise NotImplementedError

    @abstractmethod
    def is_access_token_blacklisted(self, jti: str) -> bool:
        raise NotImplementedError

    @abstractmethod
    def blacklist_access_token(self, jti: str, ttl_seconds: int) -> None:
        raise NotImplementedError

    @abstractmethod
    def get_recent_login_attempts(self, identity: str, *, window_seconds: int) -> list[int]:
        raise NotImplementedError

    @abstractmethod
    def record_failed_login(self, identity: str) -> None:
        raise NotImplementedError

    @abstractmethod
    def clear_failed_logins(self, identity: str) -> None:
        raise NotImplementedError

    @abstractmethod
    def save_refresh_record(self, record: RefreshRecord) -> None:
        raise NotImplementedError

    @abstractmethod
    def get_refresh_record(self, token_hash: str) -> RefreshRecord | None:
        raise NotImplementedError

    @abstractmethod
    def pop_refresh_record(self, token_hash: str) -> RefreshRecord | None:
        raise NotImplementedError

    @abstractmethod
    def mark_refresh_used(self, token_hash: str, family_id: str) -> None:
        raise NotImplementedError

    @abstractmethod
    def get_used_refresh_family(self, token_hash: str) -> str | None:
        raise NotImplementedError

    @abstractmethod
    def mark_family_revoked(self, family_id: str) -> None:
        raise NotImplementedError

    @abstractmethod
    def is_family_revoked(self, family_id: str) -> bool:
        raise NotImplementedError

    @abstractmethod
    def list_family_tokens(self, family_id: str) -> list[str]:
        raise NotImplementedError

    @abstractmethod
    def list_user_tokens(self, user_id: str) -> list[str]:
        raise NotImplementedError

    @abstractmethod
    def save_onboarding_token(self, token: str, payload: dict, ttl_seconds: int) -> None:
        raise NotImplementedError

    @abstractmethod
    def pop_onboarding_token(self, token: str) -> dict | None:
        raise NotImplementedError

    @abstractmethod
    def publish_event(self, stream: str, event_type: str, payload: dict) -> str:
        raise NotImplementedError

    @abstractmethod
    def read_events(self, stream: str, start_id: str, *, count: int = 100, block_ms: int = 0) -> list[tuple[str, dict]]:
        raise NotImplementedError

    @abstractmethod
    def reset(self) -> None:
        raise NotImplementedError


class InMemorySessionStore(SessionStore):
    def get_blocked_ip_until(self, ip: str) -> int | None:
        return store.blocked_ips.get(ip)

    def block_ip(self, ip: str, block_seconds: int) -> None:
        store.blocked_ips[ip] = int(time.time()) + block_seconds

    def record_cross_school_attempt(self, ip: str, *, window_seconds: int = 300) -> int:
        now_ts = int(time.time())
        attempts = store.cross_school_attempts.setdefault(ip, [])
        attempts.append(now_ts)
        threshold = now_ts - window_seconds
        filtered = [value for value in attempts if value >= threshold]
        store.cross_school_attempts[ip] = filtered
        return len(filtered)

    def is_access_token_blacklisted(self, jti: str) -> bool:
        return jti in store.access_jti_blacklist

    def blacklist_access_token(self, jti: str, ttl_seconds: int) -> None:
        _ = ttl_seconds
        store.access_jti_blacklist.add(jti)

    def get_recent_login_attempts(self, identity: str, *, window_seconds: int) -> list[int]:
        now_ts = int(time.time())
        threshold = now_ts - window_seconds
        attempts = [value for value in store.login_attempts_by_identity.get(identity, []) if value >= threshold]
        store.login_attempts_by_identity[identity] = attempts
        return attempts

    def record_failed_login(self, identity: str) -> None:
        store.login_attempts_by_identity.setdefault(identity, []).append(int(time.time()))

    def clear_failed_logins(self, identity: str) -> None:
        store.login_attempts_by_identity.pop(identity, None)

    def save_refresh_record(self, record: RefreshRecord) -> None:
        store.refresh_tokens[record.token_hash] = record
        store.refresh_family_index.setdefault(record.family_id, set()).add(record.token_hash)
        store.refresh_user_index.setdefault(record.user_id, set()).add(record.token_hash)

    def get_refresh_record(self, token_hash: str) -> RefreshRecord | None:
        return store.refresh_tokens.get(token_hash)

    def pop_refresh_record(self, token_hash: str) -> RefreshRecord | None:
        record = store.refresh_tokens.pop(token_hash, None)
        if not record:
            return None
        store.refresh_family_index.get(record.family_id, set()).discard(token_hash)
        store.refresh_user_index.get(record.user_id, set()).discard(token_hash)
        return record

    def mark_refresh_used(self, token_hash: str, family_id: str) -> None:
        store.used_refresh_tokens.add(token_hash)
        store.used_refresh_token_family[token_hash] = family_id

    def get_used_refresh_family(self, token_hash: str) -> str | None:
        return store.used_refresh_token_family.get(token_hash) if token_hash in store.used_refresh_tokens else None

    def mark_family_revoked(self, family_id: str) -> None:
        store.revoked_families.add(family_id)

    def is_family_revoked(self, family_id: str) -> bool:
        return family_id in store.revoked_families

    def list_family_tokens(self, family_id: str) -> list[str]:
        return list(store.refresh_family_index.get(family_id, set()))

    def list_user_tokens(self, user_id: str) -> list[str]:
        return list(store.refresh_user_index.get(user_id, set()))

    def save_onboarding_token(self, token: str, payload: dict, ttl_seconds: int) -> None:
        expires_at = int(time.time()) + ttl_seconds
        value = dict(payload)
        value["_expires_at"] = expires_at
        store.onboarding_tokens[token] = value

    def pop_onboarding_token(self, token: str) -> dict | None:
        record = store.onboarding_tokens.pop(token, None)
        if not record:
            return None
        expires_at = int(record.get("_expires_at", 0))
        if expires_at and expires_at <= int(time.time()):
            return None
        record.pop("_expires_at", None)
        return record

    def publish_event(self, stream: str, event_type: str, payload: dict) -> str:
        entries = store.event_streams.setdefault(stream, [])
        event_id = f"{int(time.time() * 1000)}-{len(entries)}"
        data = {"type": event_type, **payload}
        entries.append((event_id, data))
        return event_id

    def read_events(self, stream: str, start_id: str, *, count: int = 100, block_ms: int = 0) -> list[tuple[str, dict]]:
        _ = block_ms
        entries = store.event_streams.get(stream, [])
        if start_id == "$":
            return entries[-count:]
        result: list[tuple[str, dict]] = []
        for entry_id, payload in entries:
            if entry_id > start_id:
                result.append((entry_id, payload))
            if len(result) >= count:
                break
        return result

    def reset(self) -> None:
        return None


class RedisSessionStore(SessionStore):
    def __init__(self, redis_url: str) -> None:
        if redis is None:
            raise BackendUnavailableError("redis package is not installed")
        try:
            self.client = redis.Redis.from_url(redis_url, decode_responses=True)
            self.client.ping()
        except Exception as exc:  # pragma: no cover - integration failure path
            raise BackendUnavailableError(f"redis unavailable: {exc}") from exc

    def _safe(self, fn):
        try:
            return fn()
        except Exception as exc:  # pragma: no cover - integration failure path
            raise BackendUnavailableError(f"redis unavailable: {exc}") from exc

    def _refresh_key(self, token_hash: str) -> str:
        return f"refresh:{token_hash}"

    def _family_tokens_key(self, family_id: str) -> str:
        return f"refresh_family_tokens:{family_id}"

    def _user_sessions_key(self, user_id: str) -> str:
        return f"user_sessions:{user_id}"

    def _used_refresh_key(self, token_hash: str) -> str:
        return f"used_refresh:{token_hash}"

    def _revoked_family_key(self, family_id: str) -> str:
        return f"refresh_family_revoked:{family_id}"

    def _cross_school_key(self, ip: str) -> str:
        return f"cross_school_attempts:{ip}"

    def _blocked_ip_key(self, ip: str) -> str:
        return f"blocked_ip:{ip}"

    def _login_attempts_key(self, identity: str) -> str:
        return f"login_attempts:{identity}"

    def _blacklist_key(self, jti: str) -> str:
        return f"access_blacklist:{jti}"

    def get_blocked_ip_until(self, ip: str) -> int | None:
        def _impl():
            value = self.client.get(self._blocked_ip_key(ip))
            if not value:
                return None
            return int(value)

        return self._safe(_impl)

    def block_ip(self, ip: str, block_seconds: int) -> None:
        def _impl():
            expires_at = int(time.time()) + block_seconds
            self.client.setex(self._blocked_ip_key(ip), block_seconds, expires_at)

        self._safe(_impl)

    def record_cross_school_attempt(self, ip: str, *, window_seconds: int = 300) -> int:
        def _impl():
            now_ts = int(time.time())
            key = self._cross_school_key(ip)
            member = f"{now_ts}:{time.time_ns()}"
            with self.client.pipeline() as pipe:
                pipe.zadd(key, {member: now_ts})
                pipe.zremrangebyscore(key, 0, now_ts - window_seconds)
                pipe.expire(key, window_seconds + 60)
                pipe.zcard(key)
                results = pipe.execute()
            return int(results[-1])

        return self._safe(_impl)

    def is_access_token_blacklisted(self, jti: str) -> bool:
        return bool(self._safe(lambda: self.client.exists(self._blacklist_key(jti))))

    def blacklist_access_token(self, jti: str, ttl_seconds: int) -> None:
        ttl = max(ttl_seconds, 1)
        self._safe(lambda: self.client.setex(self._blacklist_key(jti), ttl, "1"))

    def get_recent_login_attempts(self, identity: str, *, window_seconds: int) -> list[int]:
        def _impl():
            now_ts = int(time.time())
            key = self._login_attempts_key(identity)
            self.client.zremrangebyscore(key, 0, now_ts - window_seconds)
            members = self.client.zrange(key, 0, -1, withscores=True)
            self.client.expire(key, window_seconds + 60)
            return [int(score) for _, score in members]

        return self._safe(_impl)

    def record_failed_login(self, identity: str) -> None:
        def _impl():
            now_ts = int(time.time())
            key = self._login_attempts_key(identity)
            member = f"{now_ts}:{time.time_ns()}"
            with self.client.pipeline() as pipe:
                pipe.zadd(key, {member: now_ts})
                pipe.expire(key, 3600 + 60)
                pipe.execute()

        self._safe(_impl)

    def clear_failed_logins(self, identity: str) -> None:
        self._safe(lambda: self.client.delete(self._login_attempts_key(identity)))

    def save_refresh_record(self, record: RefreshRecord) -> None:
        def _impl():
            ttl_seconds = max(int(record.expires_at.timestamp()) - int(time.time()), 1)
            key = self._refresh_key(record.token_hash)
            payload = {
                "token_hash": record.token_hash,
                "user_id": record.user_id,
                "family_id": record.family_id,
                "device_id": record.device_id,
                "issued_at": _dt_to_unix(record.issued_at),
                "expires_at": _dt_to_unix(record.expires_at),
            }
            with self.client.pipeline() as pipe:
                pipe.hset(key, mapping=payload)
                pipe.expire(key, ttl_seconds)
                pipe.sadd(self._family_tokens_key(record.family_id), record.token_hash)
                pipe.expire(self._family_tokens_key(record.family_id), ttl_seconds)
                pipe.sadd(self._user_sessions_key(record.user_id), record.token_hash)
                pipe.expire(self._user_sessions_key(record.user_id), ttl_seconds)
                pipe.execute()

        self._safe(_impl)

    def get_refresh_record(self, token_hash: str) -> RefreshRecord | None:
        def _impl():
            values = self.client.hgetall(self._refresh_key(token_hash))
            if not values:
                return None
            return RefreshRecord(
                token_hash=values["token_hash"],
                user_id=values["user_id"],
                family_id=values["family_id"],
                device_id=values["device_id"],
                issued_at=_unix_to_dt(values["issued_at"]),
                expires_at=_unix_to_dt(values["expires_at"]),
            )

        return self._safe(_impl)

    def pop_refresh_record(self, token_hash: str) -> RefreshRecord | None:
        def _impl():
            record = self.get_refresh_record(token_hash)
            if record is None:
                return None
            with self.client.pipeline() as pipe:
                pipe.delete(self._refresh_key(token_hash))
                pipe.srem(self._family_tokens_key(record.family_id), token_hash)
                pipe.srem(self._user_sessions_key(record.user_id), token_hash)
                pipe.execute()
            return record

        return self._safe(_impl)

    def mark_refresh_used(self, token_hash: str, family_id: str) -> None:
        ttl_seconds = int(REFRESH_TOKEN_TTL.total_seconds())
        self._safe(lambda: self.client.setex(self._used_refresh_key(token_hash), ttl_seconds, family_id))

    def get_used_refresh_family(self, token_hash: str) -> str | None:
        return self._safe(lambda: self.client.get(self._used_refresh_key(token_hash)))

    def mark_family_revoked(self, family_id: str) -> None:
        ttl_seconds = int(REFRESH_TOKEN_TTL.total_seconds())
        self._safe(lambda: self.client.setex(self._revoked_family_key(family_id), ttl_seconds, "1"))

    def is_family_revoked(self, family_id: str) -> bool:
        return bool(self._safe(lambda: self.client.exists(self._revoked_family_key(family_id))))

    def list_family_tokens(self, family_id: str) -> list[str]:
        return list(self._safe(lambda: self.client.smembers(self._family_tokens_key(family_id))))

    def list_user_tokens(self, user_id: str) -> list[str]:
        return list(self._safe(lambda: self.client.smembers(self._user_sessions_key(user_id))))

    def _onboarding_key(self, token: str) -> str:
        return f"onboarding:{token}"

    def save_onboarding_token(self, token: str, payload: dict, ttl_seconds: int) -> None:
        ttl = max(ttl_seconds, 1)
        self._safe(lambda: self.client.setex(self._onboarding_key(token), ttl, json.dumps(payload)))

    def pop_onboarding_token(self, token: str) -> dict | None:
        def _impl():
            key = self._onboarding_key(token)
            with self.client.pipeline() as pipe:
                pipe.get(key)
                pipe.delete(key)
                values = pipe.execute()
            raw = values[0]
            if not raw:
                return None
            return json.loads(raw)

        return self._safe(_impl)

    def publish_event(self, stream: str, event_type: str, payload: dict) -> str:
        data = {"type": event_type, "payload": json.dumps(payload)}
        return str(self._safe(lambda: self.client.xadd(stream, data)))

    def read_events(self, stream: str, start_id: str, *, count: int = 100, block_ms: int = 0) -> list[tuple[str, dict]]:
        def _impl():
            events = self.client.xread({stream: start_id}, count=count, block=block_ms if block_ms > 0 else None)
            output: list[tuple[str, dict]] = []
            for _, stream_events in events:
                for event_id, event_data in stream_events:
                    payload = {}
                    if "payload" in event_data:
                        payload = json.loads(event_data["payload"])
                    item = {"type": event_data.get("type"), **payload}
                    output.append((str(event_id), item))
            return output

        return list(self._safe(_impl))

    def reset(self) -> None:
        # Integration environment should isolate DB index per app; flushdb is acceptable for tests only.
        self._safe(lambda: self.client.flushdb())
