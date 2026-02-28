from __future__ import annotations

from app.db.rls_context import RlsContext, build_rls_set_local_statements


def test_build_rls_statements_use_set_config_with_local_scope() -> None:
    statements = build_rls_set_local_statements(
        RlsContext(
            school_id=None,
            user_id="service_user",
            role="service",
        )
    )

    assert statements == [
        ("SELECT set_config(%s, %s, %s)", ("app.current_school_id", "", True)),
        ("SELECT set_config(%s, %s, %s)", ("app.current_user_id", "service_user", True)),
        ("SELECT set_config(%s, %s, %s)", ("app.current_role", "service", True)),
    ]
