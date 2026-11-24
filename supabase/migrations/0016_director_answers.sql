-- 0016_director_answers.sql
-- Changes from the director's decision answers of 2026-11-24:
--   5  reminder schedule: 120-day and 1-day notices and daily overdue for critical items
--   4  CECPD / PDL renewal hours tracked per person by renewal year
--   8  every document view is logged
--   C  designated admin support may create and edit library DRAFTS (never activate)
-- No rule, hour target or deadline is seeded here. Those stay director-entered data.

-- ---------- reminders ----------
alter type public.reminder_milestone add value if not exists 'd120' before 'd90';
alter type public.reminder_milestone add value if not exists 'd1' before 'due';

-- Critical credential types get the longer ladder and daily overdue notices.
alter table public.credential_types add column is_critical boolean not null default false;

-- Daily overdue notices need one row per day; every other notice stays once per due date.
alter table public.reminder_events add column notice_date date;
alter table public.reminder_events drop constraint reminder_events_no_duplicates;
alter table public.reminder_events add constraint reminder_events_no_duplicates
  unique nulls not distinct (requirement_instance_id, credential_id, milestone, recipient_id, due_date, notice_date);

update public.settings
   set value = '["d120", "d90", "d60", "d30", "d14", "d7", "d1", "due", "overdue"]'::jsonb
 where key = 'reminder_milestones'
   and value = '["d90", "d60", "d30", "d14", "d7", "due", "overdue"]'::jsonb;

-- ---------- PDL renewal hours ----------
alter table public.staff add column pdl_level smallint check (pdl_level between 1 and 11);
alter table public.staff add column pdl_renewal_date date;

-- Renewal hours by PDL level. Entered by a director from the official source; a row
-- cannot be marked confirmed without the source link and the date it was reviewed.
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

-- ---------- document view log ----------
-- One row each time a short-lived link to a stored file is issued. Insert-only.
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

-- A person can only log their own view of a document they are allowed to see.
create policy evidence_access_log_insert on public.evidence_access_log for insert to authenticated
  with check (
    profile_id = (select auth.uid())
    and (select public.auth_role()) is not null
    and exists (select 1 from public.evidence e where e.id = evidence_id)
  );
create policy evidence_access_log_select on public.evidence_access_log for select to authenticated
  using ((select public.auth_role()) = 'director');

-- ---------- library drafts by designated admin support ----------
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

-- The designation is a grant: only a director can give it.
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

-- A designated person may add a requirement and write DRAFT versions. Publishing,
-- activating, retiring or changing an official version stays with the director
-- (policies here, plus the activation trigger from 0003).
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

-- ---------- views: carry "critical" through to the reminder engine ----------
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
