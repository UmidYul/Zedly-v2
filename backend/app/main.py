from __future__ import annotations

import json

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.concurrency import iterate_in_threadpool
from starlette.responses import Response

from app.api.routes.analytics import router as analytics_router
from app.api.routes.auth import router as auth_router
from app.api.routes.reports import router as reports_router
from app.api.routes.tests import router as tests_router
from app.api.routes.users import router as users_router
from app.core.errors import AppError, app_error_handler, unhandled_error_handler, validation_error_handler
from app.db.request_context import RequestRlsContext, reset_request_rls_context, set_request_rls_context


app = FastAPI(title="Zedly Backend Core", version="0.1.0")

V1_PREFIX = "/api/v1"
LEGACY_API_SUNSET = "Sat, 28 Mar 2026 00:00:00 GMT"
LEGACY_PUBLIC_PREFIXES = (
    "/health",
    "/auth",
    "/users",
    "/schools",
    "/classes",
    "/tests",
    "/sessions",
    "/analytics",
    "/reports",
)
PUBLIC_ROUTERS = (
    auth_router,
    users_router,
    tests_router,
    analytics_router,
    reports_router,
)


def _has_path_prefix(path: str, prefix: str) -> bool:
    return path == prefix or path.startswith(f"{prefix}/")


def _is_legacy_public_path(path: str) -> bool:
    if path.startswith(V1_PREFIX):
        return False
    return any(_has_path_prefix(path, prefix) for prefix in LEGACY_PUBLIC_PREFIXES)


async def _response_body_bytes(response: Response) -> bytes:
    body = getattr(response, "body", None)
    if body is not None:
        return body
    chunks = [chunk async for chunk in response.body_iterator]
    body = b"".join(chunks)
    response.body_iterator = iterate_in_threadpool([body])
    return body


async def _json_payload(response: Response) -> dict | list | str | int | float | bool | None:
    body = await _response_body_bytes(response)
    if not body:
        return None
    try:
        return json.loads(body)
    except json.JSONDecodeError:
        return None


def _copy_passthrough_headers(source: Response, target: Response) -> None:
    for key, value in source.raw_headers:
        decoded_key = key.decode("latin-1")
        if decoded_key.lower() in {"content-length", "content-type"}:
            continue
        target.headers.append(decoded_key, value.decode("latin-1"))


app.add_exception_handler(AppError, app_error_handler)
app.add_exception_handler(RequestValidationError, validation_error_handler)
app.add_exception_handler(Exception, unhandled_error_handler)


@app.middleware("http")
async def request_rls_context_middleware(request, call_next):
    token = set_request_rls_context(RequestRlsContext(school_id=None, user_id="service_user", role="service"))
    try:
        return await call_next(request)
    finally:
        reset_request_rls_context(token)


@app.middleware("http")
async def api_contract_middleware(request: Request, call_next):
    response = await call_next(request)
    path = request.url.path

    if _is_legacy_public_path(path):
        response.headers.setdefault("Deprecation", "true")
        response.headers.setdefault("Sunset", LEGACY_API_SUNSET)
        response.headers.setdefault("Link", '</api/v1>; rel="successor-version"')

    if not path.startswith(V1_PREFIX):
        return response

    content_type = response.headers.get("content-type", "").lower()
    if response.status_code >= 400 or "application/json" not in content_type:
        return response

    payload = await _json_payload(response)
    if payload is None:
        return response

    if isinstance(payload, dict) and "ok" in payload and ("data" in payload or "error" in payload):
        return response

    wrapped = JSONResponse(
        status_code=response.status_code,
        content={"ok": True, "data": payload},
    )
    wrapped.background = response.background
    _copy_passthrough_headers(response, wrapped)
    return wrapped


for api_router in PUBLIC_ROUTERS:
    app.include_router(api_router)
for api_router in PUBLIC_ROUTERS:
    app.include_router(api_router, prefix=V1_PREFIX)


@app.get("/health")
@app.get("/api/v1/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
