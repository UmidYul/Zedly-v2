from __future__ import annotations

import hashlib
import hmac
import time
from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient

from app.repositories.runtime import get_data_store
from conftest import login_director, login_inspector, login_student, login_teacher


def _auth_header(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _telegram_payload(*, telegram_id: int, first_name: str, username: str, bot_token: str = "dev-bot-token") -> dict:
    auth_date = int(time.time())
    payload = {
        "id": str(telegram_id),
        "first_name": first_name,
        "username": username,
        "auth_date": str(auth_date),
    }
    data_check = "\n".join(f"{key}={payload[key]}" for key in sorted(payload))
    secret = hashlib.sha256(bot_token.encode("utf-8")).digest()
    signature = hmac.new(secret, data_check.encode("utf-8"), hashlib.sha256).hexdigest()
    payload["hash"] = signature
    return payload


def test_telegram_onboarding_register_flow(client: TestClient) -> None:
    auth_data = _telegram_payload(telegram_id=5550001, first_name="New", username="new_teacher")
    telegram_response = client.post("/auth/telegram", json={"auth_data": auth_data})
    assert telegram_response.status_code == 200
    body = telegram_response.json()
    assert body["status"] == "onboarding_required"
    onboarding_token = body["onboarding_token"]

    register = client.post(
        "/users/register",
        json={
            "role": "teacher",
            "full_name": "Teacher New",
            "email": "newteacher@school.uz",
            "password": "newteacher-pass",
            "subject": "physics",
            "school": {"school_id": "school_A"},
            "onboarding_token": onboarding_token,
        },
    )
    assert register.status_code == 201
    register_body = register.json()
    assert register_body["role"] == "teacher"
    assert register_body["status"] == "pending_approval"
    assert register_body["access_token"] is None

    login_pending = client.post(
        "/auth/login",
        json={"email": "newteacher@school.uz", "password": "newteacher-pass"},
    )
    assert login_pending.status_code == 403
    assert login_pending.json()["error"]["code"] == "ACCOUNT_PENDING_APPROVAL"

    director = login_director(client)
    director_auth = _auth_header(director["access_token"])
    activate = client.patch(
        f"/schools/school_A/users/{register_body['user_id']}",
        headers=director_auth,
        json={"status": "active"},
    )
    assert activate.status_code == 200
    assert activate.json()["status"] == "active"

    login_approved = client.post(
        "/auth/login",
        json={"email": "newteacher@school.uz", "password": "newteacher-pass"},
    )
    assert login_approved.status_code == 200
    assert "access_token" in login_approved.json()

    register_reuse = client.post(
        "/users/register",
        json={
            "role": "teacher",
            "full_name": "Teacher New 2",
            "email": "newteacher2@school.uz",
            "password": "newteacher-pass",
            "subject": "physics",
            "school": {"school_id": "school_A"},
            "onboarding_token": onboarding_token,
        },
    )
    assert register_reuse.status_code == 400
    assert register_reuse.json()["error"]["code"] == "ONBOARDING_TOKEN_INVALID"


def test_test_assignment_session_and_analytics_flow(client: TestClient) -> None:
    teacher = login_teacher(client)
    teacher_auth = _auth_header(teacher["access_token"])

    create_test = client.post(
        "/tests",
        headers=teacher_auth,
        json={
            "title": "Physics Weekly",
            "subject": "physics",
            "mode": "standard",
            "status": "published",
            "questions": [
                {
                    "question_id": "q1",
                    "text": "2+2",
                    "topic": "arithmetic",
                    "answers": [
                        {"answer_id": "a1", "text": "4", "is_correct": True},
                        {"answer_id": "a2", "text": "5", "is_correct": False},
                    ],
                }
            ],
        },
    )
    assert create_test.status_code == 201
    test_id = create_test.json()["id"]

    deadline = (datetime.now(timezone.utc) + timedelta(hours=2)).isoformat()
    assign = client.post(
        f"/tests/{test_id}/assign",
        headers=teacher_auth,
        json={"assignments": [{"class_id": "cls_A_7A", "deadline": deadline}]},
    )
    assert assign.status_code == 201
    assignment_id = assign.json()["assignments_created"][0]["assignment_id"]

    student = login_student(client)
    student_auth = _auth_header(student["access_token"])
    start = client.post(
        f"/tests/{test_id}/sessions",
        headers=student_auth,
        json={"assignment_id": assignment_id, "offline_mode": False},
    )
    assert start.status_code == 201
    session_id = start.json()["session_id"]

    submit = client.post(
        f"/sessions/{session_id}/answers",
        headers=student_auth,
        json={
            "answers": [
                {
                    "question_id": "q1",
                    "answer_id": "a1",
                    "answered_at": datetime.now(timezone.utc).isoformat(),
                }
            ]
        },
    )
    assert submit.status_code == 200
    assert submit.json()["answers_saved"] == 1

    finish = client.post(f"/sessions/{session_id}/finish", headers=student_auth, json={"final_answers": []})
    assert finish.status_code == 200
    assert finish.json()["status"] in {"completed", "expired"}

    teacher_dashboard = client.get("/analytics/teacher/dashboard", headers=teacher_auth)
    assert teacher_dashboard.status_code == 200
    assert "class_average" in teacher_dashboard.json()

    director = login_director(client)
    director_auth = _auth_header(director["access_token"])
    director_dashboard = client.get("/analytics/director/dashboard", headers=director_auth)
    # school_A is seeded as freemium, so feature gate is expected.
    assert director_dashboard.status_code == 402


def test_offline_bundle_and_sync(client: TestClient) -> None:
    teacher = login_teacher(client)
    teacher_auth = _auth_header(teacher["access_token"])
    deadline = (datetime.now(timezone.utc) + timedelta(hours=2)).isoformat()
    assign = client.post(
        "/tests/tst_A_1/assign",
        headers=teacher_auth,
        json={"assignments": [{"class_id": "cls_A_7A", "deadline": deadline}]},
    )
    assert assign.status_code == 201
    assignment_id = assign.json()["assignments_created"][0]["assignment_id"]

    student = login_student(client)
    student_auth = _auth_header(student["access_token"])
    bundle = client.get("/tests/tst_A_1/offline-bundle", headers=student_auth)
    assert bundle.status_code == 200
    assert len(bundle.json()["questions"]) >= 1

    start = client.post(
        "/tests/tst_A_1/sessions",
        headers=student_auth,
        json={"assignment_id": assignment_id, "offline_mode": True},
    )
    assert start.status_code == 201
    session_id = start.json()["session_id"]

    sync = client.post(
        f"/sessions/{session_id}/sync",
        headers=student_auth,
        json={
            "answers": [
                {
                    "question_id": "q_A_1",
                    "answer_id": "a_A_1",
                    "answered_at": datetime.now(timezone.utc).isoformat(),
                }
            ]
        },
    )
    assert sync.status_code == 200
    assert sync.json()["synced_answers"] >= 1


def test_duplicate_session_start_returns_resume_url(client: TestClient) -> None:
    teacher = login_teacher(client)
    teacher_auth = _auth_header(teacher["access_token"])
    deadline = (datetime.now(timezone.utc) + timedelta(hours=2)).isoformat()
    assign = client.post(
        "/tests/tst_A_1/assign",
        headers=teacher_auth,
        json={"assignments": [{"class_id": "cls_A_7A", "deadline": deadline}]},
    )
    assert assign.status_code == 201
    assignment_id = assign.json()["assignments_created"][0]["assignment_id"]

    student = login_student(client)
    student_auth = _auth_header(student["access_token"])
    start_first = client.post(
        "/tests/tst_A_1/sessions",
        headers=student_auth,
        json={"assignment_id": assignment_id, "offline_mode": False},
    )
    assert start_first.status_code == 201
    session_id = start_first.json()["session_id"]

    start_duplicate = client.post(
        "/tests/tst_A_1/sessions",
        headers=student_auth,
        json={"assignment_id": assignment_id, "offline_mode": False},
    )
    assert start_duplicate.status_code == 409
    body = start_duplicate.json()
    assert body["error"]["code"] == "SESSION_ALREADY_EXISTS"
    details = body["error"]["details"]
    assert details["existing_session_id"] == session_id
    assert details["resume_url"] == f"/sessions/{session_id}"


def test_ntt_session_auto_finish_status_completed(client: TestClient) -> None:
    teacher = login_teacher(client)
    teacher_auth = _auth_header(teacher["access_token"])

    create_test = client.post(
        "/tests",
        headers=teacher_auth,
        json={
            "title": "NTT Physics",
            "subject": "physics",
            "mode": "ntt",
            "status": "published",
            "questions": [
                {
                    "question_id": "q_ntt_1",
                    "text": "Force formula",
                    "topic": "mechanics",
                    "answers": [
                        {"answer_id": "a_ntt_1", "text": "F=ma", "is_correct": True},
                        {"answer_id": "a_ntt_2", "text": "E=mc2", "is_correct": False},
                    ],
                }
            ],
        },
    )
    assert create_test.status_code == 201
    test_id = create_test.json()["id"]

    deadline = (datetime.now(timezone.utc) + timedelta(hours=2)).isoformat()
    assign = client.post(
        f"/tests/{test_id}/assign",
        headers=teacher_auth,
        json={"assignments": [{"class_id": "cls_A_7A", "deadline": deadline}]},
    )
    assert assign.status_code == 201
    assignment_id = assign.json()["assignments_created"][0]["assignment_id"]

    student = login_student(client)
    student_auth = _auth_header(student["access_token"])
    start = client.post(
        f"/tests/{test_id}/sessions",
        headers=student_auth,
        json={"assignment_id": assignment_id, "offline_mode": False},
    )
    assert start.status_code == 201
    session_id = start.json()["session_id"]

    data_store = get_data_store()
    session = data_store.get_test_session(session_id)
    assert session is not None
    session.expires_at = datetime.now(timezone.utc) - timedelta(minutes=1)
    data_store.save_test_session(session)

    finish = client.post(f"/sessions/{session_id}/finish", headers=student_auth, json={"final_answers": []})
    assert finish.status_code == 200
    assert finish.json()["status"] == "completed"


def test_invite_accept_class_limit_reached(client: TestClient) -> None:
    # seeded class has one student, freemium limit is 30.
    for index in range(29):
        response = client.post(
            "/auth/invite/accept",
            json={"invite_code": "ABC123", "full_name": f"Student {index}", "telegram_id": 800000 + index},
        )
        assert response.status_code == 200

    limit_response = client.post(
        "/auth/invite/accept",
        json={"invite_code": "ABC123", "full_name": "Student Overflow", "telegram_id": 900000},
    )
    assert limit_response.status_code == 403
    assert limit_response.json()["error"]["code"] == "CLASS_LIMIT_REACHED"


def test_inspector_dashboard_and_reports_status_download_flow(client: TestClient) -> None:
    teacher = login_teacher(client)
    teacher_auth = _auth_header(teacher["access_token"])

    create_test = client.post(
        "/tests",
        headers=teacher_auth,
        json={
            "title": "Inspector Seed Test",
            "subject": "physics",
            "mode": "standard",
            "status": "published",
            "questions": [
                {
                    "question_id": "q_i_1",
                    "text": "1+1",
                    "topic": "arithmetic",
                    "answers": [
                        {"answer_id": "a_i_1", "text": "2", "is_correct": True},
                        {"answer_id": "a_i_2", "text": "3", "is_correct": False},
                    ],
                }
            ],
        },
    )
    assert create_test.status_code == 201
    test_id = create_test.json()["id"]
    deadline = (datetime.now(timezone.utc) + timedelta(hours=2)).isoformat()
    assign = client.post(
        f"/tests/{test_id}/assign",
        headers=teacher_auth,
        json={"assignments": [{"class_id": "cls_A_7A", "deadline": deadline}]},
    )
    assert assign.status_code == 201
    assignment_id = assign.json()["assignments_created"][0]["assignment_id"]

    student = login_student(client)
    student_auth = _auth_header(student["access_token"])
    start = client.post(
        f"/tests/{test_id}/sessions",
        headers=student_auth,
        json={"assignment_id": assignment_id, "offline_mode": False},
    )
    assert start.status_code == 201
    session_id = start.json()["session_id"]
    submit = client.post(
        f"/sessions/{session_id}/answers",
        headers=student_auth,
        json={"answers": [{"question_id": "q_i_1", "answer_id": "a_i_1", "answered_at": datetime.now(timezone.utc).isoformat()}]},
    )
    assert submit.status_code == 200
    finish = client.post(f"/sessions/{session_id}/finish", headers=student_auth, json={"final_answers": []})
    assert finish.status_code == 200

    inspector = login_inspector(client)
    inspector_auth = _auth_header(inspector["access_token"])

    inspector_dashboard = client.get(
        "/analytics/inspector/dashboard",
        headers=inspector_auth,
        params={"district_id": "district_X", "period": "quarter"},
    )
    assert inspector_dashboard.status_code == 200
    payload = inspector_dashboard.json()
    assert payload["district_id"] == "district_X"
    assert payload["schools_total"] >= 1

    foreign_dashboard = client.get(
        "/analytics/inspector/dashboard",
        headers=inspector_auth,
        params={"district_id": "district_Y"},
    )
    assert foreign_dashboard.status_code == 403

    generate = client.post(
        "/reports/generate",
        headers=inspector_auth,
        json={
            "scope_level": "district",
            "scope_id": "district_X",
            "template_key": "roono_summary_pdf",
            "format": "pdf",
            "params": {"period": "Q1_2026"},
        },
    )
    assert generate.status_code == 202
    report_id = generate.json()["report_id"]

    download_not_ready = client.get(f"/reports/{report_id}/download", headers=inspector_auth, follow_redirects=False)
    assert download_not_ready.status_code == 409

    status_processing = client.get(f"/reports/{report_id}/status", headers=inspector_auth)
    assert status_processing.status_code == 200
    assert status_processing.json()["status"] in {"processing", "completed"}

    status_completed = client.get(f"/reports/{report_id}/status", headers=inspector_auth)
    assert status_completed.status_code == 200
    assert status_completed.json()["status"] == "completed"

    download_ready = client.get(f"/reports/{report_id}/download", headers=inspector_auth, follow_redirects=False)
    assert download_ready.status_code == 302
    assert "location" in download_ready.headers
