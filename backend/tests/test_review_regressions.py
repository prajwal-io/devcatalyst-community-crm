from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from uuid import UUID, uuid4

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.dependencies.auth import get_current_user
from app.main import app
from app.models.auth import CurrentUser, UserRole
from app.models.events import EventResponse, EventStatus, EventUpdate, RegistrationStatus
from app.services import events as event_service
from app.services import registrations as registration_service


class FakeRpcClient:
    def __init__(self, results: dict[str, object]) -> None:
        self.results = results
        self.calls: list[tuple[str, dict[str, object]]] = []

    def rpc(self, name: str, params: dict[str, object]) -> "FakeRpcClient":
        self.calls.append((name, params))
        return self

    def execute(self) -> SimpleNamespace:
        name, _ = self.calls[-1]
        result = self.results[name]
        if isinstance(result, Exception):
            raise result
        return SimpleNamespace(data=result)


@pytest.fixture(autouse=True)
def clear_dependency_overrides() -> None:
    app.dependency_overrides.clear()
    yield
    app.dependency_overrides.clear()


def participant() -> CurrentUser:
    return CurrentUser(
        id=uuid4(),
        full_name="Participant One",
        email="participant@example.com",
        role=UserRole.PARTICIPANT,
    )


def registration_row(event_id: UUID, participant_id: UUID, status: str = "REGISTERED") -> dict[str, object]:
    now = datetime.now(timezone.utc).isoformat()
    return {
        "id": str(uuid4()),
        "event_id": str(event_id),
        "participant_id": str(participant_id),
        "status": status,
        "registered_at": now,
        "cancelled_at": now if status == "CANCELLED" else None,
        "updated_at": now,
    }


def event_record(event_id: UUID) -> EventResponse:
    start = datetime.now(timezone.utc) + timedelta(days=3)
    return EventResponse(
        id=event_id,
        name="Review Event",
        description="Regression coverage",
        starts_at=start,
        ends_at=start + timedelta(hours=1),
        location="Community Hall",
        online_link=None,
        registration_deadline=start - timedelta(hours=1),
        capacity=20,
        status=EventStatus.PUBLISHED,
        created_by=uuid4(),
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
        active_registrations=2,
        available_spots=18,
    )


def test_admin_route_requires_authentication() -> None:
    response = TestClient(app).get("/api/v1/admin/events")

    assert response.status_code == 401
    assert response.json()["detail"] == "Authentication required"


def test_participant_is_denied_admin_route() -> None:
    app.dependency_overrides[get_current_user] = participant

    response = TestClient(app).get("/api/v1/admin/events")

    assert response.status_code == 403
    assert response.json()["detail"] == "Admin access required"


@pytest.mark.parametrize("as_list", [False, True])
def test_registration_rpc_accepts_dict_and_list_results(monkeypatch: pytest.MonkeyPatch, as_list: bool) -> None:
    user = participant()
    event_id = uuid4()
    row = registration_row(event_id, user.id)
    client = FakeRpcClient({"register_for_event": [row] if as_list else row})
    monkeypatch.setattr(registration_service, "get_supabase_admin_client", lambda: client)

    result = registration_service.register_for_event(event_id, user)

    assert result.event_id == event_id
    assert result.participant_id == user.id
    assert client.calls == [("register_for_event", {"p_event_id": str(event_id), "p_participant_id": str(user.id)})]


@pytest.mark.parametrize(
    ("token", "status_code", "detail"),
    [
        ("EVENT_NOT_FOUND", 404, "Event not found"),
        ("EVENT_NOT_PUBLISHED", 409, "Event is not open for registration"),
        ("REGISTRATION_CLOSED", 409, "Registration deadline has passed"),
        ("EVENT_FULL", 409, "Event capacity is full"),
        ("ALREADY_REGISTERED", 409, "You are already registered for this event"),
        ("database unavailable", 503, "Registration could not be completed"),
    ],
)
def test_registration_rpc_errors_are_mapped(
    monkeypatch: pytest.MonkeyPatch,
    token: str,
    status_code: int,
    detail: str,
) -> None:
    user = participant()
    client = FakeRpcClient({"register_for_event": RuntimeError(token)})
    monkeypatch.setattr(registration_service, "get_supabase_admin_client", lambda: client)

    with pytest.raises(HTTPException) as caught:
        registration_service.register_for_event(uuid4(), user)

    assert caught.value.status_code == status_code
    assert caught.value.detail == detail


@pytest.mark.parametrize("as_list", [False, True])
def test_cancel_rpc_accepts_dict_and_list_results(monkeypatch: pytest.MonkeyPatch, as_list: bool) -> None:
    user = participant()
    event_id = uuid4()
    row = registration_row(event_id, user.id, "CANCELLED")
    client = FakeRpcClient({"cancel_event_registration": [row] if as_list else row})
    monkeypatch.setattr(registration_service, "get_supabase_admin_client", lambda: client)

    result = registration_service.cancel_registration(event_id, user)

    assert result.status == RegistrationStatus.CANCELLED
    assert client.calls == [
        ("cancel_event_registration", {"p_event_id": str(event_id), "p_participant_id": str(user.id)})
    ]


def test_update_event_rejects_null_required_field_with_422() -> None:
    app.dependency_overrides[get_current_user] = lambda: CurrentUser(
        id=uuid4(), full_name="Admin", email="admin@example.com", role=UserRole.ADMIN
    )

    response = TestClient(app).patch(f"/api/v1/admin/events/{uuid4()}", json={"name": None})

    assert response.status_code == 422


@pytest.mark.parametrize("as_list", [False, True])
def test_update_event_rpc_uses_json_changes_and_normalizes_result(
    monkeypatch: pytest.MonkeyPatch, as_list: bool
) -> None:
    event_id = uuid4()
    existing = event_record(event_id)
    row = existing.model_dump(mode="json", exclude={"active_registrations", "available_spots"})
    row["capacity"] = 25
    client = FakeRpcClient({"update_event_details": [row] if as_list else row})
    monkeypatch.setattr(event_service, "get_admin_event", lambda _: existing)
    monkeypatch.setattr(event_service, "get_supabase_admin_client", lambda: client)
    monkeypatch.setattr(event_service, "_with_registration_counts", lambda rows: [rows[0]])

    result = event_service.update_event(event_id, EventUpdate(capacity=25))

    assert result["capacity"] == 25
    assert client.calls == [
        (
            "update_event_details",
            {"p_event_id": str(event_id), "p_changes": {"capacity": 25}},
        )
    ]


@pytest.mark.parametrize("as_list", [False, True])
def test_attendance_update_uses_rpc_and_normalizes_result(monkeypatch: pytest.MonkeyPatch, as_list: bool) -> None:
    registration_id = uuid4()
    row = registration_row(uuid4(), uuid4(), "ATTENDED")
    row["id"] = str(registration_id)
    client = FakeRpcClient({"set_registration_status": [row] if as_list else row})
    monkeypatch.setattr(registration_service, "get_supabase_admin_client", lambda: client)

    result = registration_service.update_attendance(registration_id, RegistrationStatus.ATTENDED)

    assert result.status == RegistrationStatus.ATTENDED
    assert client.calls == [
        ("set_registration_status", {"p_registration_id": str(registration_id), "p_status": "ATTENDED"})
    ]
