-- Review hardening for Phase 1-5 concurrency, history, and RLS boundaries.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated, service_role;

-- FastAPI owns all writes. Explicit grants also work on projects where the
-- Data API no longer grants table access automatically.
revoke all on public.profiles, public.events, public.registrations from anon, authenticated;
grant select on public.profiles, public.events, public.registrations to authenticated;
grant all on public.profiles, public.events, public.registrations to service_role;

create or replace function private.handle_new_user()
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

revoke all on function private.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();

drop function if exists public.handle_new_user();

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'ADMIN'
  );
$$;

revoke all on function private.is_admin() from public, anon;
grant execute on function private.is_admin() to authenticated, service_role;

drop policy if exists "profiles_select_self_or_admin" on public.profiles;
create policy "profiles_select_self_or_admin"
on public.profiles for select to authenticated
using (id = (select auth.uid()) or (select private.is_admin()));

drop policy if exists "profiles_admin_update" on public.profiles;
create policy "profiles_admin_update"
on public.profiles for update to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

drop policy if exists "events_select_published_or_admin" on public.events;
create policy "events_select_published_or_admin"
on public.events for select to authenticated
using (status = 'PUBLISHED' or (select private.is_admin()));

drop policy if exists "events_admin_manage" on public.events;
create policy "events_admin_manage"
on public.events for all to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

drop policy if exists "registrations_select_self_or_admin" on public.registrations;
create policy "registrations_select_self_or_admin"
on public.registrations for select to authenticated
using (participant_id = (select auth.uid()) or (select private.is_admin()));

drop policy if exists "registrations_admin_manage" on public.registrations;
create policy "registrations_admin_manage"
on public.registrations for all to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

drop function if exists public.is_admin();

create or replace function public.update_event_details(
  p_event_id uuid,
  p_changes jsonb
)
returns public.events
language plpgsql
security invoker
set search_path = ''
as $$
declare
  selected_event public.events%rowtype;
  active_count integer;
  result public.events%rowtype;
  merged public.events%rowtype;
begin
  select * into selected_event
  from public.events
  where id = p_event_id
  for update;

  if not found then
    raise exception 'EVENT_NOT_FOUND';
  end if;

  -- Merge against the locked row to avoid overwriting another admin's edit.
  select * into merged from jsonb_populate_record(selected_event, p_changes);

  select count(*)::integer into active_count
  from public.registrations
  where event_id = p_event_id
    and status <> 'CANCELLED';

  if merged.capacity < active_count then
    raise exception 'CAPACITY_BELOW_REGISTRATIONS';
  end if;

  update public.events
  set name = merged.name,
      description = merged.description,
      starts_at = merged.starts_at,
      ends_at = merged.ends_at,
      location = merged.location,
      online_link = merged.online_link,
      registration_deadline = merged.registration_deadline,
      capacity = merged.capacity
  where id = p_event_id
  returning * into result;

  return result;
end;
$$;

revoke all on function public.update_event_details(uuid, jsonb)
from public, anon, authenticated;
grant execute on function public.update_event_details(uuid, jsonb)
to service_role;

create or replace function public.cancel_event_registration(
  p_event_id uuid,
  p_participant_id uuid
)
returns public.registrations
language plpgsql
security invoker
set search_path = ''
as $$
declare
  existing_registration public.registrations%rowtype;
  result public.registrations%rowtype;
begin
  -- Every registration mutation locks event first, then registration.
  perform 1 from public.events where id = p_event_id for update;
  select * into existing_registration
  from public.registrations
  where event_id = p_event_id
    and participant_id = p_participant_id
  for update;

  if not found then
    raise exception 'REGISTRATION_NOT_FOUND';
  end if;

  if existing_registration.status = 'CANCELLED' then
    return existing_registration;
  end if;

  if existing_registration.status <> 'REGISTERED' then
    raise exception 'ATTENDANCE_FINALIZED';
  end if;

  update public.registrations
  set status = 'CANCELLED',
      cancelled_at = now()
  where id = existing_registration.id
  returning * into result;

  return result;
end;
$$;

revoke all on function public.cancel_event_registration(uuid, uuid) from public, anon, authenticated;
grant execute on function public.cancel_event_registration(uuid, uuid) to service_role;

create or replace function public.set_registration_status(
  p_registration_id uuid,
  p_status public.registration_status
)
returns public.registrations
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_event_id uuid;
  selected_event public.events%rowtype;
  existing_registration public.registrations%rowtype;
  active_count integer;
  result public.registrations%rowtype;
begin
  select event_id into target_event_id from public.registrations where id = p_registration_id;
  if not found then
    raise exception 'REGISTRATION_NOT_FOUND';
  end if;
  select * into selected_event from public.events where id = target_event_id for update;
  select * into existing_registration from public.registrations where id = p_registration_id for update;
  if not found then
    raise exception 'REGISTRATION_NOT_FOUND';
  end if;
  if existing_registration.status = 'CANCELLED' and p_status <> 'CANCELLED' then
    select count(*)::integer into active_count from public.registrations
    where event_id = target_event_id and status <> 'CANCELLED';
    if active_count >= selected_event.capacity then
      raise exception 'EVENT_FULL';
    end if;
  end if;
  update public.registrations
  set status = p_status,
      cancelled_at = case when p_status = 'CANCELLED' then now() else null end
  where id = p_registration_id returning * into result;
  return result;
end;
$$;

revoke all on function public.set_registration_status(uuid, public.registration_status) from public, anon, authenticated;
grant execute on function public.set_registration_status(uuid, public.registration_status) to service_role;

create or replace function private.preserve_event_history()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if exists (select 1 from public.registrations where event_id = old.id) then
    raise exception 'EVENT_HAS_REGISTRATIONS';
  end if;
  return old;
end;
$$;

revoke all on function private.preserve_event_history() from public, anon, authenticated;

drop trigger if exists events_preserve_registration_history on public.events;
create trigger events_preserve_registration_history
before delete on public.events
for each row execute function private.preserve_event_history();
