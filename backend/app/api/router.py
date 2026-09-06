from fastapi import APIRouter

from app.api.routes import (
    crm,
    admin,
    admin_events,
    admin_participants,
    admin_registrations,
    auth,
    events,
    me,
)

api_router = APIRouter()
api_router.include_router(crm.router, prefix="/admin", tags=["Admin CRM"])
api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(events.router, prefix="/events", tags=["Events"])
api_router.include_router(me.router, prefix="/me", tags=["Participant"])
api_router.include_router(admin.router, prefix="/admin", tags=["Admin"])
api_router.include_router(admin_events.router, prefix="/admin/events", tags=["Admin Events"])
api_router.include_router(admin_registrations.router, prefix="/admin/registrations", tags=["Admin Registrations"])
api_router.include_router(admin_participants.router, prefix="/admin/participants", tags=["Admin Participants"])
