"""Opt-in live CRM smoke test. Uses disposable users; never sends signup emails."""
import os
from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from supabase import create_client

from app.core.config import get_settings
from app.core.supabase import get_supabase_admin_client
from app.main import app


@pytest.mark.skipif(os.getenv("RUN_LIVE_SUPABASE") != "1", reason="Requires dedicated Supabase test credentials")
def test_live_phase_one_to_five():
    settings = get_settings()
    admin = get_supabase_admin_client()
    users = []
    event_ids = []
    client = TestClient(app)
    password = f"CRM-test-{uuid4()}!"
    try:
        headers = []
        for role in ["ADMIN", "PARTICIPANT", "PARTICIPANT"]:
            email = f"crm-test-{uuid4()}@example.com"
            created = admin.auth.admin.create_user({
                "email": email, "password": password, "email_confirm": True,
                "user_metadata": {"full_name": "Disposable CRM test", "role": "ADMIN"},
            }).user
            users.append(created.id)
            # User-controlled metadata must never grant ADMIN.
            profile = admin.table("profiles").select("role").eq("id", created.id).single().execute().data
            assert profile["role"] == "PARTICIPANT"
            if role == "ADMIN":
                admin.table("profiles").update({"role": "ADMIN"}).eq("id", created.id).execute()
            auth = create_client(settings.supabase_url, settings.supabase_anon_key)
            session = auth.auth.sign_in_with_password({"email": email, "password": password}).session
            headers.append({"Authorization": f"Bearer {session.access_token}"})

        admin_headers, participant_headers, other_headers = headers
        assert client.get("/api/v1/auth/me", headers=admin_headers).json()["role"] == "ADMIN"
        assert client.get("/api/v1/admin/events", headers=participant_headers).status_code == 403
        start = datetime.now(timezone.utc) + timedelta(days=3)
        payload = {
            "name": "Disposable CRM smoke test", "description": "Removed after verification",
            "starts_at": start.isoformat(), "registration_deadline": (start - timedelta(days=1)).isoformat(),
            "location": "Test venue", "capacity": 1,
        }
        response = client.post("/api/v1/admin/events", headers=admin_headers, json=payload)
        assert response.status_code == 201, response.text
        event_id = response.json()["id"]
        event_ids.append(event_id)
        event_path = f"/api/v1/events/{event_id}"
        admin_path = f"/api/v1/admin/events/{event_id}"
        assert client.post(event_path + "/register", headers=participant_headers).status_code == 409
        assert client.post(admin_path + "/publish", headers=admin_headers).status_code == 200
        response = client.post(event_path + "/register", headers=participant_headers)
        assert response.status_code == 201, response.text
        registration_id = response.json()["id"]
        assert client.post(event_path + "/register", headers=participant_headers).status_code == 409
        assert client.post(event_path + "/register", headers=other_headers).status_code == 409
        assert client.post(event_path + "/cancel", headers=participant_headers).status_code == 200
        assert client.post(event_path + "/register", headers=participant_headers).status_code == 201
        response = client.patch(admin_path, headers=admin_headers, json={"capacity": 2})
        assert response.status_code == 200, response.text
        assert client.post(event_path + "/register", headers=other_headers).status_code == 201
        assert client.patch(admin_path, headers=admin_headers, json={"capacity": 1}).status_code == 409
        response = client.patch(
            f"/api/v1/admin/registrations/{registration_id}/status",
            headers=admin_headers, json={"status": "ATTENDED"},
        )
        assert response.status_code == 200, response.text
        assert client.post(event_path + "/cancel", headers=participant_headers).status_code == 409
        history = client.get("/api/v1/me/registrations", headers=participant_headers).json()
        assert any(row["event_id"] == event_id and row["status"] == "ATTENDED" for row in history)
        response = client.get(f"/api/v1/admin/participants/{users[1]}/history", headers=admin_headers)
        assert response.status_code == 200, response.text
        assert client.delete(admin_path, headers=admin_headers).status_code == 409
        assert client.patch(admin_path + "/status", headers=admin_headers, json={"status": "COMPLETED"}).status_code == 200
        assert client.post(admin_path + "/unpublish", headers=admin_headers).status_code == 409
    finally:
        # Cleanup is limited to IDs created by this invocation.
        for event_id in event_ids:
            admin.table("registrations").delete().eq("event_id", event_id).execute()
            admin.table("events").delete().eq("id", event_id).execute()
        for user_id in users:
            admin.auth.admin.delete_user(user_id)
