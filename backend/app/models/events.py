from __future__ import annotations

from datetime import datetime
from enum import Enum
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class EventStatus(str, Enum):
    DRAFT = "DRAFT"
    PUBLISHED = "PUBLISHED"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class RegistrationStatus(str, Enum):
    REGISTERED = "REGISTERED"
    ATTENDED = "ATTENDED"
    ABSENT = "ABSENT"
    CANCELLED = "CANCELLED"


class EventCreate(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    description: str = Field(default="", max_length=5000)
    starts_at: datetime
    ends_at: datetime | None = None
    location: str | None = Field(default=None, max_length=300)
    online_link: str | None = Field(default=None, max_length=1000)
    registration_deadline: datetime
    capacity: int = Field(ge=1, le=100000)

    @field_validator("name", "description", "location", "online_link")
    @classmethod
    def strip_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return value.strip()

    @field_validator("starts_at", "ends_at", "registration_deadline")
    @classmethod
    def require_timezone(cls, value: datetime | None) -> datetime | None:
        if value is not None and value.tzinfo is None:
            raise ValueError("Date/time values must include a timezone")
        return value

    @field_validator("online_link")
    @classmethod
    def validate_online_link(cls, value: str | None) -> str | None:
        if value and not value.startswith(("https://", "http://")):
            raise ValueError("Online link must start with http:// or https://")
        return value

    @model_validator(mode="after")
    def validate_event_timing(self) -> "EventCreate":
        if not self.name:
            raise ValueError("Event name cannot be blank")
        if not self.location and not self.online_link:
            raise ValueError("Provide a location or online link")
        if self.ends_at is not None and self.ends_at <= self.starts_at:
            raise ValueError("Event end time must be after start time")
        if self.registration_deadline > self.starts_at:
            raise ValueError("Registration deadline cannot be after event start")
        return self


class EventUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=160)
    description: str | None = Field(default=None, max_length=5000)
    starts_at: datetime | None = None
    ends_at: datetime | None = None
    location: str | None = Field(default=None, max_length=300)
    online_link: str | None = Field(default=None, max_length=1000)
    registration_deadline: datetime | None = None
    capacity: int | None = Field(default=None, ge=1, le=100000)

    @field_validator("name", "description", "location", "online_link")
    @classmethod
    def strip_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return value.strip()

    @field_validator("starts_at", "ends_at", "registration_deadline")
    @classmethod
    def require_timezone(cls, value: datetime | None) -> datetime | None:
        if value is not None and value.tzinfo is None:
            raise ValueError("Date/time values must include a timezone")
        return value

    @field_validator("online_link")
    @classmethod
    def validate_online_link(cls, value: str | None) -> str | None:
        if value and not value.startswith(("https://", "http://")):
            raise ValueError("Online link must start with http:// or https://")
        return value

    @model_validator(mode="after")
    def reject_null_for_required_fields(self) -> "EventUpdate":
        for field_name in ("name", "description", "starts_at", "registration_deadline", "capacity"):
            if field_name in self.model_fields_set and getattr(self, field_name) is None:
                raise ValueError(f"{field_name} cannot be null")
        return self


class EventStatusUpdate(BaseModel):
    status: EventStatus


class EventResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    description: str
    starts_at: datetime
    ends_at: datetime | None
    location: str | None
    online_link: str | None
    registration_deadline: datetime
    capacity: int
    status: EventStatus
    created_by: UUID
    created_at: datetime
    updated_at: datetime
    active_registrations: int = 0
    available_spots: int = 0


class EventSummary(BaseModel):
    id: UUID
    name: str
    starts_at: datetime
    location: str | None
    online_link: str | None


class RegistrationResponse(BaseModel):
    id: UUID
    event_id: UUID
    participant_id: UUID
    status: RegistrationStatus
    registered_at: datetime
    cancelled_at: datetime | None
    updated_at: datetime


class RegistrationHistoryItem(RegistrationResponse):
    event: EventSummary


class ParticipantSummary(BaseModel):
    id: UUID
    full_name: str
    email: str


class AdminRegistrationView(RegistrationResponse):
    participant: ParticipantSummary


class AttendanceUpdate(BaseModel):
    status: RegistrationStatus


class ParticipantHistoryResponse(BaseModel):
    participant: ParticipantSummary
    registrations: list[RegistrationHistoryItem]
