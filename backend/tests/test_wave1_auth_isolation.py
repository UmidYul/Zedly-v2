from __future__ import annotations

from fastapi.testclient import TestClient

from conftest import login_teacher


def _auth_header(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_auth_lifecycle_refresh_rotation_and_reuse_detection(client: TestClient) -> None:
    login_payload = login_teacher(client)
    refresh_token_1 = login_payload["refresh_token"]

    refresh_response = client.post("/auth/refresh", json={"refresh_token": refresh_token_1})
    assert refresh_response.status_code == 200
    refresh_token_2 = refresh_response.json()["refresh_token"]

    reuse_response = client.post("/auth/refresh", json={"refresh_token": refresh_token_1})
    assert reuse_response.status_code == 401
    assert reuse_response.json()["error"]["code"] == "TOKEN_REUSE_DETECTED"

    after_family_revoke = client.post("/auth/refresh", json={"refresh_token": refresh_token_2})
    assert after_family_revoke.status_code == 401


def test_users_me_and_patch_restrictions(client: TestClient) -> None:
    login_payload = login_teacher(client)
    auth = _auth_header(login_payload["access_token"])

    me_response = client.get("/users/me", headers=auth)
    assert me_response.status_code == 200
    assert me_response.json()["role"] == "teacher"

    patch_ok = client.patch("/users/me", headers=auth, json={"full_name": "Teacher A Updated"})
    assert patch_ok.status_code == 200
    assert patch_ok.json()["full_name"] == "Teacher A Updated"

    patch_forbidden = client.patch("/users/me", headers=auth, json={"email": "new@school.uz"})
    assert patch_forbidden.status_code == 400
    assert patch_forbidden.json()["error"]["code"] == "VALIDATION_ERROR"


def test_cross_school_hidden_and_ip_blocking(client: TestClient) -> None:
    login_payload = login_teacher(client)
    auth = _auth_header(login_payload["access_token"])

    for _ in range(11):
        response = client.get("/schools/school_B/users", headers=auth)
        assert response.status_code in (403, 429)

    blocked = client.get("/users/me", headers=auth)
    assert blocked.status_code == 429


def test_create_test_ignores_school_id_spoofing(client: TestClient) -> None:
    login_payload = login_teacher(client)
    auth = _auth_header(login_payload["access_token"])

    response = client.post(
        "/tests",
        headers=auth,
        json={"title": "Spoof check", "mode": "standard", "school_id": "school_B"},
    )
    assert response.status_code == 201
    assert response.json()["school_id"] == "school_A"


def test_class_invite_assignment_scope(client: TestClient) -> None:
    login_payload = login_teacher(client)
    auth = _auth_header(login_payload["access_token"])

    forbidden = client.post("/classes/cls_B_8A/invite", headers=auth)
    assert forbidden.status_code == 403

    allowed = client.post("/classes/cls_A_7A/invite", headers=auth)
    assert allowed.status_code == 200
    assert allowed.json()["class_id"] == "cls_A_7A"


def test_invite_accept_creates_student_and_tokens(client: TestClient) -> None:
    response = client.post(
        "/auth/invite/accept",
        json={"invite_code": "ABC123", "full_name": "New Student", "telegram_id": 999001},
    )
    assert response.status_code == 200
    assert response.json()["token_type"] == "bearer"
