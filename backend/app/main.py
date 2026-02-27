from __future__ import annotations

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError

from app.api.routes.auth import router as auth_router
from app.api.routes.users import router as users_router
from app.core.errors import AppError, app_error_handler, unhandled_error_handler, validation_error_handler
from app.db.request_context import RequestRlsContext, reset_request_rls_context, set_request_rls_context


app = FastAPI(title="Zedly Backend Core", version="0.1.0")

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


app.include_router(auth_router)
app.include_router(users_router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
