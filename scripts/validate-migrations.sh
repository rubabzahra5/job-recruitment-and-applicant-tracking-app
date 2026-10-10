#!/usr/bin/env bash
# Validate supabase/migrations/*.sql against a throwaway local PostgreSQL cluster.
# Creates stub `auth` and `storage` schemas (Supabase-provided in production) so
# that references like auth.uid() and storage.objects resolve during validation.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATIONS="$ROOT/supabase/migrations"

# Debian/Ubuntu install PostgreSQL binaries outside PATH.
for bindir in /usr/lib/postgresql/16/bin /usr/lib/postgresql/15/bin /usr/lib/postgresql/14/bin /usr/pgsql-16/bin; do
  if [ -x "$bindir/initdb" ]; then
    export PATH="$bindir:$PATH"
    break
  fi
done

if ! command -v initdb >/dev/null 2>&1; then
  echo "SKIP: PostgreSQL (initdb) is not installed; migrations were not executed against a live DB."
  exit 0
fi

if [ "$(id -u)" -eq 0 ] && ! command -v su >/dev/null 2>&1; then
  echo "SKIP: running as root without 'su'; cannot initdb. Migrations were not executed against a live DB."
  exit 0
fi

TMPDIR="$(mktemp -d)"
DATA="$TMPDIR/data"
SOCK="$TMPDIR"
PORT=55433

# initdb refuses to run as root; the cluster dir must belong to the postgres user.
if [ "$(id -u)" -eq 0 ]; then
  chown postgres:postgres "$TMPDIR"
  chmod 700 "$TMPDIR"
fi

run_as_postgres() {
  if [ "$(id -u)" -eq 0 ]; then
    su postgres -s /bin/bash -c "$*"
  else
    bash -c "$*"
  fi
}

cleanup() {
  run_as_postgres "pg_ctl -D '$DATA' -m fast stop" >/dev/null 2>&1 || true
  rm -rf "$TMPDIR"
}
trap cleanup EXIT

echo "Initializing throwaway cluster in $TMPDIR ..."
run_as_postgres "initdb -D '$DATA' -E UTF8 --no-locale" >/dev/null
run_as_postgres "pg_ctl -D '$DATA' -l '$TMPDIR/log' -o '-k $SOCK -p $PORT -c listen_addresses=''' start" >/dev/null

PSQL="psql -h $SOCK -p $PORT -U postgres -v ON_ERROR_STOP=1 -q"

echo "Creating Supabase stub schemas (auth, storage) ..."
$PSQL <<'SQL'
-- Supabase-provided roles (exist in production; stubbed for local validation).
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

create schema if not exists auth;
create table auth.users (
  id uuid primary key,
  email text,
  raw_user_meta_data jsonb not null default '{}'
);
create or replace function auth.uid() returns uuid
  language sql stable as $$ select null::uuid $$;

create schema if not exists storage;
create table storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false
);
create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text not null,
  name text not null,
  owner uuid,
  created_at timestamptz default now()
);
create or replace function storage.foldername(name text) returns text[]
  language sql immutable as $$ select string_to_array(name, '/') $$;
alter table storage.objects enable row level security;
SQL

echo "Applying migrations in order ..."
for f in "$MIGRATIONS"/*.sql; do
  echo "  - $(basename "$f")"
  $PSQL -f "$f"
done

echo "Smoke checks ..."
$PSQL -t -c "select 'pipeline_stages: ' || count(*) from public.pipeline_stages;"
$PSQL -t -c "select 'pipeline_transitions: ' || count(*) from public.pipeline_transitions;"
$PSQL -t -c "select 'job_categories: ' || count(*) from public.job_categories;"
$PSQL -t -c "select 'locations: ' || count(*) from public.locations;"
$PSQL -t -c "select 'platform_settings: ' || count(*) from public.platform_settings;"
$PSQL -t -c "select 'tables with RLS enabled: ' || count(*) from pg_tables where schemaname='public' and rowsecurity;"

echo "Functional checks (trigger, constraints, generated tsvector) ..."
$PSQL <<'SQL'
-- minimal rows to exercise application-level constraints (as superuser; RLS bypassed)
insert into auth.users (id, email)
values ('11111111-1111-1111-1111-111111111111', 'candidate@example.com');
-- handle_new_user trigger auto-creates the profile row
insert into public.organizations (id, name, slug)
values ('22222222-2222-2222-2222-222222222222', 'Test Org', 'test-org');
insert into public.jobs (id, org_id, title, slug, description, employment_type, workplace, status, skills)
values ('33333333-3333-3333-3333-333333333333',
        '22222222-2222-2222-2222-222222222222',
        'Test Job', 'test-job', 'A test job', 'full_time', 'on_site', 'published',
        array['React', 'TypeScript']);
insert into public.applications (id, user_id, job_id, org_id)
values ('44444444-4444-4444-4444-444444444444',
        '11111111-1111-1111-1111-111111111111',
        '33333333-3333-3333-3333-333333333333',
        '22222222-2222-2222-2222-222222222222');
SQL

# 1. valid transition: applied -> initial_screening
$PSQL -c "update public.applications set stage = 'initial_screening' where id = '44444444-4444-4444-4444-444444444444';" \
  || { echo "FAIL: valid transition applied->initial_screening was rejected"; exit 1; }
echo "  ok: valid stage transition accepted"

# 2. invalid transition: initial_screening -> hired must be rejected
if $PSQL -c "update public.applications set stage = 'hired' where id = '44444444-4444-4444-4444-444444444444';" 2>/dev/null; then
  echo "FAIL: invalid transition initial_screening->hired was accepted"; exit 1;
fi
echo "  ok: invalid stage transition rejected"

# 3. duplicate active application must be rejected (partial unique index)
if $PSQL -c "insert into public.applications (user_id, job_id, org_id) values ('11111111-1111-1111-1111-111111111111','33333333-3333-3333-3333-333333333333','22222222-2222-2222-2222-222222222222');" 2>/dev/null; then
  echo "FAIL: duplicate active application was accepted"; exit 1;
fi
echo "  ok: duplicate active application rejected"

# 4. withdrawing frees the slot (partial index only covers withdrawn_at IS NULL)
$PSQL -c "update public.applications set stage = 'withdrawn' where id = '44444444-4444-4444-4444-444444444444';" \
  || { echo "FAIL: transition to withdrawn was rejected"; exit 1; }
$PSQL -c "select '  ok: withdrawn_at auto-stamped = ' || (withdrawn_at is not null) from public.applications where id = '44444444-4444-4444-4444-444444444444';"
$PSQL -c "insert into public.applications (user_id, job_id, org_id) values ('11111111-1111-1111-1111-111111111111','33333333-3333-3333-3333-333333333333','22222222-2222-2222-2222-222222222222');" \
  || { echo "FAIL: re-application after withdrawal was rejected"; exit 1; }
echo "  ok: re-application after withdrawal accepted"

# 5. generated tsvector includes title + skills
$PSQL -t -c "select '  ok: tsvector matches skill query = ' || (search @@ to_tsquery('english', 'react & typescript')) from public.jobs where id = '33333333-3333-3333-3333-333333333333';"

# 6. terminal stage lock: withdrawn -> applied must be rejected
if $PSQL -c "update public.applications set stage = 'applied' where id = '44444444-4444-4444-4444-444444444444';" 2>/dev/null; then
  echo "FAIL: transition out of terminal stage was accepted"; exit 1;
fi
echo "  ok: terminal stage locked"

echo "OK: all migrations applied cleanly."
