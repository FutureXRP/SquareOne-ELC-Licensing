-- 0009_rls_policies.sql
-- Row Level Security: enabled on every table, default deny (rule 6).
-- No table has a DELETE policy. auth_role() is null for signed-out, inactive and
-- archived profiles, so every policy below denies them.
-- Auditors get nothing here; their scoped, time-limited grants arrive in 0013.

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

-- Privileges: anon gets nothing; signed-in users never get DELETE or TRUNCATE.
revoke all on all tables in schema public from anon, authenticated;
grant select, insert, update on all tables in schema public to authenticated;
revoke insert, update on public.audit_events, public.reminder_events from authenticated;
grant all on all tables in schema public to service_role;
-- Later migrations must grant table privileges explicitly.
alter default privileges in schema public revoke all on tables from anon, authenticated;

revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;
-- Functions created by later migrations are not executable by PUBLIC unless granted.
alter default privileges revoke execute on functions from public;
alter default privileges in schema public revoke execute on functions from anon;
alter default privileges in schema public grant execute on functions to authenticated, service_role;

-- Shorthand used below (wrapped in a sub-select so it is evaluated once per statement).
--   staff roles  = everyone except auditor
--   office roles = director, admin_support

-- ---------- reference data: readable by staff roles, written by the director ----------
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

-- ---------- profiles ----------
create policy profiles_select on public.profiles for select to authenticated
  using (
    id = (select auth.uid())
    or (select public.auth_role()) in ('director', 'admin_support')
  );
create policy profiles_insert on public.profiles for insert to authenticated
  with check ((select public.auth_role()) = 'director');
-- A user may edit their own display name; guard_profile_privileges blocks everything else.
create policy profiles_update on public.profiles for update to authenticated
  using (
    (select public.auth_role()) = 'director'
    or (id = (select auth.uid()) and (select public.auth_role()) is not null)
  )
  with check (
    (select public.auth_role()) = 'director'
    or id = (select auth.uid())
  );

-- ---------- staff ----------
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

-- ---------- classroom reviewer assignments ----------
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

-- ---------- requirement instances ----------
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

-- ---------- evidence ----------
-- Class-wide access through can_access_class(); own access for the uploader and for a
-- staff member's own general/personnel documents. Never child_health or restricted by ownership.
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

-- ---------- evidence links ----------
-- Visible when both the evidence and the instance are visible to the caller (their own
-- RLS applies inside the sub-selects). Review decisions are director-only.
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

-- ---------- credentials ----------
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

-- ---------- training records ----------
create policy training_records_select on public.training_records for select to authenticated
  using (
    public.can_access_class('personnel')
    or (
      (select public.auth_role()) in ('educator', 'classroom_reviewer')
      and staff_id = (select public.auth_staff_id())
    )
  );
-- Staff may submit their own training; guard_review_fields keeps it pending.
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

-- ---------- tasks ----------
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

-- ---------- reminder delivery log: read-only for office roles, written by cron ----------
create policy reminder_events_select on public.reminder_events for select to authenticated
  using ((select public.auth_role()) in ('director', 'admin_support'));

-- ---------- audit trail: director read-only, written by triggers ----------
create policy audit_events_select on public.audit_events for select to authenticated
  using ((select public.auth_role()) = 'director');
