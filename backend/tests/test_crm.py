from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.api.routes import crm
from app.dependencies.auth import get_current_user
from app.main import app
from app.models.auth import CurrentUser, UserRole


@pytest.fixture
def client():
    app.dependency_overrides.clear()
    yield TestClient(app)
    app.dependency_overrides.clear()


def authorize(role=UserRole.ADMIN):
    app.dependency_overrides[get_current_user] = lambda: CurrentUser(
        id=uuid4(), full_name="Reviewer", email="reviewer@example.com", role=role,
    )


@pytest.mark.parametrize("path", ["/api/v1/admin/participants", "/api/v1/admin/dashboard"])
def test_crm_permissions(client, path):
    assert client.get(path).status_code == 401
    authorize(UserRole.PARTICIPANT)
    assert client.get(path).status_code == 403


def test_directory_search_filters_and_pagination(client, monkeypatch):
    authorize()
    one, two = str(uuid4()), str(uuid4())
    rows = {
        "profiles": [{"id": one, "full_name": "Alice", "email": "alice@example.com"},
                     {"id": two, "full_name": "Bob", "email": "bob@example.com"}],
        "registrations": [{"participant_id": one, "status": "ATTENDED"},
                          {"participant_id": one, "status": "CANCELLED"}],
    }
    monkeypatch.setattr(crm, "read_all", lambda table, columns, **filters: rows[table])
    page = client.get("/api/v1/admin/participants?page_size=1").json()
    assert page["total"] == 2
    assert page["items"][0]["full_name"] == "Alice"
    assert page["items"][0]["registrations"] == 2
    assert page["items"][0]["attended"] == 1
    assert page["items"][0]["cancelled"] == 1
    assert client.get("/api/v1/admin/participants?page_size=1&page=2").json()["items"][0]["full_name"] == "Bob"
    assert client.get("/api/v1/admin/participants?q=BOB@").json()["total"] == 1
    assert client.get("/api/v1/admin/participants?participation=none").json()["items"][0]["id"] == two
    assert client.get("/api/v1/admin/participants?participation=attended").json()["total"] == 1
    assert client.get("/api/v1/admin/participants?participation=registered").json()["total"] == 0
    assert client.get("/api/v1/admin/participants?page=0").status_code == 422
    assert client.get("/api/v1/admin/participants?page_size=101").status_code == 422


def test_dashboard_totals_and_upcoming(client, monkeypatch):
    authorize()
    now = datetime.now(timezone.utc)
    def event(days, status):
        return {"id": str(uuid4()), "name": "Event", "starts_at": (now + timedelta(days=days)).isoformat(),
                "location": "Hall", "online_link": None, "status": status}
    future = event(2, "PUBLISHED")
    rows = {
        "profiles": [{"id": str(uuid4())}],
        "events": [event(-1, "PUBLISHED"), event(1, "DRAFT"), future],
        "registrations": [{"status": s} for s in ["ATTENDED", "ATTENDED", "ABSENT", "CANCELLED", "REGISTERED"]],
    }
    monkeypatch.setattr(crm, "read_all", lambda table, columns, **filters: rows[table])
    data = client.get("/api/v1/admin/dashboard").json()
    assert data["participants"] == 1
    assert data["events"] == 3
    assert data["registrations"] == 5
    assert data["attendance_rate"] == 66.7
    assert data["active_registrations"] == 1
    assert [row["id"] for row in data["upcoming_events"]] == [future["id"]]


def test_empty_dashboard(client, monkeypatch):
    authorize()
    monkeypatch.setattr(crm, "read_all", lambda *args, **kwargs: [])
    data = client.get("/api/v1/admin/dashboard").json()
    assert data["attendance_rate"] == 0
    assert data["upcoming_events"] == []
    assert data["registrations"] == 0
