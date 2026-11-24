#!/usr/bin/env bash
# Build one paste-ready SQL file for the Supabase SQL editor from the numbered migrations.
# Comments and blank lines are stripped; the statements are byte-for-byte the tested ones.
#   supabase/bundle/1-schema.sql   every migration, in order
#   supabase/bundle/2-seed.sql     synthetic data (development projects only)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/supabase/bundle"
mkdir -p "$OUT"
strip() { grep -v -E '^\s*--' "$@" | grep -v -E '^\s*$' || true; }
{
  echo "-- SquareOne ELC Compliance Center: full schema (migrations 0001 to 0015)."
  echo "-- Paste into the Supabase SQL editor of a NEW project and run once."
  for f in "$ROOT"/supabase/migrations/*.sql; do
    echo "-- ===== $(basename "$f") ====="
    strip "$f"
  done
} > "$OUT/1-schema.sql"
{
  echo "-- Synthetic seed data. Development and preview projects only. Run after 1-schema.sql."
  strip "$ROOT/supabase/seed.sql"
} > "$OUT/2-seed.sql"
wc -l "$OUT"/*.sql
