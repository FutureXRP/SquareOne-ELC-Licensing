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
| D | Whether a classroom reviewer may see staff names for their classroom. | Not yet. They see their own records only until the present / missing indicators are built in phase 3. |

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
| 2026-11-24 | Local and CI database tests run on plain Postgres with stand-ins for Supabase's `auth` and `storage` schemas; tests are SQL scripts, not pgTAP | Docker and the Supabase CLI were not available in the build environment. The RLS policies under test are the real migrations. Re-run against a real Supabase project before go-live (see RUNBOOK). |
| 2026-11-24 | `vercel.json`, email templates and Playwright specs are deferred to phase 2 | A cron schedule pointing at routes that do not exist yet would fail daily. |
| 2026-11-24 | Authority names in the seed are neutral labels | BUILD.md marks the official sources as "not checked". |
