-- DevCatalyst-OSS Task 2: Community Registration & CRM
-- Initial database schema for Supabase PostgreSQL.

create extension if not exists pgcrypto;

-- ---------- Enums ----------
do $$
begin
  create type public.user_role as enum ('ADMIN', 'PARTICIPANT');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.event_status as enum ('DRAFT', 'PUBLISHED', 'COMPLETED', 'CANCELLED');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.registration_status as enum ('REGISTERED', 'ATTENDED', 'ABSENT', 'CANCELLED');
exception
  when duplicate_object then null;
end $$;

-- ---------- Tables ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (char_length(trim(full_name)) >= 1),
  email text not null,
  role public.user_role not null default 'PARTICIPANT',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists profiles_email_unique_idx
  on public.profiles (lower(email));

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) >= 1),
  description text not null default '',
  starts_at timestamptz not null,
  ends_at timestamptz,
  location text,
  online_link text,
  registration_deadline timestamptz not null,
  capacity integer not null check (capacity > 0),
  status public.event_status not null default 'DRAFT',
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint events_end_after_start check (ends_at is null or ends_at > starts_at),
  constraint events_deadline_not_after_start check (registration_deadline <= starts_at),
  constraint events_location_or_link check (
    nullif(trim(coalesce(location, '')), '') is not null
    or nullif(trim(coalesce(online_link, '')), '') is not null
  )
);

create table if not exists public.registrations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  participant_id uuid not null references public.profiles(id) on delete cascade,
  status public.registration_status not null default 'REGISTERED',
  registered_at timestamptz not null default now(),
  cancelled_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint registrations_event_participant_unique unique (event_id, participant_id),
  constraint registrations_cancelled_timestamp check (
    status <> 'CANCELLED' or cancelled_at is not null
  )
);

create index if not exists events_status_starts_at_idx
  on public.events (status, starts_at);

create index if not exists registrations_event_id_idx
  on public.registrations (event_id);

create index if not exists registrations_participant_id_idx
  on public.registrations (participant_id);

create index if not exists registrations_status_idx
  on public.registrations (status);

-- ---------- Generic updated_at trigger ----------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists events_set_updated_at on public.events;
create trigger events_set_updated_at
before update on public.events
for each row execute function public.set_updated_at();

drop trigger if exists registrations_set_updated_at on public.registrations;
create trigger registrations_set_updated_at
before update on public.registrations
for each row execute function public.set_updated_at();

-- ---------- Auth -> profile trigger ----------
-- New public signups always become PARTICIPANT. The client cannot self-assign ADMIN.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  generated_name text;
begin
  generated_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    split_part(coalesce(new.email, 'participant'), '@', 1)
  );

  insert into public.profiles (id, full_name, email, role)
  values (new.id, generated_name, coalesce(new.email, ''), 'PARTICIPANT')
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ---------- Authorization helper ----------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'ADMIN'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- ---------- Row Level Security ----------
alter table public.profiles enable row level security;
alter table public.events enable row level security;
alter table public.registrations enable row level security;

-- Profiles: users can read themselves; admins can read all participants.
drop policy if exists "profiles_select_self_or_admin" on public.profiles;
create policy "profiles_select_self_or_admin"
on public.profiles
for select
to authenticated
using (id = auth.uid() or public.is_admin());

-- Only admins directly update profile records through authenticated DB access.
drop policy if exists "profiles_admin_update" on public.profiles;
create policy "profiles_admin_update"
on public.profiles
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Events: authenticated users can discover published events; admins can see all.
drop policy if exists "events_select_published_or_admin" on public.events;
create policy "events_select_published_or_admin"
on public.events
for select
to authenticated
using (status = 'PUBLISHED' or public.is_admin());

-- Admins can directly manage events when using an authenticated Supabase client.
drop policy if exists "events_admin_manage" on public.events;
create policy "events_admin_manage"
on public.events
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Participants can read their own registration history; admins can read all.
drop policy if exists "registrations_select_self_or_admin" on public.registrations;
create policy "registrations_select_self_or_admin"
on public.registrations
for select
to authenticated
using (participant_id = auth.uid() or public.is_admin());

-- Direct registration writes are reserved for admins/server-side operations.
-- Participant registration business rules will be enforced by FastAPI in Phase 3.
drop policy if exists "registrations_admin_manage" on public.registrations;
create policy "registrations_admin_manage"
on public.registrations
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- ---------- Realtime ----------
alter table public.profiles replica identity full;
alter table public.events replica identity full;
alter table public.registrations replica identity full;

-- Supabase projects include the supabase_realtime publication.
do $$
begin
  alter publication supabase_realtime add table public.profiles;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.events;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.registrations;
exception when duplicate_object then null;
end $$;
