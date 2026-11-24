-- Synthetic seed data. Development and preview projects only. Run after 1-schema.sql.
insert into public.programs (id, name, parent_org, jurisdiction, licensed_capacity)
values ('10000000-0000-4000-8000-000000000001', 'SquareOne ELC (synthetic seed)', 'Synthetic parent organization', 'Oklahoma', null);
insert into public.classrooms (id, program_id, name) values
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Snapping Turtles'),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'Scissortails'),
  ('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', 'River Otters'),
  ('20000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000001', 'Turtle Doves'),
  ('20000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000001', 'Prairie Dogs'),
  ('20000000-0000-4000-8000-000000000006', '10000000-0000-4000-8000-000000000001', 'Wood Ducks');
insert into public.staff (id, employee_code, first_name, last_name, employment_status, role_title, classroom_id, hire_date, supervisor_id) values
  ('30000000-0000-4000-8000-000000000001', 'SYN-001', 'Sample', 'Alder', 'active', 'Synthetic Director', null, date '2024-01-08' + 0, null),
  ('30000000-0000-4000-8000-000000000002', 'SYN-002', 'Sample', 'Birch', 'active', 'Synthetic Office Support', null, date '2024-01-08' + 37, '30000000-0000-4000-8000-000000000001'),
  ('30000000-0000-4000-8000-000000000003', 'SYN-003', 'Sample', 'Cedar', 'active', 'Synthetic Educator', '20000000-0000-4000-8000-000000000001', date '2024-01-08' + 74, '30000000-0000-4000-8000-000000000001'),
  ('30000000-0000-4000-8000-000000000004', 'SYN-004', 'Sample', 'Dogwood', 'active', 'Synthetic Educator', '20000000-0000-4000-8000-000000000002', date '2024-01-08' + 111, '30000000-0000-4000-8000-000000000001'),
  ('30000000-0000-4000-8000-000000000005', 'SYN-005', 'Sample', 'Elm', 'active', 'Synthetic Educator', '20000000-0000-4000-8000-000000000003', date '2024-01-08' + 148, '30000000-0000-4000-8000-000000000001'),
  ('30000000-0000-4000-8000-000000000006', 'SYN-006', 'Sample', 'Fir', 'active', 'Synthetic Educator', '20000000-0000-4000-8000-000000000004', date '2024-01-08' + 185, '30000000-0000-4000-8000-000000000001'),
  ('30000000-0000-4000-8000-000000000007', 'SYN-007', 'Sample', 'Ginkgo', 'active', 'Synthetic Educator', '20000000-0000-4000-8000-000000000005', date '2024-01-08' + 222, '30000000-0000-4000-8000-000000000001'),
  ('30000000-0000-4000-8000-000000000008', 'SYN-008', 'Sample', 'Hawthorn', 'active', 'Synthetic Educator', '20000000-0000-4000-8000-000000000006', date '2024-01-08' + 259, '30000000-0000-4000-8000-000000000001'),
  ('30000000-0000-4000-8000-000000000009', 'SYN-009', 'Sample', 'Juniper', 'active', 'Synthetic Educator', '20000000-0000-4000-8000-000000000001', date '2024-01-08' + 296, '30000000-0000-4000-8000-000000000001'),
  ('30000000-0000-4000-8000-000000000010', 'SYN-010', 'Sample', 'Larch', 'active', 'Synthetic Educator', '20000000-0000-4000-8000-000000000002', date '2024-01-08' + 333, '30000000-0000-4000-8000-000000000001'),
  ('30000000-0000-4000-8000-000000000011', 'SYN-011', 'Sample', 'Maple', 'active', 'Synthetic Educator', '20000000-0000-4000-8000-000000000003', date '2024-01-08' + 370, '30000000-0000-4000-8000-000000000001'),
  ('30000000-0000-4000-8000-000000000012', 'SYN-012', 'Sample', 'Oak', 'on_leave', 'Synthetic Educator', '20000000-0000-4000-8000-000000000004', date '2024-01-08' + 407, '30000000-0000-4000-8000-000000000001');
