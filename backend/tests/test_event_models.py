from datetime import datetime, timedelta, timezone

import pytest
from pydantic import ValidationError

from app.models.events import EventCreate


def valid_event_data() -> dict:
    start = datetime.now(timezone.utc) + timedelta(days=3)
    return {
        "name": "Python Workshop",
        "description": "Learn Python",
        "starts_at": start,
        "ends_at": start + timedelta(hours=2),
        "location": "Community Hall",
        "online_link": None,
        "registration_deadline": start - timedelta(hours=12),
        "capacity": 50,
    }


def test_event_requires_location_or_link() -> None:
    data = valid_event_data()
    data["location"] = None
    with pytest.raises(ValidationError):
        EventCreate.model_validate(data)


def test_event_rejects_deadline_after_start() -> None:
    data = valid_event_data()
    data["registration_deadline"] = data["starts_at"] + timedelta(minutes=1)
    with pytest.raises(ValidationError):
        EventCreate.model_validate(data)


def test_event_rejects_end_before_start() -> None:
    data = valid_event_data()
    data["ends_at"] = data["starts_at"] - timedelta(minutes=1)
    with pytest.raises(ValidationError):
        EventCreate.model_validate(data)
