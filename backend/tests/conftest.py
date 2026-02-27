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


@pytest.fixture()
def client() -> TestClient:
    reset_runtime_backends()
    return TestClient(app)


def login_teacher(client: TestClient) -> dict:
    response = client.post(
        "/auth/login",
        json={"email": "teacherA@school.uz", "password": "teacher-pass"},
    )
    assert response.status_code == 200
    return response.json()
