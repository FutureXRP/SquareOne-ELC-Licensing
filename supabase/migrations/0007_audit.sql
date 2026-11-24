-- 0007_audit.sql
-- Insert-only audit trail and the no-hard-delete rule (rule 9), enforced by triggers so
-- they hold for every role, including the service role.

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  action text not null check (action in ('INSERT', 'UPDATE')),
  entity_table text not null,
  entity_id uuid,
  before jsonb,
  after jsonb,
  at timestamptz not null default now()
);
create index audit_events_entity_idx on public.audit_events (entity_table, entity_id);
create index audit_events_at_idx on public.audit_events (at desc);

create function public.prevent_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception '% on %.% is not allowed: records are kept, archive instead',
    tg_op, tg_table_schema, tg_table_name using errcode = '42501';
end;
$$;

create trigger audit_events_insert_only before update or delete on public.audit_events
  for each row execute function public.prevent_mutation();
create trigger audit_events_no_truncate before truncate on public.audit_events
  for each statement execute function public.prevent_mutation();

create function public.audit_row()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and to_jsonb(old) = to_jsonb(new) then
    return new;
  end if;
  insert into public.audit_events (actor_id, action, entity_table, entity_id, before, after)
  values (
    (select auth.uid()),
    tg_op,
    tg_table_name,
    new.id,
    case when tg_op = 'UPDATE' then to_jsonb(old) end,
    to_jsonb(new)
  );
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'programs', 'classrooms', 'staff', 'profiles', 'classroom_reviewer_assignments',
    'authorities', 'requirements', 'requirement_versions', 'requirement_instances',
    'evidence', 'evidence_links',
    'credential_types', 'credentials', 'reporting_periods', 'training_targets', 'training_records',
    'tasks', 'reminder_events', 'settings'
  ] loop
    execute format(
      'create trigger audit_row after insert or update on public.%I
         for each row execute function public.audit_row()', t);
    execute format(
      'create trigger no_hard_delete before delete on public.%I
         for each row execute function public.prevent_mutation()', t);
    execute format(
      'create trigger no_truncate before truncate on public.%I
         for each statement execute function public.prevent_mutation()', t);
  end loop;
end;
$$;
