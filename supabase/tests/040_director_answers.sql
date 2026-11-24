-- 040_director_answers.sql
-- Denied cases for migration 0016: library drafting, document view log, PDL targets, reminders.
begin;
select test.make_users();
insert into public.evidence (id, doc_type, storage_path, file_name, subject_type, subject_id, uploader_id, access_class) values
  ('c0000000-0000-4000-8000-000000000001', 'certificate', 'personnel/staff/30000000-0000-4000-8000-000000000003/c0000000-0000-4000-8000-000000000001/a.pdf',
   'a.pdf', 'staff', '30000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000003', 'personnel');

-- ---- library drafts: designated admin support only, never activation ----
select test.login('a0000000-0000-4000-8000-000000000002');
select test.throws(
  $$insert into public.requirements (code, authority_id, title) values ('X-NOFLAG', '40000000-0000-4000-8000-000000000001', 'x')$$,
  'admin support without the designation cannot add a requirement');
select test.affects($$update public.requirement_versions set description = 'edited' where id = '60000000-0000-4000-8000-000000000002'$$, 0,
  'admin support without the designation cannot edit a draft');
select test.throws($$update public.profiles set can_draft_library = true where id = 'a0000000-0000-4000-8000-000000000002'$$,
  'admin support cannot give themselves the drafting designation');

select test.logout();
update public.profiles set can_draft_library = true where id in ('a0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000003');
update public.requirement_versions set status = 'active', citation = 'Synthetic citation', source_url = 'https://example.test/rule',
    last_source_review = current_date, reviewed_by = 'a0000000-0000-4000-8000-000000000001', frequency = 'recurring', criticality = 'regulatory'
  where id = '60000000-0000-4000-8000-000000000001';

select test.login('a0000000-0000-4000-8000-000000000002');
select test.affects(
  $$insert into public.requirements (id, code, authority_id, title) values ('50000000-0000-4000-8000-000000007777', 'X-DRAFT', '40000000-0000-4000-8000-000000000001', 'Synthetic draft')$$, 1,
  'designated admin support can add a requirement');
select test.affects(
  $$insert into public.requirement_versions (id, requirement_id, version_label, scope) values ('60000000-0000-4000-8000-000000007777', '50000000-0000-4000-8000-000000007777', 'draft-1', 'staff')$$, 1,
  'designated admin support can write a draft version');
select test.affects($$update public.requirement_versions set description = 'edited' where id = '60000000-0000-4000-8000-000000007777'$$, 1,
  'designated admin support can edit a draft');
select test.throws(
  $$update public.requirement_versions set status = 'active', citation = 'c', source_url = 'https://example.test', last_source_review = current_date,
      reviewed_by = 'a0000000-0000-4000-8000-000000000001', frequency = 'recurring', criticality = 'regulatory'
    where id = '60000000-0000-4000-8000-000000007777'$$,
  'designated admin support still cannot activate a version');
select test.throws(
  $$insert into public.requirement_versions (requirement_id, version_label, scope, status, citation, source_url, last_source_review, reviewed_by, frequency, criticality)
    values ('50000000-0000-4000-8000-000000007777', 'v2', 'staff', 'active', 'c', 'https://example.test', current_date,
            'a0000000-0000-4000-8000-000000000001', 'recurring', 'regulatory')$$,
  'designated admin support cannot insert an already-active version');
select test.affects($$update public.requirement_versions set description = 'edited' where id = '60000000-0000-4000-8000-000000000001'$$, 0,
  'designated admin support cannot change an official (active) version');
select test.affects($$update public.requirement_versions set status = 'archived' where id = '60000000-0000-4000-8000-000000000001'$$, 0,
  'designated admin support cannot retire an official version');
select test.affects($$update public.requirements set title = 'renamed' where id = '50000000-0000-4000-8000-000000000001'$$, 0,
  'designated admin support cannot rename a requirement');

