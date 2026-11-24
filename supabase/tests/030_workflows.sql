-- 030_workflows.sql
-- Denied cases for the phase 3 and 4 tables, the workflow functions and auditor grants.
begin;
select test.make_users();

-- ---- signup: the role arrives in a second statement, exactly once ----
insert into auth.users (id, email) values ('a0000000-0000-4000-8000-000000000008', 'late-role@example.test');
select test.is($$select count(*) from public.profiles where id = 'a0000000-0000-4000-8000-000000000008' and not is_active$$, 1,
  'a user with no role yet has an inactive profile');
update auth.users set raw_app_meta_data = '{"role":"admin_support","display_name":"Late Role"}' where id = 'a0000000-0000-4000-8000-000000000008';
select test.is($$select count(*) from public.profiles where id = 'a0000000-0000-4000-8000-000000000008' and is_active and role = 'admin_support'$$, 1,
  'the first role written to app_metadata activates the profile with that role');
update public.profiles set is_active = false where id = 'a0000000-0000-4000-8000-000000000008';
update auth.users set raw_app_meta_data = '{"role":"director"}' where id = 'a0000000-0000-4000-8000-000000000008';
select test.is($$select count(*) from public.profiles where id = 'a0000000-0000-4000-8000-000000000008' and (is_active or role = 'director')$$, 0,
  'later metadata changes never re-activate or promote a profile');
update auth.users set raw_user_meta_data = '{"role":"director"}' where id = 'a0000000-0000-4000-8000-000000000007';
select test.is($$select count(*) from public.profiles where id = 'a0000000-0000-4000-8000-000000000007' and is_active$$, 0,
  'user-editable metadata is never trusted for a role');

-- Fixtures.
update public.requirement_versions set status = 'active', citation = 'Synthetic citation', source_url = 'https://example.test/rule',
    last_source_review = current_date, reviewed_by = 'a0000000-0000-4000-8000-000000000001', frequency = 'recurring', criticality = 'regulatory'
  where id in ('60000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000009', '60000000-0000-4000-8000-000000000011');
insert into public.evidence (id, doc_type, storage_path, file_name, subject_type, subject_id, uploader_id, access_class) values
  ('c0000000-0000-4000-8000-000000000001', 'certificate', 'personnel/staff/30000000-0000-4000-8000-000000000003/c0000000-0000-4000-8000-000000000001/a.pdf',
   'a.pdf', 'staff', '30000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000003', 'personnel'),
  ('c0000000-0000-4000-8000-000000000002', 'certificate', 'personnel/staff/30000000-0000-4000-8000-000000000003/c0000000-0000-4000-8000-000000000002/b.pdf',
   'b.pdf', 'staff', '30000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000003', 'personnel');
insert into public.evidence_links (id, evidence_id, requirement_instance_id)
select 'd0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', ri.id
  from public.requirement_instances ri
 where ri.requirement_version_id = '60000000-0000-4000-8000-000000000001' and ri.subject_id = '30000000-0000-4000-8000-000000000003';
insert into public.inspections (id, authority_id, inspection_date) values ('f1000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', current_date);
insert into public.findings (id, inspection_id, description) values ('f2000000-0000-4000-8000-000000000001', 'f1000000-0000-4000-8000-000000000001', 'Synthetic finding');
insert into public.corrective_actions (id, finding_id, description, owner_id) values
  ('f3000000-0000-4000-8000-000000000001', 'f2000000-0000-4000-8000-000000000001', 'Synthetic action', 'a0000000-0000-4000-8000-000000000003');
select test.is($$select count(*) from public.tasks where kind = 'corrective_action' and assignee_id = 'a0000000-0000-4000-8000-000000000003'$$, 1,
  'a corrective action files a task for its owner');
