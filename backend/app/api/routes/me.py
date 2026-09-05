from fastapi import APIRouter, Depends

from app.dependencies.auth import require_participant
from app.models.auth import CurrentUser
from app.models.events import RegistrationHistoryItem
from app.services.registrations import list_participant_registrations

router = APIRouter()


@router.get("/registrations", response_model=list[RegistrationHistoryItem])
def my_registrations(current_user: CurrentUser = Depends(require_participant)) -> list[RegistrationHistoryItem]:
    return list_participant_registrations(current_user.id)
