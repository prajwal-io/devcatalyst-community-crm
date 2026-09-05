from enum import Enum
from uuid import UUID

from pydantic import BaseModel, EmailStr


class UserRole(str, Enum):
    ADMIN = "ADMIN"
    PARTICIPANT = "PARTICIPANT"


class CurrentUser(BaseModel):
    id: UUID
    full_name: str
    email: EmailStr
    role: UserRole
