# SquareOne ELC Compliance Center

Internal readiness dashboard for certification, credentialing and licensing at SquareOne ELC.

> **Internal readiness indicator. Not an official compliance determination.**
> No real staff or child data goes into this system until the Phase 1 exit criteria are signed
> off. Seeds, tests, screenshots and previews use synthetic data only.

Build instructions live in [`BUILD.md`](BUILD.md), working rules in [`CLAUDE.md`](CLAUDE.md),
open decisions in [`docs/DECISIONS.md`](docs/DECISIONS.md).

## Status

| Phase | State |
|---|---|
| 0 Scaffold | Built |
| 1 Foundation | Built: users, roles, invitations, settings, requirements library with the activation gate, audit, signed file links, RLS tests |
| 2 MVP | Built: Overview, staff, credentials, training, evidence upload and review, renewal cycles, tasks, reminders (off by default), CSV import |
| 3 Program compliance | Built: Licensing / STARS / APPLE views, staff and child file checklists, inspections, corrective actions, safety checks, policies, event workflows |
| 4 Reporting | Built: reports with print and CSV, quarterly reviews with snapshots, auditor packets |
| 5 Optimization | Not started (metrics page, reminder tuning, integrations) |

Everything above passes locally against a real Supabase stack (Auth, PostgREST, Storage, Postgres)
running in Docker. It has **not** been run against a hosted Supabase project or deployed to Vercel
yet, and reminder emails have never been sent through Resend. See `docs/RUNBOOK.md` for the
go-live gate.

## Stack

Next.js 16 (App Router, TypeScript strict), Tailwind CSS 4, shadcn-style components, lucide-react,
Supabase (Postgres, Auth, Storage, Row Level Security), Resend, Zod, date-fns-tz
(`America/Chicago`), Vitest, Playwright, pnpm, Vercel Cron.

## Tests

```bash
pnpm install
```

Fast checks on plain PostgreSQL 15+ (no Docker):

```bash
export DATABASE_URL=$(scripts/db-local.sh start)
```

```bash
pnpm lint && pnpm typecheck && pnpm db:test && pnpm test
```

Full end-to-end acceptance tests with real logins (needs Docker):

```bash
scripts/supabase-local.sh start
```

```bash
set -a; . ./.env.supabase-local; set +a; pnpm build && pnpm test:e2e
```

`scripts/supabase-local.sh` runs real Supabase Auth, PostgREST, Storage and Postgres from
`supabase/local/docker-compose.yml`, applies every migration and the synthetic seed, and writes
the local keys to `.env.supabase-local`. To use the app by hand against it, copy that file to
`.env.local`, run `pnpm dev`, and create a login with `pnpm seed:director`.

- `pnpm db:test`: 196 SQL assertions, one denied case per RLS policy plus the database rules.
- `pnpm test`: unit tests for status, readiness, deadlines, reminders, training and CSV, and the
  parity test between the SQL views and the TypeScript functions.
- `pnpm test:e2e`: the BUILD.md acceptance tests in a browser, one login per role.

## Connect a hosted Supabase project

Use separate Supabase projects for development and production.

1. Create a project. Under Authentication, turn **Allow new users to sign up** off and keep
   email confirmation on.
2. Create the schema. Either paste `supabase/bundle/1-schema.sql` into the SQL editor and run it
   once (then `supabase/bundle/2-seed.sql` for synthetic data, development only), or use the CLI:
   `supabase link --project-ref <ref>` then `supabase db push --include-seed`.
   Rebuild the bundle after a new migration with `scripts/build-sql-bundle.sh`.
   Never apply `supabase/tests/000_local_stubs.sql` to a Supabase project.
3. Create the first director. In Authentication, Users, add a user with an email and password
   (auto-confirm on), then run in the SQL editor:

   ```sql
   update public.profiles
      set role = 'director', is_active = true, display_name = 'Your Name'
    where email = 'you@example.org';
   ```

   Every later account is created by that director in Settings, Users.
4. Set the variables from `.env.example` (locally in `.env.local`, on Vercel per environment).
5. `pnpm dev`, then sign in at `/login`.

**Invitations.** Settings, Users creates an account either with a temporary password or with a
one-time link. The link is emailed through Resend when `RESEND_API_KEY` and `EMAIL_FROM` are set;
otherwise the director is shown the link to pass on privately. Supabase's own invitation email is
not used, so no email template needs editing.

**Reminders.** `/api/cron/daily` and `/api/cron/weekly-digest` are scheduled in `vercel.json`.
They require `CRON_SECRET` and do nothing unless `REMINDERS_ENABLED=true`.

## Deploy a preview (Vercel)

Import the repository in Vercel, set the variables from `.env.example` for the Preview
environment (development Supabase project only), and deploy. Keep `REMINDERS_ENABLED=false`.
The phase 0 exit check is: the seeded director signs in on the preview and sees the Overview.

## Layout

```text
supabase/migrations   numbered SQL migrations (never edit an applied one)
supabase/bundle       the same migrations as one paste-ready file
supabase/seed.sql     synthetic data only
supabase/tests        SQL tests: constraints and RLS denied cases
supabase/local        Docker stack for local Supabase
emails                email templates (title, due date, link only)
src/proxy.ts          session refresh and route protection (Next.js 16 name for middleware)
src/app               (auth) login and callback, (app) all screens, (auditor) packets, api routes
src/actions           server actions by module
src/lib/domain        pure functions: status, readiness, deadlines, reminders, training, overview
src/lib/auth          session, role checks, permission table
tests/unit, tests/db  unit tests and SQL/TypeScript parity
tests/e2e             acceptance tests with real logins
```
