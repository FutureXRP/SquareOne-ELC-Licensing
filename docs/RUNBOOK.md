# Runbook

Status: **draft**. Access revocation is exercised by automated tests against a local Supabase
stack (see the test log). Backup restore has not been exercised, and nothing here has been run
against the hosted project yet. BUILD.md requires both to be tested and written
up here before the MVP is accepted (phase 2). Record each test run in the log at the bottom.

## Access revocation

Staff leave, a device is lost, or an account is suspected compromised.

1. On the staff member's profile, set Employment status to Separated (or in SQL).
   The database then deactivates their profile, cancels their open tasks and suppresses their
   queued reminders. Their records are kept.
2. For any account, untick Active in Settings, Users. That also bans the login in Supabase Auth.
3. For an auditor, revoke the packet in Settings, Auditor packets. Access ends immediately.
4. Do not delete the auth user: history references it and the delete is blocked.
5. Verify: sign in as that user in a private window. Every page must show "Your account is not
   active" and no data. An inactive profile has no role, so Row Level Security returns nothing.
6. If a service-role key or `CRON_SECRET` may be exposed, rotate it in Supabase and Vercel and
   redeploy.

Covered by automated tests today: `supabase/tests/020_rls.sql` ("separated staff lose access",
"inactive profile sees no ...").

## Backup restore

To be completed with the production Supabase plan's backup options (daily backups or
point-in-time recovery) once the project exists.

1. Restore into a **new** project, never over production.
2. Apply any migrations newer than the backup.
3. Run the SQL test suite and the status parity test against the restored copy.
4. Check that the `evidence` bucket objects match the `evidence.storage_path` rows.
5. Record how long it took and what was lost between the backup and the incident.

## Before real data (go-live gate)

- [ ] Every open decision in `docs/DECISIONS.md` is answered.
- [ ] `docs/BLUEPRINT.md` is committed and checked against the build.
- [ ] `pnpm db:test` and `pnpm test:e2e` re-run against the hosted development project.
- [ ] One reminder email sent end to end through Resend from a verified sender domain, with
      `REMINDERS_ENABLED=true` on a preview first.
- [ ] Vercel Cron confirmed to call both routes with `CRON_SECRET`.
- [ ] Supabase Auth: public sign-up off, email confirmation on.
- [ ] Separate development and production projects; previews point at development only.
- [ ] Backup restore and access revocation tested and logged below.
- [ ] Phase 1 exit criteria signed off by the director.

## Incident steps

1. Contain: revoke access (above), set `REMINDERS_ENABLED=false` if email is involved.
2. Preserve: do not edit records. The audit trail (`audit_events`) is insert-only.
3. Assess: the director reads `audit_events` for the affected records and time window.
4. Notify according to the parent organization's policy.
5. Write up what happened, what was exposed and what changed.

## Test log

| Date | Procedure | Environment | Result | By |
|---|---|---|---|---|
| 2026-11-24 | Access revocation: separated staff, deactivated profile, revoked and expired auditor packet | Local Supabase stack (Docker), synthetic data | Pass (automated: `supabase/tests`, `tests/e2e`) | Build session |
| | Backup restore | | Not yet tested | |
