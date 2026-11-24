-- SquareOne ELC Compliance Center: full schema (migrations 0001 to 0016).
-- Paste into the Supabase SQL editor of a NEW project and run once.
-- ===== 0001_enums.sql =====
create type public.app_role as enum
  ('director', 'admin_support', 'educator', 'classroom_reviewer', 'auditor');
create type public.employment_status as enum ('active', 'on_leave', 'separated');
create type public.authority_code as enum ('DHS', 'STARS', 'APPLE', 'CECPD', 'INTERNAL');
create type public.lifecycle_status as enum ('draft', 'active', 'superseded', 'archived');
create type public.applicability_scope as enum
  ('program', 'role', 'classroom', 'staff', 'child', 'facility');
create type public.frequency_type as enum
  ('one_time', 'recurring', 'expiration_based', 'event_triggered');
create type public.criticality as enum
  ('safety_critical', 'regulatory', 'accreditation', 'internal');
create type public.evidence_status as enum
  ('missing', 'pending_review', 'needs_correction', 'verified', 'not_applicable', 'unknown');
create type public.deadline_status as enum ('none', 'current', 'due_soon', 'urgent', 'overdue');
create type public.link_status as enum ('pending', 'approved', 'rejected');
create type public.access_class as enum ('general', 'personnel', 'child_health', 'restricted');
create type public.training_state as enum ('pending', 'verified', 'ineligible');
create type public.task_status as enum ('open', 'in_progress', 'done', 'cancelled');
create type public.reminder_milestone as enum
  ('d90', 'd60', 'd30', 'd14', 'd7', 'due', 'overdue', 'rejected', 'critical');
create type public.delivery_status as enum ('queued', 'sent', 'failed', 'suppressed');
-- ===== 0002_org_and_people.sql =====
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
create function public.chicago_today()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'America/Chicago')::date;
$$;
create table public.programs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  parent_org text,
  jurisdiction text,
  quality_designation text,
  accreditation_name text,
  accreditation_date date,
  licensed_capacity integer check (licensed_capacity is null or licensed_capacity > 0),
  leadership_theme text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);
create table public.classrooms (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs (id),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  unique (program_id, name)
);
create table public.staff (
  id uuid primary key default gen_random_uuid(),
  employee_code text not null unique,
  first_name text not null,
  last_name text not null,
  employment_status public.employment_status not null default 'active',
  role_title text,
  classroom_id uuid references public.classrooms (id),
  hire_date date,
  supervisor_id uuid references public.staff (id),
  requirement_set text,
  separation_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  check (supervisor_id is null or supervisor_id <> id),
  check (separation_date is null or hire_date is null or separation_date >= hire_date)
);
create index staff_classroom_idx on public.staff (classroom_id);
create table public.profiles (
  id uuid primary key references auth.users (id),
  role public.app_role not null default 'educator',
  staff_id uuid unique references public.staff (id),
  email text not null,
  display_name text,
  is_active boolean not null default false,
  child_health_access boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);
create table public.classroom_reviewer_assignments (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id),
  classroom_id uuid not null references public.classrooms (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  unique (profile_id, classroom_id)
);
create trigger set_updated_at before update on public.programs
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.classrooms
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.staff
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.classroom_reviewer_assignments
  for each row execute function public.set_updated_at();
create function public.auth_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select p.role
  from public.profiles p
  where p.id = (select auth.uid())
    and p.is_active
    and p.archived_at is null;
$$;
create function public.auth_staff_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.staff_id
  from public.profiles p
  where p.id = (select auth.uid())
    and p.is_active
    and p.archived_at is null;
$$;
create function public.can_access_class(cls public.access_class)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select case
      when p.role = 'director' then true
      when p.role = 'admin_support' then
        case cls
          when 'general' then true
          when 'personnel' then true
          when 'child_health' then p.child_health_access
          else false
        end
      else false
    end
    from public.profiles p
    where p.id = (select auth.uid())
      and p.is_active
      and p.archived_at is null
  ), false);
$$;
create function public.is_director_profile(pid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = pid and p.role = 'director' and p.is_active and p.archived_at is null
  );
$$;
create function public.guard_profile_privileges()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null and public.auth_role() is distinct from 'director' then
    if tg_op = 'INSERT' then
      raise exception 'only a director can create profiles' using errcode = '42501';
    end if;
    if new.role is distinct from old.role
       or new.is_active is distinct from old.is_active
       or new.staff_id is distinct from old.staff_id
       or new.child_health_access is distinct from old.child_health_access
       or new.archived_at is distinct from old.archived_at then
      raise exception 'only a director can change role, activation, staff link or grants'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
create trigger guard_profile_privileges before insert or update on public.profiles
  for each row execute function public.guard_profile_privileges();
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta_role text := new.raw_app_meta_data ->> 'role';
  valid_role boolean;
