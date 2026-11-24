-- 020_rls.sql
-- Row Level Security: one denied-case proof per policy (BUILD.md section 6).
-- Users: director ...01, admin_support ...02, educator1 ...03 (staff SYN-003),
-- educator2 ...04 (staff SYN-004), classroom_reviewer ...05, auditor ...06, uninvited ...07.
begin;
select test.make_users();

-- Fixtures created as the database owner.
update public.requirement_versions set status = 'active', citation = 'Synthetic citation', source_url = 'https://example.test/rule',
    last_source_review = current_date, reviewed_by = 'a0000000-0000-4000-8000-000000000001',
    frequency = 'recurring', criticality = 'regulatory'
  where id = '60000000-0000-4000-8000-000000000001';
insert into public.evidence (id, doc_type, storage_path, file_name, subject_type, subject_id, uploader_id, access_class) values
  ('c0000000-0000-4000-8000-000000000001', 'certificate', 'personnel/staff/30000000-0000-4000-8000-000000000003/c0000000-0000-4000-8000-000000000001/cert.pdf',
   'cert.pdf', 'staff', '30000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000003', 'personnel'),
  ('c0000000-0000-4000-8000-000000000002', 'child form', 'child_health/child/f0000000-0000-4000-8000-000000000001/c0000000-0000-4000-8000-000000000002/form.pdf',
   'form.pdf', 'child', 'f0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'child_health'),
  ('c0000000-0000-4000-8000-000000000003', 'restricted note', 'restricted/staff/30000000-0000-4000-8000-000000000003/c0000000-0000-4000-8000-000000000003/note.pdf',
   'note.pdf', 'staff', '30000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001', 'restricted');
insert into public.evidence_links (id, evidence_id, requirement_instance_id)
select 'd0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', ri.id
from public.requirement_instances ri
where ri.requirement_version_id = '60000000-0000-4000-8000-000000000001'
  and ri.subject_id = '30000000-0000-4000-8000-000000000003';
insert into storage.objects (bucket_id, name) values
  ('evidence', 'personnel/staff/30000000-0000-4000-8000-000000000003/c0000000-0000-4000-8000-000000000001/cert.pdf');
insert into public.tasks (id, title, assignee_id, created_by) values
  ('e0000000-0000-4000-8000-000000000001', 'Synthetic task for educator 1', 'a0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001');
insert into public.reminder_events (milestone, recipient_id, status, last_error) values
  ('d30', 'a0000000-0000-4000-8000-000000000003', 'failed', 'synthetic failure');

-- ================= signed out (anon) =================
select test.login(null);
select test.throws($$select count(*) from public.staff$$, 'anon cannot read staff');
select test.throws($$select count(*) from public.requirements$$, 'anon cannot read the requirements library');
select test.throws($$select count(*) from public.v_requirement_status$$, 'anon cannot read the status view');
select test.throws($$select public.auth_role()$$, 'anon cannot call auth helpers');

-- ================= uninvited / inactive profile =================
select test.login('a0000000-0000-4000-8000-000000000007');
select test.is($$select count(*) from public.staff$$, 0, 'inactive profile sees no staff');
select test.is($$select count(*) from public.requirements$$, 0, 'inactive profile sees no requirements');
select test.is($$select count(*) from public.programs$$, 0, 'inactive profile sees no program');
select test.is($$select count(*) from public.settings$$, 0, 'inactive profile sees no settings');
select test.affects(
  $$update public.profiles set is_active = true, role = 'director' where id = 'a0000000-0000-4000-8000-000000000007'$$, 0,
  'an inactive user cannot activate or promote themselves');

-- ================= educator 1 =================
select test.login('a0000000-0000-4000-8000-000000000003');
select test.is($$select count(*) from public.staff$$, 1, 'educator sees only their own staff row');
select test.is($$select count(*) from public.profiles$$, 1, 'educator sees only their own profile');
select test.is($$select count(*) from public.credentials where staff_id <> '30000000-0000-4000-8000-000000000003'$$, 0,
  'educator cannot read other staff credentials');
select test.is($$select count(*) from public.credentials$$, 2, 'educator reads their own credentials');
select test.is($$select count(*) from public.training_records where staff_id <> '30000000-0000-4000-8000-000000000003'$$, 0,
  'educator cannot read other staff training');
select test.is($$select count(*) from public.requirement_instances where subject_id <> '30000000-0000-4000-8000-000000000003'$$, 0,
  'educator cannot read other subjects requirement instances');
select test.is($$select count(*) from public.v_requirement_status where subject_id <> '30000000-0000-4000-8000-000000000003'$$, 0,
  'the status view applies the caller''s RLS');
select test.is($$select count(*) from public.evidence$$, 1, 'educator sees their own personnel document only');
select test.is($$select count(*) from public.evidence where access_class = 'restricted'$$, 0,
  'educator cannot read a restricted document even when it is about them');
select test.is($$select count(*) from storage.objects$$, 1, 'educator can reach their own stored file');
select test.is($$select count(*) from public.audit_events$$, 0, 'educator cannot read the audit trail');
select test.is($$select count(*) from public.reminder_events$$, 0, 'educator cannot read the delivery log');
select test.throws(
  $$update public.profiles set role = 'director' where id = 'a0000000-0000-4000-8000-000000000003'$$,
  'educator cannot change their own role');
select test.affects(
  $$update public.profiles set display_name = 'Sample Cedar' where id = 'a0000000-0000-4000-8000-000000000003'$$, 1,
  'educator can edit their own display name');
select test.throws(
  $$insert into public.credentials (staff_id, credential_type_id) values
    ('30000000-0000-4000-8000-000000000003', '70000000-0000-4000-8000-000000000002')$$,
  'educator cannot insert credentials');
select test.affects($$update public.credentials set expiration_date = current_date + 900$$, 0,
  'educator cannot edit credentials (expiration stays as recorded)');
select test.throws(
  $$insert into public.training_records (staff_id, course_title, completion_date, minutes, state, reviewer_id)
    values ('30000000-0000-4000-8000-000000000003', 'Self verified', date '2026-04-01', 600, 'verified', 'a0000000-0000-4000-8000-000000000003')$$,
  'educator cannot submit training as already verified');
select test.throws(
  $$insert into public.training_records (staff_id, course_title, completion_date, minutes)
    values ('30000000-0000-4000-8000-000000000004', 'For someone else', date '2026-04-01', 60)$$,
  'educator cannot submit training for another staff member');
select test.affects(
  $$insert into public.training_records (staff_id, course_title, completion_date, minutes)
    values ('30000000-0000-4000-8000-000000000003', 'Own pending course', date '2026-04-01', 60)$$, 1,
  'educator can submit their own training as pending');
select test.affects(
  $$update public.evidence_links set status = 'approved', reviewer_id = 'a0000000-0000-4000-8000-000000000003', reviewed_at = now()$$, 0,
  'educator cannot approve their own evidence');
select test.throws(
  $$insert into public.evidence (doc_type, storage_path, file_name, subject_type, subject_id, uploader_id, access_class)
    values ('x', 'personnel/staff/30000000-0000-4000-8000-000000000004/x/x.pdf', 'x.pdf', 'staff',
            '30000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000003', 'personnel')$$,
  'educator cannot upload evidence about another staff member');
select test.throws(
  $$insert into public.evidence (doc_type, storage_path, file_name, subject_type, subject_id, uploader_id, access_class)
    values ('x', 'restricted/staff/30000000-0000-4000-8000-000000000003/x/x.pdf', 'x.pdf', 'staff',
            '30000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000003', 'restricted')$$,
  'educator cannot create restricted evidence');
select test.throws(
  $$insert into storage.objects (bucket_id, name) values ('evidence', 'personnel/staff/30000000-0000-4000-8000-000000000003/none/loose.pdf')$$,
  'a file cannot be uploaded without a matching evidence row');
select test.affects($$delete from storage.objects$$, 0, 'educator cannot delete stored files');
select test.affects($$update public.requirement_versions set description = 'edited'$$, 0, 'educator cannot edit the library');
select test.throws(
  $$insert into public.requirements (code, authority_id, title) values ('X-1', '40000000-0000-4000-8000-000000000001', 'x')$$,
  'educator cannot add requirements');
select test.affects($$update public.settings set value = '999'::jsonb$$, 0, 'educator cannot edit settings');
select test.affects($$update public.staff set role_title = 'Director'$$, 0, 'educator cannot edit staff rows');
select test.throws($$delete from public.tasks$$, 'no signed-in user has DELETE on any table');
select test.throws(
  $$insert into public.audit_events (action, entity_table) values ('INSERT', 'forged')$$,
  'audit events cannot be forged');

-- ================= educator 2 (the other staff member) =================
select test.login('a0000000-0000-4000-8000-000000000004');
select test.is($$select count(*) from public.evidence$$, 0, 'a staff member cannot read another staff member''s documents (table)');
select test.is($$select count(*) from storage.objects$$, 0, 'a staff member cannot read another staff member''s documents (storage)');
select test.is($$select count(*) from public.evidence_links$$, 0, 'a staff member cannot read another staff member''s evidence links');
select test.is($$select count(*) from public.tasks$$, 0, 'a staff member cannot read another staff member''s tasks');
select test.throws(
  $$insert into public.evidence_links (evidence_id, requirement_instance_id)
    select 'c0000000-0000-4000-8000-000000000001', id from public.requirement_instances limit 1$$,
  'a staff member cannot link evidence they cannot see');

-- ================= classroom reviewer =================
select test.login('a0000000-0000-4000-8000-000000000005');
select test.is($$select count(*) from public.evidence$$, 0, 'classroom reviewer cannot read documents');
select test.is($$select count(*) from public.staff where id <> '30000000-0000-4000-8000-000000000005'$$, 0,
  'classroom reviewer cannot read other personnel rows');
select test.is($$select count(*) from public.credentials where staff_id <> '30000000-0000-4000-8000-000000000005'$$, 0,
  'classroom reviewer cannot read other staff credentials');
select test.throws(
  $$insert into public.classroom_reviewer_assignments (profile_id, classroom_id)
    values ('a0000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000001')$$,
  'classroom reviewer cannot assign themselves a classroom');

-- ================= auditor (no grant yet) =================
select test.login('a0000000-0000-4000-8000-000000000006');
select test.is($$select count(*) from public.staff$$, 0, 'auditor without a grant sees no staff');
select test.is($$select count(*) from public.evidence$$, 0, 'auditor without a grant sees no evidence');
select test.is($$select count(*) from public.requirements$$, 0, 'auditor without a grant sees no requirements');
select test.is($$select count(*) from public.v_requirement_status$$, 0, 'auditor without a grant sees no statuses');
select test.is($$select count(*) from public.profiles$$, 1, 'auditor sees only their own profile');

-- ================= admin support =================
select test.login('a0000000-0000-4000-8000-000000000002');
select test.is($$select count(*) from public.staff$$, 12, 'admin support reads staff');
select test.is($$select count(*) from public.evidence where access_class = 'personnel'$$, 1, 'admin support reads personnel documents');
select test.is($$select count(*) from public.evidence where access_class = 'child_health'$$, 0,
  'personnel access does not grant child_health access');
select test.is($$select count(*) from public.evidence where access_class = 'restricted'$$, 0, 'admin support cannot read restricted documents');
select test.is($$select count(*) from public.audit_events$$, 0, 'admin support cannot read the audit trail');
select test.is($$select count(*) from public.reminder_events where status = 'failed'$$, 1,
  'a failed delivery is visible to admin support');
select test.affects(
  $$update public.requirement_versions set status = 'active', citation = 'c', source_url = 'https://example.test', last_source_review = current_date,
      reviewed_by = 'a0000000-0000-4000-8000-000000000001', frequency = 'recurring', criticality = 'regulatory'
    where id = '60000000-0000-4000-8000-000000000002'$$, 0,
  'admin support cannot activate a library version');
select test.affects(
  $$update public.evidence_links set status = 'approved', reviewer_id = 'a0000000-0000-4000-8000-000000000002', reviewed_at = now()$$, 0,
  'admin support cannot approve evidence');
select test.throws(
  $$update public.requirement_instances set na_reason = 'Synthetic', na_approved_at = now(), na_approved_by = 'a0000000-0000-4000-8000-000000000002'
    where subject_id = '30000000-0000-4000-8000-000000000003'$$,
  'admin support cannot approve a not-applicable exception');
select test.throws(
  $$update public.requirement_instances set na_reason = 'Synthetic', na_approved_at = now(), na_approved_by = 'a0000000-0000-4000-8000-000000000001'
    where subject_id = '30000000-0000-4000-8000-000000000003'$$,
  'admin support cannot record a not-applicable approval in the director''s name');
select test.throws(
  $$update public.requirement_instances set verified_at = now(), verified_by = 'a0000000-0000-4000-8000-000000000001'
    where subject_id = '30000000-0000-4000-8000-000000000003'$$,
  'verification cannot be typed in on an instance');
select test.throws(
  $$update public.credentials set verified_at = now(), reviewer_id = 'a0000000-0000-4000-8000-000000000002'
    where staff_id = '30000000-0000-4000-8000-000000000003'$$,
  'admin support cannot verify a credential');
select test.throws(
  $$update public.training_records set state = 'verified', reviewer_id = 'a0000000-0000-4000-8000-000000000002'$$,
  'admin support cannot verify training');
select test.affects($$update public.settings set value = '1'::jsonb where key = 'urgent_days'$$, 0, 'admin support cannot edit thresholds');
select test.throws($$update public.profiles set role = 'director' where id = 'a0000000-0000-4000-8000-000000000002'$$,
  'admin support cannot promote themselves');

-- child_health is granted separately by a director.
select test.logout();
update public.profiles set child_health_access = true where id = 'a0000000-0000-4000-8000-000000000002';
select test.login('a0000000-0000-4000-8000-000000000002');
select test.is($$select count(*) from public.evidence where access_class = 'child_health'$$, 1,
  'admin support reads child_health documents only after an explicit grant');
select test.is($$select count(*) from public.evidence where access_class = 'restricted'$$, 0,
  'a child_health grant does not open restricted documents');

-- ================= director =================
select test.login('a0000000-0000-4000-8000-000000000001');
select test.is($$select count(*) from public.staff$$, 12, 'director reads all staff');
select test.is($$select count(*) from public.evidence$$, 3, 'director reads all evidence classes');
select test.is($$select (count(*) > 0)::int from public.audit_events$$, 1, 'director reads the audit trail');
select test.affects($$update public.settings set value = '10'::jsonb where key = 'urgent_days'$$, 1, 'director edits thresholds');
select test.affects(
  $$update public.evidence_links set status = 'rejected', reviewer_id = 'a0000000-0000-4000-8000-000000000001', reviewed_at = now(),
      correction_note = 'Synthetic correction note' where id = 'd0000000-0000-4000-8000-000000000001'$$, 1,
  'director records a review decision');
select test.is(
  $$select count(*) from public.v_requirement_status where evidence_status = 'needs_correction'$$, 1,
  'a rejected submission reads as needs_correction');
select test.throws($$delete from public.evidence$$, 'even the director cannot hard delete');
select test.throws($$update public.audit_events set action = 'UPDATE'$$, 'even the director cannot rewrite the audit trail');

-- ================= separated staff lose access =================
select test.logout();
update public.staff set employment_status = 'separated', separation_date = current_date
 where id = '30000000-0000-4000-8000-000000000003';
select test.login('a0000000-0000-4000-8000-000000000003');
select test.is($$select count(*) from public.credentials$$, 0, 'a separated staff member can no longer read their records');
select test.is($$select count(*) from public.evidence$$, 0, 'a separated staff member can no longer read their documents');
select test.is($$select count(*) from storage.objects$$, 0, 'a separated staff member can no longer reach stored files');

select test.logout();
rollback;
