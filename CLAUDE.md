# CLAUDE.md | SquareOne ELC Compliance Center

Internal readiness tool for an early learning center. It never declares the program officially
compliant. Full build instructions: `BUILD.md`. Open decisions: `docs/DECISIONS.md`.

@AGENTS.md

## Commands

```bash
pnpm lint && pnpm typecheck        # every session
export DATABASE_URL=$(scripts/db-local.sh start)   # local Postgres + stubs + migrations + seed
pnpm db:test                       # SQL tests: constraints and RLS denied cases
pnpm db:types                      # regenerate src/lib/database.types.ts after a migration
pnpm test                          # unit tests + SQL/TypeScript status parity (needs DATABASE_URL)
pnpm build
```

A phase is done only when all of the above pass plus that phase's acceptance tests.

## Non-negotiable rules (BUILD.md section 2). If a task needs to break one, stop and ask.

1. **No hard-coded regulatory rules.** DHS, STARS, APPLE and CECPD requirements are data in the
   requirements library, seeded `draft` / `unknown`. Never invent a citation, deadline, hour
   target or renewal period.
2. **Fabrication firewall.** A version cannot become `active`, and no deadline can come from it,
   until a director fills in `source_url`, `citation` and `last_source_review`. Enforced in the
   database (check constraint + triggers), not only the UI.
3. **Upload is not compliance.** Upload sets `pending_review`. Only a reviewer approval on a
   specific evidence-to-requirement link sets `verified`.
4. **Unknown and pending are never green.** Green = verified evidence AND deadline current or absent.
5. **Statuses and counts are computed**, in SQL views or pure functions. No user-edited status
   columns except review decisions.
6. **Security at the server.** RLS on every table, default deny. UI hiding is not access control.
   Service-role key only in cron routes and admin server actions.
7. **Sensitive data minimums.** No passwords, full SSNs or background-check reports. Background
   checks = eligibility status, verification date, verifier.
8. **No sensitive content in email.** Requirement title, due date, link. Nothing else.
9. **History is preserved.** No hard deletes on compliance records; soft-archive. Renewals create a
   new cycle. Quarterly reviews write immutable snapshots.
10. **Synthetic data only** in seeds, tests, screenshots and previews.
11. **Deterministic logic.** Deadline, status, readiness and training math are pure functions with
    unit tests. Training time is integer minutes.
12. **Dates.** Due and expiration dates are Postgres `date`. "Today" is always `America/Chicago`
    (`chicago_today()` in SQL, `chicagoToday()` in `src/lib/dates.ts`), never server UTC.

## Working conventions

- Write complete files rather than partial patches.
- One batch commit per session: `phase-N: summary`.
- Every schema change is a new numbered migration in `supabase/migrations`. Never edit an applied one.
- New tables need: `id`, `created_at`, `updated_at`, `archived_at`; RLS enabled; explicit `grant`s
  (default privileges are revoked in 0009); `audit_row`, `no_hard_delete`, `no_truncate` and
  `set_updated_at` triggers; and a denied-case test in `supabase/tests`.
- Regenerate `src/lib/database.types.ts` after each migration (`pnpm db:types`). CI fails if it is stale.
- Next.js 16: `src/proxy.ts` replaces `middleware.ts`. Cache Components is on, so anything that
  reads the session sits behind a `<Suspense>` boundary. Read `node_modules/next/dist/docs/` first.
- shadcn/ui components in `src/components/ui` are hand-written in the shadcn style (the registry
  was not reachable when the project was scaffolded). Replace them with `shadcn add` output freely.

## Data model (BUILD.md section 5, condensed)

- **People:** `programs`, `classrooms`, `staff`, `profiles` (id = auth user id; role, `is_active`,
  `child_health_access`), `classroom_reviewer_assignments`.
- **Library:** `authorities` → `requirements` (stable code) → `requirement_versions` (citation,
  source_url, scope, frequency, recurrence_rule, criticality, last_source_review, reviewed_by,
  lifecycle status; one active version per requirement) → `requirement_instances` (subject, owner,
  backup, reviewer, due_date, cycle, N/A approval, verified_at/by, closed_at).
- **Evidence:** `evidence` (storage_path, access_class, expiry_date, supersedes_id) and
  `evidence_links` (pending → approved | rejected; each link reviewed separately; decisions final).
- **Credentials and training:** `credential_types`, `credentials` (real `expiration_date` separate
  from `internal_review_date`), `reporting_periods`, `training_targets` (1800 min, `confirmed =
  false`), `training_records` (integer `minutes`, duplicate-proof unique index).
- **Tasks and reminders:** `tasks`, `reminder_events` (unique per item, milestone, recipient, due
  date), `settings` (`due_soon_days` 30, `urgent_days` 7, milestones, digest day).
- **Audit:** `audit_events`, insert-only, written by triggers on every compliance table.
- Phase 3: inspections, findings, corrective_actions, safety_checks, policies, children.
  Phase 4: review_cycles, review_results, auditor_grants.

### Status derivation (`v_requirement_status` and `src/lib/domain/status.ts`, parity-tested)

Evidence status, first match wins: `not_applicable` (director-approved with a reason) → `unknown`
(version not active or no source review) → `verified` (an approved link to unexpired evidence) →
`needs_correction` (latest decision is a rejection and nothing newer is waiting) →
`pending_review` → `missing`.

Deadline status, Chicago today: `none` (no due date) → `overdue` → `urgent` (≤ `urgent_days`) →
`due_soon` (≤ `due_soon_days`) → `current`.

Readiness = verified ÷ applicable active instances. N/A excluded from both; unknown and missing
stay in the denominator; zero applicable displays `N/A`; integer basis points; always labeled
"Internal readiness indicator. Not an official compliance determination."

## Access control (BUILD.md section 6, condensed)

| Role | Access |
|---|---|
| director | Everything: settings, library activation, approvals, N/A approvals, users |
| admin_support | Staff records, uploads, tasks. No activation, no approvals, no `child_health` unless granted, never `restricted` |
| educator | Own staff row, credentials, training, tasks, uploads |
| classroom_reviewer | Assigned classroom checklists as present / missing only, never the documents |
| auditor | Read-only, only inside an unexpired `auditor_grants` scope (phase 4; nothing before then) |

- Policies use `auth_role()`, `auth_staff_id()`, `can_access_class()` (security definer).
  An inactive or archived profile has no role and is denied everywhere.
- `personnel` and `child_health` are separate grants. Neither implies the other.
- Storage: private bucket `evidence`, path
  `{access_class}/{subject_type}/{subject_id}/{evidence_id}/{filename}`, no public URLs, 60-second
  signed URLs through `/api/evidence/signed-url` after a permission re-check.
- Separation deactivates the profile, cancels open tasks and queued reminders, keeps the records.
- `src/lib/auth/permissions.ts` drives navigation only. RLS is the access control.
- Every RLS policy has a denied-case test in `supabase/tests`.
