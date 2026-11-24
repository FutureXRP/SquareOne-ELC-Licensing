-- 001_helpers.sql
-- Tiny assertion helpers for the SQL test suite (plain SQL scripts, no pgTAP needed).
-- Each test file runs in one transaction and rolls back, so nothing persists.

drop schema if exists test cascade;
create schema test;
grant usage on schema test to anon, authenticated, service_role;

-- Act as a signed-in Supabase user (role + JWT claims), or as anon when uid is null.
create or replace function test.login(uid uuid)
returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  if uid is null then
    perform set_config('request.jwt.claims', '', true);
    perform set_config('role', 'anon', true);
  else
    perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
    perform set_config('role', 'authenticated', true);
  end if;
end;
$$;

create or replace function test.logout()
returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end;
$$;

-- The statement must raise an error (the denied case).
create or replace function test.throws(stmt text, descr text)
returns void language plpgsql as $$
begin
  begin
    execute stmt;
  exception when others then
    raise notice 'ok - % [%]', descr, sqlstate;
    return;
  end;
  raise exception 'FAILED - % (statement succeeded but must be rejected)', descr;
end;
$$;

-- The query must return exactly this number.
create or replace function test.is(query text, expected bigint, descr text)
returns void language plpgsql as $$
declare
  actual bigint;
begin
  execute query into actual;
  if actual is distinct from expected then
    raise exception 'FAILED - % (expected %, got %)', descr, expected, actual;
  end if;
  raise notice 'ok - %', descr;
end;
$$;

-- The statement must run and touch exactly this many rows (0 = silently filtered by RLS).
create or replace function test.affects(stmt text, expected bigint, descr text)
returns void language plpgsql as $$
declare
  actual bigint;
begin
  execute stmt;
  get diagnostics actual = row_count;
  if actual is distinct from expected then
    raise exception 'FAILED - % (expected % rows, got %)', descr, expected, actual;
  end if;
  raise notice 'ok - %', descr;
end;
$$;

grant execute on all functions in schema test to anon, authenticated, service_role;

-- Synthetic users for the tests. Roles come from app_metadata, as an invitation would set them.
create or replace function test.make_users()
returns void language plpgsql as $$
begin
  insert into auth.users (id, email, raw_app_meta_data) values
    ('a0000000-0000-4000-8000-000000000001', 'director@example.test', '{"role":"director"}'),
    ('a0000000-0000-4000-8000-000000000002', 'admin@example.test', '{"role":"admin_support"}'),
    ('a0000000-0000-4000-8000-000000000003', 'educator1@example.test', '{"role":"educator"}'),
    ('a0000000-0000-4000-8000-000000000004', 'educator2@example.test', '{"role":"educator"}'),
    ('a0000000-0000-4000-8000-000000000005', 'reviewer@example.test', '{"role":"classroom_reviewer"}'),
    ('a0000000-0000-4000-8000-000000000006', 'auditor@example.test', '{"role":"auditor"}'),
    -- No role in app_metadata: the profile is created inactive (default deny).
    ('a0000000-0000-4000-8000-000000000007', 'uninvited@example.test', '{}');
  update public.profiles set staff_id = '30000000-0000-4000-8000-000000000001' where id = 'a0000000-0000-4000-8000-000000000001';
  update public.profiles set staff_id = '30000000-0000-4000-8000-000000000002' where id = 'a0000000-0000-4000-8000-000000000002';
  update public.profiles set staff_id = '30000000-0000-4000-8000-000000000003' where id = 'a0000000-0000-4000-8000-000000000003';
  update public.profiles set staff_id = '30000000-0000-4000-8000-000000000004' where id = 'a0000000-0000-4000-8000-000000000004';
  update public.profiles set staff_id = '30000000-0000-4000-8000-000000000005' where id = 'a0000000-0000-4000-8000-000000000005';
end;
$$;
