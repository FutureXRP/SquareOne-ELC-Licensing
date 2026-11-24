# Decisions

## Open decisions (BUILD.md section 10)

Built with the default shown. **Do not go live with real data until these are answered.**

| # | Decision | Default in the build | Answer | Answered by / date |
|---|---|---|---|---|
| 1 | Current license and approved capacity | `licensed_capacity` null, shown as "Not confirmed" | | |
| 2 | Licensing and STARS rule versions | All requirements stay `draft` / `unknown` | | |
| 3 | APPLE renewal and reporting dates | No deadlines generated | | |
| 4 | Role-specific training targets and reporting period | 1800 minutes, `confirmed = false`, labeled "Internal target, unconfirmed" | | |
| 5 | Reminder thresholds and escalation recipients | Blueprint defaults, `REMINDERS_ENABLED=false` | | |
| 6 | Authorized reviewers and backups | Director only | | |
| 7 | Retention schedule and disposal | Soft archive only, nothing purged | | |
| 8 | Where documents live | Supabase private bucket `evidence` | | |
| 9 | Whether child records go in this system at all | Checklist indicators only until approved | | |
| 10 | Sender domain for Resend | Not configured | | |

Official starting points to verify (not checked): Oklahoma Human Services
https://oklahoma.gov/okdhs.html, CECPD https://www.cecpd.org/, APPLE https://www.faccm.org/.

## Needs an answer from the director or product owner

| # | Question | What the build does meanwhile |
|---|---|---|
| A | **The blueprint is not in the repository.** BUILD.md says to commit "SquareOne ELC \| Certification, Credentialing & Licensing Dashboard" v1.0 as `docs/BLUEPRINT.md` and to stop where the two disagree. Only BUILD.md was available. | Built from BUILD.md alone. `docs/BLUEPRINT.md` is not created; nothing was written in its place. Add the file and re-check phases against it. |
| B | Evidence status when a rejection is followed by a new upload. BUILD.md lists `needs_correction` (most recent decision is rejected) before `pending_review`. Read literally, a corrected re-upload would keep showing "needs correction" until approved. | A rejection stands until a newer submission is waiting; then the item reads `pending_review`. Same rule in the SQL view and in TypeScript, covered by tests. Easy to switch to the literal reading. |
| C | Who may draft library entries. Section 6 gives the director activation; it does not say whether admin support may write drafts. | Director only for all library writes. |
| D | Whether a classroom reviewer may see staff and child names for their classroom. | Yes, as a name with present / missing per file item (`/files/classroom`). Never a document, date or reason. |
| E | Phase 5 (metrics page, reminder tuning, workload view) and all integrations. | Not built. |
| F | Whether educators may record their own safety checks and training. | Yes: checks for their own classroom, and their own training as pending. |

## Implementation decisions made during the build

| Date | Decision | Why |
|---|---|---|
| 2026-11-24 | `src/proxy.ts` instead of `src/middleware.ts` | Next.js 16 renamed the convention and deprecated `middleware.ts`. Same behavior. |
| 2026-11-24 | UI components in `src/components/ui` are hand-written in the shadcn style | The shadcn registry was not reachable from the build environment. Same dependencies (cva, Radix Slot, tailwind-merge), so `shadcn add` output can replace them. |
| 2026-11-24 | `profiles.child_health_access` boolean | Section 6: admin support sees `child_health` files only "unless granted". This is the grant. Only a director can set it. |
| 2026-11-24 | `credentials.eligibility_status` (`eligible` / `ineligible` / `pending`) | Section 5: background checks are stored as eligibility status, verification date and verifier only. Verification date and verifier reuse `verified_at` and `reviewer_id`. |
| 2026-11-24 | On draft versions `frequency`, `recurrence_rule` and `criticality` may be empty; an active version must have `frequency`, `criticality` and a director `reviewed_by` | Seeding a frequency or criticality for an unconfirmed rule would be inventing it (rule 1). |
| 2026-11-24 | New profiles are inactive unless a server-side invitation set a role in `app_metadata` | Default deny. `user_metadata` is user-editable and is never trusted. |
| 2026-11-24 | New evidence defaults to access class `restricted` | Default deny: a missing class must not make a document widely readable. |
| 2026-11-24 | No-hard-delete and insert-only audit are triggers, not only missing policies | They must hold for the service role too (rules 6 and 9). |
| 2026-11-24 | `reminder_events.due_date` column added | The unique index in section 5 names it. |
| 2026-11-24 | Brand color is admiral blue (`#2c3863`) | Requested by the owner. Set once in `src/app/globals.css`. |
| 2026-11-24 | Phases 1 to 4 were built before the Phase 0 exit check on Vercel | The owner asked to build the whole app through to testing with real logins. The exit checks were run against a local Supabase stack instead; the hosted checks remain on the go-live gate. |
| 2026-11-24 | A renewal is: approve new evidence on an already-verified recurring item. The old cycle closes with its evidence, a new cycle opens with the next due date, and the approved submission belongs to the new cycle | Keeps prior evidence with its cycle and keeps the item verified through the handover (BUILD.md acceptance test). |
| 2026-11-24 | The next due date is computed by `src/lib/domain/deadlines.ts` from the version's recurrence rule and passed to the database function `review_evidence_link` | Rule 11: deadline math is a pure, unit-tested function. With no rule, no date is generated. |
| 2026-11-24 | New items are opened with no due date | Rule 1: a first deadline is set by a director or by a review decision, never assumed. |
| 2026-11-24 | Credentials carry reminders too (`reminder_events.credential_id`) and count in the Overdue and Due in 30 days cards | Acceptance test: "a credential due in 30 days ... produces exactly one scheduled notice". |
| 2026-11-24 | A rejection email does not contain the correction note | Rule 8. The note is free text; the email links to the item instead. |
| 2026-11-24 | Email templates are plain escaped HTML in `emails/templates.ts`, not React Email | `@react-email/components` is deprecated on npm. Same content rules. |
| 2026-11-24 | Invitations use a one-time link generated by the app (or a temporary password), not Supabase's built-in invitation email | The built-in email lands on a page a server-rendered app cannot read without editing Supabase's email template. |
| 2026-11-24 | Supabase Auth writes a new user's `app_metadata` in a second statement, so migration 0015 applies the role the first time it appears | Found by running against the real Auth service. Later metadata changes never re-activate a profile. |
| 2026-11-24 | Child records are behind a `child_records_enabled` setting, off by default and enforced by a database trigger | Open decision 9. |
| 2026-11-24 | Auditor packets are scoped to one authority's requirements and the evidence already approved for them, for 1 to 30 days | Section 6: read-only, only inside an unexpired grant. |
| 2026-11-24 | Readiness areas on the Overview are DHS, STARS, APPLE, Staff, Child files and Safety; an item can count in more than one area | Section 8 lists these areas. The "All items" row counts each item once. |
| 2026-11-24 | Local and CI database tests run on plain Postgres with stand-ins for Supabase's `auth` and `storage` schemas; tests are SQL scripts, not pgTAP | Fast and needs no Docker. The same SQL suite and the Playwright suite also run against the real Supabase services in `supabase/local`. Re-run against the hosted project before go-live (see RUNBOOK). |
| 2026-11-24 | Authority names in the seed are neutral labels | BUILD.md marks the official sources as "not checked". |
