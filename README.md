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
| 0 Scaffold | Built and tested locally. Exit check (director signs in on a Vercel preview) needs a Supabase project and a Vercel deployment. |
| 1 Foundation | Not started (the database half, RLS, audit triggers and the activation gate, is already in migrations 0001 to 0010 with tests) |
| 2 MVP | Not started |
| 3 Program compliance | Not started |
| 4 Reporting | Not started |
| 5 Optimization | Not started |

## Stack

Next.js 16 (App Router, TypeScript strict), Tailwind CSS 4, shadcn-style components, lucide-react,
Supabase (Postgres, Auth, Storage, Row Level Security), Zod, date-fns-tz (`America/Chicago`),
Vitest, pnpm. Resend, React Email, Vercel Cron and Playwright specs arrive with phase 2.

## Local checks (no Supabase account needed)

Requires Node 22, pnpm 10 and a local PostgreSQL 15+ install (`initdb`, `pg_ctl`, `psql`).

```bash
pnpm install
```

```bash
export DATABASE_URL=$(scripts/db-local.sh start)
```

```bash
pnpm lint && pnpm typecheck && pnpm db:test && pnpm test && pnpm build
```

`scripts/db-local.sh start` runs a throwaway Postgres on port 54329, applies small stand-ins for
Supabase's `auth` and `storage` schemas (`supabase/tests/000_local_stubs.sql`), then every
migration and `supabase/seed.sql`. `pnpm db:test` runs the SQL suite that proves the denied
cases. `pnpm test` runs the unit tests and the parity test between the SQL status view and the
TypeScript status functions. Stop the server with `scripts/db-local.sh stop`.

## Connect a Supabase project (development)

Use separate Supabase projects for development and production.

1. Create a project. In Authentication settings turn **public sign-up off** and **email
   confirmation on** (invite-only).
2. Apply the migrations in order and the synthetic seed:

   ```bash
   supabase link --project-ref <ref>
   ```

   ```bash
   supabase db push --include-seed
   ```

   Do not apply `supabase/tests/000_local_stubs.sql` to a Supabase project. It is for plain
   Postgres only.
3. Copy `.env.example` to `.env.local` and fill in the URL, anon key and service-role key.
4. Create a director login for the synthetic data (use a test mailbox):

   ```bash
   SEED_DIRECTOR_EMAIL=director@example.test SEED_DIRECTOR_PASSWORD='<12+ characters>' pnpm seed:director
   ```

5. `pnpm dev`, then sign in at `/login`.

Once a project is linked, `supabase gen types typescript --linked > src/lib/database.types.ts`
can replace `pnpm db:types`; both produce the same shape.

## Deploy a preview (Vercel)

Import the repository in Vercel, set the variables from `.env.example` for the Preview
environment (development Supabase project only), and deploy. Keep `REMINDERS_ENABLED=false`.
The phase 0 exit check is: the seeded director signs in on the preview and sees the Overview.

## Layout

```text
supabase/migrations   numbered SQL migrations (never edit an applied one)
supabase/seed.sql     synthetic data only
supabase/tests        SQL tests: constraints and RLS denied cases
src/proxy.ts          session refresh and route protection (Next.js 16 name for middleware)
src/app               routes: (auth) login + callback, (app) the eight tabs
src/lib/domain        pure functions: status, readiness, training, overview
src/lib/auth          session, role checks, permission table
src/lib/supabase      server, browser, admin (service role) and proxy clients
tests/unit            domain unit tests
tests/db              SQL view vs TypeScript parity
scripts               local database, type generation, director seed
```
