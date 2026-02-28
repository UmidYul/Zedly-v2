from __future__ import annotations

from fastapi.testclient import TestClient

from conftest import api_v1, login_director, login_teacher, unwrap_success


def _auth_header(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_auth_lifecycle_refresh_rotation_and_reuse_detection(client: TestClient) -> None:
    login_payload = login_teacher(client)
    refresh_token_1 = login_payload["refresh_token"]

    refresh_response = client.post(api_v1("/auth/refresh"), json={"refresh_token": refresh_token_1})
    assert refresh_response.status_code == 200
    refresh_token_2 = unwrap_success(refresh_response)["refresh_token"]

    # Force body token path for reuse detection instead of cookie-first happy path.
    client.cookies.clear()
    reuse_response = client.post(api_v1("/auth/refresh"), json={"refresh_token": refresh_token_1})
    assert reuse_response.status_code == 401
    assert reuse_response.json()["error"]["code"] == "TOKEN_REUSE_DETECTED"

    after_family_revoke = client.post(api_v1("/auth/refresh"), json={"refresh_token": refresh_token_2})
    assert after_family_revoke.status_code == 401


def test_users_me_and_patch_restrictions(client: TestClient) -> None:
    login_payload = login_teacher(client)
    auth = _auth_header(login_payload["access_token"])

    me_response = client.get(api_v1("/users/me"), headers=auth)
    assert me_response.status_code == 200
    me_payload = unwrap_success(me_response)
    assert me_payload["role"] == "teacher"
    assert me_payload["teacher_classes"][0]["class_id"] == "cls_A_7A"

    patch_ok = client.patch(api_v1("/users/me"), headers=auth, json={"full_name": "Teacher A Updated"})
    assert patch_ok.status_code == 200
    assert unwrap_success(patch_ok)["full_name"] == "Teacher A Updated"

    patch_forbidden = client.patch(api_v1("/users/me"), headers=auth, json={"email": "new@school.uz"})
    assert patch_forbidden.status_code == 400
    assert patch_forbidden.json()["error"]["code"] == "VALIDATION_ERROR"


def test_school_users_role_aware_filters(client: TestClient) -> None:
    teacher = login_teacher(client)
    teacher_auth = _auth_header(teacher["access_token"])

    teacher_students = client.get(api_v1("/schools/school_A/users"), headers=teacher_auth)
    assert teacher_students.status_code == 200
    teacher_payload = unwrap_success(teacher_students)
    assert teacher_payload["total_in_scope"] >= 1
    assert all(user["role"] == "student" for user in teacher_payload["users"])

    teacher_teacher_filter = client.get(api_v1("/schools/school_A/users"), headers=teacher_auth, params={"role": "teacher"})
    assert teacher_teacher_filter.status_code == 403
    assert teacher_teacher_filter.json()["error"]["code"] == "ROLE_FORBIDDEN"

    director = login_director(client)
    director_auth = _auth_header(director["access_token"])
    director_teachers = client.get(
        api_v1("/schools/school_A/users"),
        headers=director_auth,
        params={"role": "teacher", "status": "active", "search": "Teacher"},
    )
    assert director_teachers.status_code == 200
    director_payload = unwrap_success(director_teachers)
    assert director_payload["filtered_total"] >= 1
    assert all(user["role"] == "teacher" for user in director_payload["users"])


def test_school_users_class_scope_filter(client: TestClient) -> None:
    teacher = login_teacher(client)
    teacher_auth = _auth_header(teacher["access_token"])

    in_scope = client.get(api_v1("/schools/school_A/users"), headers=teacher_auth, params={"class_id": "cls_A_7A"})
    assert in_scope.status_code == 200
    in_scope_payload = unwrap_success(in_scope)
    assert in_scope_payload["class_id"] == "cls_A_7A"
    assert all(user["role"] == "student" for user in in_scope_payload["users"])

    cross_scope = client.get(api_v1("/schools/school_A/users"), headers=teacher_auth, params={"class_id": "cls_B_8A"})
    assert cross_scope.status_code == 403
    assert cross_scope.json()["error"]["code"] == "ROLE_FORBIDDEN"


def test_cross_school_hidden_and_ip_blocking(client: TestClient) -> None:
    login_payload = login_teacher(client)
    auth = _auth_header(login_payload["access_token"])

    for _ in range(11):
        response = client.get(api_v1("/schools/school_B/users"), headers=auth)
        assert response.status_code in (403, 429)

    blocked = client.get(api_v1("/users/me"), headers=auth)
    assert blocked.status_code == 429


def test_create_test_ignores_school_id_spoofing(client: TestClient) -> None:
    login_payload = login_teacher(client)
    auth = _auth_header(login_payload["access_token"])

    response = client.post(
        api_v1("/tests"),
        headers=auth,
        json={"title": "Spoof check", "mode": "standard", "school_id": "school_B"},
    )
    assert response.status_code == 201
    assert unwrap_success(response)["school_id"] == "school_A"


def test_class_invite_assignment_scope(client: TestClient) -> None:
    login_payload = login_teacher(client)
    auth = _auth_header(login_payload["access_token"])

    forbidden = client.post(api_v1("/classes/cls_B_8A/invite"), headers=auth)
    assert forbidden.status_code == 403

    allowed = client.post(api_v1("/classes/cls_A_7A/invite"), headers=auth)
    assert allowed.status_code == 200
    assert unwrap_success(allowed)["class_id"] == "cls_A_7A"


def test_director_provisions_student_first_login_requires_password_change(client: TestClient) -> None:
    director = login_director(client)
    director_auth = _auth_header(director["access_token"])

    provision = client.post(
        api_v1("/users/provision"),
        headers=director_auth,
        json={
            "role": "student",
            "full_name": "Provisioned Student",
            "class_id": "cls_A_7A",
        },
    )
    assert provision.status_code == 201
    provision_body = unwrap_success(provision)
    assert provision_body["role"] == "student"
    assert provision_body["login"]
    assert provision_body["otp_password"]

    first_login = client.post(
        api_v1("/auth/login"),
        json={"login": provision_body["login"], "password": provision_body["otp_password"]},
    )
    assert first_login.status_code == 200
    first_login_body = unwrap_success(first_login)
    assert first_login_body["status"] == "password_change_required"
    assert first_login_body["challenge_token"]

    change_password = client.post(
        api_v1("/auth/password/change-first"),
        json={
            "challenge_token": first_login_body["challenge_token"],
            "new_password": "student-pass-1",
            "repeat_password": "student-pass-1",
        },
    )
    assert change_password.status_code == 200
    change_password_body = unwrap_success(change_password)
    assert change_password_body["status"] == "login_methods_prompt"
    assert change_password_body["access_token"]

    me = client.get(api_v1("/users/me"), headers=_auth_header(change_password_body["access_token"]))
    assert me.status_code == 200
    assert unwrap_success(me)["role"] == "student"
