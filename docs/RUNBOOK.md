# Runbook

Status: **draft**. The backup-restore and access-revocation procedures below have not been
exercised against a real Supabase project yet. BUILD.md requires both to be tested and written
up here before the MVP is accepted (phase 2). Record each test run in the log at the bottom.

## Access revocation

Staff leave, a device is lost, or an account is suspected compromised.

1. In the app (phase 1 screen) or SQL, set the staff member's `employment_status` to `separated`.
   The database then deactivates their profile, cancels their open tasks and suppresses their
   queued reminders. Their records are kept.
2. For a non-staff account, set `profiles.is_active = false`.
3. In Supabase Auth, ban the user or sign out all of their sessions so existing tokens stop
   refreshing. Do not delete the auth user: history references it and the delete is blocked.
4. Verify: sign in as that user in a private window. Every page must show "Your account is not
   active" and no data. An inactive profile has no role, so Row Level Security returns nothing.
5. If a service-role key or `CRON_SECRET` may be exposed, rotate it in Supabase and Vercel and
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
- [ ] RLS tests re-run against the real Supabase development project, including a real Storage
      upload and signed-URL check for the cross-staff denied case.
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
| | | | | |
