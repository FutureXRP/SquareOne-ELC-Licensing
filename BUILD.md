# BUILD.md | SquareOne ELC Compliance Center

Build instructions for Claude Code. Source of truth for product behavior is the blueprint
"SquareOne ELC | Certification, Credentialing & Licensing Dashboard" v1.0 (November 24, 2026).
Commit that blueprint as `docs/BLUEPRINT.md`. Where this file and the blueprint disagree, stop and ask.

**Guiding principle:** Accountability without unnecessary administrative burden.

**Design boundary:** This is an internal readiness tool. It never declares the program officially
compliant. No real staff or child data enters the system until Phase 1 exit criteria are signed off.

---

## 1. Stack

| Layer | Choice |
|---|---|
| Framework | Next.js (App Router, latest stable), TypeScript strict |
| UI | Tailwind CSS, shadcn/ui, lucide-react |
| Database / auth / files | Supabase (Postgres, Auth, Storage, Row Level Security) |
| Hosting / scheduling | Vercel, Vercel Cron |
| Email | Resend + React Email |
| Validation | Zod (shared between forms and server actions) |
| Dates | date-fns + date-fns-tz, zone `America/Chicago` |
| Tests | Vitest (unit), Playwright (e2e), pgTAP or SQL scripts (RLS) |
| Package manager | pnpm |

Not in scope for v1: Stripe, Anthropic API, ProCare, CECPD/OPDR and Google Calendar integrations.
Leave an `integrations/` seam but build nothing behind it.

---

## 2. Non-negotiable rules

These override convenience. If a task seems to require breaking one, stop and ask.

1. **No hard-coded regulatory rules.** DHS, STARS, APPLE and CECPD requirements live in the
   requirements library as data. Seed them as `draft` with status `unknown`. Never invent a
   citation, deadline, hour target or renewal period.
2. **Fabrication firewall.** A requirement version cannot become `active`, and no deadline can be
   generated from it, until `source_url`, `citation` and `last_source_review` are filled in by a
   director. Enforce in the database, not only the UI.
3. **Upload is not compliance.** Uploading evidence sets `pending_review`. Only a reviewer approval
   on a specific evidence-to-requirement link sets `verified`.
4. **Unknown and pending are never green.** Green requires verified evidence AND a deadline that is
   current or absent.
5. **Statuses and counts are computed, never typed in.** Derive them in SQL views or pure functions
   from records. No status columns that a user edits directly, except review decisions.
6. **Security at the server.** Every table has RLS enabled with default deny. UI hiding is not
   access control. The service-role key is used only in cron routes and admin server actions.
7. **Sensitive data minimums.** Never store passwords, full Social Security numbers, or underlying
   background-check reports. Background checks are stored as eligibility status, verification date
   and verifier only.
8. **No sensitive content in email.** Reminders contain a requirement title, a due date and a link.
   No documents, no child names, no health details.
9. **History is preserved.** No hard deletes on compliance records. Soft-archive. Renewals create a
   new cycle and keep the prior evidence. Quarterly reviews write immutable snapshots.
10. **Synthetic data only** in seeds, tests, screenshots and preview deployments.
11. **Deterministic logic.** Deadline, status, readiness and training-hour math are pure functions
    with unit tests. Training time is stored as integer minutes.
12. **Dates.** Expiration and due dates are Postgres `date` (no time). "Today" is always computed in
    `America/Chicago`, never from server UTC.

### Working conventions for Claude Code

- Session 1 creates `CLAUDE.md` containing sections 2, 5 and 6 of this file in condensed form.
- Write complete files rather than partial patches.
- One batch commit per session, message format `phase-N: summary`.
- Every schema change is a new numbered migration in `supabase/migrations`. Never edit an applied one.
- Regenerate `src/lib/database.types.ts` after each migration.
- Each phase ends by running lint, typecheck, unit tests and the phase's acceptance tests.

---

## 3. Repository structure