-- The designation means nothing on a non-office role.
select test.login('a0000000-0000-4000-8000-000000000003');
select test.throws(
  $$insert into public.requirements (code, authority_id, title) values ('X-EDU', '40000000-0000-4000-8000-000000000001', 'x')$$,
  'the drafting designation does not work for an educator');

-- ---- document view log ----
select test.affects(
  $$insert into public.evidence_access_log (evidence_id, profile_id) values ('c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000003')$$, 1,
  'a person logs their own view of a document they may see');
select test.throws(
  $$insert into public.evidence_access_log (evidence_id, profile_id) values ('c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000004')$$,
  'a view cannot be logged in someone else''s name');
select test.is($$select count(*) from public.evidence_access_log$$, 0, 'staff cannot read the document view log');
select test.login('a0000000-0000-4000-8000-000000000004');
select test.throws(
  $$insert into public.evidence_access_log (evidence_id, profile_id) values ('c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000004')$$,
  'a view cannot be logged for a document the person cannot see');
select test.login('a0000000-0000-4000-8000-000000000002');
select test.is($$select count(*) from public.evidence_access_log$$, 0, 'admin support cannot read the document view log');
select test.login('a0000000-0000-4000-8000-000000000001');
select test.is($$select count(*) from public.evidence_access_log$$, 1, 'the director reads the document view log');
select test.throws($$update public.evidence_access_log set at = now() - interval '1 day'$$, 'the view log cannot be edited');
select test.throws($$delete from public.evidence_access_log$$, 'the view log cannot be deleted');

-- ---- PDL renewal-hour targets: director-entered, confirmed only with a source ----
select test.throws(
  $$insert into public.pdl_hour_targets (level_min, level_max, target_minutes, confirmed) values (1, 1, 600, true)$$,
  'a PDL target cannot be confirmed without its source link and review date');
select test.affects(
  $$insert into public.pdl_hour_targets (level_min, level_max, target_minutes, source_url, last_source_review, confirmed)
    values (1, 1, 600, 'https://example.test/pdl', current_date, true)$$, 1,
  'the director records a confirmed PDL target with its source');
select test.throws($$insert into public.pdl_hour_targets (level_min, level_max, target_minutes) values (5, 2, 600)$$, 'a PDL level range cannot be backwards');
select test.throws($$update public.staff set pdl_level = 12 where employee_code = 'SYN-003'$$, 'a PDL level is between 1 and 11');
select test.login('a0000000-0000-4000-8000-000000000002');
select test.throws($$insert into public.pdl_hour_targets (level_min, level_max, target_minutes) values (2, 11, 900)$$, 'admin support cannot set PDL targets');
select test.affects($$update public.pdl_hour_targets set target_minutes = 1$$, 0, 'admin support cannot change PDL targets');
select test.affects($$update public.credential_types set is_critical = true$$, 0, 'admin support cannot mark a credential type critical');

-- ---- reminders: once per due date, except daily overdue notices which are once per day ----
select test.logout();
insert into public.reminder_events (credential_id, milestone, recipient_id, due_date, notice_date)
select c.id, 'overdue', 'a0000000-0000-4000-8000-000000000001', current_date - 3, current_date from public.credentials c limit 1;
select test.throws(
  $$insert into public.reminder_events (credential_id, milestone, recipient_id, due_date, notice_date)
    select credential_id, 'overdue', recipient_id, due_date, notice_date from public.reminder_events where milestone = 'overdue'$$,
  'the same daily overdue notice cannot be queued twice on one day');
select test.affects(
  $$insert into public.reminder_events (credential_id, milestone, recipient_id, due_date, notice_date)
    select credential_id, 'overdue', recipient_id, due_date, notice_date + 1 from public.reminder_events where milestone = 'overdue'$$, 1,
  'a daily overdue notice can be queued again the next day');
select test.is($$select count(*) from public.settings where key = 'reminder_milestones' and value ? 'd120' and value ? 'd1'$$, 1,
  'the approved reminder schedule includes the 120-day and 1-day notices');

rollback;
