from __future__ import annotations

from fastapi.testclient import TestClient


def _auth_header(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _unwrap_success(response) -> dict:
    body = response.json()
    assert body["ok"] is True
    assert "data" in body
    return body["data"]


def test_v1_health_uses_ok_data_contract(client: TestClient) -> None:
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    data = _unwrap_success(response)
    assert data["status"] == "ok"


def test_v1_auth_login_uses_ok_data_contract(client: TestClient) -> None:
    response = client.post(
        "/api/v1/auth/login",
        json={"login": "teacher.a.schoola.1", "password": "teacher-pass"},
    )
    assert response.status_code == 200
    data = _unwrap_success(response)
    assert data["token_type"] == "bearer"
    assert data["access_token"]
    assert data["refresh_token"]
    assert "zedly_rt=" in (response.headers.get("set-cookie") or "")


def test_v1_refresh_prefers_cookie_over_body_token(client: TestClient) -> None:
    login_response = client.post(
        "/api/v1/auth/login",
        json={"login": "teacher.a.schoola.1", "password": "teacher-pass"},
    )
    assert login_response.status_code == 200

    refresh_response = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": "invalid-token-from-body"},
    )
    assert refresh_response.status_code == 200
    data = _unwrap_success(refresh_response)
    assert data["access_token"]
    assert data["refresh_token"]


def test_v1_logout_accepts_cookie_without_body(client: TestClient) -> None:
    login_response = client.post(
        "/api/v1/auth/login",
        json={"login": "teacher.a.schoola.1", "password": "teacher-pass"},
    )
    assert login_response.status_code == 200
    login_data = _unwrap_success(login_response)
    old_refresh_token = login_data["refresh_token"]

    logout_response = client.post(
        "/api/v1/auth/logout",
        headers=_auth_header(login_data["access_token"]),
        json={},
    )
    assert logout_response.status_code == 200
    logout_data = _unwrap_success(logout_response)
    assert logout_data["status"] == "ok"
    assert "Max-Age=0" in (logout_response.headers.get("set-cookie") or "")

    reuse_refresh = client.post("/api/v1/auth/refresh", json={"refresh_token": old_refresh_token})
    assert reuse_refresh.status_code == 401


def test_v1_forgot_password_is_non_enumerating_and_accepted(client: TestClient) -> None:
    existing = client.post("/api/v1/auth/password/forgot", json={"login": "teacher.a.schoola.1"})
    assert existing.status_code == 200
    existing_data = _unwrap_success(existing)
    assert existing_data["status"] == "accepted"

    missing = client.post("/api/v1/auth/password/forgot", json={"login": "unknown.login"})
    assert missing.status_code == 200
    missing_data = _unwrap_success(missing)
    assert missing_data["status"] == "accepted"


def test_v1_auth_error_uses_ok_false_contract(client: TestClient) -> None:
    response = client.post(
        "/api/v1/auth/login",
        json={"login": "teacher.a.schoola.1", "password": "wrong-password"},
    )
    assert response.status_code == 401
    payload = response.json()
    assert payload["ok"] is False
    assert payload["error"]["code"] == "UNAUTHORIZED"


def test_legacy_routes_emit_deprecation_headers(client: TestClient) -> None:
    response = client.post(
        "/auth/login",
        json={"login": "teacher.a.schoola.1", "password": "teacher-pass"},
    )
    assert response.status_code == 200
    assert response.headers.get("deprecation") == "true"
    assert response.headers.get("sunset")
    assert "/api/v1" in (response.headers.get("link") or "")
