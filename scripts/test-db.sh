#!/usr/bin/env bash
# Applies the migrations to a throwaway Postgres database and runs supabase/tests/flows.sql.
# Usage: PGHOST=... PGPORT=... PGUSER=postgres scripts/test-db.sh
set -euo pipefail
cd "$(dirname "$0")/.."
DB=yadex_test_$$
psql -q -v ON_ERROR_STOP=1 -d postgres -c "create database $DB"
trap 'psql -q -d postgres -c "drop database if exists $DB" >/dev/null; psql -q -d postgres -c "drop role if exists anon; drop role if exists authenticated" >/dev/null 2>&1 || true' EXIT
psql -q -d postgres -c "drop role if exists anon; drop role if exists authenticated" >/dev/null 2>&1 || true
for f in supabase/tests/local_stubs.sql supabase/migrations/*.sql supabase/seed.sql supabase/tests/flows.sql; do
  psql -q -v ON_ERROR_STOP=1 -d "$DB" -f "$f"
done
