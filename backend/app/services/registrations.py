from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from fastapi import HTTPException, status

from app.core.supabase import get_supabase_admin_client
from app.models.auth import CurrentUser
from app.models.events import (
    AdminRegistrationView,
    EventSummary,
    ParticipantHistoryResponse,
    ParticipantSummary,
    RegistrationHistoryItem,
    RegistrationResponse,
    RegistrationStatus,
)

REGISTRATION_COLUMNS = "id,event_id,participant_id,status,registered_at,cancelled_at,updated_at"
EVENT_SUMMARY_COLUMNS = "id,name,starts_at,location,online_link"


def _map_registration_error(exc: Exception) -> HTTPException:
    text = str(exc)
    mapping = {
        "EVENT_NOT_FOUND": (404, "Event not found"),
        "EVENT_NOT_PUBLISHED": (409, "Event is not open for registration"),
        "REGISTRATION_CLOSED": (409, "Registration deadline has passed"),
        "EVENT_FULL": (409, "Event capacity is full"),
        "ALREADY_REGISTERED": (409, "You are already registered for this event"),
    }
    for token, (code, message) in mapping.items():
        if token in text:
            return HTTPException(status_code=code, detail=message)
    return HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Registration could not be completed",
    )


def register_for_event(event_id: UUID, current_user: CurrentUser) -> RegistrationResponse:
    try:
        response = get_supabase_admin_client().rpc(
            "register_for_event",
            {
                "p_event_id": str(event_id),
                "p_participant_id": str(current_user.id),
            },
        ).execute()
    except Exception as exc:
        raise _map_registration_error(exc) from exc

    data = response.data
    if isinstance(data, list):
        row = data[0] if data else None
    else:
        row = data
    if not row:
        raise HTTPException(status_code=500, detail="Registration could not be completed")
    return RegistrationResponse.model_validate(row)


def cancel_registration(event_id: UUID, current_user: CurrentUser) -> RegistrationResponse:
    client = get_supabase_admin_client()
    lookup = (
        client.table("registrations")
        .select(REGISTRATION_COLUMNS)
        .eq("event_id", str(event_id))
        .eq("participant_id", str(current_user.id))
        .limit(1)
        .execute()
    )
    rows = lookup.data or []
    if not rows:
        raise HTTPException(status_code=404, detail="Registration not found")

    current_status = rows[0]["status"]
    if current_status == RegistrationStatus.CANCELLED.value:
        return RegistrationResponse.model_validate(rows[0])
    if current_status != RegistrationStatus.REGISTERED.value:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only active registrations can be cancelled",
        )

    response = (
        client.table("registrations")
        .update({
            "status": RegistrationStatus.CANCELLED.value,
            "cancelled_at": datetime.now(timezone.utc).isoformat(),
        })
        .eq("id", rows[0]["id"])
        .execute()
    )
    return RegistrationResponse.model_validate(response.data[0])


def _load_event_map(event_ids: list[str]) -> dict[str, dict]:
    if not event_ids:
        return {}
    response = (
        get_supabase_admin_client()
        .table("events")
        .select(EVENT_SUMMARY_COLUMNS)
        .in_("id", event_ids)
        .execute()
    )
    return {row["id"]: row for row in (response.data or [])}


def list_participant_registrations(participant_id: UUID) -> list[RegistrationHistoryItem]:
    response = (
        get_supabase_admin_client()
        .table("registrations")
        .select(REGISTRATION_COLUMNS)
        .eq("participant_id", str(participant_id))
        .order("registered_at", desc=True)
        .execute()
    )
    rows = response.data or []
    event_map = _load_event_map(list({row["event_id"] for row in rows}))

    result: list[RegistrationHistoryItem] = []
    for row in rows:
        event = event_map.get(row["event_id"])
        if not event:
            continue
        result.append(RegistrationHistoryItem.model_validate({**row, "event": EventSummary.model_validate(event)}))
    return result


def list_event_registrations(event_id: UUID) -> list[AdminRegistrationView]:
    client = get_supabase_admin_client()
    event = client.table("events").select("id").eq("id", str(event_id)).limit(1).execute()
    if not event.data:
        raise HTTPException(status_code=404, detail="Event not found")

    response = (
        client.table("registrations")
        .select(REGISTRATION_COLUMNS)
        .eq("event_id", str(event_id))
        .order("registered_at")
        .execute()
    )
    rows = response.data or []
    participant_ids = list({row["participant_id"] for row in rows})
    profile_map: dict[str, dict] = {}
    if participant_ids:
        profiles = client.table("profiles").select("id,full_name,email").in_("id", participant_ids).execute()
        profile_map = {row["id"]: row for row in (profiles.data or [])}

    result: list[AdminRegistrationView] = []
    for row in rows:
        profile = profile_map.get(row["participant_id"])
        if not profile:
            continue
        result.append(AdminRegistrationView.model_validate({**row, "participant": ParticipantSummary.model_validate(profile)}))
    return result


def update_attendance(registration_id: UUID, next_status: RegistrationStatus) -> RegistrationResponse:
    client = get_supabase_admin_client()
    lookup = client.table("registrations").select(REGISTRATION_COLUMNS).eq("id", str(registration_id)).limit(1).execute()
    if not lookup.data:
        raise HTTPException(status_code=404, detail="Registration not found")

    payload: dict[str, str | None] = {"status": next_status.value}
    payload["cancelled_at"] = datetime.now(timezone.utc).isoformat() if next_status == RegistrationStatus.CANCELLED else None
    response = client.table("registrations").update(payload).eq("id", str(registration_id)).execute()
    return RegistrationResponse.model_validate(response.data[0])


def get_participant_history(participant_id: UUID) -> ParticipantHistoryResponse:
    client = get_supabase_admin_client()
    profile_response = client.table("profiles").select("id,full_name,email").eq("id", str(participant_id)).limit(1).execute()
    if not profile_response.data:
        raise HTTPException(status_code=404, detail="Participant not found")

    participant = ParticipantSummary.model_validate(profile_response.data[0])
    registrations = list_participant_registrations(participant_id)
    return ParticipantHistoryResponse(participant=participant, registrations=registrations)
