-- 0008_status_views.sql
-- Statuses are computed, never typed in (rule 5). This view must stay in parity with
-- src/lib/domain/status.ts; tests/db/status-parity.test.ts proves it.
-- security_invoker: the caller's RLS applies to every underlying table.

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
  -- Green only when evidence is verified AND the deadline is current or absent (rule 4).
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
    -- A rejection stands until a newer submission is waiting for review.
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
