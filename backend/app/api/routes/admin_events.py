from uuid import UUID

from fastapi import APIRouter, Depends, Response, status

from app.dependencies.auth import require_admin
from app.models.auth import CurrentUser
from app.models.events import AdminRegistrationView, EventCreate, EventResponse, EventUpdate
from app.services import events as event_service
from app.services.registrations import list_event_registrations

router = APIRouter()


@router.get("", response_model=list[EventResponse])
def list_events(_: CurrentUser = Depends(require_admin)) -> list[EventResponse]:
    return event_service.list_admin_events()


@router.post("", response_model=EventResponse, status_code=status.HTTP_201_CREATED)
def create_event(payload: EventCreate, current_user: CurrentUser = Depends(require_admin)) -> EventResponse:
    return event_service.create_event(payload, current_user)


@router.get("/{event_id}", response_model=EventResponse)
def get_event(event_id: UUID, _: CurrentUser = Depends(require_admin)) -> EventResponse:
    return event_service.get_admin_event(event_id)


@router.patch("/{event_id}", response_model=EventResponse)
def update_event(event_id: UUID, payload: EventUpdate, _: CurrentUser = Depends(require_admin)) -> EventResponse:
    return event_service.update_event(event_id, payload)


@router.delete("/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_event(event_id: UUID, _: CurrentUser = Depends(require_admin)) -> Response:
    event_service.delete_event(event_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{event_id}/publish", response_model=EventResponse)
def publish_event(event_id: UUID, _: CurrentUser = Depends(require_admin)) -> EventResponse:
    return event_service.set_publication(event_id, True)


@router.post("/{event_id}/unpublish", response_model=EventResponse)
def unpublish_event(event_id: UUID, _: CurrentUser = Depends(require_admin)) -> EventResponse:
    return event_service.set_publication(event_id, False)


@router.get("/{event_id}/registrations", response_model=list[AdminRegistrationView])
def event_registrations(event_id: UUID, _: CurrentUser = Depends(require_admin)) -> list[AdminRegistrationView]:
    return list_event_registrations(event_id)