insert into public.authorities (id, code, name, website) values
  ('40000000-0000-4000-8000-000000000001', 'DHS', 'Oklahoma Human Services (child care licensing)', 'https://oklahoma.gov/okdhs.html'),
  ('40000000-0000-4000-8000-000000000002', 'STARS', 'STARS quality rating program', null),
  ('40000000-0000-4000-8000-000000000003', 'APPLE', 'APPLE accreditation', 'https://www.faccm.org/'),
  ('40000000-0000-4000-8000-000000000004', 'CECPD', 'CECPD professional development registry', 'https://www.cecpd.org/'),
  ('40000000-0000-4000-8000-000000000005', 'INTERNAL', 'SquareOne internal policy', null);
insert into public.requirements (id, code, authority_id, title, category) values
  ('50000000-0000-4000-8000-000000000001', 'DHS-STAFF-001', '40000000-0000-4000-8000-000000000001', 'Staff background check eligibility on file', 'Staff files'),
  ('50000000-0000-4000-8000-000000000002', 'DHS-STAFF-002', '40000000-0000-4000-8000-000000000001', 'Staff health and safety training on file', 'Staff files'),
  ('50000000-0000-4000-8000-000000000003', 'DHS-STAFF-003', '40000000-0000-4000-8000-000000000001', 'Staff first aid and CPR certification on file', 'Staff files'),
  ('50000000-0000-4000-8000-000000000004', 'DHS-STAFF-004', '40000000-0000-4000-8000-000000000001', 'Staff orientation record on file', 'Staff files'),
  ('50000000-0000-4000-8000-000000000005', 'DHS-PROG-001', '40000000-0000-4000-8000-000000000001', 'Current license posted and on file', 'Licensing'),
  ('50000000-0000-4000-8000-000000000006', 'DHS-PROG-002', '40000000-0000-4000-8000-000000000001', 'Emergency preparedness plan on file', 'Safety'),
  ('50000000-0000-4000-8000-000000000007', 'DHS-FAC-001', '40000000-0000-4000-8000-000000000001', 'Fire and safety inspection record on file', 'Safety'),
  ('50000000-0000-4000-8000-000000000008', 'DHS-FAC-002', '40000000-0000-4000-8000-000000000001', 'Emergency drill log maintained', 'Safety'),
  ('50000000-0000-4000-8000-000000000009', 'DHS-CHILD-001', '40000000-0000-4000-8000-000000000001', 'Child enrollment file checklist complete', 'Child files'),
  ('50000000-0000-4000-8000-000000000010', 'DHS-CLASS-001', '40000000-0000-4000-8000-000000000001', 'Classroom safety checklist completed', 'Safety'),
  ('50000000-0000-4000-8000-000000000011', 'STARS-PROG-001', '40000000-0000-4000-8000-000000000002', 'Quality rating documentation on file', 'Quality rating'),
  ('50000000-0000-4000-8000-000000000012', 'STARS-STAFF-001', '40000000-0000-4000-8000-000000000002', 'Staff professional development record on file', 'Professional development'),
  ('50000000-0000-4000-8000-000000000013', 'STARS-PROG-002', '40000000-0000-4000-8000-000000000002', 'Family engagement documentation on file', 'Quality rating'),
  ('50000000-0000-4000-8000-000000000014', 'APPLE-PROG-001', '40000000-0000-4000-8000-000000000003', 'Accreditation certificate on file', 'Accreditation'),
  ('50000000-0000-4000-8000-000000000015', 'APPLE-PROG-002', '40000000-0000-4000-8000-000000000003', 'Accreditation annual report submitted', 'Accreditation'),
  ('50000000-0000-4000-8000-000000000016', 'APPLE-CLASS-001', '40000000-0000-4000-8000-000000000003', 'Classroom documentation portfolio maintained', 'Accreditation'),
  ('50000000-0000-4000-8000-000000000017', 'CECPD-STAFF-001', '40000000-0000-4000-8000-000000000004', 'Staff registry profile verified', 'Professional development'),
  ('50000000-0000-4000-8000-000000000018', 'CECPD-STAFF-002', '40000000-0000-4000-8000-000000000004', 'Staff training hours recorded in registry', 'Professional development'),
  ('50000000-0000-4000-8000-000000000019', 'INT-STAFF-001', '40000000-0000-4000-8000-000000000005', 'Staff handbook acknowledgment on file', 'Policies'),
  ('50000000-0000-4000-8000-000000000020', 'INT-PROG-001', '40000000-0000-4000-8000-000000000005', 'Quarterly internal file review completed', 'Internal review');
