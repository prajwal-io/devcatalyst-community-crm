from uuid import UUID

from fastapi import APIRouter, Depends

from app.dependencies.auth import require_admin
from app.models.auth import CurrentUser
from app.models.events import AttendanceUpdate, RegistrationResponse
from app.services.registrations import update_attendance

router = APIRouter()


@router.patch("/{registration_id}/status", response_model=RegistrationResponse)
def set_registration_status(
    registration_id: UUID,
    payload: AttendanceUpdate,
    _: CurrentUser = Depends(require_admin),
) -> RegistrationResponse:
    return update_attendance(registration_id, payload.status)
