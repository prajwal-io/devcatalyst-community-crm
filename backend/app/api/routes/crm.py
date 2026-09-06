from collections import Counter
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

from app.core.supabase import get_supabase_admin_client
from app.dependencies.auth import require_admin
from app.models.events import EventSummary, ParticipantSummary

router = APIRouter(dependencies=[Depends(require_admin)])


def read_all(table: str, columns: str, **filters) -> list[dict]:
    """Page explicitly: Supabase caps an individual response at 1,000 rows."""
    rows = []
    while True:
        query = get_supabase_admin_client().table(table).select(columns).order("id")
        for name, value in filters.items():
            query = query.eq(name, value)
        batch = query.range(len(rows), len(rows) + 499).execute().data or []
        rows.extend(batch)
        if len(batch) < 500:
            return rows


class ParticipantRecord(ParticipantSummary):
    registrations: int
    attended: int
    absent: int
    cancelled: int
    active: int


class ParticipantPage(BaseModel):
    items: list[ParticipantRecord]
    total: int
    page: int
    page_size: int


class Dashboard(BaseModel):
    participants: int
    events: int
    registrations: int
    active_registrations: int
    attended: int
    absent: int
    cancelled: int
    attendance_rate: float
    upcoming_events: list[EventSummary]


@router.get("/participants", response_model=ParticipantPage)
def participants(
    q: str = Query(default="", max_length=160),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    participation: str = Query(default="all", pattern="^(all|registered|attended|none)$"),
) -> ParticipantPage:
    profiles = read_all("profiles", "id,full_name,email", role="PARTICIPANT")
    registrations = read_all("registrations", "id,participant_id,status")
    counts: dict[str, Counter] = {}
    for row in registrations:
        counts.setdefault(row["participant_id"], Counter())[row["status"]] += 1
    items = []
    query = q.strip().casefold()
    for profile in profiles:
        if query and query not in f'{profile["full_name"]} {profile["email"]}'.casefold():
            continue
        count = counts.get(profile["id"], Counter())
        total = sum(count.values())
        if participation == "none" and total:
            continue
        if participation == "registered" and not count["REGISTERED"]:
            continue
        if participation == "attended" and not count["ATTENDED"]:
            continue
        items.append(ParticipantRecord(
            **profile, registrations=total, attended=count["ATTENDED"],
            absent=count["ABSENT"], cancelled=count["CANCELLED"], active=count["REGISTERED"],
        ))
    items.sort(key=lambda item: (item.full_name.casefold(), str(item.id)))
    offset = (page - 1) * page_size
    return ParticipantPage(items=items[offset:offset + page_size], total=len(items), page=page, page_size=page_size)


@router.get("/dashboard", response_model=Dashboard)
def dashboard() -> Dashboard:
    profiles = read_all("profiles", "id", role="PARTICIPANT")
    events = read_all("events", "id,name,starts_at,location,online_link,status")
    registrations = read_all("registrations", "id,status")
    counts = Counter(row["status"] for row in registrations)
    now = datetime.now(timezone.utc)
    upcoming = sorted(
        (row for row in events if row["status"] == "PUBLISHED"
         and datetime.fromisoformat(row["starts_at"].replace("Z", "+00:00")) >= now),
        key=lambda row: datetime.fromisoformat(row["starts_at"].replace("Z", "+00:00")),
    )
    finalized = counts["ATTENDED"] + counts["ABSENT"]
    return Dashboard(
        participants=len(profiles), events=len(events), registrations=len(registrations),
        active_registrations=counts["REGISTERED"], attended=counts["ATTENDED"],
        absent=counts["ABSENT"], cancelled=counts["CANCELLED"],
        attendance_rate=round(100 * counts["ATTENDED"] / finalized, 1) if finalized else 0,
        upcoming_events=[EventSummary.model_validate(row) for row in upcoming[:5]],
    )
