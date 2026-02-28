from __future__ import annotations

import random
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from app.core.constants import MAX_QUESTIONS_PER_TEST, NTT_TIME_LIMIT_MINUTES
from app.core.errors import AppError
from app.core.settings import settings
from app.core.types import ErrorCode, Role
from app.repositories.exceptions import BackendUnavailableError
from app.repositories.models import SessionAnswer, TestAssignment, TestAnswerOption, TestQuestion, TestResource, TestSessionResource, User
from app.repositories.runtime import get_data_store, get_session_store
from app.services.analytics_service import service as analytics_service


def _service_unavailable() -> AppError:
    return AppError(status_code=503, code=ErrorCode.SERVICE_UNAVAILABLE.value, message="Storage backend unavailable")


def _parse_iso8601(value: str) -> datetime:
    normalized = value.replace("Z", "+00:00")
    return datetime.fromisoformat(normalized)


def _ensure_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _now() -> datetime:
    return datetime.now(timezone.utc)


class TestService:
    def _to_question(self, payload: dict[str, Any]) -> TestQuestion:
        answers = [
            TestAnswerOption(
                answer_id=item["answer_id"],
                text=item["text"],
                is_correct=bool(item.get("is_correct", False)),
                explanation=item.get("explanation"),
            )
            for item in payload.get("answers", [])
        ]
        return TestQuestion(
            question_id=payload["question_id"],
            text=payload["text"],
            topic=payload.get("topic", "general"),
            points=int(payload.get("points", 1)),
            answers=answers,
        )

    def create_test(self, *, current_user: User, payload: dict[str, Any]) -> TestResource:
        if current_user.role != Role.TEACHER:
            raise AppError(status_code=403, code=ErrorCode.ROLE_FORBIDDEN.value, message="Only teacher can create test")

        questions_payload = payload.get("questions", [])
        if len(questions_payload) > MAX_QUESTIONS_PER_TEST:
            raise AppError(
                status_code=400,
                code=ErrorCode.VALIDATION_ERROR.value,
                message=f"Maximum {MAX_QUESTIONS_PER_TEST} questions per test",
            )

        questions = [self._to_question(item) for item in questions_payload]
        status = payload.get("status", "draft")
        if status == "published" and len(questions) == 0:
            raise AppError(status_code=400, code=ErrorCode.VALIDATION_ERROR.value, message="Published test must contain questions")

        mode = payload.get("mode", "standard")
        time_limit = int(payload.get("time_limit_minutes", 30))
        if mode == "ntt":
            time_limit = NTT_TIME_LIMIT_MINUTES

        test = TestResource(
            id=f"tst_{uuid.uuid4().hex[:10]}",
            school_id=current_user.school_id or "",
            teacher_id=current_user.id,
            title=payload["title"],
            subject=payload.get("subject", "general"),
            mode=mode,
            status=status,
            show_answers=payload.get("show_answers", "after_deadline"),
            shuffle_questions=bool(payload.get("shuffle_questions", True)),
            shuffle_answers=bool(payload.get("shuffle_answers", True)),
            time_limit_minutes=time_limit,
            allow_retakes=bool(payload.get("allow_retakes", False)),
            questions=questions,
            published_at=_now() if status == "published" else None,
        )
        try:
            get_data_store().save_test(test)
        except BackendUnavailableError as exc:
            raise _service_unavailable() from exc
        return test

    def get_test(self, *, current_user: User, test_id: str) -> dict[str, Any]:
        try:
            data_store = get_data_store()
            test = data_store.get_test_by_id(test_id)
        except BackendUnavailableError as exc:
            raise _service_unavailable() from exc

        if not test:
            raise AppError(status_code=404, code=ErrorCode.RESOURCE_NOT_FOUND.value, message="Test not found")

        if current_user.role in (Role.TEACHER, Role.DIRECTOR):
            if current_user.school_id != test.school_id:
                raise AppError(status_code=403, code=ErrorCode.SCHOOL_ACCESS_FORBIDDEN.value, message="Cross-school access denied")
            include_correct = True
            assignment_for_student = None
        elif current_user.role == Role.STUDENT:
            student_class = data_store.get_student_class_id(current_user.id)
            if not student_class:
                raise AppError(status_code=403, code=ErrorCode.ROLE_FORBIDDEN.value, message="Student class is not assigned")
            assignments = data_store.list_assignments_by_test(test_id)
            assignment_for_student = next((item for item in assignments if item.class_id == student_class), None)
            if assignment_for_student is None:
                raise AppError(status_code=403, code=ErrorCode.ROLE_FORBIDDEN.value, message="Test is not assigned to student class")
            include_correct = False
            if test.show_answers == "immediately":
                include_correct = True
            elif test.show_answers == "after_deadline" and _now() >= assignment_for_student.deadline:
                include_correct = True
        else:
            raise AppError(status_code=403, code=ErrorCode.ROLE_FORBIDDEN.value, message="Role cannot access tests")

        questions_payload: list[dict[str, Any]] = []
        for question in test.questions:
            answer_payload = []
            for answer in question.answers:
                item = {
                    "answer_id": answer.answer_id,
                    "text": answer.text,
                }
                if include_correct:
                    item["is_correct"] = answer.is_correct
                    item["explanation"] = answer.explanation
                answer_payload.append(item)
            questions_payload.append(
                {
                    "question_id": question.question_id,
                    "text": question.text,
                    "topic": question.topic,
                    "points": question.points,
                    "answers": answer_payload,
                }
            )

        return {
            "id": test.id,
            "title": test.title,
            "subject": test.subject,
            "school_id": test.school_id,
            "teacher_id": test.teacher_id,
            "mode": test.mode,
            "status": test.status,
            "show_answers": test.show_answers,
            "questions": questions_payload,
            "assignment": (
                {
                    "assignment_id": assignment_for_student.id,
                    "deadline": assignment_for_student.deadline.isoformat(),
                    "status": assignment_for_student.status,
                }
                if assignment_for_student
                else None
            ),
        }

    def assign_test(self, *, current_user: User, test_id: str, assignments: list[dict[str, Any]]) -> list[TestAssignment]:
        if current_user.role != Role.TEACHER:
            raise AppError(status_code=403, code=ErrorCode.ROLE_FORBIDDEN.value, message="Only teacher can assign tests")
        try:
            data_store = get_data_store()
            test = data_store.get_test_by_id(test_id)
        except BackendUnavailableError as exc:
            raise _service_unavailable() from exc

        if not test:
            raise AppError(status_code=404, code=ErrorCode.RESOURCE_NOT_FOUND.value, message="Test not found")
        if test.teacher_id != current_user.id:
            raise AppError(status_code=403, code=ErrorCode.ROLE_FORBIDDEN.value, message="Teacher can assign only own tests")
        if test.school_id != (current_user.school_id or ""):
            raise AppError(status_code=403, code=ErrorCode.SCHOOL_ACCESS_FORBIDDEN.value, message="Cross-school access denied")

        created: list[TestAssignment] = []
        for item in assignments:
            class_id = item["class_id"]
            if not data_store.has_teacher_class_assignment(teacher_id=current_user.id, class_id=class_id, subject=test.subject):
                raise AppError(status_code=403, code=ErrorCode.ROLE_FORBIDDEN.value, message="Teacher is not assigned to class/subject")
            if data_store.find_assignment(test_id=test_id, class_id=class_id):
                raise AppError(status_code=409, code=ErrorCode.TEST_ALREADY_ASSIGNED.value, message="Test already assigned to class")
            deadline = _ensure_utc(_parse_iso8601(item["deadline"]))
            if deadline <= _now() + timedelta(minutes=30):
                raise AppError(status_code=400, code=ErrorCode.VALIDATION_ERROR.value, message="Deadline must be at least 30 minutes in the future")
            assignment = TestAssignment(
                id=f"asgn_{uuid.uuid4().hex[:10]}",
                test_id=test_id,
                class_id=class_id,
                school_id=test.school_id,
                teacher_id=current_user.id,
                deadline=deadline,
                status="assigned",
            )
            data_store.save_test_assignment(assignment)
            created.append(assignment)

        if test.status == "draft":
            test.status = "published"
            test.published_at = _now()
            data_store.save_test(test)

        return created

    def _find_question(self, test: TestResource, question_id: str) -> TestQuestion | None:
        return next((value for value in test.questions if value.question_id == question_id), None)

    def _score_answer(self, question: TestQuestion, answer_id: str | None) -> tuple[bool | None, int]:
        if answer_id is None:
            return None, 0
        option = next((value for value in question.answers if value.answer_id == answer_id), None)
        if option is None:
            raise AppError(status_code=400, code=ErrorCode.INVALID_ANSWER.value, message="Invalid answer id")
        if option.is_correct:
            return True, question.points
        return False, 0

    def start_session(self, *, current_user: User, test_id: str, assignment_id: str, offline_mode: bool) -> TestSessionResource:
        if current_user.role != Role.STUDENT:
            raise AppError(status_code=403, code=ErrorCode.ROLE_FORBIDDEN.value, message="Only students can start test sessions")
        try:
            data_store = get_data_store()
            assignment = data_store.get_assignment_by_id(assignment_id)
            test = data_store.get_test_by_id(test_id)
        except BackendUnavailableError as exc:
            raise _service_unavailable() from exc

        if not assignment or not test:
            raise AppError(status_code=404, code=ErrorCode.RESOURCE_NOT_FOUND.value, message="Assignment or test not found")
        if assignment.test_id != test_id:
            raise AppError(status_code=400, code=ErrorCode.VALIDATION_ERROR.value, message="Assignment does not belong to test")

        student_class = data_store.get_student_class_id(current_user.id)
        if student_class != assignment.class_id:
            raise AppError(status_code=403, code=ErrorCode.ROLE_FORBIDDEN.value, message="Student is not assigned to class")
        if assignment.deadline <= _now():
            raise AppError(status_code=403, code=ErrorCode.SESSION_EXPIRED.value, message="Assignment deadline expired")
        if test.mode == "ntt" and offline_mode:
            raise AppError(status_code=400, code=ErrorCode.NTT_OFFLINE_FORBIDDEN.value, message="Offline mode is forbidden for NTT")

        existing = data_store.find_student_session(test_id=test_id, student_id=current_user.id)
        if existing and existing.status == "in_progress":
            if existing.expires_at <= _now():
                # Expired in-progress session should not block a new start.
                existing.status = "completed" if existing.mode == "ntt" else "expired"
                existing.completed_at = _now()
                data_store.save_test_session(existing)
            else:
                raise AppError(
                    status_code=409,
                    code=ErrorCode.SESSION_ALREADY_EXISTS.value,
                    message="Session already in progress",
                    details={
                        "existing_session_id": existing.id,
                        "session_status": existing.status,
                        "resume_url": f"/sessions/{existing.id}",
                    },
                )
        if existing and not test.allow_retakes and existing.status in {"completed", "expired"}:
            raise AppError(
                status_code=409,
                code=ErrorCode.SESSION_ALREADY_EXISTS.value,
                message="Session already completed",
                details={
                    "existing_session_id": existing.id,
                    "session_status": existing.status,
                    "score_percent": existing.score_percent,
                    "result_url": f"/sessions/{existing.id}/result",
                },
            )

        question_order = [value.question_id for value in test.questions]
        if test.shuffle_questions:
            random.Random(f"{current_user.id}:{test_id}").shuffle(question_order)

        answer_shuffles: dict[str, list[str]] = {}
        for question in test.questions:
            answer_ids = [value.answer_id for value in question.answers]
            if test.shuffle_answers:
                random.Random(f"{current_user.id}:{test_id}:{question.question_id}").shuffle(answer_ids)
            answer_shuffles[question.question_id] = answer_ids

        now_ts = _now()
        session = TestSessionResource(
            id=f"sess_{uuid.uuid4().hex[:10]}",
            test_id=test_id,
            assignment_id=assignment_id,
            student_id=current_user.id,
            school_id=test.school_id,
            mode=test.mode,
            status="in_progress",
            started_at=now_ts,
            expires_at=now_ts + timedelta(minutes=test.time_limit_minutes),
            question_order=question_order,
            answer_shuffles=answer_shuffles,
        )
        try:
            data_store.save_test_session(session)
            get_session_store().publish_event(
                "test_events",
                "test_started",
                {
                    "session_id": session.id,
                    "test_id": session.test_id,
                    "student_id": session.student_id,
                    "school_id": session.school_id,
                    "started_at": session.started_at.isoformat(),
                },
            )
        except BackendUnavailableError as exc:
            raise _service_unavailable() from exc
        return session

    def submit_answers(
        self,
        *,
        current_user: User,
        session_id: str,
        answers: list[dict[str, Any]],
        prefer_earlier: bool = False,
        source: str = "online",
        allow_expired: bool = False,
    ) -> dict[str, Any]:
        try:
            data_store = get_data_store()
            session = data_store.get_test_session(session_id)
        except BackendUnavailableError as exc:
            raise _service_unavailable() from exc
        if not session:
            raise AppError(status_code=404, code=ErrorCode.RESOURCE_NOT_FOUND.value, message="Session not found")
        if current_user.role != Role.STUDENT or current_user.id != session.student_id:
            raise AppError(status_code=403, code=ErrorCode.ROLE_FORBIDDEN.value, message="Session belongs to another student")
        if session.status != "in_progress":
            raise AppError(status_code=403, code=ErrorCode.ROLE_FORBIDDEN.value, message="Session is not active")
        if session.expires_at <= _now() and not allow_expired:
            raise AppError(status_code=410, code=ErrorCode.SESSION_EXPIRED.value, message="Session expired")

        test = data_store.get_test_by_id(session.test_id)
        if not test:
            raise AppError(status_code=404, code=ErrorCode.RESOURCE_NOT_FOUND.value, message="Test not found")

        saved = 0
        per_answer_result: list[dict[str, Any]] = []
        existing_answers = {value.question_id: value for value in data_store.list_session_answers(session.id)}
        highest_index_answered = -1
        for question_id in existing_answers.keys():
            if question_id in session.question_order:
                highest_index_answered = max(highest_index_answered, session.question_order.index(question_id))

        for item in answers:
            question_id = item["question_id"]
            question = self._find_question(test, question_id)
            if not question:
                raise AppError(status_code=400, code=ErrorCode.INVALID_QUESTION.value, message="Invalid question id")
            if test.mode == "ntt":
                current_index = session.question_order.index(question_id)
                if current_index < highest_index_answered:
                    raise AppError(status_code=400, code=ErrorCode.VALIDATION_ERROR.value, message="Cannot answer previous question in NTT mode")
                highest_index_answered = max(highest_index_answered, current_index)

            answered_at = _ensure_utc(_parse_iso8601(item["answered_at"]))
            is_late = answered_at > session.expires_at
            is_correct, points_awarded = self._score_answer(question, item.get("answer_id"))
            session_answer = SessionAnswer(
                id=f"ans_{uuid.uuid4().hex[:12]}",
                session_id=session.id,
                question_id=question_id,
                answer_id=item.get("answer_id"),
                answered_at=answered_at,
                server_answered_at=_now(),
                time_spent_seconds=item.get("time_spent_seconds"),
                is_late=is_late,
                source=source,
                is_correct=is_correct,
                points_awarded=points_awarded,
            )
            applied = data_store.upsert_session_answer(session_answer, prefer_earlier=prefer_earlier)
            if not applied:
                continue
            saved += 1
            try:
                get_session_store().publish_event(
                    "test_events",
                    "answer_submitted",
                    {
                        "session_id": session.id,
                        "question_id": question_id,
                        "is_correct": is_correct,
                        "topic": question.topic,
                        "school_id": session.school_id,
                    },
                )
            except BackendUnavailableError as exc:
                raise _service_unavailable() from exc
            if test.show_answers == "immediately":
                correct_option = next((value for value in question.answers if value.is_correct), None)
                per_answer_result.append(
                    {
                        "question_id": question_id,
                        "is_correct": is_correct,
                        "correct_answer_id": correct_option.answer_id if correct_option else None,
                    }
                )

        total_answered = len(data_store.list_session_answers(session.id))
        return {
            "session": session,
            "answers_saved": saved,
            "total_answered": total_answered,
            "per_answer_result": per_answer_result or None,
        }

    def finish_session(self, *, current_user: User, session_id: str, final_answers: list[dict[str, Any]]) -> dict[str, Any]:
        if final_answers:
            self.submit_answers(
                current_user=current_user,
                session_id=session_id,
                answers=final_answers,
                prefer_earlier=True,
                source="final",
            )

        try:
            data_store = get_data_store()
            session = data_store.get_test_session(session_id)
        except BackendUnavailableError as exc:
            raise _service_unavailable() from exc
        if not session:
            raise AppError(status_code=404, code=ErrorCode.RESOURCE_NOT_FOUND.value, message="Session not found")
        if current_user.role != Role.STUDENT or current_user.id != session.student_id:
            raise AppError(status_code=403, code=ErrorCode.ROLE_FORBIDDEN.value, message="Session belongs to another student")
        if session.status in {"completed", "expired"}:
            assignment = data_store.get_assignment_by_id(session.assignment_id)
            test = data_store.get_test_by_id(session.test_id)
            answers = data_store.list_session_answers(session.id)
            return self._build_finish_result(
                session=session,
                assignment=assignment,
                test=test,
                answers=answers,
                total_questions=len(session.question_order),
            )

        answers = data_store.list_session_answers(session.id)
        total_questions = len(session.question_order)
        correct_answers = sum(1 for value in answers if value.is_correct)
        total_points = 0
        earned_points = 0
        test = data_store.get_test_by_id(session.test_id)
        if not test:
            raise AppError(status_code=404, code=ErrorCode.RESOURCE_NOT_FOUND.value, message="Test not found")
        points_by_question = {question.question_id: question.points for question in test.questions}
        for question in test.questions:
            total_points += question.points
        for value in answers:
            earned_points += min(points_by_question.get(value.question_id, 0), value.points_awarded)

        score = round((earned_points / total_points) * 100, 2) if total_points else 0.0
        if session.mode == "ntt":
            session.status = "completed"
        else:
            session.status = "completed" if session.expires_at > _now() else "expired"
        session.completed_at = _now()
        session.score_percent = score
        session.late_submission = any(value.is_late for value in answers) or session.expires_at <= _now()
        data_store.save_test_session(session)

        try:
            get_session_store().publish_event(
                "test_events",
                "session_finalized",
                {
                    "session_id": session.id,
                    "test_id": session.test_id,
                    "student_id": session.student_id,
                    "school_id": session.school_id,
                    "score_percent": score,
                    "is_late": session.late_submission,
                },
            )
        except BackendUnavailableError as exc:
            raise _service_unavailable() from exc

        analytics_service.recalculate_for_session(session.id)

        assignment = data_store.get_assignment_by_id(session.assignment_id)
        return self._build_finish_result(
            session=session,
            assignment=assignment,
            test=test,
            answers=answers,
            total_questions=total_questions,
            correct_answers=correct_answers,
        )

    def _build_finish_result(
        self,
        *,
        session: TestSessionResource,
        assignment: TestAssignment | None,
        test: TestResource | None,
        answers: list[SessionAnswer],
        total_questions: int,
        correct_answers: int | None = None,
    ) -> dict[str, Any]:
        computed_correct = correct_answers if correct_answers is not None else sum(1 for value in answers if value.is_correct)
        topic_breakdown = self._build_topic_breakdown(test=test, answers=answers)
        return {
            "session_id": session.id,
            "assignment_id": assignment.id if assignment else session.assignment_id,
            "status": session.status,
            "score_percent": session.score_percent,
            "total_questions": total_questions,
            "answered_questions": len(answers),
            "correct_answers": computed_correct,
            "late_submission": session.late_submission,
            "topic_breakdown": topic_breakdown,
        }

    def _build_topic_breakdown(self, *, test: TestResource | None, answers: list[SessionAnswer]) -> list[dict[str, Any]]:
        if not test:
            return []

        answers_by_question = {value.question_id: value for value in answers}
        by_topic: dict[str, dict[str, int]] = {}

        for question in test.questions:
            topic = question.topic or "general"
            bucket = by_topic.setdefault(topic, {"total_questions": 0, "answered_questions": 0, "correct_answers": 0})
            bucket["total_questions"] += 1

            answer = answers_by_question.get(question.question_id)
            if answer is None:
                continue
            bucket["answered_questions"] += 1
            if answer.is_correct:
                bucket["correct_answers"] += 1

        result: list[dict[str, Any]] = []
        for topic, stats in sorted(by_topic.items(), key=lambda item: item[0]):
            total = stats["total_questions"]
            score_percent = round((stats["correct_answers"] / total) * 100, 2) if total else 0.0
            result.append(
                {
                    "topic": topic,
                    "total_questions": total,
                    "answered_questions": stats["answered_questions"],
                    "correct_answers": stats["correct_answers"],
                    "score_percent": score_percent,
                }
            )
        return result

    def class_results(self, *, current_user: User, test_id: str, class_id: str) -> dict[str, Any]:
        if current_user.role != Role.TEACHER:
            raise AppError(status_code=403, code=ErrorCode.ROLE_FORBIDDEN.value, message="Only teacher can access class results")

        try:
            data_store = get_data_store()
            test = data_store.get_test_by_id(test_id)
        except BackendUnavailableError as exc:
            raise _service_unavailable() from exc

        if not test:
            raise AppError(status_code=404, code=ErrorCode.RESOURCE_NOT_FOUND.value, message="Test not found")
        if test.teacher_id != current_user.id:
            raise AppError(status_code=403, code=ErrorCode.ROLE_FORBIDDEN.value, message="Teacher can view only own test results")
        if test.school_id != (current_user.school_id or ""):
            raise AppError(status_code=403, code=ErrorCode.SCHOOL_ACCESS_FORBIDDEN.value, message="Cross-school access denied")

        assignment = data_store.find_assignment(test_id=test_id, class_id=class_id)
        if not assignment:
            raise AppError(status_code=404, code=ErrorCode.RESOURCE_NOT_FOUND.value, message="Assignment not found")
        if assignment.teacher_id != current_user.id:
            raise AppError(status_code=403, code=ErrorCode.ROLE_FORBIDDEN.value, message="Assignment does not belong to teacher")

        students = data_store.list_students_by_class(class_id)
        sessions = [value for value in data_store.list_sessions_by_class(class_id) if value.assignment_id == assignment.id]

        latest_by_student: dict[str, TestSessionResource] = {}
        for session in sorted(sessions, key=lambda item: item.started_at):
            latest_by_student[session.student_id] = session

        completed_scores: list[float] = []
        rows: list[dict[str, Any]] = []
        for student in students:
            session = latest_by_student.get(student.id)
            if session is None:
                rows.append(
                    {
                        "student_id": student.id,
                        "student_name": student.full_name,
                        "session_id": None,
                        "status": "not_started",
                        "score_percent": None,
                        "answered_questions": 0,
                        "total_questions": len(test.questions),
                        "correct_answers": 0,
                        "late_submission": False,
                        "completed_at": None,
                    }
                )
                continue

            answers = data_store.list_session_answers(session.id)
            correct_answers = sum(1 for value in answers if value.is_correct)
            if session.status in {"completed", "expired"} and session.score_percent is not None:
                completed_scores.append(float(session.score_percent))
            rows.append(
                {
                    "student_id": student.id,
                    "student_name": student.full_name,
                    "session_id": session.id,
                    "status": session.status,
                    "score_percent": session.score_percent,
                    "answered_questions": len(answers),
                    "total_questions": len(session.question_order),
                    "correct_answers": correct_answers,
                    "late_submission": bool(session.late_submission),
                    "completed_at": session.completed_at.isoformat() if session.completed_at else None,
                }
            )

        rows.sort(key=lambda item: item["student_name"].lower())
        average_score = round(sum(completed_scores) / len(completed_scores), 2) if completed_scores else 0.0

        return {
            "test_id": test_id,
            "class_id": class_id,
            "total_students": len(students),
            "sessions_total": len(latest_by_student),
            "completed_sessions": len(completed_scores),
            "average_score": average_score,
            "students": rows,
        }

    def offline_bundle(self, *, current_user: User, test_id: str) -> dict[str, Any]:
        if not settings.feature_offline_enabled:
            raise AppError(status_code=403, code=ErrorCode.ROLE_FORBIDDEN.value, message="Offline feature is disabled")
        if current_user.role != Role.STUDENT:
            raise AppError(status_code=403, code=ErrorCode.ROLE_FORBIDDEN.value, message="Only students can request offline bundle")
        try:
            data_store = get_data_store()
            test = data_store.get_test_by_id(test_id)
        except BackendUnavailableError as exc:
            raise _service_unavailable() from exc
        if not test:
            raise AppError(status_code=404, code=ErrorCode.RESOURCE_NOT_FOUND.value, message="Test not found")
        if test.mode == "ntt":
            raise AppError(status_code=400, code=ErrorCode.NTT_OFFLINE_FORBIDDEN.value, message="Offline mode is forbidden for NTT")

        student_class = data_store.get_student_class_id(current_user.id)
        assignments = data_store.list_assignments_by_test(test_id)
        assignment = next((value for value in assignments if value.class_id == student_class), None)
        if not assignment:
            raise AppError(status_code=403, code=ErrorCode.ROLE_FORBIDDEN.value, message="Test is not assigned to student class")
        return {
            "test_id": test.id,
            "mode": test.mode,
            "expires_at": assignment.deadline.isoformat(),
            "questions": [
                {
                    "question_id": question.question_id,
                    "text": question.text,
                    "topic": question.topic,
                    "answers": [{"answer_id": answer.answer_id, "text": answer.text} for answer in question.answers],
                }
                for question in test.questions
            ],
        }

    def sync_answers(self, *, current_user: User, session_id: str, answers: list[dict[str, Any]]) -> dict[str, Any]:
        if not settings.feature_offline_enabled:
            raise AppError(status_code=403, code=ErrorCode.ROLE_FORBIDDEN.value, message="Offline feature is disabled")
        result = self.submit_answers(
            current_user=current_user,
            session_id=session_id,
            answers=answers,
            prefer_earlier=True,
            source="offline",
            allow_expired=True,
        )
        session: TestSessionResource = result["session"]
        all_answers = get_data_store().list_session_answers(session.id)
        late_submission = any(value.is_late for value in all_answers)
        if len(all_answers) >= len(session.question_order):
            finish_result = self.finish_session(current_user=current_user, session_id=session_id, final_answers=[])
            status = finish_result["status"]
        else:
            status = session.status
        return {
            "session_id": session.id,
            "synced_answers": result["answers_saved"],
            "total_answered": len(all_answers),
            "late_submission": late_submission,
            "status": status,
        }

    def finalize_expired_sessions(self) -> int:
        try:
            data_store = get_data_store()
            sessions = data_store.list_expired_sessions(_now())
        except BackendUnavailableError as exc:
            raise _service_unavailable() from exc
        finalized = 0
        for session in sessions:
            user = data_store.get_user_by_id(session.student_id)
            if user:
                self.finish_session(current_user=user, session_id=session.id, final_answers=[])
                finalized += 1
        return finalized


service = TestService()
