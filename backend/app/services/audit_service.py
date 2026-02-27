from __future__ import annotations

from app.core.settings import settings
from app.repositories.exceptions import BackendUnavailableError
from app.repositories.models import AuditEvent
from app.repositories.runtime import get_data_store, get_session_store


class AuditService:
    def record(
        self,
        *,
        event: str,
        user_id: str | None,
        school_id: str | None,
        resource_id: str | None = None,
        ip: str | None = None,
        details: dict | None = None,
    ) -> None:
        payload = AuditEvent(
            event=event,
            user_id=user_id,
            school_id=school_id,
            resource_id=resource_id,
            ip=ip,
            details=details or {},
        )
        try:
            get_data_store().add_audit_event(payload)
        except BackendUnavailableError:
            # Audit is best-effort for runtime availability issues.
            return

    def record_cross_school_attempt(
        self,
        *,
        user_id: str | None,
        user_school_id: str | None,
        target_school_id: str | None,
        resource_id: str | None,
        ip: str | None,
    ) -> None:
        details = {
            "target_school_id": target_school_id,
            "resource_id": resource_id,
        }
        self.record(
            event="cross_school_access_attempt",
            user_id=user_id,
            school_id=user_school_id,
            resource_id=resource_id,
            ip=ip,
            details=details,
        )

        if not ip:
            return

        try:
            attempts_in_window = get_session_store().record_cross_school_attempt(ip, window_seconds=300)
            if attempts_in_window > settings.security_alert_threshold_per_5m:
                get_session_store().block_ip(ip, settings.security_ip_block_seconds)
                alert = AuditEvent(
                    event="enumeration_attack_alert",
                    user_id=user_id,
                    school_id=user_school_id,
                    resource_id=resource_id,
                    ip=ip,
                    details={"attempts_in_5m": attempts_in_window},
                )
                get_data_store().add_security_alert(alert)
        except BackendUnavailableError:
            return


service = AuditService()
