from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timezone
from typing import Any

from app.core.errors import AppError
from app.core.types import ErrorCode, Role
from app.repositories.exceptions import BackendUnavailableError
from app.repositories.models import AnalyticsSnapshot, SessionAnswer, TestSessionResource, User
from app.repositories.runtime import get_data_store


def _service_unavailable() -> AppError:
    return AppError(status_code=503, code=ErrorCode.SERVICE_UNAVAILABLE.value, message="Storage backend unavailable")


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _month_start(value: datetime | None = None) -> datetime:
    ts = value or _now()
    return ts.replace(day=1, hour=0, minute=0, second=0, microsecond=0)


def _snapshot_id(*, school_id: str | None, entity_type: str, entity_id: str, metric_name: str, period_type: str, period_start: datetime) -> str:
    school_part = school_id or "global"
    return f"snap_{school_part}_{entity_type}_{entity_id}_{metric_name}_{period_type}_{period_start.strftime('%Y%m')}"


class AnalyticsService:
    def _save_snapshot(self, *, school_id: str | None, entity_type: str, entity_id: str, metric_name: str, value_json: dict[str, Any]) -> AnalyticsSnapshot:
        period_start = _month_start()
        snapshot = AnalyticsSnapshot(
            id=_snapshot_id(
                school_id=school_id,
                entity_type=entity_type,
                entity_id=entity_id,
                metric_name=metric_name,
                period_type="month",
                period_start=period_start,
            ),
            school_id=school_id,
            entity_type=entity_type,
            entity_id=entity_id,
            metric_name=metric_name,
            period_type="month",
            period_start=period_start,
            value_json=value_json,
            updated_at=_now(),
        )
        try:
            get_data_store().save_analytics_snapshot(snapshot)
        except BackendUnavailableError as exc:
            raise _service_unavailable() from exc
        return snapshot

    def _session_answers(self, session: TestSessionResource) -> list[SessionAnswer]:
        return get_data_store().list_session_answers(session.id)

    def _calc_weak_topics(self, sessions: list[TestSessionResource]) -> list[dict[str, Any]]:
        topic_total: dict[str, int] = defaultdict(int)
        topic_errors: dict[str, int] = defaultdict(int)
        data_store = get_data_store()
        for session in sessions:
            test = data_store.get_test_by_id(session.test_id)
            if not test:
                continue
            topic_by_question = {question.question_id: question.topic for question in test.questions}
            for answer in data_store.list_session_answers(session.id):
                topic = topic_by_question.get(answer.question_id, "general")
                topic_total[topic] += 1
                if answer.is_correct is False:
                    topic_errors[topic] += 1
        result: list[dict[str, Any]] = []
        for topic, total in topic_total.items():
            if total < 5:
                continue
            errors = topic_errors.get(topic, 0)
            error_rate = round((errors / total) * 100, 2) if total else 0.0
            if error_rate >= 40:
                result.append({"topic": topic, "error_rate": error_rate, "answers_count": total})
        result.sort(key=lambda x: x["error_rate"], reverse=True)
        return result

    def recalculate_for_session(self, session_id: str) -> None:
        try:
            data_store = get_data_store()
            session = data_store.get_test_session(session_id)
        except BackendUnavailableError as exc:
            raise _service_unavailable() from exc
        if not session:
            return
        assignment = data_store.get_assignment_by_id(session.assignment_id)
        if not assignment:
            return

        class_sessions = [item for item in data_store.list_sessions_by_class(assignment.class_id) if item.status in {"completed", "expired"}]
        scored_class_sessions = [item for item in class_sessions if item.score_percent is not None]
        class_average = round(sum(item.score_percent or 0.0 for item in scored_class_sessions) / len(scored_class_sessions), 2) if scored_class_sessions else 0.0
        weak_topics = self._calc_weak_topics(class_sessions)
        self._save_snapshot(
            school_id=session.school_id,
            entity_type="class",
            entity_id=assignment.class_id,
            metric_name="class_average",
            value_json={"value": class_average, "sessions": len(scored_class_sessions)},
        )
        self._save_snapshot(
            school_id=session.school_id,
            entity_type="class",
            entity_id=assignment.class_id,
            metric_name="weak_topics",
            value_json={"topics": weak_topics},
        )

        school_sessions = [item for item in data_store.list_sessions_by_school(session.school_id) if item.status in {"completed", "expired"}]
        scored_school_sessions = [item for item in school_sessions if item.score_percent is not None]
        school_average = round(sum(item.score_percent or 0.0 for item in scored_school_sessions) / len(scored_school_sessions), 2) if scored_school_sessions else 0.0
        teachers = [item for item in data_store.list_users_by_school(session.school_id) if item.role == Role.TEACHER]
        tests = data_store.list_tests_by_school(session.school_id)
        active_teacher_ids = {item.teacher_id for item in tests}
        active_rate = round((len(active_teacher_ids) / len(teachers)) * 100, 2) if teachers else 0.0

        self._save_snapshot(
            school_id=session.school_id,
            entity_type="school",
            entity_id=session.school_id,
            metric_name="school_average",
            value_json={"value": school_average, "sessions": len(scored_school_sessions)},
        )
        self._save_snapshot(
            school_id=session.school_id,
            entity_type="school",
            entity_id=session.school_id,
            metric_name="active_teachers_rate",
            value_json={"value": active_rate, "active_teachers": len(active_teacher_ids), "total_teachers": len(teachers)},
        )

    def teacher_dashboard(self, *, current_user: User, period: str, class_id: str | None = None) -> dict[str, Any]:
        if current_user.role != Role.TEACHER:
            raise AppError(status_code=403, code=ErrorCode.ROLE_FORBIDDEN.value, message="Only teacher can access teacher dashboard")
        try:
            data_store = get_data_store()
        except BackendUnavailableError as exc:
            raise _service_unavailable() from exc

        classes = data_store.list_classes_by_teacher(current_user.id)
        target_class = class_id or (classes[0].id if classes else None)
        if not target_class:
            return {
                "teacher_id": current_user.id,
                "school_id": current_user.school_id,
                "period": period,
                "class_average": 0.0,
                "completed_sessions": 0,
                "weak_topics": [],
                "snapshot_updated_at": _now().isoformat(),
            }

        average_snapshot = data_store.get_latest_snapshot(
            school_id=current_user.school_id,
            entity_type="class",
            entity_id=target_class,
            metric_name="class_average",
        )
        weak_topics_snapshot = data_store.get_latest_snapshot(
            school_id=current_user.school_id,
            entity_type="class",
            entity_id=target_class,
            metric_name="weak_topics",
        )
        if average_snapshot is None or weak_topics_snapshot is None:
            sessions = data_store.list_sessions_by_class(target_class)
            if sessions:
                self.recalculate_for_session(sessions[-1].id)
                average_snapshot = data_store.get_latest_snapshot(
                    school_id=current_user.school_id,
                    entity_type="class",
                    entity_id=target_class,
                    metric_name="class_average",
                )
                weak_topics_snapshot = data_store.get_latest_snapshot(
                    school_id=current_user.school_id,
                    entity_type="class",
                    entity_id=target_class,
                    metric_name="weak_topics",
                )
        return {
            "teacher_id": current_user.id,
            "school_id": current_user.school_id,
            "period": period,
            "class_average": float((average_snapshot.value_json or {}).get("value", 0.0)) if average_snapshot else 0.0,
            "completed_sessions": int((average_snapshot.value_json or {}).get("sessions", 0)) if average_snapshot else 0,
            "weak_topics": list((weak_topics_snapshot.value_json or {}).get("topics", [])) if weak_topics_snapshot else [],
            "snapshot_updated_at": (average_snapshot.updated_at if average_snapshot else _now()).isoformat(),
        }

    def director_dashboard(self, *, current_user: User, period: str) -> dict[str, Any]:
        if current_user.role != Role.DIRECTOR:
            raise AppError(status_code=403, code=ErrorCode.ROLE_FORBIDDEN.value, message="Only director can access director dashboard")
        school_id = current_user.school_id or ""
        try:
            data_store = get_data_store()
            average_snapshot = data_store.get_latest_snapshot(
                school_id=school_id,
                entity_type="school",
                entity_id=school_id,
                metric_name="school_average",
            )
            active_snapshot = data_store.get_latest_snapshot(
                school_id=school_id,
                entity_type="school",
                entity_id=school_id,
                metric_name="active_teachers_rate",
            )
            school = data_store.get_school_by_id(school_id)
        except BackendUnavailableError as exc:
            raise _service_unavailable() from exc

        school_average = float((average_snapshot.value_json or {}).get("value", 0.0)) if average_snapshot else 0.0
        active_rate = float((active_snapshot.value_json or {}).get("value", 0.0)) if active_snapshot else 0.0
        conversion_trigger = bool(school and school.subscription_plan == "freemium" and active_rate >= 85.0)
        message = (
            f"{active_rate:.0f}% teachers are active. Upgrade to school license."
            if conversion_trigger
            else None
        )
        return {
            "director_id": current_user.id,
            "school_id": school_id,
            "period": period,
            "school_average": school_average,
            "active_teachers_rate": active_rate,
            "conversion_trigger": conversion_trigger,
            "conversion_message": message,
            "snapshot_updated_at": (average_snapshot.updated_at if average_snapshot else _now()).isoformat(),
        }


service = AnalyticsService()
