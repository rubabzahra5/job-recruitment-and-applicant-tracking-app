/**
 * Migration 0019 — scam reports (Phase 1, item 8).
 *
 * Source-content test (same approach as security-hardening-migration
 * .test.ts): pins the access design — table created idempotently, RLS
 * enabled, NO policies for anon/authenticated (writes/reads are
 * service-role only), grants revoked, CHECK constraints matching the
 * form schema in app/(public)/report-scam/_schemas.ts.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "..");
const MIGRATION_PATH = path.join(ROOT, "supabase", "migrations", "0019_scam_reports.sql");

const sql = existsSync(MIGRATION_PATH) ? readFileSync(MIGRATION_PATH, "utf8") : "";
/** SQL with comments stripped, so assertions see statements only. */
const statements = sql
  .split("\n")
  .filter((line) => !line.trimStart().startsWith("--"))
  .join("\n");

describe("migration 0019 — scam reports", () => {
  it("exists", () => {
    expect(existsSync(MIGRATION_PATH)).toBe(true);
  });

  it("creates the table idempotently with the agreed columns", () => {
    expect(statements).toMatch(/create table if not exists public\.scam_reports/i);
    for (const column of [
      "reporter_name",
      "reporter_email",
      "job_url",
      "organization_name",
      "description",
      "evidence_urls",
      "ip_hash",
    ]) {
      expect(statements).toMatch(new RegExp(`${column} text`, "i"));
    }
    expect(statements).toMatch(/description text not null/i);
    expect(statements).toMatch(/created_at timestamptz not null default now\(\)/i);
  });

  it("links job_id to jobs with on delete set null", () => {
    expect(statements).toMatch(
      /job_id uuid references public\.jobs\(id\) on delete set null/i,
    );
  });

  it("constrains scam_type to the form's five values", () => {
    expect(statements).toMatch(
      /scam_type in \('money_asked', 'fake_job', 'impersonation', 'phishing', 'other'\)/i,
    );
  });

  it("constrains status and defaults it to 'new'", () => {
    expect(statements).toMatch(/status text not null default 'new'/i);
    expect(statements).toMatch(
      /status in \('new', 'reviewing', 'action_taken', 'dismissed'\)/i,
    );
  });

  it("enables RLS and revokes API-role grants", () => {
    expect(statements).toMatch(/alter table public\.scam_reports enable row level security/i);
    expect(statements).toMatch(/revoke all on table public\.scam_reports from anon, authenticated/i);
  });

  it("creates NO policies at all — service-role access only", () => {
    expect(statements).not.toMatch(/create policy/i);
  });
});
