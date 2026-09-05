from fastapi import APIRouter, Depends

from app.dependencies.auth import get_current_user
from app.models.auth import CurrentUser

router = APIRouter()


@router.get("/me", response_model=CurrentUser)
def read_current_user(current_user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    return current_user
