from uuid import UUID

from fastapi import APIRouter, Depends

from app.dependencies.auth import require_admin
from app.models.auth import CurrentUser
from app.models.events import ParticipantHistoryResponse
from app.services.registrations import get_participant_history

router = APIRouter()


@router.get("/{participant_id}/history", response_model=ParticipantHistoryResponse)
def participant_history(
    participant_id: UUID,
    _: CurrentUser = Depends(require_admin),
) -> ParticipantHistoryResponse:
    return get_participant_history(participant_id)