```text
squareone-elc-compliance/
├── BUILD.md
├── CLAUDE.md
├── README.md
├── .env.example
├── vercel.json                      # cron schedule
├── docs/
│   ├── BLUEPRINT.md                 # product blueprint v1.0
│   ├── DECISIONS.md                 # open decisions and answers (section 10)
│   └── RUNBOOK.md                   # backup restore, access revocation, incident steps
├── supabase/
│   ├── config.toml
│   ├── migrations/
│   │   ├── 0001_enums.sql
│   │   ├── 0002_org_and_people.sql
│   │   ├── 0003_requirements.sql
│   │   ├── 0004_evidence.sql
│   │   ├── 0005_credentials_training.sql
│   │   ├── 0006_tasks_reminders.sql
│   │   ├── 0007_audit.sql
│   │   ├── 0008_status_views.sql
│   │   ├── 0009_rls_policies.sql
│   │   ├── 0010_storage_buckets.sql
│   │   ├── 0011_inspections_safety_policies.sql   # phase 3
│   │   ├── 0012_children.sql                      # phase 3
│   │   └── 0013_reviews_auditor.sql               # phase 4
│   ├── seed.sql                     # synthetic data only
│   └── tests/                       # RLS and constraint tests
├── emails/
│   ├── ReminderEmail.tsx
│   ├── WeeklyDigestEmail.tsx
│   ├── EvidenceRejectedEmail.tsx
│   └── CriticalAlertEmail.tsx
├── src/
│   ├── middleware.ts                # session refresh, route protection
│   ├── app/
│   │   ├── (auth)/login/page.tsx
│   │   ├── (auth)/auth/callback/route.ts
│   │   ├── (app)/layout.tsx         # nav: Overview Staff Licensing STARS APPLE Files Safety Reports
│   │   ├── (app)/page.tsx           # Overview
│   │   ├── (app)/staff/page.tsx
│   │   ├── (app)/staff/[id]/page.tsx
│   │   ├── (app)/training/page.tsx
│   │   ├── (app)/requirements/page.tsx
│   │   ├── (app)/requirements/[id]/page.tsx
│   │   ├── (app)/licensing/page.tsx
│   │   ├── (app)/stars/page.tsx
│   │   ├── (app)/apple/page.tsx
│   │   ├── (app)/files/staff/page.tsx
│   │   ├── (app)/files/children/page.tsx
│   │   ├── (app)/safety/page.tsx
│   │   ├── (app)/policies/page.tsx
│   │   ├── (app)/tasks/page.tsx
│   │   ├── (app)/review/page.tsx            # approval queue
│   │   ├── (app)/reports/page.tsx
│   │   ├── (app)/reports/[type]/page.tsx    # printable
│   │   ├── (app)/calendar/page.tsx
│   │   ├── (app)/settings/...               # users, thresholds, classrooms, library
│   │   ├── (auditor)/packet/[grantId]/page.tsx
│   │   └── api/
│   │       ├── cron/daily/route.ts
│   │       ├── cron/weekly-digest/route.ts
│   │       ├── evidence/signed-url/route.ts
│   │       └── export/[type]/route.ts
│   ├── components/
│   │   ├── ui/                      # shadcn
│   │   ├── dashboard/               # StatCard, ActionQueue, DeadlineList, ReadinessPanel, ActivityFeed
│   │   ├── status/                  # StatusBadge (evidence + deadline), CriticalBanner
│   │   ├── evidence/                # UploadDialog, ReviewPanel, EvidenceLinkList
│   │   ├── filters/                 # classroom, employee, authority, owner, status, due date
│   │   └── tables/
│   ├── lib/
│   │   ├── supabase/                # server.ts, browser.ts, admin.ts (service role)
│   │   ├── auth/                    # getSession, requireRole, permissions.ts
│   │   ├── domain/
│   │   │   ├── status.ts            # evidence + deadline status derivation
│   │   │   ├── deadlines.ts         # recurrence rules -> next due date
│   │   │   ├── readiness.ts         # readiness metric
│   │   │   ├── training.ts          # verified / pending / remaining minutes
│   │   │   └── reminders.ts         # milestone selection and de-duplication
│   │   ├── email/send.ts            # Resend wrapper with delivery logging
│   │   ├── dates.ts                 # Chicago "today", date-only helpers
│   │   ├── csv/                     # import preview, validation, duplicate detection
│   │   ├── audit.ts
│   │   ├── validation/              # Zod schemas
│   │   └── database.types.ts        # generated
│   └── actions/                     # server actions by module
└── tests/
    ├── unit/                        # domain functions
    └── e2e/                         # one spec per acceptance test
```

