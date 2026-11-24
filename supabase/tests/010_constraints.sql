-- 010_constraints.sql
-- Database-level guarantees that hold for every role, including the service role:
-- fabrication firewall, upload-is-not-compliance, history preservation, duplicates.
begin;
select test.make_users();

\set director '''a0000000-0000-4000-8000-000000000001'''
\set educator1 '''a0000000-0000-4000-8000-000000000003'''

-- ---- Fabrication firewall (rule 2) ----
select test.throws(
  $$update public.requirement_versions set status = 'active' where id = '60000000-0000-4000-8000-000000000001'$$,
  'a version cannot be activated with no source, citation or review date');
select test.throws(
  $$update public.requirement_versions set status = 'active', citation = 'Synthetic citation',
      last_source_review = current_date, reviewed_by = 'a0000000-0000-4000-8000-000000000001',
      frequency = 'recurring', criticality = 'regulatory'
    where id = '60000000-0000-4000-8000-000000000001'$$,
  'a version cannot be activated without a source_url');
select test.throws(
  $$update public.requirement_versions set status = 'active', citation = '   ', source_url = 'https://example.test/rule',
      last_source_review = current_date, reviewed_by = 'a0000000-0000-4000-8000-000000000001',
      frequency = 'recurring', criticality = 'regulatory'
    where id = '60000000-0000-4000-8000-000000000001'$$,
  'a blank citation does not satisfy the activation gate');
select test.throws(
  $$update public.requirement_versions set status = 'active', citation = 'Synthetic citation', source_url = 'https://example.test/rule',
      last_source_review = current_date, reviewed_by = 'a0000000-0000-4000-8000-000000000002',
      frequency = 'recurring', criticality = 'regulatory'
    where id = '60000000-0000-4000-8000-000000000001'$$,
  'a version cannot be activated when reviewed_by is not a director (even by the service role)');
select test.throws(
  $$update public.requirement_instances set due_date = current_date + 30
    where requirement_version_id = '60000000-0000-4000-8000-000000000001'$$,
  'no deadline can be generated from a draft version');
select test.is(
  $$select count(*) from public.v_requirement_status where evidence_status <> 'unknown'$$, 0,
  'every seeded (draft) requirement reports as unknown');
select test.is(
  $$select count(*) from public.v_requirement_status where is_green$$, 0,
  'unknown is never green');

-- Activation with a complete, director-reviewed source works.
select test.affects(
  $$update public.requirement_versions set status = 'active', citation = 'Synthetic citation', source_url = 'https://example.test/rule',
      last_source_review = current_date, reviewed_by = 'a0000000-0000-4000-8000-000000000001',
      frequency = 'recurring', criticality = 'regulatory'
    where id = '60000000-0000-4000-8000-000000000001'$$, 1,
  'a director-reviewed version with source, citation and review date can be activated');
select test.throws(
  $$update public.requirement_versions set source_url = null where id = '60000000-0000-4000-8000-000000000001'$$,
  'an active version cannot lose its source');

-- A second active version supersedes the first; only one stays active.
insert into public.requirement_versions
  (id, requirement_id, version_label, scope, citation, source_url, last_source_review, reviewed_by, frequency, criticality, status)
values
  ('60000000-0000-4000-8000-000000009999', '50000000-0000-4000-8000-000000000001', 'v2', 'staff',
   'Synthetic citation 2', 'https://example.test/rule2', current_date, :director, 'recurring', 'regulatory', 'active');
select test.is(
  $$select count(*) from public.requirement_versions
    where requirement_id = '50000000-0000-4000-8000-000000000001' and status = 'active'$$, 1,
  'only one active version per requirement');
select test.is(
  $$select count(*) from public.requirement_versions
    where id = '60000000-0000-4000-8000-000000000001' and status = 'superseded'$$, 1,
  'the previous version is superseded, not deleted');

-- ---- Upload is not compliance (rule 3) ----
insert into public.requirement_instances (id, requirement_version_id, subject_type, subject_id, due_date)
values ('b0000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000009999', 'staff',
        '30000000-0000-4000-8000-000000000003', public.chicago_today() + 120);
insert into public.evidence (id, doc_type, storage_path, file_name, subject_type, subject_id, uploader_id, access_class)
values ('c0000000-0000-4000-8000-000000000001', 'certificate',
        'personnel/staff/30000000-0000-4000-8000-000000000003/c0000000-0000-4000-8000-000000000001/cert.pdf',
        'cert.pdf', 'staff', '30000000-0000-4000-8000-000000000003', :educator1, 'personnel');

select test.throws(
  $$insert into public.evidence_links (evidence_id, requirement_instance_id, status, reviewer_id, reviewed_at)
    values ('c0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'approved',
            'a0000000-0000-4000-8000-000000000001', now())$$,
  'an evidence link cannot be created already approved');
insert into public.evidence_links (id, evidence_id, requirement_instance_id)
values ('d0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001');
select test.is(
  $$select count(*) from public.v_requirement_status
    where requirement_instance_id = 'b0000000-0000-4000-8000-000000000001'
      and evidence_status = 'pending_review' and not is_green$$, 1,
  'uploading evidence leaves the requirement pending_review, not verified and not green');
select test.throws(
  $$update public.evidence_links set status = 'rejected', reviewer_id = 'a0000000-0000-4000-8000-000000000001', reviewed_at = now()
    where id = 'd0000000-0000-4000-8000-000000000001'$$,
  'a rejection requires a correction note');
select test.throws(
  $$update public.evidence_links set status = 'approved' where id = 'd0000000-0000-4000-8000-000000000001'$$,
  'an approval requires a reviewer and a review time');
