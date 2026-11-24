-- 0012_children.sql  (phase 3)
-- Deliberately minimal: a code, first name, last initial and classroom. No health details
-- in columns. Health items exist only as checklist requirement instances and as evidence in
-- the child_health access class.

create table public.children (
  id uuid primary key default gen_random_uuid(),
  child_code text not null unique,
  first_name text not null,
  last_initial text not null check (char_length(last_initial) = 1),
  classroom_id uuid references public.classrooms (id),
  enrollment_date date,
  status text not null default 'enrolled' check (status in ('enrolled', 'withdrawn')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);
create index children_classroom_idx on public.children (classroom_id);
select public.setup_compliance_table('children');

-- Whether child records are kept here at all is an open decision (DECISIONS.md #9).
-- The switch is off until the director turns it on, and the database enforces it.
insert into public.settings (key, value) values ('child_records_enabled', 'false'::jsonb);

create function public.guard_children_enabled()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.settings s where s.key = 'child_records_enabled' and s.value = 'true'::jsonb
  ) then
    raise exception 'child records are not enabled; a director must turn them on in Settings'
      using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger guard_children_enabled before insert on public.children
  for each row execute function public.guard_children_enabled();

create policy children_select on public.children for select to authenticated
  using (
    (select public.auth_role()) in ('director', 'admin_support')
    or (
      (select public.auth_role()) = 'classroom_reviewer'
      and classroom_id is not null
      and public.can_use_classroom(classroom_id)
    )
  );
create policy children_insert on public.children for insert to authenticated
  with check ((select public.auth_role()) in ('director', 'admin_support'));
create policy children_update on public.children for update to authenticated
  using ((select public.auth_role()) in ('director', 'admin_support'))
  with check ((select public.auth_role()) in ('director', 'admin_support'));

-- A child's own requirement instances are visible to that classroom's reviewer as
-- checklist rows (status only). Documents stay behind the evidence policies.
create policy requirement_instances_select_classroom on public.requirement_instances for select to authenticated
  using (
    (select public.auth_role()) = 'classroom_reviewer'
    and (
      (subject_type = 'classroom' and public.can_use_classroom(subject_id))
      or (subject_type = 'child' and exists (select 1 from public.children c where c.id = subject_id))
    )
  );