insert into public.policies (id, title) values ('f4000000-0000-4000-8000-000000000001', 'Synthetic policy');
insert into public.policy_versions (id, policy_id, version_label, status) values
  ('f5000000-0000-4000-8000-000000000001', 'f4000000-0000-4000-8000-000000000001', 'v1', 'active'),
  ('f5000000-0000-4000-8000-000000000002', 'f4000000-0000-4000-8000-000000000001', 'v2-draft', 'draft');
insert into public.classroom_reviewer_assignments (profile_id, classroom_id) values ('a0000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000001');

-- ---- child records are off until a director turns them on ----
select test.throws($$insert into public.children (child_code, first_name, last_initial) values ('CH-1', 'Sample', 'Q')$$,
  'child records cannot be created while the switch is off (even by the service role)');
update public.settings set value = 'true'::jsonb where key = 'child_records_enabled';
insert into public.children (id, child_code, first_name, last_initial, classroom_id) values
  ('f6000000-0000-4000-8000-000000000001', 'CH-1', 'Sample', 'Q', '20000000-0000-4000-8000-000000000001'),
  ('f6000000-0000-4000-8000-000000000002', 'CH-2', 'Sample', 'R', '20000000-0000-4000-8000-000000000002');
select test.is($$select count(*) from public.requirement_instances where subject_type = 'child'$$, 2,
  'enrolling a child opens their checklist from the active child-scope requirement');
select test.throws($$insert into public.children (child_code, first_name, last_initial) values ('CH-3', 'Sample', 'QQ')$$,
  'only a last initial is stored, never a full last name');

-- ================= educator 1 =================
select test.login('a0000000-0000-4000-8000-000000000003');
select test.is($$select count(*) from public.inspections$$, 0, 'educator cannot read inspections');
select test.is($$select count(*) from public.findings$$, 0, 'educator cannot read findings');
select test.is($$select count(*) from public.corrective_actions$$, 1, 'educator sees only the corrective action they own');
select test.affects($$update public.corrective_actions set description = 'edited'$$, 0, 'educator cannot edit a corrective action');
select test.throws($$insert into public.inspections (authority_id, inspection_date) values ('40000000-0000-4000-8000-000000000001', current_date)$$,
  'educator cannot record an inspection');
select test.is($$select count(*) from public.children$$, 0, 'educator cannot read children');
select test.is($$select count(*) from public.review_cycles$$, 0, 'educator cannot read review cycles');
select test.is($$select count(*) from public.auditor_grants$$, 0, 'educator cannot read auditor grants');
select test.is($$select count(*) from public.policy_versions$$, 1, 'educator reads active policy versions only, not drafts');
select test.throws($$insert into public.policies (title) values ('x')$$, 'educator cannot publish a policy');
select test.throws(
  $$insert into public.policy_acknowledgments (policy_version_id, profile_id) values ('f5000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000004')$$,
  'nobody can acknowledge a policy for someone else');
select test.throws(
  $$insert into public.policy_acknowledgments (policy_version_id, profile_id) values ('f5000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000003')$$,
  'a draft policy version cannot be acknowledged');
select test.affects(
  $$insert into public.policy_acknowledgments (policy_version_id, profile_id) values ('f5000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000003')$$, 1,
  'a staff member acknowledges the active version for themselves');
select test.throws($$update public.policy_acknowledgments set acknowledged_at = now() - interval '1 year'$$, 'an acknowledgment cannot be changed');
-- educator 1 works in classroom ...01
select test.affects(
  $$insert into public.safety_checks (classroom_id, check_type, performed_on, performed_by, result)
    values ('20000000-0000-4000-8000-000000000001', 'weekly_checklist', current_date, 'a0000000-0000-4000-8000-000000000003', 'pass')$$, 1,
  'educator records a safety check for their own classroom');
select test.throws(
  $$insert into public.safety_checks (classroom_id, check_type, performed_on, performed_by, result)
    values ('20000000-0000-4000-8000-000000000003', 'weekly_checklist', current_date, 'a0000000-0000-4000-8000-000000000003', 'pass')$$,
  'educator cannot record a safety check for another classroom');
