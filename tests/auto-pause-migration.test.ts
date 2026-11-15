/**
 * Migration 0017 — auto-pause fairness (ghost-job cron).
 *
 * Regression guard for the November 2026 incident: migration 0012's
 * auto_pause_stale_jobs() paused any published job whose
 * last_employer_activity_at was NULL, treating "no activity recorded"
 * as "inactive forever" — and the daily cron emptied the public job
 * board. Migration 0017 replaces the function so it pauses on
 * EFFECTIVE activity: coalesce(last_employer_activity_at, published_at,
 * created_at).
 *
 * This is a source-content test (same approach as no-paywall.test.ts):
 * it pins the shape of the migration so the dangerous condition cannot
 * quietly come back. The live-PostgreSQL migration validation lives in
 * scripts/validate-migrations.sh / duplicate-application-sql.test.ts.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "..");
const MIGRATION_PATH = path.join(
  ROOT,
  "supabase",
  "migrations",
  "0017_auto_pause_fairness.sql",
);

const sql = existsSync(MIGRATION_PATH) ? readFileSync(MIGRATION_PATH, "utf8") : "";

describe("migration 0017 — auto_pause_stale_jobs fairness", () => {
  it("exists", () => {
    expect(existsSync(MIGRATION_PATH)).toBe(true);
  });

  it("replaces the function with the same signature and return shape as 0012", () => {
    expect(sql).toMatch(
      /create or replace function public\.auto_pause_stale_jobs\(inactivity_days int default 30\)/i,
    );
    expect(sql).toMatch(/returns table \(job_id uuid, job_title text, org_name text\)/i);
  });

  it("pauses on effective activity: coalesce(last_employer_activity_at, published_at, created_at)", () => {
    expect(sql).toMatch(
      /coalesce\(\s*(?:\w+\.)?last_employer_activity_at\s*,\s*(?:\w+\.)?published_at\s*,\s*(?:\w+\.)?created_at\s*\)/i,
    );
  });

  it("never pauses a job merely for having no activity stamp (the 0012 bug)", () => {
    expect(sql).not.toMatch(/last_employer_activity_at\s+is\s+null/i);
  });

  it("still only pauses jobs that are currently published", () => {
    expect(sql).toMatch(/status\s*=\s*'published'/i);
    expect(sql).toMatch(/set status = 'paused'/i);
  });
});
