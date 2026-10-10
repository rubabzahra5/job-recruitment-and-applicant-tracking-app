/**
 * E2E: recruiter journey — review application → move stage → schedule
 * interview → record feedback → create/approve/send offer → mark hired.
 *
 * Requires a live Supabase project:
 *   E2E_SUPABASE_URL, E2E_SUPABASE_ANON_KEY, E2E_SUPABASE_SERVICE_ROLE_KEY
 * Skipped entirely when credentials are absent.
 *
 * Seeds via service role: org (verified/active), recruiter user (org role
 * `recruiter` + active membership), a second org_admin (offer approver),
 * a candidate user with an application on a published job.
 */

import { test, expect, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.E2E_SUPABASE_URL;
const SERVICE_KEY = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY;
const PASSWORD = process.env.E2E_TEST_PASSWORD ?? "E2eTestPass123!";
const HAS_CREDS = Boolean(SUPABASE_URL && SERVICE_KEY);

const stamp = Date.now().toString(36);
const RECRUITER_EMAIL = `e2e-recruiter-${stamp}@example.com`;
const ADMIN_EMAIL = `e2e-orgadmin-${stamp}@example.com`;
const CANDIDATE_EMAIL = `e2e-candrec-${stamp}@example.com`;

test.beforeEach(async () => {
  test.skip(!HAS_CREDS, "E2E_SUPABASE_URL / E2E_SUPABASE_SERVICE_ROLE_KEY not set");
});

let admin: SupabaseClient<any>;
let orgId = "";
let applicationId = "";
let recruiterId = "";
let orgAdminId = "";
let candidateId = "";

async function makeUser(email: string): Promise<string> {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { display_name: email },
  });
  if (error) throw error;
  return data.user.id;
}

test.beforeAll(async () => {
  test.skip(!HAS_CREDS, "E2E_SUPABASE_URL / E2E_SUPABASE_SERVICE_ROLE_KEY not set");
  admin = createClient<any>(SUPABASE_URL!, SERVICE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: org, error: orgErr } = await admin
    .from("organizations")
    .insert({
      name: `E2E Rec Org ${stamp}`,
      slug: `e2e-rec-org-${stamp}`,
      verification_status: "verified",
      account_status: "active",
    })
    .select("id")
    .single();
  if (orgErr) throw orgErr;
  orgId = org.id as string;

  recruiterId = await makeUser(RECRUITER_EMAIL);
  orgAdminId = await makeUser(ADMIN_EMAIL);
  candidateId = await makeUser(CANDIDATE_EMAIL);

  for (const [uid, role] of [
    [recruiterId, "recruiter"],
    [orgAdminId, "org_admin"],
  ] as const) {
    const { error: mErr } = await admin.from("organization_memberships").insert({
      org_id: orgId,
      user_id: uid,
      is_active: true,
    });
    if (mErr) throw mErr;
    const { error: rErr } = await admin
      .from("user_roles")
      .insert({ user_id: uid, role, org_id: orgId });
    if (rErr) throw rErr;
  }
  const { error: candRoleErr } = await admin
    .from("user_roles")
    .insert({ user_id: candidateId, role: "candidate", org_id: null });
  if (candRoleErr) throw candRoleErr;

  const { data: job, error: jobErr } = await admin
    .from("jobs")
    .insert({
      org_id: orgId,
      title: `E2E Recruiter Job ${stamp}`,
      slug: `e2e-recruiter-job-${stamp}`,
      description: "Recruiter flow test job with enough description text.",
      employment_type: "full_time",
      workplace: "on_site",
      status: "published",
    })
    .select("id")
    .single();
  if (jobErr) throw jobErr;

  const { data: app, error: appErr } = await admin
    .from("applications")
    .insert({
      user_id: candidateId,
      job_id: job.id,
      org_id: orgId,
      stage: "applied",
      snapshot_title: `E2E Recruiter Job ${stamp}`,
    })
    .select("id")
    .single();
  if (appErr) throw appErr;
  applicationId = app.id as string;
});

test.afterAll(async () => {
  if (!HAS_CREDS) return;
  await admin.from("organizations").delete().eq("id", orgId);
  for (const uid of [recruiterId, orgAdminId, candidateId]) {
    await admin.from("user_roles").delete().eq("user_id", uid);
    await admin.auth.admin.deleteUser(uid);
  }
});