select test.throws(
  $$insert into public.safety_checks (classroom_id, check_type, performed_on, performed_by, result)
    values ('20000000-0000-4000-8000-000000000001', 'drill', current_date, 'a0000000-0000-4000-8000-000000000001', 'pass')$$,
  'a safety check cannot be recorded in someone else''s name');
select test.throws($$select public.review_evidence_link('d0000000-0000-4000-8000-000000000001', 'approved')$$,
  'educator cannot approve their own evidence through the review function');
select test.throws($$select public.generate_instances()$$, 'educator cannot open requirement items');
select test.throws($$select public.generate_instances_internal(null, null, null)$$, 'the internal generator is not callable by users');
select test.throws($$select * from public.classroom_file_indicators('20000000-0000-4000-8000-000000000002')$$,
  'file indicators are refused for a classroom the caller does not work in');
select test.is($$select count(*) from public.v_credentials where staff_id <> '30000000-0000-4000-8000-000000000003'$$, 0,
  'the credentials view applies the caller''s RLS');
select test.is($$select count(*) from public.v_deadline_items where subject_id <> '30000000-0000-4000-8000-000000000003'$$, 0,
  'the deadline view applies the caller''s RLS');
select test.is($$select count(*) from public.v_review_queue$$, 1, 'educator sees their own submission in the queue');

-- ================= educator 2 =================
select test.login('a0000000-0000-4000-8000-000000000004');
select test.is($$select count(*) from public.v_review_queue$$, 0, 'a staff member cannot see another staff member''s submissions');
select test.is($$select count(*) from public.safety_checks$$, 0, 'a staff member cannot read another classroom''s safety checks');
select test.is($$select count(*) from public.policy_acknowledgments$$, 0, 'a staff member cannot see who else acknowledged a policy');

-- ================= classroom reviewer (assigned to classroom ...01) =================
select test.login('a0000000-0000-4000-8000-000000000005');
select test.is($$select count(*) from public.children$$, 1, 'classroom reviewer sees children in the assigned classroom only');
select test.is($$select count(*) from public.requirement_instances where subject_type = 'child'$$, 1,
  'classroom reviewer sees checklist items for assigned children only');
select test.is($$select count(*) from public.evidence$$, 0, 'classroom reviewer still cannot read documents');
select test.is($$select (count(*) > 0)::int from public.classroom_file_indicators('20000000-0000-4000-8000-000000000001')$$, 1,
  'classroom reviewer gets present / missing indicators for the assigned classroom');
select test.throws($$select * from public.classroom_file_indicators('20000000-0000-4000-8000-000000000002')$$,
  'classroom reviewer is refused indicators for an unassigned classroom');
select test.affects($$update public.children set first_name = 'x'$$, 0, 'classroom reviewer cannot edit children');

-- ================= admin support =================
select test.login('a0000000-0000-4000-8000-000000000002');
select test.is($$select count(*) from public.children$$, 2, 'admin support reads the child directory');
select test.throws(
  $$update public.corrective_actions set verified_by = 'a0000000-0000-4000-8000-000000000002', verified_at = now()$$,
  'admin support cannot verify closure of a corrective action');
select test.throws(
  $$update public.corrective_actions set verified_by = 'a0000000-0000-4000-8000-000000000001', verified_at = now()$$,
  'closure cannot be recorded in the director''s name by someone else');
select test.throws($$insert into public.review_cycles (quarter, year) values (1, 2027)$$, 'admin support cannot open a review cycle');
select test.throws(
  $$insert into public.auditor_grants (profile_id, label, expires_at) values ('a0000000-0000-4000-8000-000000000006', 'x', now() + interval '1 day')$$,
  'admin support cannot grant auditor access');
select test.throws($$select public.review_evidence_link('d0000000-0000-4000-8000-000000000001', 'approved')$$,
  'admin support cannot review evidence through the review function');
select test.affects($$update public.settings set value = 'false'::jsonb where key = 'child_records_enabled'$$, 0,
  'admin support cannot switch child records on or off');

