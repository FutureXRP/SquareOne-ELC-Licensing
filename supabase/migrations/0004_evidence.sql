-- 0004_evidence.sql
-- Evidence and evidence-to-requirement links. Upload is not compliance (rule 3):
-- a link always starts pending and only a reviewer decision changes it.

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

-- An approval stamps the instance with who verified it and when (used as a recurrence anchor).
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