select test.affects(
  $$update public.evidence_links set status = 'approved', reviewer_id = 'a0000000-0000-4000-8000-000000000001', reviewed_at = now()
    where id = 'd0000000-0000-4000-8000-000000000001'$$, 1,
  'a reviewer approval is recorded');
select test.is(
  $$select count(*) from public.v_requirement_status
    where requirement_instance_id = 'b0000000-0000-4000-8000-000000000001'
      and evidence_status = 'verified' and deadline_status = 'current' and is_green$$, 1,
  'approved evidence with a current deadline is verified and green');
select test.is(
  $$select count(*) from public.requirement_instances
    where id = 'b0000000-0000-4000-8000-000000000001'
      and verified_by = 'a0000000-0000-4000-8000-000000000001' and verified_at is not null$$, 1,
  'approval stamps the instance with verifier and time');
select test.throws(
  $$update public.evidence_links set status = 'pending', reviewer_id = null, reviewed_at = null
    where id = 'd0000000-0000-4000-8000-000000000001'$$,
  'a review decision is final');

-- An expired document can never read as verified (acceptance test).
update public.evidence set issue_date = public.chicago_today() - 400, expiry_date = public.chicago_today() - 1
 where id = 'c0000000-0000-4000-8000-000000000001';
select test.is(
  $$select count(*) from public.v_requirement_status
    where requirement_instance_id = 'b0000000-0000-4000-8000-000000000001'
      and evidence_status = 'verified'$$, 0,
  'approved evidence past its expiry date is no longer verified');

-- Overdue is never green even with valid evidence.
update public.evidence set expiry_date = null where id = 'c0000000-0000-4000-8000-000000000001';
update public.requirement_instances set due_date = public.chicago_today() - 1 where id = 'b0000000-0000-4000-8000-000000000001';
select test.is(
  $$select count(*) from public.v_requirement_status
    where requirement_instance_id = 'b0000000-0000-4000-8000-000000000001'
      and evidence_status = 'verified' and deadline_status = 'overdue' and not is_green$$, 1,
  'verified evidence with an overdue deadline is not green');

-- ---- Not-applicable exceptions ----
select test.throws(
  $$update public.requirement_instances set na_reason = 'Synthetic reason', na_approved_at = now(),
      na_approved_by = 'a0000000-0000-4000-8000-000000000002'
    where id = 'b0000000-0000-4000-8000-000000000001'$$,
  'a not-applicable exception cannot be approved by a non-director');
select test.throws(
  $$update public.requirement_instances set na_approved_at = now(),
      na_approved_by = 'a0000000-0000-4000-8000-000000000001'
    where id = 'b0000000-0000-4000-8000-000000000001'$$,
  'a not-applicable exception requires a reason');

-- ---- Training duplicates (acceptance test) ----
select test.throws(
  $$insert into public.training_records (staff_id, course_title, completion_date, minutes)
    values ('30000000-0000-4000-8000-000000000003', 'SYNTHETIC COURSE A', date '2026-03-14', 120)$$,
  'a duplicate training record (case-insensitive title, same date) is rejected');
select test.throws(
  $$insert into public.training_records (staff_id, course_title, completion_date, minutes)
    values ('30000000-0000-4000-8000-000000000003', 'Another course', date '2026-03-15', 0)$$,
  'training minutes must be a positive integer');

-- ---- History is preserved (rule 9) ----
select test.throws($$delete from public.staff where employee_code = 'SYN-012'$$, 'staff rows cannot be hard deleted');
select test.throws($$delete from public.evidence$$, 'evidence cannot be hard deleted');
select test.throws($$delete from public.requirement_instances$$, 'requirement instances cannot be hard deleted');
select test.throws($$truncate public.training_records$$, 'compliance tables cannot be truncated');
select test.is(
  $$select count(*) from public.audit_events
    where entity_table = 'evidence_links' and entity_id = 'd0000000-0000-4000-8000-000000000001'$$, 2,
  'insert and review decision are both in the audit trail');
select test.throws($$update public.audit_events set action = 'INSERT'$$, 'audit events cannot be updated');
select test.throws($$delete from public.audit_events$$, 'audit events cannot be deleted');

-- ---- Separation keeps records, removes access ----
insert into public.tasks (id, title, assignee_id, status)
values ('e0000000-0000-4000-8000-000000000001', 'Synthetic task', :educator1, 'open');
insert into public.reminder_events (requirement_instance_id, milestone, recipient_id, due_date)
values ('b0000000-0000-4000-8000-000000000001', 'd30', :educator1, current_date);
select test.throws(
  $$insert into public.reminder_events (requirement_instance_id, milestone, recipient_id, due_date)
    values ('b0000000-0000-4000-8000-000000000001', 'd30', 'a0000000-0000-4000-8000-000000000003', current_date)$$,
  'a duplicate reminder for the same item, milestone, recipient and due date is rejected');
update public.staff set employment_status = 'separated', separation_date = current_date
 where id = '30000000-0000-4000-8000-000000000003';
select test.is($$select count(*) from public.profiles where id = 'a0000000-0000-4000-8000-000000000003' and not is_active$$, 1,
  'separation deactivates the profile');
select test.is($$select count(*) from public.tasks where id = 'e0000000-0000-4000-8000-000000000001' and status = 'cancelled'$$, 1,
  'separation cancels open tasks');
select test.is($$select count(*) from public.reminder_events where recipient_id = 'a0000000-0000-4000-8000-000000000003' and status = 'suppressed'$$, 1,
  'separation suppresses queued reminders');
select test.is($$select count(*) from public.credentials where staff_id = '30000000-0000-4000-8000-000000000003'$$, 2,
  'separation keeps the records');

rollback;