insert into public.requirement_versions (id, requirement_id, version_label, scope, description, status) values
  ('60000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001', 'draft-1', 'staff', 'Placeholder. Confirm the requirement, citation, frequency and evidence criteria against the official source before activation.', 'draft'),
  ('60000000-0000-4000-8000-000000000002', '50000000-0000-4000-8000-000000000002', 'draft-1', 'staff', 'Placeholder. Confirm the requirement, citation, frequency and evidence criteria against the official source before activation.', 'draft'),
  ('60000000-0000-4000-8000-000000000003', '50000000-0000-4000-8000-000000000003', 'draft-1', 'staff', 'Placeholder. Confirm the requirement, citation, frequency and evidence criteria against the official source before activation.', 'draft'),
  ('60000000-0000-4000-8000-000000000004', '50000000-0000-4000-8000-000000000004', 'draft-1', 'staff', 'Placeholder. Confirm the requirement, citation, frequency and evidence criteria against the official source before activation.', 'draft'),
  ('60000000-0000-4000-8000-000000000005', '50000000-0000-4000-8000-000000000005', 'draft-1', 'program', 'Placeholder. Confirm the requirement, citation, frequency and evidence criteria against the official source before activation.', 'draft'),
  ('60000000-0000-4000-8000-000000000006', '50000000-0000-4000-8000-000000000006', 'draft-1', 'program', 'Placeholder. Confirm the requirement, citation, frequency and evidence criteria against the official source before activation.', 'draft'),
  ('60000000-0000-4000-8000-000000000007', '50000000-0000-4000-8000-000000000007', 'draft-1', 'facility', 'Placeholder. Confirm the requirement, citation, frequency and evidence criteria against the official source before activation.', 'draft'),
  ('60000000-0000-4000-8000-000000000008', '50000000-0000-4000-8000-000000000008', 'draft-1', 'facility', 'Placeholder. Confirm the requirement, citation, frequency and evidence criteria against the official source before activation.', 'draft'),
  ('60000000-0000-4000-8000-000000000009', '50000000-0000-4000-8000-000000000009', 'draft-1', 'child', 'Placeholder. Confirm the requirement, citation, frequency and evidence criteria against the official source before activation.', 'draft'),
  ('60000000-0000-4000-8000-000000000010', '50000000-0000-4000-8000-000000000010', 'draft-1', 'classroom', 'Placeholder. Confirm the requirement, citation, frequency and evidence criteria against the official source before activation.', 'draft'),
  ('60000000-0000-4000-8000-000000000011', '50000000-0000-4000-8000-000000000011', 'draft-1', 'program', 'Placeholder. Confirm the requirement, citation, frequency and evidence criteria against the official source before activation.', 'draft'),
  ('60000000-0000-4000-8000-000000000012', '50000000-0000-4000-8000-000000000012', 'draft-1', 'staff', 'Placeholder. Confirm the requirement, citation, frequency and evidence criteria against the official source before activation.', 'draft'),
  ('60000000-0000-4000-8000-000000000013', '50000000-0000-4000-8000-000000000013', 'draft-1', 'program', 'Placeholder. Confirm the requirement, citation, frequency and evidence criteria against the official source before activation.', 'draft'),
  ('60000000-0000-4000-8000-000000000014', '50000000-0000-4000-8000-000000000014', 'draft-1', 'program', 'Placeholder. Confirm the requirement, citation, frequency and evidence criteria against the official source before activation.', 'draft'),
  ('60000000-0000-4000-8000-000000000015', '50000000-0000-4000-8000-000000000015', 'draft-1', 'program', 'Placeholder. Confirm the requirement, citation, frequency and evidence criteria against the official source before activation.', 'draft'),
  ('60000000-0000-4000-8000-000000000016', '50000000-0000-4000-8000-000000000016', 'draft-1', 'classroom', 'Placeholder. Confirm the requirement, citation, frequency and evidence criteria against the official source before activation.', 'draft'),
  ('60000000-0000-4000-8000-000000000017', '50000000-0000-4000-8000-000000000017', 'draft-1', 'staff', 'Placeholder. Confirm the requirement, citation, frequency and evidence criteria against the official source before activation.', 'draft'),
  ('60000000-0000-4000-8000-000000000018', '50000000-0000-4000-8000-000000000018', 'draft-1', 'staff', 'Placeholder. Confirm the requirement, citation, frequency and evidence criteria against the official source before activation.', 'draft'),
  ('60000000-0000-4000-8000-000000000019', '50000000-0000-4000-8000-000000000019', 'draft-1', 'staff', 'Placeholder. Confirm the requirement, citation, frequency and evidence criteria against the official source before activation.', 'draft'),
  ('60000000-0000-4000-8000-000000000020', '50000000-0000-4000-8000-000000000020', 'draft-1', 'program', 'Placeholder. Confirm the requirement, citation, frequency and evidence criteria against the official source before activation.', 'draft');
