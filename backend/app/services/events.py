from __future__ import annotations

from collections import Counter
from uuid import UUID

from fastapi import HTTPException, status

from app.core.supabase import get_supabase_admin_client
from app.models.auth import CurrentUser
from app.models.events import EventCreate, EventResponse, EventStatus, EventUpdate

EVENT_COLUMNS = (
    "id,name,description,starts_at,ends_at,location,online_link,"
    "registration_deadline,capacity,status,created_by,created_at,updated_at"
)


def _not_found() -> HTTPException:
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")


def _with_registration_counts(rows: list[dict]) -> list[EventResponse]:
    if not rows:
        return []

    client = get_supabase_admin_client()
    event_ids = [row["id"] for row in rows]
    registrations = (
        client.table("registrations")
        .select("event_id,status")
        .in_("event_id", event_ids)
        .neq("status", "CANCELLED")
        .execute()
    )
    counts = Counter(item["event_id"] for item in (registrations.data or []))

    result: list[EventResponse] = []
    for row in rows:
        active = counts.get(row["id"], 0)
        enriched = {
            **row,
            "active_registrations": active,
            "available_spots": max(int(row["capacity"]) - active, 0),
        }
        result.append(EventResponse.model_validate(enriched))
    return result


def list_published_events() -> list[EventResponse]:
    response = (
        get_supabase_admin_client()
        .table("events")
        .select(EVENT_COLUMNS)
        .eq("status", EventStatus.PUBLISHED.value)
        .order("starts_at")
        .execute()
    )
    return _with_registration_counts(response.data or [])


def get_published_event(event_id: UUID) -> EventResponse:
    response = (
        get_supabase_admin_client()
        .table("events")
        .select(EVENT_COLUMNS)
        .eq("id", str(event_id))
        .eq("status", EventStatus.PUBLISHED.value)
        .limit(1)
        .execute()
    )
    rows = response.data or []
    if not rows:
        raise _not_found()
    return _with_registration_counts(rows)[0]


def list_admin_events() -> list[EventResponse]:
    response = (
        get_supabase_admin_client()
        .table("events")
        .select(EVENT_COLUMNS)
        .order("starts_at")
        .execute()
    )
    return _with_registration_counts(response.data or [])


def get_admin_event(event_id: UUID) -> EventResponse:
    response = (
        get_supabase_admin_client()
        .table("events")
        .select(EVENT_COLUMNS)
        .eq("id", str(event_id))
        .limit(1)
        .execute()
    )
    rows = response.data or []
    if not rows:
        raise _not_found()
    return _with_registration_counts(rows)[0]


def create_event(payload: EventCreate, current_user: CurrentUser) -> EventResponse:
    data = payload.model_dump(mode="json")
    data.update({"created_by": str(current_user.id), "status": EventStatus.DRAFT.value})
    response = get_supabase_admin_client().table("events").insert(data).execute()
    if not response.data:
        raise HTTPException(status_code=500, detail="Event could not be created")
    return _with_registration_counts(response.data)[0]


def update_event(event_id: UUID, payload: EventUpdate) -> EventResponse:
    existing = get_admin_event(event_id)
    changes = payload.model_dump(exclude_unset=True, mode="json")
    if not changes:
        return existing

    merged = {
        "name": changes.get("name", existing.name),
        "description": changes.get("description", existing.description),
        "starts_at": changes.get("starts_at", existing.starts_at.isoformat()),
        "ends_at": changes.get("ends_at", existing.ends_at.isoformat() if existing.ends_at else None),
        "location": changes.get("location", existing.location),
        "online_link": changes.get("online_link", existing.online_link),
        "registration_deadline": changes.get("registration_deadline", existing.registration_deadline.isoformat()),
        "capacity": changes.get("capacity", existing.capacity),
    }
    EventCreate.model_validate(merged)

    response = (
        get_supabase_admin_client()
        .table("events")
        .update(changes)
        .eq("id", str(event_id))
        .execute()
    )
    if not response.data:
        raise _not_found()
    return _with_registration_counts(response.data)[0]


def delete_event(event_id: UUID) -> None:
    get_admin_event(event_id)
    get_supabase_admin_client().table("events").delete().eq("id", str(event_id)).execute()


def set_publication(event_id: UUID, publish: bool) -> EventResponse:
    existing = get_admin_event(event_id)
    if publish and existing.status in {EventStatus.COMPLETED, EventStatus.CANCELLED}:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Completed or cancelled events cannot be published",
        )

    new_status = EventStatus.PUBLISHED.value if publish else EventStatus.DRAFT.value
    response = (
        get_supabase_admin_client()
        .table("events")
        .update({"status": new_status})
        .eq("id", str(event_id))
        .execute()
    )
    if not response.data:
        raise _not_found()
    return _with_registration_counts(response.data)[0]
