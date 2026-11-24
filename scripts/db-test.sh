#!/usr/bin/env bash
# Run the SQL test suite (constraints and RLS denied cases) against DATABASE_URL.
# Each test file runs in its own transaction and rolls back.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
: "${DATABASE_URL:?Set DATABASE_URL, e.g. export DATABASE_URL=\$(scripts/db-local.sh start)}"

psql -q "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$ROOT/supabase/tests/001_helpers.sql"
total=0
for f in "$ROOT"/supabase/tests/0[1-9]*.sql; do
  echo "== $(basename "$f")"
  out="$(psql -q "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$f" 2>&1)" || { echo "$out" | grep -v '^$' | tail -15; echo "FAILED: $(basename "$f")"; exit 1; }
  n="$(echo "$out" | grep -c 'NOTICE:  ok - ' || true)"
  echo "   $n assertions passed"
  total=$((total + n))
done
echo "SQL tests passed: $total assertions"
