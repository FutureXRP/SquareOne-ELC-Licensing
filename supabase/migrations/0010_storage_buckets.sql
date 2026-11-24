-- 0010_storage_buckets.sql
-- One private bucket. Object path:
--   {access_class}/{subject_type}/{subject_id}/{evidence_id}/{filename}
-- Storage policies mirror the evidence table: an object is reachable only through an
-- evidence row the caller can already see. There are no public URLs, and no update or
-- delete policy (history is preserved).

insert into storage.buckets (id, name, public)
values ('evidence', 'evidence', false)
on conflict (id) do update set public = false;

create policy evidence_objects_select on storage.objects for select to authenticated
  using (
    bucket_id = 'evidence'
    and exists (
      select 1 from public.evidence e
      where e.storage_path = storage.objects.name
        and e.archived_at is null
    )
  );

-- Upload flow: the evidence row is created first (its insert policy checks the access
-- class and subject), then the file is uploaded to exactly that row's storage_path.
create policy evidence_objects_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'evidence'
    and exists (
      select 1 from public.evidence e
      where e.storage_path = storage.objects.name
        and e.uploader_id = (select auth.uid())
        and (storage.foldername(storage.objects.name))[1] = e.access_class::text
        and (storage.foldername(storage.objects.name))[4] = e.id::text
    )
  );