---

## 4. Environment

`.env.example`:

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=          # server only, never NEXT_PUBLIC
RESEND_API_KEY=
EMAIL_FROM=                         # verified Resend sender
NEXT_PUBLIC_APP_URL=
CRON_SECRET=                        # checked on every /api/cron request
APP_TIMEZONE=America/Chicago
REMINDERS_ENABLED=false             # stays false until director approves thresholds
```

Supabase Auth settings: public sign-up disabled, invite-only, email confirmation on.
Use separate Supabase projects for development and production.

---

## 5. Data model

All tables: `id uuid primary key default gen_random_uuid()`, `created_at`, `updated_at`,
`archived_at` (nullable, soft archive). RLS enabled on every table.

### Enums

```text
app_role            director | admin_support | educator | classroom_reviewer | auditor
employment_status   active | on_leave | separated
authority_code      DHS | STARS | APPLE | CECPD | INTERNAL
lifecycle_status    draft | active | superseded | archived
applicability_scope program | role | classroom | staff | child | facility
frequency_type      one_time | recurring | expiration_based | event_triggered
criticality         safety_critical | regulatory | accreditation | internal
evidence_status     missing | pending_review | needs_correction | verified | not_applicable | unknown
deadline_status     none | current | due_soon | urgent | overdue
link_status         pending | approved | rejected
access_class        general | personnel | child_health | restricted
training_state      pending | verified | ineligible
task_status         open | in_progress | done | cancelled
reminder_milestone  d90 | d60 | d30 | d14 | d7 | due | overdue | rejected | critical
delivery_status     queued | sent | failed | suppressed
```

### Tables

**Organization and people**

- `programs`: name, parent_org, jurisdiction, quality_designation, accreditation_name,
  accreditation_date, licensed_capacity (nullable until confirmed), leadership_theme.
- `classrooms`: program_id, name. Seed: Snapping Turtles, Scissortails, River Otters,
  Turtle Doves, Prairie Dogs, Wood Ducks.
- `profiles`: id = auth.users.id, role `app_role`, staff_id (nullable), email, display_name, is_active.
- `staff`: employee_code (unique), first_name, last_name, employment_status, role_title,
  classroom_id, hire_date, supervisor_id, requirement_set, separation_date.
- `classroom_reviewer_assignments`: profile_id, classroom_id.
- `children` (phase 3): child_code, first_name, last_initial, classroom_id, enrollment_date,
  status. Keep this table minimal. No health details in columns; health items exist only as
  checklist requirement instances and restricted evidence.

**Requirements library**

- `authorities`: code `authority_code`, name, website.
- `requirements`: code (stable, human readable, e.g. `DHS-STAFF-001`), authority_id, title, category.
- `requirement_versions`: requirement_id, version_label, effective_date, citation, source_url,
  scope `applicability_scope`, applies_to (jsonb: roles, classroom ids), description,
  evidence_criteria, frequency `frequency_type`, recurrence_rule (jsonb, see below), criticality,
  last_source_review (date), reviewed_by, status `lifecycle_status`.
  - Check constraint: `status = 'active'` requires citation, source_url and last_source_review to be non-null.
  - Only one active version per requirement (partial unique index).
- `requirement_instances`: requirement_version_id, subject_type, subject_id, owner_id, backup_id,
  reviewer_id, due_date (date, nullable), cycle_number, previous_instance_id, na_reason,
  na_approved_by, na_approved_at, verified_at, verified_by, closed_at.

`recurrence_rule` shapes:

```json
{ "type": "interval", "every": 12, "unit": "month", "anchor": "verified_at | fixed_date | hire_date" }
{ "type": "fixed_months", "months": [1, 4, 7, 10], "day": 15 }
{ "type": "expiration", "source": "credential.expiration_date" }
{ "type": "event", "trigger": "new_hire | role_change | new_child | inspection | rule_change" }
```

Never derive a recurring deadline from `upload_date` unless the rule's anchor says so.

**Evidence**

- `evidence`: doc_type, storage_path, file_name, version, subject_type, subject_id, uploader_id,
  uploaded_at, issue_date, expiry_date, access_class, supersedes_id.
- `evidence_links`: evidence_id, requirement_instance_id, status `link_status`, reviewer_id,
  reviewed_at, correction_note. Unique (evidence_id, requirement_instance_id). Each link is
  approved separately; one file can serve several requirements only through separate approved links.

**Credentials and training**

- `credential_types`: name, category, requires_expiration (bool).
- `credentials`: staff_id, credential_type_id, issuer, issue_date, expiration_date (the real
  expiration), internal_review_date (separate), evidence_id, reviewer_id, verified_at,
  renewal_owner_id. Background-check records use this table with eligibility status only.
- `reporting_periods`: label, start_date, end_date.
- `training_targets`: role_title, reporting_period_id, target_minutes, confirmed (bool). Seed the
  30-hour internal target as 1800 minutes with `confirmed = false`.
- `training_records`: staff_id, course_title, provider, completion_date, minutes (integer),
  category, registry_verified (bool), certificate_identifier, evidence_id, reporting_period_id,
  state `training_state`, reviewer_id.
  - Unique index on (staff_id, lower(course_title), completion_date, coalesce(certificate_identifier, '')).

**Tasks and reminders**

- `tasks`: requirement_instance_id (nullable), title, assignee_id, due_date, status, kind
  (renewal, correction, follow_up, corrective_action, manual), created_by.
- `reminder_events`: requirement_instance_id, task_id, milestone, recipient_id, channel,
  status `delivery_status`, attempts, last_error, provider_message_id, sent_at.
  - Unique (requirement_instance_id, milestone, recipient_id, due_date) to suppress duplicates.
- `settings`: key, value jsonb. Seed: `due_soon_days = 30`, `urgent_days = 7`, milestone list,
  digest day. All editable by director.

**Phase 3 and 4 tables**

- `inspections`, `findings`, `corrective_actions` (finding_id, owner, due_date, evidence link, verified closure).
- `safety_checks`: classroom_id, check_type (weekly checklist, drill, maintenance, inspection), performed_on, performed_by, result, notes.
- `policies`, `policy_versions`, `policy_acknowledgments`.
- `review_cycles` (quarter, year, opened_at, signed_off_by, signed_off_at), `review_results`
  (cycle_id, scope, snapshot jsonb, exceptions, follow-up task ids). Snapshots are insert-only.
- `auditor_grants`: profile_id, scope (jsonb list of evidence and requirement ids), expires_at, created_by, revoked_at.

**Audit**

- `audit_events`: actor_id, action, entity_table, entity_id, before jsonb, after jsonb, at.
  Written by triggers on every compliance table. Insert-only; no update or delete policy for anyone.

### Status derivation (view `v_requirement_status` and `lib/domain/status.ts`, kept in parity by tests)

Evidence status, first match wins:

1. `not_applicable` if na_approved_by is set with a reason.
2. `unknown` if the requirement version is not `active` or lacks last_source_review.
3. `verified` if at least one linked evidence item has an approved link and is not past its expiry_date.
4. `needs_correction` if the most recent link decision is rejected.
5. `pending_review` if a link is pending.
6. `missing` otherwise.

Deadline status, using Chicago "today":

- `none` if due_date is null
- `overdue` if due_date < today
- `urgent` if due_date is within `urgent_days`
- `due_soon` if within `due_soon_days`
- `current` otherwise

Display rules: show both statuses when both apply. Green only when evidence is `verified` and
deadline is `current` or `none`. An expired credential can never render as verified/current.
Safety-critical exceptions appear in a banner on Overview regardless of readiness percentage.

### Readiness metric (`lib/domain/readiness.ts`)

```text
readiness = verified applicable active instances / all applicable active instances * 100
```

- Exclude approved not-applicable items from numerator and denominator.
- Unknown and missing items stay in the denominator.
- Zero applicable items displays `N/A`, not 0 or 100.
- Compute with integers (basis points), round for display only.
- Always labeled "Internal readiness indicator. Not an official compliance determination."

---

## 6. Access control

| Role | Access |
|---|---|
| director | Everything, including settings, library activation, approvals, N/A approvals, user management |
| admin_support | Assigned records, uploads, scheduling, tasks. No library activation, no N/A approval, no child_health files unless granted |
| educator | Own staff profile, own credentials and training, own tasks, own uploads |
| classroom_reviewer | Assigned classroom checklists and file-completeness indicators only (present / missing), not the documents |
| auditor | Read-only, only items in an unexpired `auditor_grants` scope |

Implementation:

- SQL helpers `auth_role()`, `auth_staff_id()`, `can_access_class(access_class)` as
  `security definer` functions used by policies.
- Staff cannot select other staff members' credentials, training, evidence or personnel rows.
- `personnel` and `child_health` access classes are checked separately; having one does not grant the other.
- Storage: one private bucket `evidence`, path `{access_class}/{subject_type}/{subject_id}/{evidence_id}/{filename}`.
  No public URLs. Files are served through `/api/evidence/signed-url`, which re-checks permission
  and returns a signed URL valid for 60 seconds. Storage policies mirror table policies.
- Separation: setting `employment_status = separated` deactivates the profile, cancels future
  reminders and tasks, and keeps the records.
- Every RLS policy has a test in `supabase/tests` that proves the denied case.

---

## 7. Reminders and scheduling

`vercel.json` schedules two routes. Vercel Cron runs in UTC, so each handler computes the
Chicago date itself and exits if it has already run for that local date (idempotent).

- `/api/cron/daily`: recompute due dates for new cycles, select milestones, send critical and
  milestone notices, escalate overdue items, retry failed sends.
- `/api/cron/weekly-digest`: one consolidated email per person for routine items.

Both require `Authorization: Bearer ${CRON_SECRET}` and do nothing unless `REMINDERS_ENABLED=true`.

Default milestones (stored in `settings`, editable):

| Trigger | Action |
|---|---|
| 90 days before | Planning notice, major renewals only |
| 60 days before | Owner gets a preparation task |
| 30 days before | Owner reminder, appears in Due in 30 days |
| 14 days before | Owner follow-up |
| 7 days before | Escalate to director and backup |
| Due date | Immediate action notice |
| Overdue | Escalate until resolved, folded into the weekly digest after the first notice |
| Evidence rejected | Notify submitter with the correction note and a correction task |
| Critical eligibility concern | Immediate notice to director |

Rules: one `reminder_events` row per item, milestone and recipient (the unique index enforces
it). Reminders stop only on approved resolution or an approved N/A exception. Every send attempt
is logged; failures appear in Settings > Notifications for directors and admin support.

---

## 8. Screens

**Overview** (default for director)

- Stat cards: Overdue, Due in 30 days, Missing evidence, Awaiting review, Staff verified,
  Requirements verified, Open corrective actions. Every card links to a filtered list.
- Action queue (critical first, owner and next action), Upcoming deadlines (next 90 days),
  Program readiness by area (DHS, STARS, APPLE, Staff, Child files, Safety), Recent activity.
- Global search, quick upload, add task. Filters: classroom, employee, authority, owner, status, due date.

**Other screens:** Staff list and profile (credentials, training ledger, file checklist, tasks),
Training (verified, pending and remaining minutes per person against target), Requirements library
(versions, activation gate), Licensing / STARS / APPLE (requirements by authority with evidence
index), Files (staff and child checklists), Safety, Policies, Tasks, Review queue, Calendar
(30/60/90), Reports, Settings.

**Reports** (print stylesheet plus CSV export; each shows generation date, filters and verification status):
Director action report, Staff credential matrix, Training report, DHS / STARS / APPLE evidence
indexes, Quarterly file audit, Inspection and corrective action history, 30/60/90 renewal calendar.

---

## 9. Build phases

Each phase is one or more Claude Code sessions. Do not start a phase until the previous one passes.

### Phase 0: Scaffold

- Next.js app, Tailwind, shadcn, Supabase clients, middleware, login, app shell with the eight nav tabs.
- Migrations 0001 to 0010, generated types, `seed.sql` with synthetic program, six classrooms,
  12 synthetic staff, 5 authorities, about 20 draft requirements, sample credentials.
- `CLAUDE.md`, `README.md`, CI (lint, typecheck, unit tests).
- Exit: a seeded director can log in on a Vercel preview and see an empty Overview.

### Phase 1: Foundation (blueprint phase 1)

- Users and roles management, invitations, classroom and settings screens.
- Requirements library CRUD with versioning and the activation gate.
- Audit triggers, storage bucket and signed-URL route.
- RLS test suite.
- Exit: RLS tests pass; a requirement cannot be activated without source, citation and review date.

### Phase 2: MVP (blueprint phase 2)

- Overview with computed cards and filtered lists.
- Staff profiles, credential register, training ledger with duplicate prevention.
- Evidence upload, link to requirements, review queue with approve / return for correction.
- Requirement instances, renewal cycles, task queue.
- Reminder engine and email templates (shipped with `REMINDERS_ENABLED=false`).
- CSV import for staff, credentials and training with preview, validation and duplicate detection.
- Exit: MVP acceptance tests below pass in Playwright against seeded synthetic data.

### Phase 3: Program compliance (blueprint phase 3)

- DHS, STARS and APPLE views, child-file checklists, staff-file checklists.
- Inspections, findings, corrective actions with verified closure.
- Safety checks and drills, policies with versions and acknowledgments.
- Event workflows: new hire, role change, staff departure, new child, inspection, rule change.

### Phase 4: Reporting (blueprint phase 4)

- All reports and exports, quarterly review cycles (January, April, July, October) with
  snapshots and director sign-off, inspection mode with scoped time-limited auditor packets.

### Phase 5: Optimization (blueprint phase 5)

- Metrics page (overdue count, on-time renewal rate, approval time, repeat findings), reminder
  tuning, workload view. Integrations only after access and data handling are confirmed.

### MVP acceptance tests (one Playwright or SQL test each)

- [ ] A credential due in 30 days appears in the Due in 30 days queue and produces exactly one scheduled notice.
- [ ] An expired credential cannot display as verified/current.
- [ ] Uploading evidence does not close a requirement.
- [ ] A rejected submission returns to its owner with a correction task.
- [ ] An approved renewal keeps prior evidence and sets the correct next deadline.
- [ ] A staff member cannot read another staff member's restricted documents (table and storage).
- [ ] A child-file export excludes unrelated sensitive records. (phase 3)
- [ ] A quarterly review keeps a dated snapshot and open follow-ups. (phase 4)
- [ ] Unknown requirements stay visible and do not raise readiness.
- [ ] A failed reminder delivery is logged and visible to administrators.
- [ ] Duplicate training records do not increase verified minutes.
- [ ] Backup restoration and access revocation are tested and written up in `docs/RUNBOOK.md`.

---

## 10. Open decisions (track in `docs/DECISIONS.md`)

Build with the default shown. Do not block on these; do not go live with real data until they are answered.

| Decision | Default until answered |
|---|---|
| Current license and approved capacity | `licensed_capacity` null, shown as "Not confirmed" |
| Licensing and STARS rule versions | All requirements stay `draft` / `unknown` |
| APPLE renewal and reporting dates | No deadlines generated |
| Role-specific training targets and reporting period | 1800 minutes, `confirmed = false`, labeled "Internal target, unconfirmed" |
| Reminder thresholds and escalation recipients | Blueprint defaults, `REMINDERS_ENABLED=false` |
| Authorized reviewers and backups | Director only |
| Retention schedule and disposal | Soft archive only, nothing purged |
| Where documents live (Supabase Storage or links to existing storage) | Supabase private bucket |
| Whether child records go in this system at all | Checklist indicators only until approved |
| Sender domain for Resend | Not configured |

Official starting points to verify (not checked in this document):
Oklahoma Human Services https://oklahoma.gov/okdhs.html, CECPD https://www.cecpd.org/,
APPLE https://www.faccm.org/.

---

## 11. Definition of done

Leadership can answer at any time: What is required? What is current? What is missing? What is
coming due? Who owns the next step? Where is the verified evidence?
