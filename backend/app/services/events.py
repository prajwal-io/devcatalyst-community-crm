from __future__ import annotations

from collections import Counter
from uuid import UUID

from fastapi import HTTPException, status
from pydantic import ValidationError

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
    try:
        EventCreate.model_validate(merged)
    except ValidationError as exc:
        raise HTTPException(status_code=422, detail="; ".join(error["msg"] for error in exc.errors())) from exc

    try:
        response = get_supabase_admin_client().rpc(
            "update_event_details",
            {
                "p_event_id": str(event_id),
                "p_changes": changes,
            },
        ).execute()
    except Exception as exc:
        if "CAPACITY_BELOW_REGISTRATIONS" in str(exc):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Capacity cannot be lower than the number of active registrations",
            ) from exc
        if "EVENT_NOT_FOUND" in str(exc):
            raise _not_found() from exc
        if getattr(exc, "code", None) in {"23514", "23502", "22007", "22008"}:
            raise HTTPException(status_code=422, detail="Event fields are inconsistent") from exc
        raise HTTPException(status_code=503, detail="Event could not be updated") from exc
    if not response.data:
        raise _not_found()
    rows = response.data if isinstance(response.data, list) else [response.data]
    return _with_registration_counts(rows)[0]


def delete_event(event_id: UUID) -> None:
    get_admin_event(event_id)
    try:
        get_supabase_admin_client().table("events").delete().eq("id", str(event_id)).execute()
    except Exception as exc:
        if "EVENT_HAS_REGISTRATIONS" in str(exc):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Events with registration history cannot be deleted; cancel the event instead",
            ) from exc
        raise


def set_publication(event_id: UUID, publish: bool) -> EventResponse:
    return set_status(event_id, EventStatus.PUBLISHED if publish else EventStatus.DRAFT)


def set_status(event_id: UUID, next_status: EventStatus) -> EventResponse:
    existing = get_admin_event(event_id)
    if existing.status in {EventStatus.COMPLETED, EventStatus.CANCELLED} and next_status != existing.status:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Completed or cancelled events are final")

    try:
        response = (
            get_supabase_admin_client()
            .table("events")
            .update({"status": next_status.value})
            .eq("id", str(event_id))
            .eq("status", existing.status.value)
            .execute()
        )
    except Exception as exc:
        raise HTTPException(status_code=503, detail="Event status could not be updated") from exc
    if not response.data:
        raise HTTPException(status_code=409, detail="Event changed; reload and try again")
    rows = response.data if isinstance(response.data, list) else [response.data]
    return _with_registration_counts(rows)[0]
