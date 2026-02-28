from __future__ import annotations

from contextvars import ContextVar, Token
from dataclasses import dataclass


@dataclass(slots=True, frozen=True)
class RequestRlsContext:
    school_id: str | None
    user_id: str
    role: str


_request_rls_context: ContextVar[RequestRlsContext | None] = ContextVar("request_rls_context", default=None)


def set_request_rls_context(context: RequestRlsContext | None) -> Token:
    return _request_rls_context.set(context)


def get_request_rls_context() -> RequestRlsContext | None:
    return _request_rls_context.get()


def reset_request_rls_context(token: Token) -> None:
    _request_rls_context.reset(token)