-- ================= director: review decisions and renewal cycles =================
select test.login('a0000000-0000-4000-8000-000000000001');
select test.throws($$select public.review_evidence_link('d0000000-0000-4000-8000-000000000001', 'rejected', '  ')$$,
  'a rejection through the review function still needs a correction note');
select test.throws($$select public.review_evidence_link('d0000000-0000-4000-8000-000000000001', 'pending')$$,
  'pending is not a decision');
select public.review_evidence_link('d0000000-0000-4000-8000-000000000001', 'approved', null, current_date + 365, true);
select test.is(
  $$select count(*) from public.v_requirement_status
     where requirement_code = 'DHS-STAFF-001' and subject_id = '30000000-0000-4000-8000-000000000003'
       and evidence_status = 'verified' and due_date = current_date + 365 and cycle_number = 1 and closed_at is null$$, 1,
  'a first approval verifies the item and sets the due date it was given');
select test.throws($$select public.review_evidence_link('d0000000-0000-4000-8000-000000000001', 'rejected', 'changed my mind')$$,
  'a decided submission cannot be decided again');
-- Renewal.
insert into public.evidence_links (id, evidence_id, requirement_instance_id)
select 'd0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000002', ri.id
  from public.requirement_instances ri
 where ri.requirement_version_id = '60000000-0000-4000-8000-000000000001' and ri.subject_id = '30000000-0000-4000-8000-000000000003';
select public.review_evidence_link('d0000000-0000-4000-8000-000000000002', 'approved', null, current_date + 730, true);
select test.is(
  $$select count(*) from public.requirement_instances n
      join public.requirement_instances o on o.id = n.previous_instance_id
      join public.evidence_links nl on nl.requirement_instance_id = n.id and nl.id = 'd0000000-0000-4000-8000-000000000002' and nl.status = 'approved'
      join public.evidence_links ol on ol.requirement_instance_id = o.id and ol.id = 'd0000000-0000-4000-8000-000000000001' and ol.status = 'approved'
     where n.cycle_number = 2 and n.due_date = current_date + 730 and n.closed_at is null and o.closed_at is not null$$, 1,
  'an approved renewal closes the old cycle with its evidence and opens the next with the new deadline');
select test.throws(
  $$update public.evidence_links set requirement_instance_id = (select id from public.requirement_instances where subject_id = '30000000-0000-4000-8000-000000000004' limit 1)
     where id = 'd0000000-0000-4000-8000-000000000002'$$,
  'an approved evidence link cannot be moved to another item');
select test.affects(
  $$update public.corrective_actions set verified_by = 'a0000000-0000-4000-8000-000000000001', verified_at = now()$$, 1,
  'the director verifies closure of a corrective action');
select test.throws($$update public.corrective_actions set verified_by = null, verified_at = null$$, 'a verified closure cannot be undone');

-- Rule change: a new active version closes old items and opens fresh ones.
insert into public.requirement_versions (id, requirement_id, version_label, scope, citation, source_url, last_source_review, reviewed_by, frequency, criticality, status)
values ('60000000-0000-4000-8000-000000008888', '50000000-0000-4000-8000-000000000001', 'v2', 'staff', 'Synthetic citation v2',
        'https://example.test/rule-v2', current_date, 'a0000000-0000-4000-8000-000000000001', 'recurring', 'regulatory', 'active');
select test.is(
  $$select count(*) from public.requirement_instances ri join public.requirement_versions rv on rv.id = ri.requirement_version_id
     where rv.requirement_id = '50000000-0000-4000-8000-000000000001' and rv.status = 'superseded' and ri.closed_at is null$$, 0,
  'a rule change closes every item under the old version');
select test.is(
  $$select count(*) from public.v_requirement_status
     where requirement_version_id = '60000000-0000-4000-8000-000000008888' and closed_at is null and evidence_status = 'missing'$$, 12,
  'a rule change opens fresh, unverified items under the new version');
