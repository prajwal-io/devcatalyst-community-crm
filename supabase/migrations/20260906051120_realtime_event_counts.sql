-- Invalidate published event data without exposing other participants' rows.
create or replace function private.notify_event_registration_change()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    update public.events set updated_at = clock_timestamp() where id = old.event_id;
  else
    update public.events set updated_at = clock_timestamp() where id = new.event_id;
  end if;
  return null;
end;
$$;
revoke all on function private.notify_event_registration_change() from public, anon, authenticated;
create trigger registrations_notify_event
after insert or update of status or delete on public.registrations
for each row execute function private.notify_event_registration_change();
