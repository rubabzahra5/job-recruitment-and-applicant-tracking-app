/**
 * Migration 0018 — security hardening (Phase 1 item 18 fixes).
 *
 * Source-content test (same approach as auto-pause-migration.test.ts):
 * pins the statements that close SEC-01, SEC-02, SEC-06, SEC-08 and
 * SEC-13 from docs/security/test-report.md, so a future edit cannot
 * quietly drop one of the guards. Behaviour against a live database is
 * covered by scripts/validate-migrations.sh where PostgreSQL is
 * available.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "..");
const MIGRATION_PATH = path.join(
  ROOT,
  "supabase",
  "migrations",
  "0018_security_hardening.sql",
);

const sql = existsSync(MIGRATION_PATH) ? readFileSync(MIGRATION_PATH, "utf8") : "";

describe("migration 0018 — security hardening", () => {
  it("exists", () => {
    expect(existsSync(MIGRATION_PATH)).toBe(true);
  });

  it("SEC-01: enables RLS on rate_limit_hits and revokes API-role grants", () => {
    expect(sql).toMatch(/alter table public\.rate_limit_hits enable row level security/i);
    expect(sql).toMatch(/revoke all on table public\.rate_limit_hits from anon, authenticated/i);
  });

  it("SEC-02/SEC-06: installs the trust-column guard on organizations and profiles", () => {
    expect(sql).toMatch(/create or replace function public\.guard_trust_columns\(\)/i);
    expect(sql).toMatch(
      /create trigger guard_organizations_trust_columns\s+before insert or update on public\.organizations/i,
    );
    expect(sql).toMatch(
      /create trigger guard_profiles_trust_columns\s+before update on public\.profiles/i,
    );
  });

  it("SEC-02: the guard pins organization trust columns for non-privileged callers", () => {
    expect(sql).toMatch(/new\.verification_status := 'unverified'/i);
    expect(sql).toMatch(/new\.account_status := 'active'/i);
    expect(sql).toMatch(/new\.verification_status := old\.verification_status/i);
    expect(sql).toMatch(/new\.account_status := old\.account_status/i);
  });

  it("SEC-06: the guard pins profile trust columns for non-privileged callers", () => {
    expect(sql).toMatch(/new\.is_active := old\.is_active/i);
    expect(sql).toMatch(/new\.phone_verified := old\.phone_verified/i);
    expect(sql).toMatch(/new\.phone_verified_at := old\.phone_verified_at/i);
    expect(sql).toMatch(/new\.email := old\.email/i);
  });

  it("privilege is service-role JWT, super admin, or a non-API connection", () => {
    expect(sql).toMatch(/v_jwt_role = 'service_role'/i);
    expect(sql).toMatch(/public\.is_super_admin\(\)/i);
    expect(sql).toMatch(/session_user <> 'authenticator'/i);
  });

  it("SEC-08: drops the any-signed-in-user audit log insert policy", () => {
    expect(sql).toMatch(/drop policy if exists audit_logs_insert on public\.audit_logs/i);
  });

  it("SEC-13: drops the any-signed-in-user platform settings select policy", () => {
    expect(sql).toMatch(
      /drop policy if exists platform_settings_select on public\.platform_settings/i,
    );
  });
});
