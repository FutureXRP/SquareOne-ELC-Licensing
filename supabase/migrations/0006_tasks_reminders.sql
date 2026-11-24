-- 0006_tasks_reminders.sql
-- Tasks, reminder delivery log, director-editable settings, and the separation workflow.

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  requirement_instance_id uuid references public.requirement_instances (id),
  title text not null,
  assignee_id uuid references public.profiles (id),
  due_date date,
  status public.task_status not null default 'open',
  kind text not null default 'manual'
    check (kind in ('renewal', 'correction', 'follow_up', 'corrective_action', 'manual')),
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);
create index tasks_assignee_idx on public.tasks (assignee_id);
create index tasks_instance_idx on public.tasks (requirement_instance_id);

create table public.reminder_events (
  id uuid primary key default gen_random_uuid(),
  requirement_instance_id uuid references public.requirement_instances (id),
  task_id uuid references public.tasks (id),
  milestone public.reminder_milestone not null,
  recipient_id uuid not null references public.profiles (id),
  channel text not null default 'email' check (channel in ('email', 'digest')),
  due_date date,
  status public.delivery_status not null default 'queued',
  attempts integer not null default 0 check (attempts >= 0),
  last_error text,
  provider_message_id text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  -- One notice per item, milestone, recipient and due date (section 7).
  constraint reminder_events_no_duplicates
    unique nulls not distinct (requirement_instance_id, milestone, recipient_id, due_date)
);
create index reminder_events_status_idx on public.reminder_events (status);

create table public.settings (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  value jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

-- Blueprint defaults. These are internal thresholds, not regulatory rules, and stay
-- editable by the director.
insert into public.settings (key, value) values
  ('due_soon_days', '30'::jsonb),
  ('urgent_days', '7'::jsonb),
  ('reminder_milestones', '["d90", "d60", "d30", "d14", "d7", "due", "overdue"]'::jsonb),
  ('digest_day', '"monday"'::jsonb);

create function public.setting_int(setting_key text, fallback integer)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select (s.value #>> '{}')::integer
    from public.settings s
    where s.key = setting_key
      and s.archived_at is null
      and jsonb_typeof(s.value) = 'number'
  ), fallback);
$$;

-- Separation: deactivate the login, cancel open tasks and queued reminders, keep the records.
create function public.handle_staff_separation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.employment_status = 'separated' and old.employment_status is distinct from 'separated' then
    update public.profiles set is_active = false where staff_id = new.id and is_active;

    update public.tasks t
       set status = 'cancelled'
      from public.profiles p
     where p.staff_id = new.id
       and t.assignee_id = p.id
       and t.status in ('open', 'in_progress');

    update public.reminder_events r
       set status = 'suppressed'
      from public.profiles p
     where p.staff_id = new.id
       and r.recipient_id = p.id
       and r.status = 'queued';
  end if;
  return new;
end;
$$;
create trigger handle_staff_separation after update on public.staff
  for each row execute function public.handle_staff_separation();

create trigger set_updated_at before update on public.tasks
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.reminder_events
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.settings
  for each row execute function public.set_updated_at();
