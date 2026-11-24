-- 0003_requirements.sql
-- Requirements library. Regulatory rules are data, never code (rule 1), and the
-- fabrication firewall (rule 2) is enforced here in the database.

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
  -- frequency, recurrence_rule and criticality stay empty on drafts until a director
  -- confirms them from the official source. They are never guessed.
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
  -- Fabrication firewall: no active version without a source, citation and review.
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

-- Activation gate. Runs for every writer, including the service role and seeds.
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
    -- Only one active version per requirement: the previous one is superseded, not deleted.
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
  -- No deadline may be generated from a version that is not active (rule 2). Active
  -- already implies source_url, citation and last_source_review via the check constraint.
  if new.due_date is not null and (tg_op = 'INSERT' or new.due_date is distinct from old.due_date) then
    select rv.status into version_status
      from public.requirement_versions rv
     where rv.id = new.requirement_version_id;
    if version_status is distinct from 'active' then
      raise exception 'a due date cannot be set from a requirement version that is not active'
        using errcode = '23514';
    end if;
  end if;

  -- Not-applicable exceptions are approved by a director only.
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

  -- verified_at / verified_by are written only by the evidence review trigger (0004).
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
