-- 0005_credentials_training.sql
-- Credentials and training. Training time is integer minutes (rule 11).

create table public.credential_types (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  category text,
  requires_expiration boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

-- Background checks live here as eligibility status, verification date (verified_at) and
-- verifier (reviewer_id) only. The underlying report is never stored (rule 7).
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
-- Duplicate prevention: the same course, date and certificate cannot be entered twice.
create unique index training_records_no_duplicates on public.training_records
  (staff_id, lower(course_title), completion_date, coalesce(certificate_identifier, ''));

-- Verification fields are review decisions. Only a director (the default authorized
-- reviewer, DECISIONS.md) may set them when acting as a signed-in user.
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
