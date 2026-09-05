from uuid import UUID

from fastapi import APIRouter, Depends

from app.dependencies.auth import get_current_user, require_participant
from app.models.auth import CurrentUser
from app.models.events import EventResponse, RegistrationResponse
from app.services import events as event_service
from app.services import registrations as registration_service

router = APIRouter()


@router.get("", response_model=list[EventResponse])
def list_events(_: CurrentUser = Depends(get_current_user)) -> list[EventResponse]:
    return event_service.list_published_events()


@router.get("/{event_id}", response_model=EventResponse)
def event_details(event_id: UUID, _: CurrentUser = Depends(get_current_user)) -> EventResponse:
    return event_service.get_published_event(event_id)


@router.post("/{event_id}/register", response_model=RegistrationResponse, status_code=201)
def register(event_id: UUID, current_user: CurrentUser = Depends(require_participant)) -> RegistrationResponse:
    return registration_service.register_for_event(event_id, current_user)


@router.post("/{event_id}/cancel", response_model=RegistrationResponse)
def cancel(event_id: UUID, current_user: CurrentUser = Depends(require_participant)) -> RegistrationResponse:
    return registration_service.cancel_registration(event_id, current_user)
