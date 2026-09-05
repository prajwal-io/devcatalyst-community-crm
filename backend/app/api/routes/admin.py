from fastapi import APIRouter, Depends

from app.dependencies.auth import require_admin
from app.models.auth import CurrentUser

router = APIRouter()


@router.get("/test")
def admin_test(current_user: CurrentUser = Depends(require_admin)) -> dict[str, str]:
    return {
        "message": "Admin authorization is working",
        "user_id": str(current_user.id),
    }
