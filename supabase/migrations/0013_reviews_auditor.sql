-- 0013_reviews_auditor.sql  (phase 4)
-- Quarterly review cycles with immutable snapshots, and scoped, time-limited auditor access.

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

-- Snapshots are insert-only: a dated record of what the review saw.
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
  -- { "requirement_ids": [uuid, ...], "evidence_ids": [uuid, ...] }
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

-- Is this id inside one of the caller's live grants? `kind` is the scope key.
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

-- Read-only auditor policies. Everything outside a live grant stays invisible.
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
