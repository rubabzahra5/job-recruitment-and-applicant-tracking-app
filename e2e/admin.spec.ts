/**
 * E2E: super-admin flow — control-center login → create org → invite an org
 * admin → suspend / reactivate the org.
 *
 * Requires a live Supabase project:
 *   E2E_SUPABASE_URL, E2E_SUPABASE_ANON_KEY, E2E_SUPABASE_SERVICE_ROLE_KEY
 * Skipped entirely when credentials are absent.
 *
 * A super_admin user is provisioned via the service role in beforeAll
 * (mirrors scripts/bootstrap-admin.ts) and removed in afterAll.
 */

import { test, expect, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.E2E_SUPABASE_URL;
const SERVICE_KEY = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY;
const PASSWORD = process.env.E2E_TEST_PASSWORD ?? "E2eTestPass123!";
const HAS_CREDS = Boolean(SUPABASE_URL && SERVICE_KEY);

const stamp = Date.now().toString(36);
const SUPERADMIN_EMAIL = `e2e-superadmin-${stamp}@example.com`;

test.beforeEach(async () => {
  test.skip(!HAS_CREDS, "E2E_SUPABASE_URL / E2E_SUPABASE_SERVICE_ROLE_KEY not set");
});

let admin: SupabaseClient<any>;
let superAdminId = "";

test.beforeAll(async () => {
  test.skip(!HAS_CREDS, "E2E_SUPABASE_URL / E2E_SUPABASE_SERVICE_ROLE_KEY not set");
  admin = createClient<any>(SUPABASE_URL!, SERVICE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await admin.auth.admin.createUser({
    email: SUPERADMIN_EMAIL,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { display_name: "E2E Super Admin" },
  });
  if (error) throw error;
  superAdminId = data.user.id;
  const { error: roleErr } = await admin
    .from("user_roles")
    .insert({ user_id: superAdminId, role: "super_admin", org_id: null });
  if (roleErr) throw roleErr;
});

test.afterAll(async () => {
  if (!HAS_CREDS) return;
  await admin.from("user_roles").delete().eq("user_id", superAdminId);
  await admin.auth.admin.deleteUser(superAdminId);
});

async function loginAsSuperAdmin(page: Page) {
  await page.goto("/control-center/login");
  await page.getByLabel(/email/i).fill(SUPERADMIN_EMAIL);
  await page.getByLabel(/password/i).fill(PASSWORD);
  await page.getByRole("button", { name: /log in|sign in/i }).click();
  await page.waitForURL(/\/control-center(\?|$)/, { timeout: 15000 });
}

test("super admin logs in and sees the dashboard", async ({ page }) => {
  await loginAsSuperAdmin(page);
  await expect(page.getByRole("heading", { name: /overview|dashboard/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /organizations/i })).toBeVisible();
});

test("super admin creates an org, invites an admin, suspends and reactivates", async ({
  page,
}) => {
  await loginAsSuperAdmin(page);

  // Create org
  await page.goto("/control-center/organizations");
  await page.getByRole("button", { name: /new organization|create organization/i }).click();
  await page.getByLabel(/organization name/i).fill(`E2E Admin Org ${stamp}`);
  await page.getByLabel(/slug/i).fill(`e2e-admin-org-${stamp}`);
  await page.getByRole("button", { name: /create/i }).click();
  await expect(page.getByText(`E2E Admin Org ${stamp}`)).toBeVisible({ timeout: 15000 });

  // Invite an org admin (token shown for manual delivery)
  await page.getByText(`E2E Admin Org ${stamp}`).click();
  await page.getByRole("button", { name: /add member|invite/i }).click();
  await page.getByLabel(/email/i).fill(`e2e-invited-admin-${stamp}@example.com`);
  await page.getByLabel(/role/i).selectOption("org_admin");
  await page.getByRole("button", { name: /send invite|invite/i }).click();
  await expect(page.getByText(/invitation/i).first()).toBeVisible({ timeout: 15000 });

  // Suspend the org
  await page.getByRole("button", { name: /suspend/i }).click();
  await page.getByRole("button", { name: /confirm/i }).click();
  await expect(page.getByText(/suspended/i).first()).toBeVisible({ timeout: 15000 });

  // Reactivate the org
  await page.getByRole("button", { name: /reactivate/i }).click();
  await page.getByRole("button", { name: /confirm/i }).click();
  await expect(page.getByText(/active/i).first()).toBeVisible({ timeout: 15000 });
});
