from __future__ import annotations

from fastapi.testclient import TestClient


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
        json={"email": "teacherA@school.uz", "password": "teacher-pass"},
    )
    assert response.status_code == 200
    data = _unwrap_success(response)
    assert data["token_type"] == "bearer"
    assert data["access_token"]
    assert data["refresh_token"]


def test_v1_auth_error_uses_ok_false_contract(client: TestClient) -> None:
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "teacherA@school.uz", "password": "wrong-password"},
    )
    assert response.status_code == 401
    payload = response.json()
    assert payload["ok"] is False
    assert payload["error"]["code"] == "UNAUTHORIZED"


def test_legacy_routes_emit_deprecation_headers(client: TestClient) -> None:
    response = client.post(
        "/auth/login",
        json={"email": "teacherA@school.uz", "password": "teacher-pass"},
    )
    assert response.status_code == 200
    assert response.headers.get("deprecation") == "true"
    assert response.headers.get("sunset")
    assert "/api/v1" in (response.headers.get("link") or "")
