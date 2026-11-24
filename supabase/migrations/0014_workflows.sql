-- 0014_workflows.sql
-- Renewal cycles, review decisions, instance generation, event workflows and the views
-- the screens read. Statuses stay computed (rule 5); nothing here types one in.

-- ---------- one deadline formula for every view (parity-tested against TypeScript) ----------
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

-- ---------- reminders can also point at a credential ----------
alter table public.reminder_events add column credential_id uuid references public.credentials (id);
alter table public.reminder_events drop constraint reminder_events_no_duplicates;
alter table public.reminder_events add constraint reminder_events_no_duplicates
  unique nulls not distinct (requirement_instance_id, credential_id, milestone, recipient_id, due_date);

-- ---------- evidence links: a pending link may move to the next cycle only ----------
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

-- ---------- instance generation ----------
-- Creates the missing open instances for active versions. Idempotent. Never sets a due
-- date: deadlines come from a review decision or from the director.
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

-- ---------- event workflows ----------
-- New hire and role or classroom change: open the file items that now apply.
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

-- Rule change: when a version becomes active, items under older versions close (their
-- evidence stays as history), fresh items open under the new rule, and a follow-up is filed.
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

-- An inspection finding files a corrective-action task for the office.
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

-- ---------- the review decision ----------
-- One atomic call. p_next_due is computed by src/lib/domain/deadlines.ts from the
-- version's recurrence rule; this function never invents a date.
--   approve, first time : the link is approved; due date set to p_next_due when p_set_due.
--   approve, renewal    : the current cycle closes with its evidence, a new cycle opens with
--                         p_next_due, and the approved link belongs to the new cycle.
--   reject              : correction note, a correction task and a notice for the submitter.
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

  -- The obligation is met: its open renewal and correction work is done, queued notices stop.
  update public.tasks set status = 'done'
   where requirement_instance_id = i.id and status in ('open', 'in_progress') and kind in ('renewal', 'correction');
  update public.reminder_events set status = 'suppressed'
   where requirement_instance_id = i.id and status in ('queued', 'failed');
  return target;
end;
$$;

-- ---------- views the screens read (security_invoker: the caller's RLS applies) ----------
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

-- Credentials with their computed standing. An expired credential is never current.
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

-- Everything with a date on it: requirement items and credentials. Feeds the Overview
-- cards, the calendar and the reminder engine.
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

-- Submissions with what the reviewer needs to decide.
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

-- ---------- file-completeness indicators for classroom reviewers ----------
-- Present / missing only. No document, no dates, no reasons (section 6).
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

-- Display names for people the caller works with, without opening the profiles table:
-- any active staff role may resolve an id to a display name.
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
