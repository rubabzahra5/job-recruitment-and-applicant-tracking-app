import { test, expect } from "@playwright/test";

/**
 * Foundation smoke tests: the app boots, public routes render, and protected
 * routes redirect unauthenticated visitors to sign-in (middleware,
 * redirect-only — real authorization is server-side).
 */
test("homepage renders", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /find your next job/i })).toBeVisible();
});

test("protected routes redirect to sign-in when unauthenticated", async ({ page }) => {
  for (const path of ["/candidate", "/employer", "/control-center"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login/);
  }
});

test("unknown routes show the 404 page", async ({ page }) => {
  await page.goto("/this-page-does-not-exist");
  await expect(page.getByText(/page not found/i)).toBeVisible();
});