select test.is($$select count(*) from public.tasks where title like 'Rule change: DHS-STAFF-001%'$$, 1, 'a rule change files a follow-up task');

-- Quarterly review: snapshots are insert-only and a signed cycle is final.
insert into public.review_cycles (id, quarter, year, opened_by) values ('f7000000-0000-4000-8000-000000000001', 4, 2026, 'a0000000-0000-4000-8000-000000000001');
insert into public.review_results (cycle_id, scope, snapshot, created_by) values ('f7000000-0000-4000-8000-000000000001', 'program', '{"taken_on":"2026-11-24"}', 'a0000000-0000-4000-8000-000000000001');
select test.throws($$update public.review_results set snapshot = '{}'::jsonb$$, 'a review snapshot cannot be edited');
select test.throws($$delete from public.review_results$$, 'a review snapshot cannot be deleted');
select test.throws(
  $$update public.review_cycles set signed_off_by = 'a0000000-0000-4000-8000-000000000002', signed_off_at = now()$$,
  'a review cycle cannot be signed off in a non-director''s name');
update public.review_cycles set signed_off_by = 'a0000000-0000-4000-8000-000000000001', signed_off_at = now();
select test.throws($$update public.review_cycles set signed_off_at = now() - interval '1 day'$$, 'a signed-off review cycle is final');

-- ================= auditor: scoped, time-limited, read-only =================
select test.logout();
insert into public.auditor_grants (id, profile_id, label, scope, expires_at, created_by) values
  ('f8000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000006', 'Synthetic packet',
   '{"requirement_ids":["50000000-0000-4000-8000-000000000001"],"evidence_ids":["c0000000-0000-4000-8000-000000000001"]}',
   now() + interval '1 day', 'a0000000-0000-4000-8000-000000000001');
select test.login('a0000000-0000-4000-8000-000000000006');
select test.is($$select count(*) from public.requirements$$, 1, 'auditor sees only the requirements in the grant');
select test.is($$select count(*) from public.evidence$$, 1, 'auditor sees only the evidence in the grant');
select test.is($$select count(*) from storage.objects$$, 0, 'auditor reaches no stored file outside the grant');
select test.is($$select count(*) from public.staff$$, 0, 'auditor still cannot read staff records');
select test.is($$select count(*) from public.credentials$$, 0, 'auditor still cannot read credentials');
select test.is($$select count(*) from public.children$$, 0, 'auditor still cannot read children');
select test.is($$select (count(*) > 0)::int from public.v_requirement_status$$, 1, 'auditor sees statuses for granted requirements');
select test.is($$select count(*) from public.v_requirement_status where requirement_id <> '50000000-0000-4000-8000-000000000001'$$, 0,
  'auditor sees no statuses outside the grant');
select test.affects($$update public.evidence set doc_type = 'edited'$$, 0, 'auditor access is read-only');
select test.affects($$update public.auditor_grants set expires_at = now() + interval '10 years'$$, 0, 'auditor cannot extend their own grant');
select test.throws(
  $$insert into public.auditor_grants (profile_id, label, expires_at) values ('a0000000-0000-4000-8000-000000000006', 'self', now() + interval '1 day')$$,
  'auditor cannot grant themselves access');
select test.is($$select count(*) from public.profile_names(array['a0000000-0000-4000-8000-000000000001']::uuid[])$$, 0,
  'auditor cannot resolve staff names');

select test.logout();
update public.auditor_grants set expires_at = now() - interval '1 minute';
select test.login('a0000000-0000-4000-8000-000000000006');
select test.is($$select count(*) from public.evidence$$, 0, 'an expired grant shows no evidence');
select test.is($$select count(*) from public.requirements$$, 0, 'an expired grant shows no requirements');
select test.logout();
update public.auditor_grants set expires_at = now() + interval '1 day', revoked_at = now();
select test.login('a0000000-0000-4000-8000-000000000006');
select test.is($$select count(*) from public.evidence$$, 0, 'a revoked grant shows no evidence');

select test.logout();
rollback;
