-- 0011_inspections_safety_policies.sql  (phase 3)
-- Inspections, findings, corrective actions, safety checks, policies.

-- One call gives a new compliance table everything the conventions require:
-- RLS on, explicit grants, updated_at, audit trail, no hard delete, no truncate.
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

-- Closure is a review decision: only a director verifies it, in their own name.
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

-- Inspections, findings, corrective actions: office roles. An owner sees their own action.
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

-- Safety checks: office roles see all; classroom staff record and see checks for their
-- own classroom (assigned reviewer, or the educator's classroom).
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

-- Policies: staff read the titles and active versions; the director writes.
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

-- Acknowledgments: each person signs for themselves, once. Office roles see who has signed.
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
