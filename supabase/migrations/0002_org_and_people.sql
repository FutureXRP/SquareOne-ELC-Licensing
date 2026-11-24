-- 0002_org_and_people.sql
-- Organization, people, and the auth helper functions used by triggers and RLS policies.

-- Shared trigger: keep updated_at current.
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

-- "Today" is always the calendar date in America/Chicago, never server UTC (rule 12).
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

-- profiles.id is the Supabase auth user id. New profiles start inactive (default deny)
-- unless a server-side invitation set a role in app_metadata.
create table public.profiles (
  id uuid primary key references auth.users (id),
  role public.app_role not null default 'educator',
  staff_id uuid unique references public.staff (id),
  email text not null,
  display_name text,
  is_active boolean not null default false,
  -- admin_support may see child_health files only when a director grants it (section 6).
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

-- ---------------------------------------------------------------------------
-- Auth helpers (security definer so policies can read profiles without recursion).
-- An inactive or archived profile has no role, which every policy treats as deny.
-- ---------------------------------------------------------------------------
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

-- personnel and child_health are checked separately: one never implies the other.
-- This covers class-wide access only; "own record" access is granted by table policies.
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

-- Signed-in users may not change their own role, activation or grants. Only a director
-- (or a server-side admin action, where auth.uid() is null) can.
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

-- Create a profile for every auth user. The role is read from app_metadata, which only
-- the service role can write. user_metadata is user-editable and is never trusted.
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
