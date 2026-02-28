from __future__ import annotations

from dataclasses import dataclass


@dataclass(slots=True)
class RlsContext:
    school_id: str | None
    user_id: str
    role: str


def build_rls_set_local_statements(ctx: RlsContext) -> list[tuple[str, tuple[str, str, bool]]]:
    school_value = "" if ctx.school_id is None else ctx.school_id
    return [
        ("SELECT set_config(%s, %s, %s)", ("app.current_school_id", school_value, True)),
        ("SELECT set_config(%s, %s, %s)", ("app.current_user_id", ctx.user_id, True)),
        ("SELECT set_config(%s, %s, %s)", ("app.current_role", ctx.role, True)),
    ]
