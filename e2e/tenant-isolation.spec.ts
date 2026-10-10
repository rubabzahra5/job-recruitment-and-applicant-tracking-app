/**
 * E2E: tenant isolation — a user of org A cannot see or touch org B's data.
 *
 * Requires a live Supabase project:
 *   E2E_SUPABASE_URL, E2E_SUPABASE_ANON_KEY, E2E_SUPABASE_SERVICE_ROLE_KEY
 * Skipped entirely when credentials are absent.
 *
 * Seeds via service role: two orgs (A, B), a recruiter member of A only, a
 * published job + application in org B. Then asserts, as the org-A user:
 *   1. ?org=<B> is rejected (not an active member)
 *   2. org B's application detail page is denied
 *   3. org B's job never appears in org A's job list
 */

import { test, expect } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.E2E_SUPABASE_URL;
const SERVICE_KEY = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY;
const PASSWORD = process.env.E2E_TEST_PASSWORD ?? "E2eTestPass123!";
const HAS_CREDS = Boolean(SUPABASE_URL && SERVICE_KEY);

const stamp = Date.now().toString(36);
const USER_A_EMAIL = `e2e-tenant-a-${stamp}@example.com`;

test.beforeEach(async () => {
  test.skip(!HAS_CREDS, "E2E_SUPABASE_URL / E2E_SUPABASE_SERVICE_ROLE_KEY not set");
});

let admin: SupabaseClient<any>;
let orgA = "";
let orgB = "";
let jobB = "";
let appB = "";
let userA = "";

test.beforeAll(async () => {
  test.skip(!HAS_CREDS, "E2E_SUPABASE_URL / E2E_SUPABASE_SERVICE_ROLE_KEY not set");
  admin = createClient<any>(SUPABASE_URL!, SERVICE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  for (const [key, name] of [
    ["a", `E2E Tenant A ${stamp}`],
    ["b", `E2E Tenant B ${stamp}`],
  ] as const) {
    const { data, error } = await admin
      .from("organizations")
      .insert({
        name,
        slug: `e2e-tenant-${key}-${stamp}`,
        verification_status: "verified",
        account_status: "active",
      })
      .select("id")
      .single();
    if (error) throw error;
    if (key === "a") orgA = data.id as string;
    else orgB = data.id as string;
  }

  const { data: user, error: userErr } = await admin.auth.admin.createUser({
    email: USER_A_EMAIL,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { display_name: "Tenant A User" },
  });
  if (userErr) throw userErr;
  userA = user.user.id;

  // Member of A only.
  const { error: mErr } = await admin.from("organization_memberships").insert({
    org_id: orgA,
    user_id: userA,
    is_active: true,
  });
  if (mErr) throw mErr;
  const { error: rErr } = await admin
    .from("user_roles")
    .insert({ user_id: userA, role: "recruiter", org_id: orgA });
  if (rErr) throw rErr;

  // A job + application living in org B.
  const { data: job, error: jobErr } = await admin
    .from("jobs")
    .insert({
      org_id: orgB,
      title: `E2E Tenant B Secret Job ${stamp}`,
      slug: `e2e-tenant-b-job-${stamp}`,
      description: "This job belongs to org B and must be invisible to org A.",
      employment_type: "full_time",
      workplace: "remote",
      status: "published",
    })
    .select("id")
    .single();
  if (jobErr) throw jobErr;
  jobB = job.id as string;

  const { data: app, error: appErr } = await admin
    .from("applications")
    .insert({
      user_id: userA, // same user id, but the application belongs to org B
      job_id: jobB,
      org_id: orgB,
      stage: "applied",
      snapshot_title: `E2E Tenant B Secret Job ${stamp}`,
    })
    .select("id")
    .single();
  if (appErr) throw appErr;
  appB = app.id as string;
});

test.afterAll(async () => {
  if (!HAS_CREDS) return;
  await admin.from("organizations").delete().eq("id", orgA);
  await admin.from("organizations").delete().eq("id", orgB);
  await admin.from("user_roles").delete().eq("user_id", userA);
  await admin.auth.admin.deleteUser(userA);
});

test("org A user is rejected when forcing ?org=<org B>", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel(/email address/i).fill(USER_A_EMAIL);
  await page.getByLabel(/^password/i).fill(PASSWORD);
  await page.getByRole("button", { name: /log in/i }).click();
  await page.waitForURL(/\/employer(\?|$)/, { timeout: 15000 });

  await page.goto(`/employer/jobs?org=${orgB}`);
  // getOrgContext throws NoOrganizationError → the route's error boundary.
  await expect(
    page.getByText(/no organization|not a member|access denied|something went wrong/i).first(),
  ).toBeVisible({ timeout: 15000 });
});

test("org A user cannot open org B's application", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel(/email address/i).fill(USER_A_EMAIL);
  await page.getByLabel(/^password/i).fill(PASSWORD);
  await page.getByRole("button", { name: /log in/i }).click();
  await page.waitForURL(/\/employer(\?|$)/, { timeout: 15000 });

  await page.goto(`/employer/applications/${appB}?org=${orgA}`);
  // getOrgApplication verifies row.org_id === ctx.orgId before returning.
  await expect(
    page.getByText(/not found|access denied|no organization|something went wrong/i).first(),
  ).toBeVisible({ timeout: 15000 });
});

test("org B's job never appears in org A's lists", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel(/email address/i).fill(USER_A_EMAIL);
  await page.getByLabel(/^password/i).fill(PASSWORD);
  await page.getByRole("button", { name: /log in/i }).click();
  await page.waitForURL(/\/employer(\?|$)/, { timeout: 15000 });

  await page.goto(`/employer/jobs?org=${orgA}`);
  await expect(
    page.getByText(`E2E Tenant B Secret Job ${stamp}`),
  ).not.toBeVisible({ timeout: 5000 });

  await page.goto(`/employer/applications?org=${orgA}`);
  // The org-B application must not leak into org A's board.
  await expect(page.getByText(`E2E Tenant B Secret Job ${stamp}`)).not.toBeVisible({
    timeout: 5000,
  });
});
