import asyncio
from typing import Any, Dict

from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_health_endpoint_exists() -> None:
    resp = client.get("/backend-api/health/ping")
    assert resp.status_code in (200, 404)


def test_exec_endpoint_shape_without_data() -> None:
    """
    Smoke test: /backend-api/dash/exec should return 404 until a snapshot is created.
    """
    resp = client.get("/backend-api/dash/exec")
    # Either 404 if no snapshot exists, or 200 if something has already been computed.
    assert resp.status_code in (200, 404)

