-- Client writes go through FastAPI; keep only the scoped read policies.
drop policy if exists "profiles_admin_update" on public.profiles;
drop policy if exists "events_admin_manage" on public.events;
drop policy if exists "registrations_admin_manage" on public.registrations;
create index if not exists events_created_by_idx on public.events (created_by);
