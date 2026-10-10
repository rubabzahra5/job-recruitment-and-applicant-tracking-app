import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Duplicate-application constraint at the SQL level.
 *
 * Spins up a throwaway PostgreSQL 16 cluster (same technique as
 * scripts/validate-migrations.sh), applies all migrations, then verifies the
 * partial unique index `applications_user_job_active_uniq`
 * ((user_id, job_id) WHERE withdrawn_at IS NULL):
 *   - a second ACTIVE application for the same (user, job) is rejected (23505)
 *   - withdrawing stamps withdrawn_at via the trigger and frees the slot,
 *     so the candidate may re-apply
 *   - terminal-stage lock is enforced by the transition trigger
 *
 * Skipped when PostgreSQL binaries are unavailable in this environment.
 */

const PG_BIN = "/usr/lib/postgresql/16/bin";
const INITDB = join(PG_BIN, "initdb");
const IS_ROOT = typeof process.getuid === "function" && process.getuid() === 0;
const canRun =
  existsSync(INITDB) &&
  (!IS_ROOT || existsSync("/bin/su") || existsSync("/usr/bin/su"));

function sh(cmd: string): string {
  const env = { ...process.env, PATH: `${PG_BIN}:${process.env.PATH}` };
  if (IS_ROOT) {
    return execFileSync("su", ["postgres", "-s", "/bin/bash", "-c", cmd], {
      encoding: "utf8",
      env,
    });
  }
  return execFileSync("bash", ["-c", cmd], { encoding: "utf8", env });
}

const STUB_SQL = `
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
`;

const SEED_SQL = `
insert into auth.users (id, email)
values ('11111111-1111-1111-1111-111111111111', 'candidate@example.com'),
       ('99999999-9999-9999-9999-999999999999', 'candidate2@example.com');
insert into public.organizations (id, name, slug)
values ('22222222-2222-2222-2222-222222222222', 'Test Org', 'test-org');
insert into public.jobs (id, org_id, title, slug, description, employment_type, workplace, status, skills)
values ('33333333-3333-3333-3333-333333333333',
        '22222222-2222-2222-2222-222222222222',
        'Test Job', 'test-job', 'A test job', 'full_time', 'on_site', 'published',
        array['React', 'TypeScript']);
`;

const U = "'11111111-1111-1111-1111-111111111111'";
const U2 = "'99999999-9999-9999-9999-999999999999'";
const J = "'33333333-3333-3333-3333-333333333333'";
const O = "'22222222-2222-2222-2222-222222222222'";

