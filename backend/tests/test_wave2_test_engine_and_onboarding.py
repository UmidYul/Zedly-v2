from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient

from app.repositories.runtime import get_data_store
from conftest import api_v1, login_director, login_inspector, login_student, login_teacher, unwrap_success


def _auth_header(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_director_provisions_teacher_first_login_and_connects_methods(client: TestClient) -> None:
    director = login_director(client)
    director_auth = _auth_header(director["access_token"])

    provision = client.post(
        api_v1("/users/provision"),
        headers=director_auth,
        json={
            "role": "teacher",
            "full_name": "Teacher Provisioned",
            "subject": "physics",
            "class_name": "9A",
        },
    )
    assert provision.status_code == 201
    provision_body = unwrap_success(provision)
    assert provision_body["role"] == "teacher"
    assert provision_body["login"]
    assert provision_body["otp_password"]

    first_login = client.post(
        api_v1("/auth/login"),
        json={"login": provision_body["login"], "password": provision_body["otp_password"]},
    )
    assert first_login.status_code == 200
    first_login_body = unwrap_success(first_login)
    assert first_login_body["status"] == "password_change_required"

    changed = client.post(
        api_v1("/auth/password/change-first"),
        json={
            "challenge_token": first_login_body["challenge_token"],
            "new_password": "teacher-pass-1",
            "repeat_password": "teacher-pass-1",
        },
    )
    assert changed.status_code == 200
    changed_body = unwrap_success(changed)
    assert changed_body["status"] == "login_methods_prompt"
    access_token = changed_body["access_token"]
    teacher_auth = _auth_header(access_token)

    methods_before = client.get(api_v1("/users/me/login-methods"), headers=teacher_auth)
    assert methods_before.status_code == 200
    assert unwrap_success(methods_before) == {"google_connected": False, "telegram_connected": False}

    connect_google = client.post(api_v1("/users/me/login-methods/google/connect"), headers=teacher_auth)
    assert connect_google.status_code == 200
    assert unwrap_success(connect_google)["google_connected"] is True

    connect_telegram = client.post(api_v1("/users/me/login-methods/telegram/connect"), headers=teacher_auth)
    assert connect_telegram.status_code == 200
    assert unwrap_success(connect_telegram)["telegram_connected"] is True


def test_test_assignment_session_and_analytics_flow(client: TestClient) -> None:
    teacher = login_teacher(client)
    teacher_auth = _auth_header(teacher["access_token"])

    create_test = client.post(
        api_v1("/tests"),
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
    test_id = unwrap_success(create_test)["id"]

    deadline = (datetime.now(timezone.utc) + timedelta(hours=2)).isoformat()
    assign = client.post(
        api_v1(f"/tests/{test_id}/assign"),
        headers=teacher_auth,
        json={"assignments": [{"class_id": "cls_A_7A", "deadline": deadline}]},
    )
    assert assign.status_code == 201
    assignment_id = unwrap_success(assign)["assignments_created"][0]["assignment_id"]

    student = login_student(client)
    student_auth = _auth_header(student["access_token"])
    start = client.post(
        api_v1(f"/tests/{test_id}/sessions"),
        headers=student_auth,
        json={"assignment_id": assignment_id, "offline_mode": False},
    )
    assert start.status_code == 201
    session_id = unwrap_success(start)["session_id"]

    submit = client.post(
        api_v1(f"/sessions/{session_id}/answers"),
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
    assert unwrap_success(submit)["answers_saved"] == 1

    finish = client.post(api_v1(f"/sessions/{session_id}/finish"), headers=student_auth, json={"final_answers": []})
    assert finish.status_code == 200
    finish_body = unwrap_success(finish)
    assert finish_body["status"] in {"completed", "expired"}
    assert finish_body["topic_breakdown"] == [
        {
            "topic": "arithmetic",
            "total_questions": 1,
            "answered_questions": 1,
            "correct_answers": 1,
            "score_percent": 100.0,
        }
    ]

    teacher_dashboard = client.get(api_v1("/analytics/teacher/dashboard"), headers=teacher_auth)
    assert teacher_dashboard.status_code == 200
    assert "class_average" in unwrap_success(teacher_dashboard)

    director = login_director(client)
    director_auth = _auth_header(director["access_token"])
    director_dashboard = client.get(api_v1("/analytics/director/dashboard"), headers=director_auth)
    # school_A is seeded as freemium, so feature gate is expected.
    assert director_dashboard.status_code == 402


def test_teacher_can_view_class_results_by_test_and_class(client: TestClient) -> None:
    teacher = login_teacher(client)
    teacher_auth = _auth_header(teacher["access_token"])

    create_test = client.post(
        api_v1("/tests"),
        headers=teacher_auth,
        json={
            "title": "Class Results Smoke",
            "subject": "physics",
            "mode": "standard",
            "status": "published",
            "questions": [
                {
                    "question_id": "q_cls_1",
                    "text": "5+5",
                    "topic": "arithmetic",
                    "answers": [
                        {"answer_id": "a_cls_1", "text": "10", "is_correct": True},
                        {"answer_id": "a_cls_2", "text": "11", "is_correct": False},
                    ],
                }
            ],
        },
    )
    assert create_test.status_code == 201
    test_id = unwrap_success(create_test)["id"]

    deadline = (datetime.now(timezone.utc) + timedelta(hours=2)).isoformat()
    assign = client.post(
        api_v1(f"/tests/{test_id}/assign"),
        headers=teacher_auth,
        json={"assignments": [{"class_id": "cls_A_7A", "deadline": deadline}]},
    )
    assert assign.status_code == 201
    assignment_id = unwrap_success(assign)["assignments_created"][0]["assignment_id"]

    student = login_student(client)
    student_auth = _auth_header(student["access_token"])
    start = client.post(
        api_v1(f"/tests/{test_id}/sessions"),
        headers=student_auth,
        json={"assignment_id": assignment_id, "offline_mode": False},
    )
    assert start.status_code == 201
    session_id = unwrap_success(start)["session_id"]

    submit = client.post(
        api_v1(f"/sessions/{session_id}/answers"),
        headers=student_auth,
        json={"answers": [{"question_id": "q_cls_1", "answer_id": "a_cls_1", "answered_at": datetime.now(timezone.utc).isoformat()}]},
    )
    assert submit.status_code == 200
    finish = client.post(api_v1(f"/sessions/{session_id}/finish"), headers=student_auth, json={"final_answers": []})
    assert finish.status_code == 200

    class_results = client.get(
        api_v1(f"/tests/{test_id}/results"),
        headers=teacher_auth,
        params={"class_id": "cls_A_7A"},
    )
    assert class_results.status_code == 200
    payload = unwrap_success(class_results)
    assert payload["test_id"] == test_id
    assert payload["class_id"] == "cls_A_7A"
    assert payload["total_students"] >= 1
    assert payload["sessions_total"] >= 1
    assert payload["completed_sessions"] >= 1
    assert isinstance(payload["students"], list) and len(payload["students"]) >= 1
    assert any(item["student_id"] == "usr_student_A" for item in payload["students"])

    forbidden_for_student = client.get(
        api_v1(f"/tests/{test_id}/results"),
        headers=student_auth,
        params={"class_id": "cls_A_7A"},
    )
    assert forbidden_for_student.status_code == 403


def test_offline_bundle_and_sync(client: TestClient) -> None:
    teacher = login_teacher(client)
    teacher_auth = _auth_header(teacher["access_token"])
    deadline = (datetime.now(timezone.utc) + timedelta(hours=2)).isoformat()
    assign = client.post(
        api_v1("/tests/tst_A_1/assign"),
        headers=teacher_auth,
        json={"assignments": [{"class_id": "cls_A_7A", "deadline": deadline}]},
    )
    assert assign.status_code == 201
    assignment_id = unwrap_success(assign)["assignments_created"][0]["assignment_id"]

    student = login_student(client)
    student_auth = _auth_header(student["access_token"])
    bundle = client.get(api_v1("/tests/tst_A_1/offline-bundle"), headers=student_auth)
    assert bundle.status_code == 200
    assert len(unwrap_success(bundle)["questions"]) >= 1

    start = client.post(
        api_v1("/tests/tst_A_1/sessions"),
        headers=student_auth,
        json={"assignment_id": assignment_id, "offline_mode": True},
    )
    assert start.status_code == 201
    session_id = unwrap_success(start)["session_id"]

    sync = client.post(
        api_v1(f"/sessions/{session_id}/sync"),
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
    assert unwrap_success(sync)["synced_answers"] >= 1


def test_duplicate_session_start_returns_resume_url(client: TestClient) -> None:
    teacher = login_teacher(client)
    teacher_auth = _auth_header(teacher["access_token"])
    deadline = (datetime.now(timezone.utc) + timedelta(hours=2)).isoformat()
    assign = client.post(
        api_v1("/tests/tst_A_1/assign"),
        headers=teacher_auth,
        json={"assignments": [{"class_id": "cls_A_7A", "deadline": deadline}]},
    )
    assert assign.status_code == 201
    assignment_id = unwrap_success(assign)["assignments_created"][0]["assignment_id"]

    student = login_student(client)
    student_auth = _auth_header(student["access_token"])
    start_first = client.post(
        api_v1("/tests/tst_A_1/sessions"),
        headers=student_auth,
        json={"assignment_id": assignment_id, "offline_mode": False},
    )
    assert start_first.status_code == 201
    session_id = unwrap_success(start_first)["session_id"]

    start_duplicate = client.post(
        api_v1("/tests/tst_A_1/sessions"),
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
        api_v1("/tests"),
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
    test_id = unwrap_success(create_test)["id"]

    deadline = (datetime.now(timezone.utc) + timedelta(hours=2)).isoformat()
    assign = client.post(
        api_v1(f"/tests/{test_id}/assign"),
        headers=teacher_auth,
        json={"assignments": [{"class_id": "cls_A_7A", "deadline": deadline}]},
    )
    assert assign.status_code == 201
    assignment_id = unwrap_success(assign)["assignments_created"][0]["assignment_id"]

    student = login_student(client)
    student_auth = _auth_header(student["access_token"])
    start = client.post(
        api_v1(f"/tests/{test_id}/sessions"),
        headers=student_auth,
        json={"assignment_id": assignment_id, "offline_mode": False},
    )
    assert start.status_code == 201
    session_id = unwrap_success(start)["session_id"]

    data_store = get_data_store()
    session = data_store.get_test_session(session_id)
    assert session is not None
    session.expires_at = datetime.now(timezone.utc) - timedelta(minutes=1)
    data_store.save_test_session(session)

    finish = client.post(api_v1(f"/sessions/{session_id}/finish"), headers=student_auth, json={"final_answers": []})
    assert finish.status_code == 200
    assert unwrap_success(finish)["status"] == "completed"


def test_account_provision_hierarchy_restrictions(client: TestClient) -> None:
    teacher = login_teacher(client)
    teacher_auth = _auth_header(teacher["access_token"])
    teacher_attempt = client.post(
        api_v1("/users/provision"),
        headers=teacher_auth,
        json={"role": "student", "full_name": "Forbidden Student", "class_id": "cls_A_7A"},
    )
    assert teacher_attempt.status_code == 403
    assert teacher_attempt.json()["error"]["code"] == "ROLE_FORBIDDEN"

    director = login_director(client)
    director_auth = _auth_header(director["access_token"])
    cross_school_attempt = client.post(
        api_v1("/users/provision"),
        headers=director_auth,
        json={"role": "teacher", "full_name": "Cross School Teacher", "school_id": "school_B"},
    )
    assert cross_school_attempt.status_code == 403
    assert cross_school_attempt.json()["error"]["code"] == "SCHOOL_ACCESS_FORBIDDEN"

    missing_class_for_student = client.post(
        api_v1("/users/provision"),
        headers=director_auth,
        json={"role": "student", "full_name": "No Class Student"},
    )
    assert missing_class_for_student.status_code == 400
    assert missing_class_for_student.json()["error"]["code"] == "VALIDATION_ERROR"


def test_inspector_dashboard_and_reports_status_download_flow(client: TestClient) -> None:
    teacher = login_teacher(client)
    teacher_auth = _auth_header(teacher["access_token"])

    create_test = client.post(
        api_v1("/tests"),
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
    test_id = unwrap_success(create_test)["id"]
    deadline = (datetime.now(timezone.utc) + timedelta(hours=2)).isoformat()
    assign = client.post(
        api_v1(f"/tests/{test_id}/assign"),
        headers=teacher_auth,
        json={"assignments": [{"class_id": "cls_A_7A", "deadline": deadline}]},
    )
    assert assign.status_code == 201
    assignment_id = unwrap_success(assign)["assignments_created"][0]["assignment_id"]

    student = login_student(client)
    student_auth = _auth_header(student["access_token"])
    start = client.post(
        api_v1(f"/tests/{test_id}/sessions"),
        headers=student_auth,
        json={"assignment_id": assignment_id, "offline_mode": False},
    )
    assert start.status_code == 201
    session_id = unwrap_success(start)["session_id"]
    submit = client.post(
        api_v1(f"/sessions/{session_id}/answers"),
        headers=student_auth,
        json={"answers": [{"question_id": "q_i_1", "answer_id": "a_i_1", "answered_at": datetime.now(timezone.utc).isoformat()}]},
    )
    assert submit.status_code == 200
    finish = client.post(api_v1(f"/sessions/{session_id}/finish"), headers=student_auth, json={"final_answers": []})
    assert finish.status_code == 200

    inspector = login_inspector(client)
    inspector_auth = _auth_header(inspector["access_token"])

    inspector_dashboard = client.get(
        api_v1("/analytics/inspector/dashboard"),
        headers=inspector_auth,
        params={"district_id": "district_X", "period": "quarter"},
    )
    assert inspector_dashboard.status_code == 200
    payload = unwrap_success(inspector_dashboard)
    assert payload["district_id"] == "district_X"
    assert payload["schools_total"] >= 1

    foreign_dashboard = client.get(
        api_v1("/analytics/inspector/dashboard"),
        headers=inspector_auth,
        params={"district_id": "district_Y"},
    )
    assert foreign_dashboard.status_code == 403

    generate = client.post(
        api_v1("/reports/generate"),
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
    report_id = unwrap_success(generate)["report_id"]

    download_not_ready = client.get(api_v1(f"/reports/{report_id}/download"), headers=inspector_auth, follow_redirects=False)
    assert download_not_ready.status_code == 409

    status_processing = client.get(api_v1(f"/reports/{report_id}/status"), headers=inspector_auth)
    assert status_processing.status_code == 200
    assert unwrap_success(status_processing)["status"] in {"processing", "completed"}

    status_completed = client.get(api_v1(f"/reports/{report_id}/status"), headers=inspector_auth)
    assert status_completed.status_code == 200
    assert unwrap_success(status_completed)["status"] == "completed"

    download_ready = client.get(api_v1(f"/reports/{report_id}/download"), headers=inspector_auth, follow_redirects=False)
    assert download_ready.status_code == 302
    assert "location" in download_ready.headers
