from __future__ import annotations

from collections.abc import Mapping

from app.core.types import Role

# Canonical permission keys.
ROLE_PERMISSIONS: dict[Role, set[str]] = {
    Role.STUDENT: {
        "take_test",
        "take_ntt_simulator",
        "view_own_results",
        "view_own_result_breakdown",
        "view_own_portfolio",
        "share_result_card",
    },
    Role.TEACHER: {
        "create_test",
        "create_test_ai_generation",
        "edit_own_test",
        "delete_own_test",
        "publish_to_marketplace",
        "assign_test_to_class",
        "view_class_results",
        "view_class_analytics",
        "invite_students_to_class",
        "view_school_user_list",
        "view_test_marketplace",
        "copy_test_from_marketplace",
    },
    Role.DIRECTOR: {
        "view_class_results",
        "view_class_analytics",
        "view_school_analytics",
        "view_school_teacher_activity",
        "view_school_user_list",
        "manage_school_users",
        "manage_school_license",
        "generate_school_report",
    },
    Role.PSYCHOLOGIST: {
        "create_psychological_test",
        "view_psychological_results",
        "view_career_guidance_report",
    },
    Role.PARENT: {
        "view_child_results",
        "export_portfolio_pdf",
    },
    Role.INSPECTOR: {
        "view_district_analytics",
        "view_school_in_district",
        "generate_roono_report",
    },
    Role.MINISTRY: {
        "view_national_analytics",
        "view_regional_comparison",
        "generate_national_report",
    },
    Role.SUPERADMIN: {
        "access_admin_panel",
        "manage_all_schools",
        "manage_subscriptions_global",
    },
}

PERMISSION_ALIASES: dict[str, str] = {
    "use_ai_generation": "create_test_ai_generation",
    "assign_test_to_own_class": "assign_test_to_class",
    "view_own_class_results": "view_class_results",
    "view_marketplace_tests": "view_test_marketplace",
    "copy_marketplace_test": "copy_test_from_marketplace",
    "invite_students": "invite_students_to_class",
    "view_school_aggregate_analytics": "view_school_analytics",
    "view_teacher_activity": "view_school_teacher_activity",
    "view_district_aggregate_analytics": "view_district_analytics",
    "view_school_details": "view_school_in_district",
}

ROLE_ALIASES: dict[str, str] = {
    "district_admin": "inspector",
    "school_admin": "director",
}


def canonical_permission(permission_key: str) -> str:
    return PERMISSION_ALIASES.get(permission_key, permission_key)


def canonical_role(role_key: str) -> str:
    return ROLE_ALIASES.get(role_key, role_key)


def permissions_for_role(role: Role) -> set[str]:
    return ROLE_PERMISSIONS.get(role, set())


def normalize_permissions(permission_keys: set[str] | list[str] | tuple[str, ...]) -> set[str]:
    return {canonical_permission(value) for value in permission_keys}


def has_permission(role: Role, permission_key: str, explicit_permissions: set[str] | None = None) -> bool:
    canonical = canonical_permission(permission_key)
    if explicit_permissions is not None:
        return canonical in normalize_permissions(explicit_permissions)
    return canonical in permissions_for_role(role)


def canonical_payload_permissions(role: Role) -> list[str]:
    values = sorted(permissions_for_role(role))
    return values
