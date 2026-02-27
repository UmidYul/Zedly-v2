from __future__ import annotations

from dataclasses import dataclass


@dataclass(slots=True)
class RlsContext:
    school_id: str | None
    user_id: str
    role: str


def _quote(value: str) -> str:
    return value.replace("'", "''")


def build_rls_set_local_statements(ctx: RlsContext) -> list[str]:
    school_value = "" if ctx.school_id is None else ctx.school_id
    return [
        f"SET LOCAL app.current_school_id = '{_quote(school_value)}';",
        f"SET LOCAL app.current_user_id = '{_quote(ctx.user_id)}';",
        f"SET LOCAL app.current_role = '{_quote(ctx.role)}';",
    ]