begin
  valid_role := meta_role in ('director', 'admin_support', 'educator', 'classroom_reviewer', 'auditor');
  insert into public.profiles (id, role, email, display_name, is_active)
  values (
    new.id,
    case when valid_role then meta_role::public.app_role else 'educator'::public.app_role end,
    coalesce(new.email, ''),
    new.raw_app_meta_data ->> 'display_name',
    coalesce(valid_role, false)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
-- ===== 0003_requirements.sql =====
create table public.authorities (
  id uuid primary key default gen_random_uuid(),
  code public.authority_code not null unique,
  name text not null,
  website text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);
create table public.requirements (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  authority_id uuid not null references public.authorities (id),
  title text not null,
  category text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);
create index requirements_authority_idx on public.requirements (authority_id);
create table public.requirement_versions (
  id uuid primary key default gen_random_uuid(),
  requirement_id uuid not null references public.requirements (id),
  version_label text not null,
  effective_date date,
  citation text,
  source_url text,
  scope public.applicability_scope not null,
  applies_to jsonb not null default '{}'::jsonb,
  description text,
  evidence_criteria text,
  frequency public.frequency_type,
  recurrence_rule jsonb,
  criticality public.criticality,
  last_source_review date,
  reviewed_by uuid references public.profiles (id),
  status public.lifecycle_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  unique (requirement_id, version_label),
  constraint requirement_versions_active_requires_source check (
    status <> 'active' or (
      nullif(btrim(citation), '') is not null
      and nullif(btrim(source_url), '') is not null
      and last_source_review is not null
      and reviewed_by is not null
      and frequency is not null
      and criticality is not null
    )
  ),
  constraint requirement_versions_recurrence_rule_shape check (
    recurrence_rule is null or (
      jsonb_typeof(recurrence_rule) = 'object'
      and recurrence_rule ->> 'type' in ('interval', 'fixed_months', 'expiration', 'event')
    )
  )
);
create unique index requirement_versions_one_active
  on public.requirement_versions (requirement_id) where status = 'active';
create function public.guard_requirement_version_activation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'active' and (tg_op = 'INSERT' or old.status is distinct from 'active') then
    if not public.is_director_profile(new.reviewed_by) then
      raise exception 'a requirement version can only be activated with a director as reviewed_by'
        using errcode = '42501';
    end if;
    if (select auth.uid()) is not null and public.auth_role() is distinct from 'director' then
      raise exception 'only a director can activate a requirement version'
        using errcode = '42501';
    end if;
    update public.requirement_versions
       set status = 'superseded'
     where requirement_id = new.requirement_id
       and status = 'active'
       and id <> new.id;
  end if;
  return new;
end;
$$;
create trigger guard_requirement_version_activation
  before insert or update on public.requirement_versions
  for each row execute function public.guard_requirement_version_activation();
create table public.requirement_instances (
  id uuid primary key default gen_random_uuid(),
  requirement_version_id uuid not null references public.requirement_versions (id),
  subject_type public.applicability_scope not null,
  subject_id uuid,
  owner_id uuid references public.profiles (id),
  backup_id uuid references public.profiles (id),
  reviewer_id uuid references public.profiles (id),
  due_date date,
  cycle_number integer not null default 1 check (cycle_number >= 1),
  previous_instance_id uuid references public.requirement_instances (id),
  na_reason text,
  na_approved_by uuid references public.profiles (id),
  na_approved_at timestamptz,
  verified_at timestamptz,
  verified_by uuid references public.profiles (id),
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint requirement_instances_na_complete check (
    na_approved_by is null
    or (nullif(btrim(na_reason), '') is not null and na_approved_at is not null)
  ),
  constraint requirement_instances_verified_complete check (
    (verified_at is null) = (verified_by is null)
  )
);
create index requirement_instances_version_idx on public.requirement_instances (requirement_version_id);
create index requirement_instances_subject_idx on public.requirement_instances (subject_type, subject_id);
create index requirement_instances_owner_idx on public.requirement_instances (owner_id);
create index requirement_instances_due_idx on public.requirement_instances (due_date);
create function public.guard_requirement_instance()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  version_status public.lifecycle_status;
begin
  if new.due_date is not null and (tg_op = 'INSERT' or new.due_date is distinct from old.due_date) then
    select rv.status into version_status
      from public.requirement_versions rv
     where rv.id = new.requirement_version_id;
    if version_status is distinct from 'active' then
      raise exception 'a due date cannot be set from a requirement version that is not active'
        using errcode = '23514';
    end if;
  end if;
  if new.na_approved_by is not null
     and (tg_op = 'INSERT' or new.na_approved_by is distinct from old.na_approved_by) then
    if not public.is_director_profile(new.na_approved_by) then
      raise exception 'a not-applicable exception must be approved by a director'
        using errcode = '42501';
    end if;
    if (select auth.uid()) is not null and (select auth.uid()) <> new.na_approved_by then
      raise exception 'na_approved_by must be the approving director' using errcode = '42501';
    end if;
  end if;
  if (select auth.uid()) is not null and pg_trigger_depth() = 1 then
    if tg_op = 'INSERT' and (new.verified_at is not null or new.verified_by is not null) then
      raise exception 'verification is set by evidence review, not directly' using errcode = '42501';
    end if;
    if tg_op = 'UPDATE' and (new.verified_at is distinct from old.verified_at
                             or new.verified_by is distinct from old.verified_by) then
      raise exception 'verification is set by evidence review, not directly' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
create trigger guard_requirement_instance
  before insert or update on public.requirement_instances
  for each row execute function public.guard_requirement_instance();
create trigger set_updated_at before update on public.authorities
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.requirements
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.requirement_versions
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.requirement_instances
  for each row execute function public.set_updated_at();
-- ===== 0004_evidence.sql =====
create table public.evidence (
  id uuid primary key default gen_random_uuid(),
  doc_type text not null,
  storage_path text not null unique,
  file_name text not null,
  version integer not null default 1 check (version >= 1),
  subject_type public.applicability_scope not null,
  subject_id uuid,
  uploader_id uuid not null references public.profiles (id),
  uploaded_at timestamptz not null default now(),
  issue_date date,
  expiry_date date,
  access_class public.access_class not null default 'restricted',
  supersedes_id uuid references public.evidence (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  check (expiry_date is null or issue_date is null or expiry_date >= issue_date)
);
create index evidence_subject_idx on public.evidence (subject_type, subject_id);
create index evidence_uploader_idx on public.evidence (uploader_id);
create table public.evidence_links (
  id uuid primary key default gen_random_uuid(),
  evidence_id uuid not null references public.evidence (id),
  requirement_instance_id uuid not null references public.requirement_instances (id),
  status public.link_status not null default 'pending',
  reviewer_id uuid references public.profiles (id),
  reviewed_at timestamptz,
  correction_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  unique (evidence_id, requirement_instance_id),
  constraint evidence_links_decision_complete check (
    (status = 'pending' and reviewer_id is null and reviewed_at is null)
    or (status <> 'pending' and reviewer_id is not null and reviewed_at is not null)
  ),
  constraint evidence_links_rejection_needs_note check (
    status <> 'rejected' or nullif(btrim(correction_note), '') is not null
  )
);
create index evidence_links_instance_idx on public.evidence_links (requirement_instance_id);
create index evidence_links_status_idx on public.evidence_links (status);
create function public.guard_evidence_link()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.status <> 'pending' then
      raise exception 'an evidence link starts as pending; approval is a separate review decision'
        using errcode = '23514';
    end if;
    return new;
  end if;
  if new.evidence_id <> old.evidence_id
     or new.requirement_instance_id <> old.requirement_instance_id then
    raise exception 'an evidence link cannot be re-pointed; create a new link' using errcode = '23514';
  end if;
  if new.status is distinct from old.status then
    if old.status <> 'pending' then
      raise exception 'a review decision is final; submit new evidence instead' using errcode = '23514';
    end if;
    if (select auth.uid()) is not null and new.reviewer_id is distinct from (select auth.uid()) then
      raise exception 'reviewer_id must be the signed-in reviewer' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
create trigger guard_evidence_link before insert or update on public.evidence_links
  for each row execute function public.guard_evidence_link();
create function public.stamp_instance_verification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'approved' and old.status is distinct from 'approved' then
    update public.requirement_instances
       set verified_at = new.reviewed_at,
           verified_by = new.reviewer_id
     where id = new.requirement_instance_id
       and verified_at is null;
  end if;
  return new;
end;
$$;
create trigger stamp_instance_verification after update on public.evidence_links
  for each row execute function public.stamp_instance_verification();
create trigger set_updated_at before update on public.evidence
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.evidence_links
  for each row execute function public.set_updated_at();
-- ===== 0005_credentials_training.sql =====
create table public.credential_types (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  category text,
  requires_expiration boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);
create table public.credentials (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff (id),
  credential_type_id uuid not null references public.credential_types (id),
  issuer text,
  issue_date date,
  expiration_date date,
  internal_review_date date,
  eligibility_status text check (eligibility_status in ('eligible', 'ineligible', 'pending')),
  evidence_id uuid references public.evidence (id),
  reviewer_id uuid references public.profiles (id),
  verified_at timestamptz,
  renewal_owner_id uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  check (expiration_date is null or issue_date is null or expiration_date >= issue_date),
  check ((verified_at is null) = (reviewer_id is null))
);
create index credentials_staff_idx on public.credentials (staff_id);
create index credentials_expiration_idx on public.credentials (expiration_date);
create table public.reporting_periods (
  id uuid primary key default gen_random_uuid(),
  label text not null unique,
  start_date date not null,
  end_date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  check (end_date >= start_date)
);
create table public.training_targets (
  id uuid primary key default gen_random_uuid(),
  role_title text not null,
  reporting_period_id uuid not null references public.reporting_periods (id),
  target_minutes integer not null check (target_minutes >= 0),
  confirmed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  unique (role_title, reporting_period_id)
);
create table public.training_records (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff (id),
  course_title text not null,
  provider text,
  completion_date date not null,
  minutes integer not null check (minutes > 0),
  category text,
  registry_verified boolean not null default false,
  certificate_identifier text,
  evidence_id uuid references public.evidence (id),
  reporting_period_id uuid references public.reporting_periods (id),
  state public.training_state not null default 'pending',
  reviewer_id uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  check (state = 'pending' or reviewer_id is not null)
);
create index training_records_staff_idx on public.training_records (staff_id);
create unique index training_records_no_duplicates on public.training_records
  (staff_id, lower(course_title), completion_date, coalesce(certificate_identifier, ''));
create function public.guard_review_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  is_reviewer boolean := (select auth.uid()) is null or public.auth_role() = 'director';
begin
  if is_reviewer then
    return new;
  end if;
  if tg_table_name = 'credentials' then
    if tg_op = 'INSERT' then
      if new.verified_at is not null or new.reviewer_id is not null
         or coalesce(new.eligibility_status, 'pending') <> 'pending' then
        raise exception 'only a reviewer can verify a credential' using errcode = '42501';
      end if;
    elsif new.verified_at is distinct from old.verified_at
       or new.reviewer_id is distinct from old.reviewer_id
       or new.eligibility_status is distinct from old.eligibility_status then
      raise exception 'only a reviewer can verify a credential' using errcode = '42501';
    end if;
  elsif tg_table_name = 'training_records' then
    if tg_op = 'INSERT' then
      if new.state <> 'pending' or new.reviewer_id is not null or new.registry_verified then
        raise exception 'only a reviewer can verify a training record' using errcode = '42501';
      end if;
    elsif new.state is distinct from old.state
       or new.reviewer_id is distinct from old.reviewer_id
       or new.registry_verified is distinct from old.registry_verified
       or (old.state = 'verified' and new.minutes is distinct from old.minutes) then
      raise exception 'only a reviewer can verify a training record' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
create trigger guard_review_fields before insert or update on public.credentials
  for each row execute function public.guard_review_fields();
create trigger guard_review_fields before insert or update on public.training_records
  for each row execute function public.guard_review_fields();
create trigger set_updated_at before update on public.credential_types
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.credentials
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.reporting_periods
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.training_targets
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.training_records
  for each row execute function public.set_updated_at();
-- ===== 0006_tasks_reminders.sql =====
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
-- ===== 0007_audit.sql =====
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
-- ===== 0008_status_views.sql =====
create view public.v_requirement_status
with (security_invoker = true)
as
with ctx as (
  select
    public.chicago_today() as today,
    public.setting_int('urgent_days', 7) as urgent_days,
    public.setting_int('due_soon_days', 30) as due_soon_days
),
link_facts as (
  select
    l.requirement_instance_id,
    bool_or(
      l.status = 'approved'
      and (e.expiry_date is null or e.expiry_date >= ctx.today)
    ) as has_valid_approved,
    max(l.reviewed_at) filter (where l.status <> 'pending') as last_decision_at,
    max(l.created_at) filter (where l.status = 'pending') as last_pending_at,
    bool_or(l.status = 'pending') as has_pending,
    (array_agg(l.status order by l.reviewed_at desc, l.id desc)
       filter (where l.status <> 'pending'))[1] as last_decision
  from public.evidence_links l
  join public.evidence e on e.id = l.evidence_id
  cross join ctx
  where l.archived_at is null
    and e.archived_at is null
  group by l.requirement_instance_id
)
select
  ri.id as requirement_instance_id,
  rv.id as requirement_version_id,
  r.id as requirement_id,
  r.code as requirement_code,
  r.title as requirement_title,
  r.category as requirement_category,
  a.code as authority_code,
  rv.criticality,
  rv.status as version_status,
  ri.subject_type,
  ri.subject_id,
  ri.owner_id,
  ri.backup_id,
  ri.reviewer_id,
  ri.due_date,
  ri.cycle_number,
  ri.closed_at,
  es.evidence_status,
  ds.deadline_status,
  (es.evidence_status = 'verified' and ds.deadline_status in ('current', 'none')) as is_green
from public.requirement_instances ri
join public.requirement_versions rv on rv.id = ri.requirement_version_id
join public.requirements r on r.id = rv.requirement_id
join public.authorities a on a.id = r.authority_id
cross join ctx
left join link_facts lf on lf.requirement_instance_id = ri.id
cross join lateral (
  select case
    when ri.na_approved_by is not null and nullif(btrim(ri.na_reason), '') is not null
      then 'not_applicable'
    when rv.status <> 'active' or rv.last_source_review is null
      then 'unknown'
    when coalesce(lf.has_valid_approved, false)
      then 'verified'
    when lf.last_decision = 'rejected'
         and (lf.last_pending_at is null or lf.last_pending_at <= lf.last_decision_at)
      then 'needs_correction'
    when coalesce(lf.has_pending, false)
      then 'pending_review'
    else 'missing'
  end::public.evidence_status as evidence_status
) es
cross join lateral (
  select case
    when ri.due_date is null then 'none'
    when ri.due_date < ctx.today then 'overdue'
    when ri.due_date - ctx.today <= ctx.urgent_days then 'urgent'
    when ri.due_date - ctx.today <= ctx.due_soon_days then 'due_soon'
    else 'current'
  end::public.deadline_status as deadline_status
) ds
where ri.archived_at is null;
-- ===== 0009_rls_policies.sql =====
do $$
declare
  t text;
begin
  foreach t in array array[
    'programs', 'classrooms', 'staff', 'profiles', 'classroom_reviewer_assignments',
    'authorities', 'requirements', 'requirement_versions', 'requirement_instances',
    'evidence', 'evidence_links',
    'credential_types', 'credentials', 'reporting_periods', 'training_targets', 'training_records',
    'tasks', 'reminder_events', 'settings', 'audit_events'
  ] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end;
$$;
revoke all on all tables in schema public from anon, authenticated;
grant select, insert, update on all tables in schema public to authenticated;
revoke insert, update on public.audit_events, public.reminder_events from authenticated;
grant all on all tables in schema public to service_role;
alter default privileges in schema public revoke all on tables from anon, authenticated;
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
alter default privileges revoke execute on functions from public;
alter default privileges in schema public revoke execute on functions from anon;
alter default privileges in schema public grant execute on functions to authenticated, service_role;
do $$
declare
  t text;
begin
  foreach t in array array[
    'programs', 'classrooms', 'authorities', 'requirements', 'requirement_versions',
    'credential_types', 'reporting_periods', 'training_targets', 'settings'
  ] loop
    execute format($f$
      create policy %1$s_select on public.%1$I for select to authenticated
        using ((select public.auth_role()) in ('director', 'admin_support', 'educator', 'classroom_reviewer'))
    $f$, t);
    execute format($f$
      create policy %1$s_insert on public.%1$I for insert to authenticated
        with check ((select public.auth_role()) = 'director')
    $f$, t);
    execute format($f$
      create policy %1$s_update on public.%1$I for update to authenticated
        using ((select public.auth_role()) = 'director')
        with check ((select public.auth_role()) = 'director')
    $f$, t);
  end loop;
end;
$$;
create policy profiles_select on public.profiles for select to authenticated
  using (
    id = (select auth.uid())
    or (select public.auth_role()) in ('director', 'admin_support')
  );
create policy profiles_insert on public.profiles for insert to authenticated
  with check ((select public.auth_role()) = 'director');
create policy profiles_update on public.profiles for update to authenticated
  using (
    (select public.auth_role()) = 'director'
    or (id = (select auth.uid()) and (select public.auth_role()) is not null)
  )
  with check (
    (select public.auth_role()) = 'director'
    or id = (select auth.uid())
  );
create policy staff_select on public.staff for select to authenticated
  using (
    (select public.auth_role()) in ('director', 'admin_support')
    or id = (select public.auth_staff_id())
  );
create policy staff_insert on public.staff for insert to authenticated
  with check ((select public.auth_role()) in ('director', 'admin_support'));
create policy staff_update on public.staff for update to authenticated
  using ((select public.auth_role()) in ('director', 'admin_support'))
  with check ((select public.auth_role()) in ('director', 'admin_support'));
create policy cra_select on public.classroom_reviewer_assignments for select to authenticated
  using (
    (select public.auth_role()) in ('director', 'admin_support')
    or (profile_id = (select auth.uid()) and (select public.auth_role()) is not null)
  );
create policy cra_insert on public.classroom_reviewer_assignments for insert to authenticated
  with check ((select public.auth_role()) = 'director');
create policy cra_update on public.classroom_reviewer_assignments for update to authenticated
  using ((select public.auth_role()) = 'director')
  with check ((select public.auth_role()) = 'director');
create policy requirement_instances_select on public.requirement_instances for select to authenticated
  using (
    (select public.auth_role()) in ('director', 'admin_support')
    or (
      (select public.auth_role()) in ('educator', 'classroom_reviewer')
      and (
        (select auth.uid()) in (owner_id, backup_id, reviewer_id)
        or (subject_type = 'staff' and subject_id = (select public.auth_staff_id()))
      )
    )
  );
create policy requirement_instances_insert on public.requirement_instances for insert to authenticated
  with check ((select public.auth_role()) in ('director', 'admin_support'));
create policy requirement_instances_update on public.requirement_instances for update to authenticated
  using ((select public.auth_role()) in ('director', 'admin_support'))
  with check ((select public.auth_role()) in ('director', 'admin_support'));
create policy evidence_select on public.evidence for select to authenticated
  using (
    (select public.auth_role()) is not null
    and (
      public.can_access_class(access_class)
      or (
        (select public.auth_role()) in ('educator', 'classroom_reviewer', 'admin_support')
        and access_class in ('general', 'personnel')
        and (
          uploader_id = (select auth.uid())
          or (subject_type = 'staff' and subject_id = (select public.auth_staff_id()))
        )
      )
    )
  );
create policy evidence_insert on public.evidence for insert to authenticated
  with check (
    uploader_id = (select auth.uid())
    and (
      public.can_access_class(access_class)
      or (
        (select public.auth_role()) in ('educator', 'classroom_reviewer')
        and access_class in ('general', 'personnel')
        and subject_type = 'staff'
        and subject_id = (select public.auth_staff_id())
      )
    )
  );
create policy evidence_update on public.evidence for update to authenticated
  using ((select public.auth_role()) in ('director', 'admin_support') and public.can_access_class(access_class))
  with check ((select public.auth_role()) in ('director', 'admin_support') and public.can_access_class(access_class));
create policy evidence_links_select on public.evidence_links for select to authenticated
  using (
    exists (select 1 from public.evidence e where e.id = evidence_id)
    and exists (select 1 from public.requirement_instances ri where ri.id = requirement_instance_id)
  );
create policy evidence_links_insert on public.evidence_links for insert to authenticated
  with check (
    status = 'pending'
    and exists (select 1 from public.evidence e where e.id = evidence_id)
    and exists (select 1 from public.requirement_instances ri where ri.id = requirement_instance_id)
  );
create policy evidence_links_update on public.evidence_links for update to authenticated
  using ((select public.auth_role()) = 'director')
  with check ((select public.auth_role()) = 'director');
create policy credentials_select on public.credentials for select to authenticated
  using (
    public.can_access_class('personnel')
    or (
      (select public.auth_role()) in ('educator', 'classroom_reviewer')
      and staff_id = (select public.auth_staff_id())
    )
  );
create policy credentials_insert on public.credentials for insert to authenticated
  with check (public.can_access_class('personnel'));
create policy credentials_update on public.credentials for update to authenticated
  using (public.can_access_class('personnel'))
  with check (public.can_access_class('personnel'));
create policy training_records_select on public.training_records for select to authenticated
  using (
    public.can_access_class('personnel')
    or (
      (select public.auth_role()) in ('educator', 'classroom_reviewer')
      and staff_id = (select public.auth_staff_id())
    )
  );
create policy training_records_insert on public.training_records for insert to authenticated
  with check (
    public.can_access_class('personnel')
    or (
      (select public.auth_role()) in ('educator', 'classroom_reviewer')
      and staff_id = (select public.auth_staff_id())
    )
  );
create policy training_records_update on public.training_records for update to authenticated
  using (public.can_access_class('personnel'))
  with check (public.can_access_class('personnel'));
create policy tasks_select on public.tasks for select to authenticated
  using (
    (select public.auth_role()) in ('director', 'admin_support')
    or (
      (select public.auth_role()) in ('educator', 'classroom_reviewer')
      and (select auth.uid()) in (assignee_id, created_by)
    )
  );
create policy tasks_insert on public.tasks for insert to authenticated
  with check (
    (select public.auth_role()) in ('director', 'admin_support')
    and created_by = (select auth.uid())
  );
create policy tasks_update on public.tasks for update to authenticated
  using (
    (select public.auth_role()) in ('director', 'admin_support')
    or ((select public.auth_role()) in ('educator', 'classroom_reviewer') and assignee_id = (select auth.uid()))
  )
  with check (
    (select public.auth_role()) in ('director', 'admin_support')
    or assignee_id = (select auth.uid())
  );
create policy reminder_events_select on public.reminder_events for select to authenticated
  using ((select public.auth_role()) in ('director', 'admin_support'));
create policy audit_events_select on public.audit_events for select to authenticated
  using ((select public.auth_role()) = 'director');
-- ===== 0010_storage_buckets.sql =====
insert into storage.buckets (id, name, public)
values ('evidence', 'evidence', false)
on conflict (id) do update set public = false;
create policy evidence_objects_select on storage.objects for select to authenticated
  using (
    bucket_id = 'evidence'
    and exists (
      select 1 from public.evidence e
      where e.storage_path = storage.objects.name
        and e.archived_at is null
    )
  );
create policy evidence_objects_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'evidence'
    and exists (
      select 1 from public.evidence e
      where e.storage_path = storage.objects.name
        and e.uploader_id = (select auth.uid())
        and (storage.foldername(storage.objects.name))[1] = e.access_class::text
        and (storage.foldername(storage.objects.name))[4] = e.id::text
    )
  );
-- ===== 0011_inspections_safety_policies.sql =====
create function public.setup_compliance_table(tbl text, insert_only boolean default false)
returns void
language plpgsql
set search_path = ''
as $$
begin
  execute format('alter table public.%I enable row level security', tbl);
  execute format('revoke all on public.%I from anon, authenticated', tbl);
  execute format('grant select, insert%s on public.%I to authenticated',
                 case when insert_only then '' else ', update' end, tbl);
  execute format('grant all on public.%I to service_role', tbl);
  execute format('create trigger audit_row after insert or update on public.%I
                    for each row execute function public.audit_row()', tbl);
  execute format('create trigger no_hard_delete before delete on public.%I
                    for each row execute function public.prevent_mutation()', tbl);
  execute format('create trigger no_truncate before truncate on public.%I
                    for each statement execute function public.prevent_mutation()', tbl);
  if insert_only then
    execute format('create trigger insert_only before update on public.%I
                      for each row execute function public.prevent_mutation()', tbl);
  else
    execute format('create trigger set_updated_at before update on public.%I
                      for each row execute function public.set_updated_at()', tbl);
  end if;
end;
$$;
revoke execute on function public.setup_compliance_table(text, boolean) from authenticated;
create table public.inspections (
  id uuid primary key default gen_random_uuid(),
  authority_id uuid not null references public.authorities (id),
  inspection_date date not null,
  inspector text,
  kind text not null default 'routine',
  summary text,
  evidence_id uuid references public.evidence (id),
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);
create table public.findings (
  id uuid primary key default gen_random_uuid(),
  inspection_id uuid not null references public.inspections (id),
  requirement_id uuid references public.requirements (id),
  description text not null,
  criticality public.criticality,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);
create index findings_inspection_idx on public.findings (inspection_id);
create table public.corrective_actions (
  id uuid primary key default gen_random_uuid(),
  finding_id uuid not null references public.findings (id),
  description text not null,
  owner_id uuid references public.profiles (id),
  due_date date,
  evidence_id uuid references public.evidence (id),
  verified_by uuid references public.profiles (id),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  check ((verified_at is null) = (verified_by is null))
);
create index corrective_actions_finding_idx on public.corrective_actions (finding_id);
create function public.guard_corrective_action()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.verified_by is not null
     and (tg_op = 'INSERT' or new.verified_by is distinct from old.verified_by) then
    if not public.is_director_profile(new.verified_by) then
      raise exception 'a corrective action is closed by a director' using errcode = '42501';
    end if;
    if (select auth.uid()) is not null and (select auth.uid()) <> new.verified_by then
      raise exception 'verified_by must be the signed-in director' using errcode = '42501';
    end if;
  end if;
  if tg_op = 'UPDATE' and old.verified_by is not null and new.verified_by is distinct from old.verified_by then
    raise exception 'a verified closure is final' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger guard_corrective_action before insert or update on public.corrective_actions
  for each row execute function public.guard_corrective_action();
create table public.safety_checks (
  id uuid primary key default gen_random_uuid(),
  classroom_id uuid references public.classrooms (id),
  check_type text not null check (check_type in ('weekly_checklist', 'drill', 'maintenance', 'inspection')),
  performed_on date not null,
  performed_by uuid not null references public.profiles (id),
  result text not null check (result in ('pass', 'issue_found')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);
create index safety_checks_classroom_idx on public.safety_checks (classroom_id, performed_on desc);
create table public.policies (
  id uuid primary key default gen_random_uuid(),
  title text not null unique,
  category text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);
create table public.policy_versions (
  id uuid primary key default gen_random_uuid(),
  policy_id uuid not null references public.policies (id),
  version_label text not null,
  effective_date date,
  summary text,
  evidence_id uuid references public.evidence (id),
  status public.lifecycle_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  unique (policy_id, version_label)
);
create unique index policy_versions_one_active on public.policy_versions (policy_id) where status = 'active';
create function public.supersede_policy_version()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'active' and (tg_op = 'INSERT' or old.status is distinct from 'active') then
    update public.policy_versions set status = 'superseded'
     where policy_id = new.policy_id and status = 'active' and id <> new.id;
  end if;
  return new;
end;
$$;
create trigger supersede_policy_version before insert or update on public.policy_versions
  for each row execute function public.supersede_policy_version();
create table public.policy_acknowledgments (
  id uuid primary key default gen_random_uuid(),
  policy_version_id uuid not null references public.policy_versions (id),
  profile_id uuid not null references public.profiles (id),
  acknowledged_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  unique (policy_version_id, profile_id)
);
select public.setup_compliance_table('inspections');
select public.setup_compliance_table('findings');
select public.setup_compliance_table('corrective_actions');
select public.setup_compliance_table('safety_checks');
select public.setup_compliance_table('policies');
select public.setup_compliance_table('policy_versions');
select public.setup_compliance_table('policy_acknowledgments', true);
create policy inspections_select on public.inspections for select to authenticated
  using ((select public.auth_role()) in ('director', 'admin_support'));
create policy inspections_insert on public.inspections for insert to authenticated
  with check ((select public.auth_role()) in ('director', 'admin_support'));
create policy inspections_update on public.inspections for update to authenticated
  using ((select public.auth_role()) in ('director', 'admin_support'))
  with check ((select public.auth_role()) in ('director', 'admin_support'));
create policy findings_select on public.findings for select to authenticated
  using ((select public.auth_role()) in ('director', 'admin_support'));
create policy findings_insert on public.findings for insert to authenticated
  with check ((select public.auth_role()) in ('director', 'admin_support'));
create policy findings_update on public.findings for update to authenticated
  using ((select public.auth_role()) in ('director', 'admin_support'))
  with check ((select public.auth_role()) in ('director', 'admin_support'));
create policy corrective_actions_select on public.corrective_actions for select to authenticated
  using (
    (select public.auth_role()) in ('director', 'admin_support')
    or ((select public.auth_role()) in ('educator', 'classroom_reviewer') and owner_id = (select auth.uid()))
  );
create policy corrective_actions_insert on public.corrective_actions for insert to authenticated
  with check ((select public.auth_role()) in ('director', 'admin_support'));
create policy corrective_actions_update on public.corrective_actions for update to authenticated
  using ((select public.auth_role()) in ('director', 'admin_support'))
  with check ((select public.auth_role()) in ('director', 'admin_support'));
create function public.can_use_classroom(cid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.auth_role() in ('director', 'admin_support'), false)
    or exists (
      select 1 from public.classroom_reviewer_assignments a
      where a.profile_id = (select auth.uid()) and a.classroom_id = cid and a.archived_at is null
        and public.auth_role() = 'classroom_reviewer'
    )
    or exists (
      select 1 from public.staff s
      where s.id = public.auth_staff_id() and s.classroom_id = cid
        and public.auth_role() in ('educator', 'classroom_reviewer')
    );
$$;
create policy safety_checks_select on public.safety_checks for select to authenticated
  using (
    (select public.auth_role()) in ('director', 'admin_support')
    or (classroom_id is not null and public.can_use_classroom(classroom_id))
  );
create policy safety_checks_insert on public.safety_checks for insert to authenticated
  with check (
    performed_by = (select auth.uid())
    and (
      (select public.auth_role()) in ('director', 'admin_support')
      or (classroom_id is not null and public.can_use_classroom(classroom_id))
    )
  );
create policy safety_checks_update on public.safety_checks for update to authenticated
  using ((select public.auth_role()) in ('director', 'admin_support'))
  with check ((select public.auth_role()) in ('director', 'admin_support'));
create policy policies_select on public.policies for select to authenticated
  using ((select public.auth_role()) in ('director', 'admin_support', 'educator', 'classroom_reviewer'));
create policy policies_insert on public.policies for insert to authenticated
  with check ((select public.auth_role()) = 'director');
create policy policies_update on public.policies for update to authenticated
  using ((select public.auth_role()) = 'director') with check ((select public.auth_role()) = 'director');
create policy policy_versions_select on public.policy_versions for select to authenticated
  using (
    (select public.auth_role()) in ('director', 'admin_support')
    or ((select public.auth_role()) in ('educator', 'classroom_reviewer') and status = 'active')
  );
create policy policy_versions_insert on public.policy_versions for insert to authenticated
  with check ((select public.auth_role()) = 'director');
create policy policy_versions_update on public.policy_versions for update to authenticated
  using ((select public.auth_role()) = 'director') with check ((select public.auth_role()) = 'director');
create policy policy_acknowledgments_select on public.policy_acknowledgments for select to authenticated
  using (
    (select public.auth_role()) in ('director', 'admin_support')
    or (profile_id = (select auth.uid()) and (select public.auth_role()) is not null)
  );
create policy policy_acknowledgments_insert on public.policy_acknowledgments for insert to authenticated
  with check (
    profile_id = (select auth.uid())
    and (select public.auth_role()) in ('director', 'admin_support', 'educator', 'classroom_reviewer')
    and exists (select 1 from public.policy_versions pv where pv.id = policy_version_id and pv.status = 'active')
  );
-- ===== 0012_children.sql =====
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
create policy requirement_instances_select_classroom on public.requirement_instances for select to authenticated
  using (
    (select public.auth_role()) = 'classroom_reviewer'
    and (
      (subject_type = 'classroom' and public.can_use_classroom(subject_id))
      or (subject_type = 'child' and exists (select 1 from public.children c where c.id = subject_id))
    )
  );
-- ===== 0013_reviews_auditor.sql =====
create table public.review_cycles (
  id uuid primary key default gen_random_uuid(),
  quarter integer not null check (quarter between 1 and 4),
  year integer not null check (year between 2020 and 2100),
  opened_at timestamptz not null default now(),
  opened_by uuid references public.profiles (id),
  signed_off_by uuid references public.profiles (id),
  signed_off_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  unique (year, quarter),
  check ((signed_off_at is null) = (signed_off_by is null))
);
create function public.guard_review_cycle()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and old.signed_off_by is not null then
    raise exception 'a signed-off review cycle is final' using errcode = '23514';
  end if;
  if new.signed_off_by is not null then
    if not public.is_director_profile(new.signed_off_by) then
      raise exception 'a review cycle is signed off by a director' using errcode = '42501';
    end if;
    if (select auth.uid()) is not null and (select auth.uid()) <> new.signed_off_by then
      raise exception 'signed_off_by must be the signed-in director' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
create trigger guard_review_cycle before insert or update on public.review_cycles
  for each row execute function public.guard_review_cycle();
create table public.review_results (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.review_cycles (id),
  scope text not null,
  snapshot jsonb not null,
  exceptions jsonb not null default '[]'::jsonb,
  follow_up_task_ids uuid[] not null default '{}',
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);
create index review_results_cycle_idx on public.review_results (cycle_id);
create table public.auditor_grants (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id),
  label text not null,
  scope jsonb not null default '{"requirement_ids": [], "evidence_ids": []}'::jsonb,
  expires_at timestamptz not null,
  created_by uuid references public.profiles (id),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);
create index auditor_grants_profile_idx on public.auditor_grants (profile_id);
select public.setup_compliance_table('review_cycles');
select public.setup_compliance_table('review_results', true);
select public.setup_compliance_table('auditor_grants');
create policy review_cycles_select on public.review_cycles for select to authenticated
  using ((select public.auth_role()) in ('director', 'admin_support'));
create policy review_cycles_insert on public.review_cycles for insert to authenticated
  with check ((select public.auth_role()) = 'director');
create policy review_cycles_update on public.review_cycles for update to authenticated
  using ((select public.auth_role()) = 'director') with check ((select public.auth_role()) = 'director');
create policy review_results_select on public.review_results for select to authenticated
  using ((select public.auth_role()) in ('director', 'admin_support'));
create policy review_results_insert on public.review_results for insert to authenticated
  with check ((select public.auth_role()) = 'director');
create policy auditor_grants_select on public.auditor_grants for select to authenticated
  using (
    (select public.auth_role()) = 'director'
    or (profile_id = (select auth.uid()) and (select public.auth_role()) = 'auditor')
  );
create policy auditor_grants_insert on public.auditor_grants for insert to authenticated
  with check ((select public.auth_role()) = 'director');
create policy auditor_grants_update on public.auditor_grants for update to authenticated
  using ((select public.auth_role()) = 'director') with check ((select public.auth_role()) = 'director');
create function public.auditor_has(kind text, target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.auth_role() = 'auditor' and exists (
    select 1 from public.auditor_grants g
    where g.profile_id = (select auth.uid())
      and g.revoked_at is null
      and g.archived_at is null
      and g.expires_at > now()
      and g.scope -> kind ? target::text
  );
$$;
create policy requirements_select_auditor on public.requirements for select to authenticated
  using (public.auditor_has('requirement_ids', id));
create policy requirement_versions_select_auditor on public.requirement_versions for select to authenticated
  using (public.auditor_has('requirement_ids', requirement_id));
create policy authorities_select_auditor on public.authorities for select to authenticated
  using ((select public.auth_role()) = 'auditor');
create policy requirement_instances_select_auditor on public.requirement_instances for select to authenticated
  using (exists (
    select 1 from public.requirement_versions rv
    where rv.id = requirement_version_id and public.auditor_has('requirement_ids', rv.requirement_id)
  ));
create policy evidence_select_auditor on public.evidence for select to authenticated
  using (public.auditor_has('evidence_ids', id));
-- ===== 0014_workflows.sql =====
create function public.deadline_status_for(due date)
returns public.deadline_status
language sql
stable
set search_path = ''
as $$
  select case
    when due is null then 'none'
    when due < public.chicago_today() then 'overdue'
    when due - public.chicago_today() <= public.setting_int('urgent_days', 7) then 'urgent'
    when due - public.chicago_today() <= public.setting_int('due_soon_days', 30) then 'due_soon'
    else 'current'
  end::public.deadline_status;
$$;
alter table public.reminder_events add column credential_id uuid references public.credentials (id);
alter table public.reminder_events drop constraint reminder_events_no_duplicates;
alter table public.reminder_events add constraint reminder_events_no_duplicates
  unique nulls not distinct (requirement_instance_id, credential_id, milestone, recipient_id, due_date);
create or replace function public.guard_evidence_link()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.status <> 'pending' then
      raise exception 'an evidence link starts as pending; approval is a separate review decision'
        using errcode = '23514';
    end if;
    return new;
  end if;
  if new.evidence_id <> old.evidence_id then
    raise exception 'an evidence link cannot be re-pointed; create a new link' using errcode = '23514';
  end if;
  if new.requirement_instance_id <> old.requirement_instance_id then
    if old.status <> 'pending' or not exists (
      select 1 from public.requirement_instances n
      where n.id = new.requirement_instance_id and n.previous_instance_id = old.requirement_instance_id
    ) then
      raise exception 'an evidence link can only move, while pending, to the next cycle of the same requirement'
        using errcode = '23514';
    end if;
  end if;
  if new.status is distinct from old.status then
    if old.status <> 'pending' then
      raise exception 'a review decision is final; submit new evidence instead' using errcode = '23514';
    end if;
    if (select auth.uid()) is not null and new.reviewer_id is distinct from (select auth.uid()) then
      raise exception 'reviewer_id must be the signed-in reviewer' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
create function public.generate_instances_internal(p_version uuid, p_staff uuid, p_child uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  created integer := 0;
  n integer;
begin
  if p_child is null then
    insert into public.requirement_instances (requirement_version_id, subject_type, subject_id)
    select rv.id, 'staff', s.id
      from public.requirement_versions rv
      cross join public.staff s
     where rv.status = 'active' and rv.archived_at is null and rv.scope in ('staff', 'role')
       and (p_version is null or rv.id = p_version)
       and (p_staff is null or s.id = p_staff)
       and s.employment_status <> 'separated' and s.archived_at is null
       and (coalesce(jsonb_array_length(rv.applies_to -> 'roles'), 0) = 0 or rv.applies_to -> 'roles' ? s.role_title)
       and (coalesce(jsonb_array_length(rv.applies_to -> 'classroom_ids'), 0) = 0
            or rv.applies_to -> 'classroom_ids' ? s.classroom_id::text)
       and not exists (
         select 1 from public.requirement_instances ri
          where ri.requirement_version_id = rv.id and ri.subject_type = 'staff' and ri.subject_id = s.id
            and ri.closed_at is null and ri.archived_at is null);
    get diagnostics n = row_count; created := created + n;
  end if;
  if p_staff is null then
    insert into public.requirement_instances (requirement_version_id, subject_type, subject_id)
    select rv.id, 'child', c.id
      from public.requirement_versions rv
      cross join public.children c
     where rv.status = 'active' and rv.archived_at is null and rv.scope = 'child'
       and (p_version is null or rv.id = p_version)
       and (p_child is null or c.id = p_child)
       and c.status = 'enrolled' and c.archived_at is null
       and not exists (
         select 1 from public.requirement_instances ri
          where ri.requirement_version_id = rv.id and ri.subject_type = 'child' and ri.subject_id = c.id
            and ri.closed_at is null and ri.archived_at is null);
    get diagnostics n = row_count; created := created + n;
  end if;
  if p_staff is null and p_child is null then
    insert into public.requirement_instances (requirement_version_id, subject_type, subject_id)
    select rv.id, 'classroom', c.id
      from public.requirement_versions rv
      cross join public.classrooms c
     where rv.status = 'active' and rv.archived_at is null and rv.scope = 'classroom'
       and (p_version is null or rv.id = p_version)
       and c.archived_at is null
       and (coalesce(jsonb_array_length(rv.applies_to -> 'classroom_ids'), 0) = 0
            or rv.applies_to -> 'classroom_ids' ? c.id::text)
       and not exists (
         select 1 from public.requirement_instances ri
          where ri.requirement_version_id = rv.id and ri.subject_type = 'classroom' and ri.subject_id = c.id
            and ri.closed_at is null and ri.archived_at is null);
    get diagnostics n = row_count; created := created + n;
    insert into public.requirement_instances (requirement_version_id, subject_type, subject_id)
    select rv.id, rv.scope, p.id
      from public.requirement_versions rv
      cross join public.programs p
     where rv.status = 'active' and rv.archived_at is null and rv.scope in ('program', 'facility')
       and (p_version is null or rv.id = p_version)
       and p.archived_at is null
       and not exists (
         select 1 from public.requirement_instances ri
          where ri.requirement_version_id = rv.id and ri.subject_id = p.id
            and ri.closed_at is null and ri.archived_at is null);
    get diagnostics n = row_count; created := created + n;
  end if;
  return created;
end;
$$;
revoke execute on function public.generate_instances_internal(uuid, uuid, uuid) from authenticated;
create function public.generate_instances(p_version uuid default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.auth_role() is null or public.auth_role() not in ('director', 'admin_support') then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return public.generate_instances_internal(p_version, null, null);
end;
$$;
create function public.on_staff_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform public.generate_instances_internal(null, new.id, null);
    insert into public.tasks (title, kind, created_by)
    values ('New hire file: ' || new.employee_code, 'follow_up', (select auth.uid()));
  elsif new.role_title is distinct from old.role_title or new.classroom_id is distinct from old.classroom_id then
    perform public.generate_instances_internal(null, new.id, null);
    insert into public.tasks (title, kind, created_by)
    values ('Role or classroom change, review file: ' || new.employee_code, 'follow_up', (select auth.uid()));
  end if;
  return new;
end;
$$;
create trigger on_staff_change after insert or update on public.staff
  for each row execute function public.on_staff_change();
create function public.on_child_enrolled()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.generate_instances_internal(null, null, new.id);
  insert into public.tasks (title, kind, created_by)
  values ('New child file: ' || new.child_code, 'follow_up', (select auth.uid()));
  return new;
end;
$$;
create trigger on_child_enrolled after insert on public.children
  for each row execute function public.on_child_enrolled();
create function public.on_requirement_version_activated()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  req_code text;
  closed integer;
begin
  if new.status = 'active' and (tg_op = 'INSERT' or old.status is distinct from 'active') then
    update public.requirement_instances ri
       set closed_at = now()
      from public.requirement_versions rv
     where rv.id = ri.requirement_version_id
       and rv.requirement_id = new.requirement_id
       and rv.id <> new.id
       and ri.closed_at is null;
    get diagnostics closed = row_count;
    perform public.generate_instances_internal(new.id, null, null);
    if closed > 0 then
      select r.code into req_code from public.requirements r where r.id = new.requirement_id;
      insert into public.tasks (title, kind, created_by)
      values ('Rule change: ' || req_code || ' has a new version. Re-collect evidence.', 'follow_up', new.reviewed_by);
    end if;
  end if;
  return new;
end;
$$;
create trigger on_requirement_version_activated after insert or update on public.requirement_versions
  for each row execute function public.on_requirement_version_activated();
create function public.on_corrective_action()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.tasks (title, kind, assignee_id, due_date, created_by)
    values ('Corrective action: ' || left(new.description, 120), 'corrective_action', new.owner_id, new.due_date, (select auth.uid()));
  end if;
  return new;
end;
$$;
create trigger on_corrective_action after insert on public.corrective_actions
  for each row execute function public.on_corrective_action();
create function public.review_evidence_link(
  p_link uuid,
  p_decision public.link_status,
  p_note text default null,
  p_next_due date default null,
  p_set_due boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  l public.evidence_links;
  i public.requirement_instances;
  rv public.requirement_versions;
  req_title text;
  submitter uuid;
  target uuid;
  task uuid;
begin
  if public.auth_role() is distinct from 'director' then
    raise exception 'only a director can review evidence' using errcode = '42501';
  end if;
  if p_decision not in ('approved', 'rejected') then
    raise exception 'decision must be approved or rejected' using errcode = '22023';
  end if;
  select * into l from public.evidence_links where id = p_link for update;
  if not found or l.status <> 'pending' then
    raise exception 'this submission is not waiting for review' using errcode = '23514';
  end if;
  select * into i from public.requirement_instances where id = l.requirement_instance_id for update;
  select * into rv from public.requirement_versions where id = i.requirement_version_id;
  select r.title into req_title from public.requirements r where r.id = rv.requirement_id;
  select e.uploader_id into submitter from public.evidence e where e.id = l.evidence_id;
  target := i.id;
  if p_decision = 'rejected' then
    if nullif(btrim(p_note), '') is null then
      raise exception 'a correction note is required' using errcode = '23514';
    end if;
    update public.evidence_links
       set status = 'rejected', reviewer_id = me, reviewed_at = now(), correction_note = p_note
     where id = p_link;
    insert into public.tasks (requirement_instance_id, title, assignee_id, kind, created_by)
    values (i.id, 'Correct and resubmit: ' || req_title, submitter, 'correction', me)
    returning id into task;
    insert into public.reminder_events (requirement_instance_id, task_id, milestone, recipient_id, due_date)
    values (i.id, task, 'rejected', submitter, public.chicago_today())
    on conflict do nothing;
    return target;
  end if;
  if rv.status <> 'active' then
    raise exception 'evidence cannot be approved against a requirement whose source is not confirmed'
      using errcode = '23514';
  end if;
  if i.verified_at is not null and rv.frequency in ('recurring', 'expiration_based') then
    update public.requirement_instances set closed_at = now() where id = i.id;
    insert into public.requirement_instances
      (requirement_version_id, subject_type, subject_id, owner_id, backup_id, reviewer_id,
       due_date, cycle_number, previous_instance_id)
    values
      (i.requirement_version_id, i.subject_type, i.subject_id, i.owner_id, i.backup_id, i.reviewer_id,
       p_next_due, i.cycle_number + 1, i.id)
    returning id into target;
    update public.evidence_links set requirement_instance_id = target where id = p_link;
  elsif p_set_due then
    update public.requirement_instances set due_date = p_next_due where id = i.id;
  end if;
  update public.evidence_links
     set status = 'approved', reviewer_id = me, reviewed_at = now()
   where id = p_link;
  update public.tasks set status = 'done'
   where requirement_instance_id = i.id and status in ('open', 'in_progress') and kind in ('renewal', 'correction');
  update public.reminder_events set status = 'suppressed'
   where requirement_instance_id = i.id and status in ('queued', 'failed');
  return target;
end;
$$;
create or replace view public.v_requirement_status
with (security_invoker = true)
as
with ctx as (
  select
    public.chicago_today() as today,
    public.setting_int('urgent_days', 7) as urgent_days,
    public.setting_int('due_soon_days', 30) as due_soon_days
),
link_facts as (
  select
    l.requirement_instance_id,
    bool_or(
      l.status = 'approved'
      and (e.expiry_date is null or e.expiry_date >= ctx.today)
    ) as has_valid_approved,
    max(l.reviewed_at) filter (where l.status <> 'pending') as last_decision_at,
    max(l.created_at) filter (where l.status = 'pending') as last_pending_at,
    bool_or(l.status = 'pending') as has_pending,
    (array_agg(l.status order by l.reviewed_at desc, l.id desc)
       filter (where l.status <> 'pending'))[1] as last_decision
  from public.evidence_links l
  join public.evidence e on e.id = l.evidence_id
  cross join ctx
  where l.archived_at is null
    and e.archived_at is null
  group by l.requirement_instance_id
)
select
  ri.id as requirement_instance_id,
  rv.id as requirement_version_id,
  r.id as requirement_id,
  r.code as requirement_code,
  r.title as requirement_title,
  r.category as requirement_category,
  a.code as authority_code,
  rv.criticality,
  rv.status as version_status,
  ri.subject_type,
  ri.subject_id,
  ri.owner_id,
  ri.backup_id,
  ri.reviewer_id,
  ri.due_date,
  ri.cycle_number,
  ri.closed_at,
  es.evidence_status,
  ds.deadline_status,
  (es.evidence_status = 'verified' and ds.deadline_status in ('current', 'none')) as is_green,
  coalesce(
    st.first_name || ' ' || st.last_name,
    ch.first_name || ' ' || ch.last_initial || '.',
    cl.name,
    pr.name
  ) as subject_label,
  coalesce(st.classroom_id, ch.classroom_id, cl.id) as classroom_id,
  rv.frequency,
  rv.recurrence_rule,
  ri.verified_at,
  st.hire_date as subject_hire_date
from public.requirement_instances ri
join public.requirement_versions rv on rv.id = ri.requirement_version_id
join public.requirements r on r.id = rv.requirement_id
join public.authorities a on a.id = r.authority_id
cross join ctx
left join link_facts lf on lf.requirement_instance_id = ri.id
left join public.staff st on ri.subject_type in ('staff', 'role') and st.id = ri.subject_id
left join public.children ch on ri.subject_type = 'child' and ch.id = ri.subject_id
left join public.classrooms cl on ri.subject_type = 'classroom' and cl.id = ri.subject_id
left join public.programs pr on ri.subject_type in ('program', 'facility') and pr.id = ri.subject_id
cross join lateral (
  select case
    when ri.na_approved_by is not null and nullif(btrim(ri.na_reason), '') is not null
      then 'not_applicable'
    when rv.status <> 'active' or rv.last_source_review is null
      then 'unknown'
    when coalesce(lf.has_valid_approved, false)
      then 'verified'
    when lf.last_decision = 'rejected'
         and (lf.last_pending_at is null or lf.last_pending_at <= lf.last_decision_at)
      then 'needs_correction'
    when coalesce(lf.has_pending, false)
      then 'pending_review'
    else 'missing'
  end::public.evidence_status as evidence_status
) es
cross join lateral (
  select case
    when ri.due_date is null then 'none'
    when ri.due_date < ctx.today then 'overdue'
    when ri.due_date - ctx.today <= ctx.urgent_days then 'urgent'
    when ri.due_date - ctx.today <= ctx.due_soon_days then 'due_soon'
    else 'current'
  end::public.deadline_status as deadline_status
) ds
where ri.archived_at is null;
create view public.v_credentials
with (security_invoker = true)
as
select
  c.id,
  c.staff_id,
  s.first_name || ' ' || s.last_name as staff_name,
  s.employment_status,
  s.classroom_id,
  c.credential_type_id,
  ct.name as credential_name,
  ct.requires_expiration,
  c.issuer,
  c.issue_date,
  c.expiration_date,
  c.internal_review_date,
  c.eligibility_status,
  c.evidence_id,
  c.reviewer_id,
  c.verified_at,
  c.renewal_owner_id,
  public.deadline_status_for(c.expiration_date) as deadline_status,
  (c.verified_at is not null
     and (c.expiration_date is null or c.expiration_date >= public.chicago_today())) as is_verified_current,
  not exists (
    select 1 from public.credentials n
     where n.staff_id = c.staff_id and n.credential_type_id = c.credential_type_id
       and n.archived_at is null and n.id <> c.id
       and (n.expiration_date, n.created_at) > (c.expiration_date, c.created_at)
       and c.expiration_date is not null and n.expiration_date is not null
  ) as is_latest
from public.credentials c
join public.credential_types ct on ct.id = c.credential_type_id
join public.staff s on s.id = c.staff_id
where c.archived_at is null;
create view public.v_deadline_items
with (security_invoker = true)
as
select
  'requirement'::text as kind,
  s.requirement_instance_id as id,
  s.requirement_title as title,
  s.subject_label,
  s.subject_type,
  s.subject_id,
  s.classroom_id,
  s.owner_id,
  s.backup_id,
  s.due_date,
  s.deadline_status,
  (s.evidence_status = 'verified') as verified,
  s.criticality,
  s.authority_code
from public.v_requirement_status s
where s.closed_at is null
  and s.due_date is not null
  and s.evidence_status <> 'not_applicable'
union all
select
  'credential'::text,
  c.id,
  c.credential_name,
  c.staff_name,
  'staff'::public.applicability_scope,
  c.staff_id,
  c.classroom_id,
  c.renewal_owner_id,
  null::uuid,
  c.expiration_date,
  c.deadline_status,
  c.is_verified_current,
  null::public.criticality,
  null::public.authority_code
from public.v_credentials c
where c.expiration_date is not null
  and c.is_latest
  and c.employment_status <> 'separated';
create view public.v_review_queue
with (security_invoker = true)
as
select
  l.id as link_id,
  l.status,
  l.created_at as submitted_at,
  l.reviewed_at,
  l.correction_note,
  e.id as evidence_id,
  e.file_name,
  e.doc_type,
  e.access_class,
  e.issue_date,
  e.expiry_date,
  e.uploader_id,
  s.requirement_instance_id,
  s.requirement_code,
  s.requirement_title,
  s.authority_code,
  s.version_status,
  s.subject_label,
  s.subject_type,
  s.subject_id,
  s.due_date,
  s.frequency,
  s.recurrence_rule,
  s.verified_at as instance_verified_at,
  s.subject_hire_date
from public.evidence_links l
join public.evidence e on e.id = l.evidence_id
join public.v_requirement_status s on s.requirement_instance_id = l.requirement_instance_id
where l.archived_at is null and e.archived_at is null;
revoke all on public.v_credentials, public.v_deadline_items, public.v_review_queue from anon, authenticated;
grant select on public.v_requirement_status, public.v_credentials, public.v_deadline_items, public.v_review_queue
  to authenticated, service_role;
create function public.classroom_file_indicators(p_classroom uuid)
returns table (subject_type public.applicability_scope, subject_label text, requirement_title text, present boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.can_use_classroom(p_classroom) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return query
    select s.subject_type, s.subject_label, s.requirement_title,
           s.evidence_status in ('verified', 'not_applicable')
      from public.v_requirement_status s
     where s.closed_at is null
       and s.classroom_id = p_classroom
       and s.subject_type in ('staff', 'child', 'classroom')
     order by s.subject_type, s.subject_label, s.requirement_title;
end;
$$;
create function public.profile_names(ids uuid[])
returns table (id uuid, display_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, coalesce(nullif(p.display_name, ''), p.email)
    from public.profiles p
   where p.id = any (ids)
     and public.auth_role() in ('director', 'admin_support', 'educator', 'classroom_reviewer');
$$;
-- ===== 0015_auth_metadata_sync.sql =====
create function public.handle_user_role_assigned()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_role text := new.raw_app_meta_data ->> 'role';
begin
  if (old.raw_app_meta_data ->> 'role') is null
     and new_role in ('director', 'admin_support', 'educator', 'classroom_reviewer', 'auditor') then
    update public.profiles p
       set role = new_role::public.app_role,
           is_active = true,
           display_name = coalesce(p.display_name, new.raw_app_meta_data ->> 'display_name'),
           email = coalesce(new.email, p.email)
     where p.id = new.id
       and not p.is_active
       and p.archived_at is null;
  end if;
  return new;
end;
$$;
revoke execute on function public.handle_user_role_assigned() from authenticated;
create trigger on_auth_user_role_assigned after update of raw_app_meta_data on auth.users
  for each row execute function public.handle_user_role_assigned();
-- ===== 0016_director_answers.sql =====
alter type public.reminder_milestone add value if not exists 'd120' before 'd90';
alter type public.reminder_milestone add value if not exists 'd1' before 'due';
alter table public.credential_types add column is_critical boolean not null default false;
alter table public.reminder_events add column notice_date date;
alter table public.reminder_events drop constraint reminder_events_no_duplicates;
alter table public.reminder_events add constraint reminder_events_no_duplicates
  unique nulls not distinct (requirement_instance_id, credential_id, milestone, recipient_id, due_date, notice_date);
update public.settings
   set value = '["d120", "d90", "d60", "d30", "d14", "d7", "d1", "due", "overdue"]'::jsonb
 where key = 'reminder_milestones'
   and value = '["d90", "d60", "d30", "d14", "d7", "due", "overdue"]'::jsonb;
alter table public.staff add column pdl_level smallint check (pdl_level between 1 and 11);
alter table public.staff add column pdl_renewal_date date;
create table public.pdl_hour_targets (
  id uuid primary key default gen_random_uuid(),
  level_min smallint not null check (level_min between 1 and 11),
  level_max smallint not null check (level_max between 1 and 11),
  target_minutes integer not null check (target_minutes >= 0),
  source_url text,
  last_source_review date,
  confirmed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  check (level_max >= level_min),
  unique (level_min, level_max),
  constraint pdl_hour_targets_confirmed_requires_source check (
    not confirmed or (nullif(btrim(source_url), '') is not null and last_source_review is not null)
  )
);
select public.setup_compliance_table('pdl_hour_targets');
create policy pdl_hour_targets_select on public.pdl_hour_targets for select to authenticated
  using ((select public.auth_role()) in ('director', 'admin_support', 'educator', 'classroom_reviewer'));
create policy pdl_hour_targets_insert on public.pdl_hour_targets for insert to authenticated
  with check ((select public.auth_role()) = 'director');
create policy pdl_hour_targets_update on public.pdl_hour_targets for update to authenticated
  using ((select public.auth_role()) = 'director') with check ((select public.auth_role()) = 'director');
create table public.evidence_access_log (
  id uuid primary key default gen_random_uuid(),
  evidence_id uuid not null references public.evidence (id),
  profile_id uuid not null references public.profiles (id),
  at timestamptz not null default now()
);
create index evidence_access_log_evidence_idx on public.evidence_access_log (evidence_id, at desc);
alter table public.evidence_access_log enable row level security;
revoke all on public.evidence_access_log from anon, authenticated;
grant select, insert on public.evidence_access_log to authenticated;
grant all on public.evidence_access_log to service_role;
create trigger insert_only before update or delete on public.evidence_access_log
  for each row execute function public.prevent_mutation();
create trigger no_truncate before truncate on public.evidence_access_log
  for each statement execute function public.prevent_mutation();
create policy evidence_access_log_insert on public.evidence_access_log for insert to authenticated
  with check (
    profile_id = (select auth.uid())
    and (select public.auth_role()) is not null
    and exists (select 1 from public.evidence e where e.id = evidence_id)
  );
create policy evidence_access_log_select on public.evidence_access_log for select to authenticated
  using ((select public.auth_role()) = 'director');
alter table public.profiles add column can_draft_library boolean not null default false;
create function public.can_draft_library()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select p.role = 'director' or (p.role = 'admin_support' and p.can_draft_library)
      from public.profiles p
     where p.id = (select auth.uid()) and p.is_active and p.archived_at is null
  ), false);
$$;
create or replace function public.guard_profile_privileges()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null and public.auth_role() is distinct from 'director' then
    if tg_op = 'INSERT' then
      raise exception 'only a director can create profiles' using errcode = '42501';
    end if;
    if new.role is distinct from old.role
       or new.is_active is distinct from old.is_active
       or new.staff_id is distinct from old.staff_id
       or new.child_health_access is distinct from old.child_health_access
       or new.can_draft_library is distinct from old.can_draft_library
       or new.archived_at is distinct from old.archived_at then
      raise exception 'only a director can change role, activation, staff link or grants'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
drop policy requirements_insert on public.requirements;
create policy requirements_insert on public.requirements for insert to authenticated
  with check (public.can_draft_library());
drop policy requirement_versions_insert on public.requirement_versions;
create policy requirement_versions_insert on public.requirement_versions for insert to authenticated
  with check (
    (select public.auth_role()) = 'director'
    or (public.can_draft_library() and status = 'draft')
  );
drop policy requirement_versions_update on public.requirement_versions;
create policy requirement_versions_update on public.requirement_versions for update to authenticated
  using (
    (select public.auth_role()) = 'director'
    or (public.can_draft_library() and status = 'draft')
  )
  with check (
    (select public.auth_role()) = 'director'
    or (public.can_draft_library() and status = 'draft')
  );
create or replace view public.v_credentials
with (security_invoker = true)
as
select
  c.id,
  c.staff_id,
  s.first_name || ' ' || s.last_name as staff_name,
  s.employment_status,
  s.classroom_id,
  c.credential_type_id,
  ct.name as credential_name,
  ct.requires_expiration,
  c.issuer,
  c.issue_date,
  c.expiration_date,
  c.internal_review_date,
  c.eligibility_status,
  c.evidence_id,
  c.reviewer_id,
  c.verified_at,
  c.renewal_owner_id,
  public.deadline_status_for(c.expiration_date) as deadline_status,
  (c.verified_at is not null
     and (c.expiration_date is null or c.expiration_date >= public.chicago_today())) as is_verified_current,
  not exists (
    select 1 from public.credentials n
     where n.staff_id = c.staff_id and n.credential_type_id = c.credential_type_id
       and n.archived_at is null and n.id <> c.id
       and (n.expiration_date, n.created_at) > (c.expiration_date, c.created_at)
       and c.expiration_date is not null and n.expiration_date is not null
  ) as is_latest,
  ct.is_critical
from public.credentials c
join public.credential_types ct on ct.id = c.credential_type_id
join public.staff s on s.id = c.staff_id
where c.archived_at is null;
create or replace view public.v_deadline_items
with (security_invoker = true)
as
select
  'requirement'::text as kind,
  s.requirement_instance_id as id,
  s.requirement_title as title,
  s.subject_label,
  s.subject_type,
  s.subject_id,
  s.classroom_id,
  s.owner_id,
  s.backup_id,
  s.due_date,
  s.deadline_status,
  (s.evidence_status = 'verified') as verified,
  s.criticality,
  s.authority_code,
  coalesce(s.criticality in ('safety_critical', 'regulatory', 'accreditation'), false) as critical
from public.v_requirement_status s
where s.closed_at is null
  and s.due_date is not null
  and s.evidence_status <> 'not_applicable'
union all
select
  'credential'::text,
  c.id,
  c.credential_name,
  c.staff_name,
  'staff'::public.applicability_scope,
  c.staff_id,
  c.classroom_id,
  c.renewal_owner_id,
  null::uuid,
  c.expiration_date,
  c.deadline_status,
  c.is_verified_current,
  null::public.criticality,
  null::public.authority_code,
  c.is_critical
from public.v_credentials c
where c.expiration_date is not null
  and c.is_latest
  and c.employment_status <> 'separated';
