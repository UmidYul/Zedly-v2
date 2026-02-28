from __future__ import annotations

import os
import sys
from pathlib import Path

from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

os.environ.setdefault("ZEDLY_STORAGE_BACKEND", "memory")
os.environ.setdefault("ZEDLY_SESSIONS_BACKEND", "memory")

from app.main import app
from app.repositories.runtime import reset_runtime_backends


import pytest


API_V1_PREFIX = "/api/v1"


def api_v1(path: str) -> str:
    if path.startswith("/"):
        return f"{API_V1_PREFIX}{path}"
    return f"{API_V1_PREFIX}/{path}"


def unwrap_success(response) -> dict:
    body = response.json()
    assert body["ok"] is True
    assert "data" in body
    return body["data"]


@pytest.fixture()
def client() -> TestClient:
    reset_runtime_backends()
    return TestClient(app)


def login_teacher(client: TestClient) -> dict:
    response = client.post(
        api_v1("/auth/login"),
        json={"login": "teacher.a.schoola.1", "password": "teacher-pass"},
    )
    assert response.status_code == 200
    return unwrap_success(response)


def login_student(client: TestClient) -> dict:
    response = client.post(
        api_v1("/auth/login"),
        json={"login": "student.a.7a.schoola.1", "password": "student-pass"},
    )
    assert response.status_code == 200
    return unwrap_success(response)


def login_director(client: TestClient) -> dict:
    response = client.post(
        api_v1("/auth/login"),
        json={"login": "director.a.schoola.1", "password": "director-pass"},
    )
    assert response.status_code == 200
    return unwrap_success(response)


def login_inspector(client: TestClient) -> dict:
    response = client.post(
        api_v1("/auth/login"),
        json={"login": "inspector.x.districtx.1", "password": "inspector-pass"},
    )
    assert response.status_code == 200
    return unwrap_success(response)
