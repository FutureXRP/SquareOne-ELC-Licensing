#!/usr/bin/env bash
# Start a throwaway local Postgres, apply the Supabase stubs, migrations and seed.
# Used for local development checks and CI. Synthetic data only.
#
#   scripts/db-local.sh start   -> starts a private server, prints DATABASE_URL
#   scripts/db-local.sh stop
#   scripts/db-local.sh apply   -> (re)creates the database named in DATABASE_URL on a
#                                  server that is already running (used by CI)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PGBIN="${PGBIN:-$(pg_config --bindir 2>/dev/null || true)}"
if [ -z "$PGBIN" ] || [ ! -x "$PGBIN/initdb" ]; then
  PGBIN="$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)"
fi
DATA="${SQUAREONE_PGDATA:-$ROOT/.pgdata}"
PORT="${SQUAREONE_PGPORT:-54329}"
DB="squareone_test"
LOCAL_URL="postgres://postgres@127.0.0.1:$PORT/$DB"

as_pg() {
  # Postgres refuses to run as root; fall back to the postgres OS user when needed.
  if [ "$(id -u)" = "0" ]; then
    chown -R postgres "$DATA" 2>/dev/null || true
    su postgres -s /bin/bash -c "$*"
  else
    bash -c "$*"
  fi
}

apply_all() {
  local url="$1"
  local db="${url##*/}"
  local admin="${url%/*}/postgres"
  if [[ ! "$db" =~ ^[a-z0-9_]+_test$ ]]; then
    echo "Refusing to recreate '$db': the database name must end in _test." >&2
    exit 2
  fi
  psql -q "$admin" -v ON_ERROR_STOP=1 -c "drop database if exists $db" -c "create database $db" 2>/dev/null
  psql -q "$url" -v ON_ERROR_STOP=1 -f "$ROOT/supabase/tests/000_local_stubs.sql"
  for f in "$ROOT"/supabase/migrations/*.sql; do
    psql -q "$url" -v ON_ERROR_STOP=1 -f "$f" >/dev/null
  done
  psql -q "$url" -v ON_ERROR_STOP=1 -f "$ROOT/supabase/seed.sql"
}

case "${1:-start}" in
  start)
    if [ ! -d "$DATA/base" ]; then
      mkdir -p "$DATA"
      as_pg "'$PGBIN/initdb' -D '$DATA' -U postgres -A trust >/dev/null"
    fi
    if ! "$PGBIN/pg_isready" -q -h 127.0.0.1 -p "$PORT"; then
      as_pg "'$PGBIN/pg_ctl' -D '$DATA' -o '-p $PORT -c listen_addresses=127.0.0.1 -k /tmp' -l '$DATA/server.log' -w start >/dev/null"
    fi
    apply_all "$LOCAL_URL"
    echo "$LOCAL_URL"
    ;;
  apply)
    : "${DATABASE_URL:?Set DATABASE_URL to a database on a running Postgres server}"
    apply_all "$DATABASE_URL"
    ;;
  stop)
    as_pg "'$PGBIN/pg_ctl' -D '$DATA' -m fast stop >/dev/null" || true
    ;;
  *)
    echo "usage: $0 start|stop|apply" >&2
    exit 2
    ;;
esac
