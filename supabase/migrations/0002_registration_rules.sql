-- Phases 2-5: atomic event registration and security hardening.

revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;

grant all on table public.profiles to service_role;
grant all on table public.events to service_role;
grant all on table public.registrations to service_role;

create or replace function public.register_for_event(
  p_event_id uuid,
  p_participant_id uuid
)
returns public.registrations
language plpgsql
security invoker
set search_path = ''
as $$
declare
  selected_event public.events%rowtype;
  existing_registration public.registrations%rowtype;
  active_count integer;
  result public.registrations%rowtype;
begin
  select * into selected_event
  from public.events
  where id = p_event_id
  for update;

  if not found then
    raise exception 'EVENT_NOT_FOUND';
  end if;

  if selected_event.status <> 'PUBLISHED' then
    raise exception 'EVENT_NOT_PUBLISHED';
  end if;

  if now() > selected_event.registration_deadline then
    raise exception 'REGISTRATION_CLOSED';
  end if;

  select * into existing_registration
  from public.registrations
  where event_id = p_event_id
    and participant_id = p_participant_id;

  if found and existing_registration.status <> 'CANCELLED' then
    raise exception 'ALREADY_REGISTERED';
  end if;

  select count(*)::integer into active_count
  from public.registrations
  where event_id = p_event_id
    and status <> 'CANCELLED';

  if active_count >= selected_event.capacity then
    raise exception 'EVENT_FULL';
  end if;

  if existing_registration.id is not null then
    update public.registrations
    set status = 'REGISTERED',
        registered_at = now(),
        cancelled_at = null,
        updated_at = now()
    where id = existing_registration.id
    returning * into result;
  else
    insert into public.registrations (event_id, participant_id, status)
    values (p_event_id, p_participant_id, 'REGISTERED')
    returning * into result;
  end if;

  return result;
end;
$$;

revoke all on function public.register_for_event(uuid, uuid) from public, anon, authenticated;
grant execute on function public.register_for_event(uuid, uuid) to service_role;