async function loginAs(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel(/email address/i).fill(email);
  await page.getByLabel(/^password/i).fill(PASSWORD);
  await page.getByRole("button", { name: /log in/i }).click();
  await page.waitForURL(/\/employer(\?|$)/, { timeout: 15000 });
}

test("recruiter moves the application through screening", async ({ page }) => {
  await loginAs(page, RECRUITER_EMAIL);
  await page.goto(`/employer/applications/${applicationId}?org=${orgId}`);
  // StageMoveControl offers only allowed next stages.
  await page.getByRole("button", { name: /move stage|change stage/i }).click();
  await page.getByRole("option", { name: /initial screening/i }).click();
  await page.getByRole("button", { name: /confirm/i }).click();
  await expect(page.getByText(/initial screening/i).first()).toBeVisible({ timeout: 15000 });
});

test("recruiter schedules an interview and records feedback", async ({ page }) => {
  await loginAs(page, RECRUITER_EMAIL);
  await page.goto(`/employer/interviews?org=${orgId}`);
  await page.getByRole("button", { name: /schedule interview|new interview/i }).click();
  // InterviewForm: pick the application, set a future Karachi wall-clock time.
  await page.getByLabel(/application/i).selectOption(applicationId);
  const when = new Date(Date.now() + 3 * 86400000);
  const local = when.toISOString().slice(0, 16);
  await page.getByLabel(/date.*time|scheduled at/i).fill(local);
  await page.getByLabel(/interviewer/i).first().fill(RECRUITER_EMAIL);
  await page.getByRole("button", { name: /schedule/i }).click();
  await expect(page.getByText(/interview scheduled/i).first()).toBeVisible({ timeout: 15000 });

  // Feedback: open the interview and submit a 5-criterion rating.
  await page.getByText(/e2e recruiter job/i).first().click();
  await page.getByRole("button", { name: /feedback|add feedback/i }).click();
  await page.getByLabel(/recommendation|decision/i).selectOption("hire");
  await page.getByRole("button", { name: /save feedback|submit/i }).click();
  await expect(page.getByText(/feedback saved/i)).toBeVisible({ timeout: 15000 });
});

test("offer is approved by a second admin, sent, and the candidate is hired", async ({
  page,
}) => {
  // Recruiter creates the offer.
  await loginAs(page, RECRUITER_EMAIL);
  await page.goto(`/employer/offers?org=${orgId}`);
  await page.getByRole("button", { name: /new offer|create offer/i }).click();
  await page.getByLabel(/application/i).selectOption(applicationId);
  await page.getByLabel(/salary|compensation/i).fill("250000");
  const joining = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  await page.getByLabel(/joining date/i).fill(joining);
  await page.getByRole("button", { name: /create|save/i }).click();
  await expect(page.getByText(/offer created|draft/i).first()).toBeVisible({ timeout: 15000 });

  // Approver (org_admin, different from creator) approves.
  await page.goto("/login");
  await page.getByLabel(/email address/i).fill(ADMIN_EMAIL);
  await page.getByLabel(/^password/i).fill(PASSWORD);
  await page.getByRole("button", { name: /log in/i }).click();
  await page.waitForURL(/\/employer(\?|$)/, { timeout: 15000 });
  await page.goto(`/employer/offers?org=${orgId}`);
  await page.getByText(/e2e recruiter job/i).first().click();
  await page.getByRole("button", { name: /approve/i }).click();
  await page.getByRole("button", { name: /confirm/i }).click();
  await expect(page.getByText(/approved/i).first()).toBeVisible({ timeout: 15000 });

  // Send the offer, then mark hired.
  await page.getByRole("button", { name: /send/i }).click();
  await page.getByRole("button", { name: /confirm/i }).click();
  await page.getByRole("button", { name: /mark hired/i }).click();
  await page.getByRole("button", { name: /confirm/i }).click();

  // Application is now at the hired terminal stage.
  await page.goto(`/employer/applications/${applicationId}?org=${orgId}`);
  await expect(page.getByText(/^hired$/i).first()).toBeVisible({ timeout: 15000 });
});