insert into public.requirement_instances (requirement_version_id, subject_type, subject_id)
select rv.id, 'staff', s.id
from public.requirement_versions rv
cross join public.staff s
where rv.scope = 'staff';
insert into public.requirement_instances (requirement_version_id, subject_type, subject_id)
select rv.id, 'program', p.id
from public.requirement_versions rv
cross join public.programs p
where rv.scope in ('program', 'facility');
insert into public.requirement_instances (requirement_version_id, subject_type, subject_id)
select rv.id, 'classroom', c.id
from public.requirement_versions rv
cross join public.classrooms c
where rv.scope = 'classroom';
insert into public.credential_types (id, name, category, requires_expiration) values
  ('70000000-0000-4000-8000-000000000001', 'Background check eligibility', 'Eligibility', false),
  ('70000000-0000-4000-8000-000000000002', 'First aid and CPR certificate', 'Health and safety', true),
  ('70000000-0000-4000-8000-000000000003', 'Food handler permit', 'Health and safety', true),
  ('70000000-0000-4000-8000-000000000004', 'Educator credential', 'Professional', true);
insert into public.credentials (staff_id, credential_type_id, issuer, issue_date, expiration_date, eligibility_status)
select s.id, '70000000-0000-4000-8000-000000000001', 'Synthetic issuer', null, null, 'pending'
from public.staff s;
insert into public.credentials (staff_id, credential_type_id, issuer, issue_date, expiration_date)
select s.id,
       '70000000-0000-4000-8000-000000000002',
       'Synthetic issuer',
       public.chicago_today() - 700 + (row_number() over (order by s.employee_code))::int * 3,
       public.chicago_today() - 20 + (row_number() over (order by s.employee_code))::int * 25
from public.staff s;
insert into public.reporting_periods (id, label, start_date, end_date)
values ('80000000-0000-4000-8000-000000000001', 'Synthetic period 2026', date '2026-01-01', date '2026-12-31');
insert into public.training_targets (role_title, reporting_period_id, target_minutes, confirmed)
values
  ('Synthetic Educator', '80000000-0000-4000-8000-000000000001', 1800, false),
  ('Synthetic Director', '80000000-0000-4000-8000-000000000001', 1800, false),
  ('Synthetic Office Support', '80000000-0000-4000-8000-000000000001', 1800, false);
insert into public.training_records (staff_id, course_title, provider, completion_date, minutes, category, reporting_period_id)
select s.id, 'Synthetic course A', 'Synthetic provider', date '2026-03-14', 120, 'Synthetic category',
       '80000000-0000-4000-8000-000000000001'
from public.staff s
where s.employee_code in ('SYN-003', 'SYN-004', 'SYN-005');