describe.skipIf(!canRun)("duplicate application — SQL-level partial unique index", () => {
  let dir = "";
  let qdir = "";
  let psql = "";
  let qn = 0;

  function runSql(sql: string): string {
    const f = join(qdir, `q-${qn++}.sql`);
    writeFileSync(f, sql);
    chmodSync(f, 0o644);
    return sh(`${psql} -v ON_ERROR_STOP=1 -q -t -A -f '${f}'`);
  }

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "hp-sqltest-"));
    if (IS_ROOT) {
      // initdb refuses root: the cluster dir must belong to postgres.
      execFileSync("chown", ["postgres:postgres", dir]);
      chmodSync(dir, 0o700);
    }
    qdir = join(dir, "q");
    const migStage = join(dir, "migrations");
    if (IS_ROOT) {
      // /home/hatch is not traversable by postgres: stage the SQL where it can read.
      execFileSync("bash", [
        "-c",
        `install -d -o postgres -g postgres -m 700 '${qdir}' '${migStage}' && ` +
          `cp /home/hatch/workspace/job-recruitment-and-applicant-tracking-system/supabase/migrations/*.sql '${migStage}/' && ` +
          `chown postgres:postgres '${migStage}'/*.sql`,
      ]);
    } else {
      execFileSync("bash", [
        "-c",
        `mkdir -p '${qdir}' '${migStage}' && ` +
          `cp /home/hatch/workspace/job-recruitment-and-applicant-tracking-system/supabase/migrations/*.sql '${migStage}/'`,
      ]);
    }

    const data = join(dir, "data");
    const port = 55434;
    sh(`'${INITDB}' -D '${data}' -E UTF8 --no-locale -U postgres`);
    sh(
      `pg_ctl -D '${data}' -l '${dir}/log' -o '-k ${dir} -p ${port} -c listen_addresses=''' start`,
    );
    psql = `psql -h ${dir} -p ${port} -U postgres`;

    runSql(STUB_SQL);
    const files = execFileSync("bash", ["-c", `ls '${migStage}'/*.sql`], {
      encoding: "utf8",
    })
      .trim()
      .split("\n");
    for (const f of files) {
      sh(`${psql} -v ON_ERROR_STOP=1 -q -f '${f}'`);
    }
    runSql(SEED_SQL);
  }, 180_000);

  afterAll(() => {
    if (dir) {
      try {
        sh(`pg_ctl -D '${join(dir, "data")}' -m fast stop`);
      } catch {
        // best effort
      }
      try {
        if (IS_ROOT) execFileSync("chown", ["-R", "root:root", dir]);
      } catch {
        // best effort
      }
      rmSync(dir, { recursive: true, force: true });
    }
  }, 60_000);

  it("rejects a duplicate ACTIVE application with the partial unique index (23505)", () => {
    runSql(
      `insert into public.applications (id, user_id, job_id, org_id)
       values ('44444444-4444-4444-4444-444444444444', ${U}, ${J}, ${O});`,
    );
    // The DO block succeeds silently when the insert is rejected with the
    // expected constraint; any other outcome raises (and fails the test).
    runSql(`
      DO $$
      BEGIN
        INSERT INTO public.applications (user_id, job_id, org_id)
        VALUES (${U}, ${J}, ${O});
        RAISE EXCEPTION 'FAIL: duplicate active application was accepted';
      EXCEPTION WHEN unique_violation THEN
        IF SQLERRM NOT LIKE '%applications_user_job_active_uniq%' THEN
          RAISE EXCEPTION 'wrong constraint violated: %', SQLERRM;
        END IF;
      END $$;
    `);
  }, 60_000);

  it("withdrawing stamps withdrawn_at (trigger) and frees the slot for re-apply", () => {
    runSql(
      `update public.applications set stage = 'withdrawn'
       where id = '44444444-4444-4444-4444-444444444444';`,
    );
    const stamped = runSql(
      `select count(*) from public.applications
       where id = '44444444-4444-4444-4444-444444444444' and withdrawn_at is not null;`,
    );
    expect(stamped.trim()).toBe("1");

    // Re-apply now succeeds: the partial index only covers withdrawn_at IS NULL.
    runSql(
      `insert into public.applications (id, user_id, job_id, org_id)
       values ('55555555-5555-5555-5555-555555555555', ${U}, ${J}, ${O});`,
    );
    const count = runSql(
      `select count(*) from public.applications where user_id = ${U} and job_id = ${J};`,
    );
    expect(count.trim()).toBe("2");

    // But a third active application is still blocked.
    runSql(`
      DO $$
      BEGIN
        INSERT INTO public.applications (user_id, job_id, org_id)
        VALUES (${U}, ${J}, ${O});
        RAISE EXCEPTION 'FAIL: third active application was accepted';
      EXCEPTION WHEN unique_violation THEN
        -- expected: the slot is still guarded
      END $$;
    `);
  }, 60_000);

  it("enforces the terminal-stage lock at the SQL level", () => {
    // Second user: no slot contention with the other tests.
    runSql(
      `insert into public.applications (id, user_id, job_id, org_id)
       values ('66666666-6666-6666-6666-666666666666', ${U2}, ${J}, ${O});`,
    );
    // applied → rejected is a seeded valid transition.
    runSql(
      `update public.applications set stage = 'rejected'
       where id = '66666666-6666-6666-6666-666666666666';`,
    );
    const out = runSql(`
      DO $$
      BEGIN
        UPDATE public.applications SET stage = 'applied'
        WHERE id = '66666666-6666-6666-6666-666666666666';
        RAISE EXCEPTION 'FAIL: transition out of terminal stage was accepted';
      EXCEPTION WHEN raise_exception THEN
        IF SQLERRM NOT LIKE '%Cannot transition out of terminal stage%' THEN
          RAISE EXCEPTION 'unexpected error: %', SQLERRM;
        END IF;
      END $$;
    `);
    expect(out).toBe("");
  }, 60_000);

  it("accepts a valid transition (applied → initial_screening)", () => {
    // Terminal rows still hold the partial-index slot (withdrawn_at IS NULL)
    // and cannot move to withdrawn, so remove the previous test's row.
    runSql(
      `delete from public.applications
       where id = '66666666-6666-6666-6666-666666666666';`,
    );
    runSql(
      `insert into public.applications (id, user_id, job_id, org_id)
       values ('77777777-7777-7777-7777-777777777777', ${U2}, ${J}, ${O});`,
    );
    runSql(
      `update public.applications set stage = 'initial_screening'
       where id = '77777777-7777-7777-7777-777777777777';`,
    );
    const stage = runSql(
      `select stage from public.applications where id = '77777777-7777-7777-7777-777777777777';`,
    );
    expect(stage.trim()).toBe("initial_screening");
  }, 60_000);
});
