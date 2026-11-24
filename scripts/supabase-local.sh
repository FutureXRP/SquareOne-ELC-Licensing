#!/usr/bin/env bash
# Local Supabase stack (Docker): real Auth, PostgREST, Storage and Postgres.
#
#   scripts/supabase-local.sh start   start services, apply migrations + synthetic seed,
#                                     write .env.supabase-local
#   scripts/supabase-local.sh reset   drop everything and start again
#   scripts/supabase-local.sh stop
#
# The Supabase CLI (`supabase start`) does the same job where it is available.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
COMPOSE=(docker compose -f "$ROOT/supabase/local/docker-compose.yml")
ENV_FILE="$ROOT/.env.supabase-local"
export PG_PASSWORD="local-synthetic-only"
export JWT_SECRET="local-synthetic-only-jwt-secret-0123456789abcdef"
export SITE_URL="${SITE_URL:-http://127.0.0.1:3000}"
DB_URL="postgres://supabase_admin:$PG_PASSWORD@127.0.0.1:54322/postgres"

jwt() {
  node -e '
    const c = require("node:crypto");
    const b = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
    const body = b({ alg: "HS256", typ: "JWT" }) + "." + b({ role: process.argv[1], iss: "supabase-local", iat: 1700000000, exp: 4102444800 });
    console.log(body + "." + c.createHmac("sha256", process.argv[2]).update(body).digest("base64url"));
  ' "$1" "$JWT_SECRET"
}
export ANON_KEY="$(jwt anon)"
export SERVICE_ROLE_KEY="$(jwt service_role)"

case "${1:-start}" in
  stop)
    pkill -f supabase-gateway.mjs 2>/dev/null || true
    "${COMPOSE[@]}" down
    ;;
  reset)
    pkill -f supabase-gateway.mjs 2>/dev/null || true
    while curl -s -o /dev/null http://127.0.0.1:54321/; do sleep 1; done
    "${COMPOSE[@]}" down -v
    exec "$0" start
    ;;
  start)
    "${COMPOSE[@]}" up -d db
    until psql -q "$DB_URL" -c "select 1" >/dev/null 2>&1; do sleep 1; done
    # Service logins use the local password (the image creates the roles without one).
    psql -q "$DB_URL" -v ON_ERROR_STOP=1 <<SQL
alter user authenticator with password '$PG_PASSWORD';
alter user supabase_auth_admin with password '$PG_PASSWORD';
alter user supabase_storage_admin with password '$PG_PASSWORD';
alter user postgres with password '$PG_PASSWORD';
SQL
    "${COMPOSE[@]}" up -d
    # Auth and Storage create their own schemas on first start. Wait for them.
    until psql -qtA "$DB_URL" -c "select to_regclass('auth.users') is not null and to_regclass('storage.objects') is not null" 2>/dev/null | grep -q t; do sleep 1; done
    until curl -sf -o /dev/null http://127.0.0.1:54326/status; do sleep 1; done
    until curl -sf -o /dev/null http://127.0.0.1:54324/health; do sleep 1; done
    until psql -qtA "$DB_URL" -c "select count(*) from information_schema.columns where table_schema = 'storage' and table_name = 'buckets' and column_name = 'public'" | grep -q 1; do sleep 1; done
    APP_DB="postgres://postgres:$PG_PASSWORD@127.0.0.1:54322/postgres"
    if ! psql -qtA "$APP_DB" -c "select to_regclass('public.programs') is not null" | grep -q t; then
      for f in "$ROOT"/supabase/migrations/*.sql; do
        psql -q "$APP_DB" -v ON_ERROR_STOP=1 -f "$f" >/dev/null
      done
      psql -q "$APP_DB" -v ON_ERROR_STOP=1 -f "$ROOT/supabase/seed.sql"
      psql -q "$APP_DB" -c "notify pgrst, 'reload schema'"
    fi
    if ! curl -s -o /dev/null http://127.0.0.1:54321/; then
      setsid nohup node "$ROOT/scripts/supabase-gateway.mjs" >/dev/null 2>&1 < /dev/null &
    fi
    until curl -s -o /dev/null http://127.0.0.1:54321/; do sleep 1; done
    until curl -sf -o /dev/null "http://127.0.0.1:54321/rest/v1/programs?select=id" -H "apikey: $SERVICE_ROLE_KEY"; do sleep 1; done
    cat > "$ENV_FILE" <<ENV
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=$ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY
NEXT_PUBLIC_APP_URL=$SITE_URL
SUPABASE_DB_URL=$APP_DB
ENV
    echo "Local Supabase is up. Keys written to .env.supabase-local (mail catcher: http://127.0.0.1:54327)"
    ;;
  *)
    echo "usage: $0 start|stop|reset" >&2
    exit 2
    ;;
esac
