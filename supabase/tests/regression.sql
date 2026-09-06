\set ON_ERROR_STOP on

begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000001', 'admin@example.com', '{"full_name":"Admin"}'),
  ('00000000-0000-0000-0000-000000000002', 'one@example.com', '{"full_name":"One"}'),
  ('00000000-0000-0000-0000-000000000003', 'two@example.com', '{"full_name":"Two"}');

update public.profiles set role = 'ADMIN' where id = '00000000-0000-0000-0000-000000000001';

insert into public.events
  (id, name, starts_at, registration_deadline, location, capacity, status, created_by)
values
  ('10000000-0000-0000-0000-000000000001', 'Open', now() + interval '3 days', now() + interval '2 days', 'Hall', 2, 'PUBLISHED', '00000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000002', 'Draft', now() + interval '3 days', now() + interval '2 days', 'Hall', 2, 'DRAFT', '00000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000003', 'Closed', now() + interval '1 day', now() - interval '1 hour', 'Hall', 2, 'PUBLISHED', '00000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000004', 'Full', now() + interval '3 days', now() + interval '2 days', 'Hall', 1, 'PUBLISHED', '00000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000005', 'Capacity edit', now() + interval '3 days', now() + interval '2 days', 'Hall', 2, 'PUBLISHED', '00000000-0000-0000-0000-000000000001');

set role service_role;

select public.register_for_event('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002');

do $$ begin
  perform public.register_for_event('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002');
  raise exception 'duplicate registration was accepted';
exception when others then
  if sqlerrm not like '%ALREADY_REGISTERED%' then raise; end if;
end $$;

do $$ begin
  perform public.register_for_event('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002');
  raise exception 'draft event registration was accepted';
exception when others then
  if sqlerrm not like '%EVENT_NOT_PUBLISHED%' then raise; end if;
end $$;

do $$ begin
  perform public.register_for_event('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000002');
  raise exception 'late registration was accepted';
exception when others then
  if sqlerrm not like '%REGISTRATION_CLOSED%' then raise; end if;
end $$;

select public.register_for_event('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000002');
do $$ begin
  perform public.register_for_event('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000003');
  raise exception 'full event registration was accepted';
exception when others then
  if sqlerrm not like '%EVENT_FULL%' then raise; end if;
end $$;

select public.set_registration_status(
  (select id from public.registrations where event_id = '10000000-0000-0000-0000-000000000001'),
  'ATTENDED'
);
do $$ begin
  perform public.cancel_event_registration('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002');
  raise exception 'finalized attendance was cancelled';
exception when others then
  if sqlerrm not like '%ATTENDANCE_FINALIZED%' then raise; end if;
end $$;

reset role;
insert into public.registrations (event_id, participant_id, status, cancelled_at)
values ('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000003', 'CANCELLED', now());
set role service_role;
do $$ begin
  perform public.set_registration_status(
    (select id from public.registrations where event_id = '10000000-0000-0000-0000-000000000004' and participant_id = '00000000-0000-0000-0000-000000000003'),
    'REGISTERED'
  );
  raise exception 'cancelled registration was restored above capacity';
exception when others then
  if sqlerrm not like '%EVENT_FULL%' then raise; end if;
end $$;

select public.register_for_event('10000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000002');
select public.register_for_event('10000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000003');
do $$ begin
  perform public.update_event_details('10000000-0000-0000-0000-000000000005', '{"capacity":1}'::jsonb);
  raise exception 'capacity was reduced below active registrations';
exception when others then
  if sqlerrm not like '%CAPACITY_BELOW_REGISTRATIONS%' then raise; end if;
end $$;

reset role;

do $$
declare role_name text;
begin
  foreach role_name in array array['anon', 'authenticated'] loop
    if has_table_privilege(role_name, 'public.profiles', 'INSERT,UPDATE,DELETE')
       or has_table_privilege(role_name, 'public.events', 'INSERT,UPDATE,DELETE')
       or has_table_privilege(role_name, 'public.registrations', 'INSERT,UPDATE,DELETE') then
      raise exception '% retained client write privileges', role_name;
    end if;
  end loop;

  foreach role_name in array array['anon', 'authenticated'] loop
    if has_function_privilege(role_name, 'public.register_for_event(uuid,uuid)', 'EXECUTE')
       or has_function_privilege(role_name, 'public.cancel_event_registration(uuid,uuid)', 'EXECUTE')
       or has_function_privilege(role_name, 'public.update_event_details(uuid,jsonb)', 'EXECUTE')
       or has_function_privilege(role_name, 'public.set_registration_status(uuid,public.registration_status)', 'EXECUTE') then
      raise exception '% can execute a protected RPC', role_name;
    end if;
  end loop;
end $$;

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);
do $$ begin
  if (select count(*) from public.profiles) <> 1 then
    raise exception 'RLS did not restrict profiles to the authenticated user';
  end if;
  if (select count(*) from public.registrations where participant_id <> auth.uid()) <> 0 then
    raise exception 'RLS exposed another participant registration';
  end if;
end $$;
reset role;

rollback;
