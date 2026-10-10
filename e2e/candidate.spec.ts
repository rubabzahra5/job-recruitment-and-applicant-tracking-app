/**
 * E2E: candidate journey — register → upload CV → search jobs → apply →
 * track application → withdraw.
 *
 * Requires a live Supabase project. Credentials come from environment:
 *   E2E_SUPABASE_URL, E2E_SUPABASE_ANON_KEY, E2E_SUPABASE_SERVICE_ROLE_KEY
 * Optional: E2E_BASE_URL (defaults to http://127.0.0.1:3100, see
 * playwright.config.ts), E2E_TEST_PASSWORD (default "E2eTestPass123!").
 *
 * When credentials are absent the whole file is SKIPPED (honest skip, not a
 * fake pass). A published job + verified org are seeded via the service role
 * in beforeAll and removed in afterAll.
 *
 * Assumptions about the test project: auth email confirmation is DISABLED
 * (dev default), storage bucket `cvs` exists, seeded pipeline stages exist.
 */

import { test, expect } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.E2E_SUPABASE_URL;
const SERVICE_KEY = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY;
const PASSWORD = process.env.E2E_TEST_PASSWORD ?? "E2eTestPass123!";
const HAS_CREDS = Boolean(SUPABASE_URL && SERVICE_KEY);

const stamp = Date.now().toString(36);
const CANDIDATE_EMAIL = `e2e-candidate-${stamp}@example.com`;
const ORG_SLUG = `e2e-org-${stamp}`;

test.beforeEach(async () => {
  test.skip(!HAS_CREDS, "E2E_SUPABASE_URL / E2E_SUPABASE_SERVICE_ROLE_KEY not set");
});

let admin: SupabaseClient<any>;
let orgId = "";
let jobId = "";
let jobSlug = "";
let userId = "";

test.beforeAll(async () => {
  test.skip(!HAS_CREDS, "E2E_SUPABASE_URL / E2E_SUPABASE_SERVICE_ROLE_KEY not set");
  admin = createClient<any>(SUPABASE_URL!, SERVICE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Seed org (verified + active) and a published job.
  const { data: org, error: orgErr } = await admin
    .from("organizations")
    .insert({ name: `E2E Org ${stamp}`, slug: ORG_SLUG, verification_status: "verified", account_status: "active" })
    .select("id")
    .single();
  if (orgErr) throw orgErr;
  orgId = org.id as string;

  const { data: job, error: jobErr } = await admin
    .from("jobs")
    .insert({
      org_id: orgId,
      title: `E2E Engineer ${stamp}`,
      slug: `e2e-engineer-${stamp}`,
      description: "An end-to-end test engineering role with enough description text.",
      employment_type: "full_time",
      workplace: "remote",
      status: "published",
      skills: ["TypeScript"],
    })
    .select("id, slug")
    .single();
  if (jobErr) throw jobErr;
  jobId = job.id as string;
  jobSlug = job.slug as string;

  // Seed a pre-confirmed candidate user with the candidate role.
  const { data: created, error: userErr } = await admin.auth.admin.createUser({
    email: CANDIDATE_EMAIL,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { display_name: "E2E Candidate" },
  });
  if (userErr) throw userErr;
  userId = created.user.id;
  const { error: roleErr } = await admin
    .from("user_roles")
    .insert({ user_id: userId, role: "candidate", org_id: null });
  if (roleErr) throw roleErr;
});

test.afterAll(async () => {
  if (!HAS_CREDS) return;
  // Best-effort cleanup: org cascade removes jobs; applications cascade too.
  await admin.from("organizations").delete().eq("id", orgId);
  await admin.from("user_roles").delete().eq("user_id", userId);
  await admin.auth.admin.deleteUser(userId);
});

test("candidate registers via the UI", async ({ page }) => {
  const email = `e2e-register-${stamp}@example.com`;
  await page.goto("/register");
  await page.getByLabel(/full name/i).fill("E2E Registrant");
  await page.getByLabel(/email address/i).fill(email);
  await page.getByLabel(/^password/i).fill(PASSWORD);
  await page.getByLabel(/confirm password/i).fill(PASSWORD);
  await page.getByLabel(/i am a/i).selectOption("candidate");
  await page.getByRole("button", { name: /create account/i }).click();
  // With email confirmation disabled the user lands on /candidate;
  // with it enabled they see the "check your inbox" state. Both are honest.
  await expect(
    page.getByText("Check your inbox").or(page.getByRole("heading", { name: /dashboard/i })),
  ).toBeVisible({ timeout: 15000 });
});

test("candidate logs in, uploads a CV, searches, and applies", async ({ page }) => {
  // Login
  await page.goto("/login");
  await page.getByLabel(/email address/i).fill(CANDIDATE_EMAIL);
  await page.getByLabel(/^password/i).fill(PASSWORD);
  await page.getByRole("button", { name: /log in/i }).click();
  await page.waitForURL(/\/candidate(\?|$)/, { timeout: 15000 });

  // Upload CV
  await page.goto("/candidate/resume");
  const pdf = Buffer.from("%PDF-1.4\n%fake e2e cv\n");
  await page.getByLabel(/choose cv file/i).setInputFiles({
    name: "e2e-cv.pdf",
    mimeType: "application/pdf",
    buffer: pdf,
  });
  await page.getByRole("button", { name: /upload cv/i }).click();
  await expect(page.getByText("e2e-cv.pdf")).toBeVisible({ timeout: 15000 });

  // Search jobs
  await page.goto(`/jobs?keyword=e2e-engineer-${stamp}`);
  await expect(page.getByText(`E2E Engineer ${stamp}`)).toBeVisible();

  // Apply via the wizard
  await page.goto(`/candidate/apply/${jobSlug}`);
  await page.getByRole("button", { name: /continue to questions/i }).click();
  // No questions seeded: straight to CV step.
  await page.getByRole("button", { name: /^continue$/i }).click();
  await page.getByRole("button", { name: /review application/i }).click();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: /submit application/i }).click();
  await expect(page.getByText("Application submitted")).toBeVisible({ timeout: 15000 });

  // Track in the applications list
  await page.goto("/candidate/applications");
  await expect(page.getByText(`E2E Engineer ${stamp}`)).toBeVisible();
});

test("candidate withdraws the application", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel(/email address/i).fill(CANDIDATE_EMAIL);
  await page.getByLabel(/^password/i).fill(PASSWORD);
  await page.getByRole("button", { name: /log in/i }).click();
  await page.waitForURL(/\/candidate(\?|$)/, { timeout: 15000 });

  await page.goto("/candidate/applications");
  await page.getByText(`E2E Engineer ${stamp}`).click();
  await page.getByRole("button", { name: /withdraw/i }).click();
  // ConfirmDialog
  await page.getByRole("button", { name: /confirm/i }).click();
  await expect(page.getByText(/withdrawn/i).first()).toBeVisible({ timeout: 15000 });
});
