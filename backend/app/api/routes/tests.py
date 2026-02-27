from __future__ import annotations

from fastapi import APIRouter, Depends, Request

from app.middleware.chain import AuthContext, audit_trail, authenticate, enforce_assignment_scope, require_permission
from app.schemas.tests import (
    AssignTestRequest,
    AssignTestResponse,
    FinishSessionRequest,
    FinishSessionResponse,
    OfflineBundleResponse,
    StartSessionRequest,
    StartSessionResponse,
    SubmitAnswersRequest,
    SubmitAnswersResponse,
    SyncSessionResponse,
    TestCreateFullRequest,
    TestCreateResponse,
)
from app.services.assessment_service import service as test_service


router = APIRouter(tags=["tests"])


@router.post("/tests", response_model=TestCreateResponse, status_code=201)
def create_test(
    payload: TestCreateFullRequest,
    request: Request,
    auth: AuthContext = Depends(require_permission("create_test")),
) -> TestCreateResponse:
    test = test_service.create_test(current_user=auth.user, payload=payload.model_dump(exclude_none=False))
    audit_trail(event="test.created", auth=auth, resource_id=test.id, request=request)
    return TestCreateResponse(
        id=test.id,
        title=test.title,
        subject=test.subject,
        school_id=test.school_id,
        teacher_id=test.teacher_id,
        mode=test.mode,
        status=test.status,
        questions_count=len(test.questions),
    )


@router.get("/tests/{test_id}")
def get_test(
    test_id: str,
    request: Request,
    auth: AuthContext = Depends(authenticate),
) -> dict:
    result = test_service.get_test(current_user=auth.user, test_id=test_id)
    audit_trail(event="test.viewed", auth=auth, resource_id=test_id, request=request)
    return result


@router.post("/tests/{test_id}/assign", response_model=AssignTestResponse, status_code=201)
def assign_test(
    test_id: str,
    payload: AssignTestRequest,
    request: Request,
    auth: AuthContext = Depends(require_permission("assign_test_to_class")),
) -> AssignTestResponse:
    for item in payload.assignments:
        enforce_assignment_scope(auth=auth, class_id=item.class_id)
    created = test_service.assign_test(current_user=auth.user, test_id=test_id, assignments=[item.model_dump() for item in payload.assignments])
    audit_trail(event="test.assigned", auth=auth, resource_id=test_id, request=request)
    return AssignTestResponse(
        test_id=test_id,
        assignments_created=[
            {"assignment_id": item.id, "class_id": item.class_id, "deadline": item.deadline.isoformat(), "status": item.status}
            for item in created
        ],
    )


@router.post("/tests/{test_id}/sessions", response_model=StartSessionResponse, status_code=201)
def start_session(
    test_id: str,
    payload: StartSessionRequest,
    request: Request,
    auth: AuthContext = Depends(require_permission("take_test")),
) -> StartSessionResponse:
    session = test_service.start_session(
        current_user=auth.user,
        test_id=test_id,
        assignment_id=payload.assignment_id,
        offline_mode=payload.offline_mode,
    )
    test_payload = test_service.get_test(current_user=auth.user, test_id=test_id)
    bundle_questions = test_payload.get("questions") if payload.offline_mode else None
    audit_trail(event="test.session.started", auth=auth, resource_id=session.id, request=request)
    return StartSessionResponse(
        session_id=session.id,
        assignment_id=session.assignment_id,
        status=session.status,
        expires_at=session.expires_at.isoformat(),
        question_order=session.question_order,
        answer_shuffles=session.answer_shuffles,
        questions=bundle_questions,
    )


@router.post("/sessions/{session_id}/answers", response_model=SubmitAnswersResponse)
def submit_answers(
    session_id: str,
    payload: SubmitAnswersRequest,
    request: Request,
    auth: AuthContext = Depends(require_permission("take_test")),
) -> SubmitAnswersResponse:
    result = test_service.submit_answers(
        current_user=auth.user,
        session_id=session_id,
        answers=[item.model_dump() for item in payload.answers],
    )
    session = result["session"]
    audit_trail(event="test.session.answers_submitted", auth=auth, resource_id=session_id, request=request)
    return SubmitAnswersResponse(
        session_id=session.id,
        answers_saved=result["answers_saved"],
        total_answered=result["total_answered"],
        status=session.status,
        per_answer_result=result["per_answer_result"],
    )


@router.post("/sessions/{session_id}/finish", response_model=FinishSessionResponse)
def finish_session(
    session_id: str,
    payload: FinishSessionRequest,
    request: Request,
    auth: AuthContext = Depends(require_permission("take_test")),
) -> FinishSessionResponse:
    result = test_service.finish_session(
        current_user=auth.user,
        session_id=session_id,
        final_answers=[item.model_dump() for item in payload.final_answers],
    )
    audit_trail(event="test.session.finished", auth=auth, resource_id=session_id, request=request)
    return FinishSessionResponse(**result)


@router.get("/tests/{test_id}/offline-bundle", response_model=OfflineBundleResponse)
def offline_bundle(
    test_id: str,
    request: Request,
    auth: AuthContext = Depends(require_permission("take_test")),
) -> OfflineBundleResponse:
    result = test_service.offline_bundle(current_user=auth.user, test_id=test_id)
    audit_trail(event="test.offline_bundle.generated", auth=auth, resource_id=test_id, request=request)
    return OfflineBundleResponse(**result)


@router.post("/sessions/{session_id}/sync", response_model=SyncSessionResponse)
def sync_answers(
    session_id: str,
    payload: SubmitAnswersRequest,
    request: Request,
    auth: AuthContext = Depends(require_permission("take_test")),
) -> SyncSessionResponse:
    result = test_service.sync_answers(
        current_user=auth.user,
        session_id=session_id,
        answers=[item.model_dump() for item in payload.answers],
    )
    audit_trail(event="test.session.synced", auth=auth, resource_id=session_id, request=request)
    return SyncSessionResponse(**result)
