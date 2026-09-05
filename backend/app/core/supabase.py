from functools import lru_cache

from supabase import Client, create_client

from app.core.config import get_settings


def _require(value: str | None, name: str) -> str:
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


@lru_cache
def get_supabase_auth_client() -> Client:
    """Client using the public anon key for Supabase Auth token validation."""
    settings = get_settings()
    return create_client(
        _require(settings.supabase_url, "SUPABASE_URL"),
        _require(settings.supabase_anon_key, "SUPABASE_ANON_KEY"),
    )


@lru_cache
def get_supabase_admin_client() -> Client:
    """Server-only client. The service-role key must never reach the frontend."""
    settings = get_settings()
    return create_client(
        _require(settings.supabase_url, "SUPABASE_URL"),
        _require(settings.supabase_service_role_key, "SUPABASE_SERVICE_ROLE_KEY"),
    )
