import { test, expect } from "@playwright/test";

// Starter smoke coverage for the dashboard's public routes. /dashboard/* and
// most /api/* routes require a real Keycloak session (src/middleware.ts) and
// aren't reachable here without live admin credentials — see the
// "Validating changes" step in AGENTS.md for what that means for coverage.

test("login page renders the Keycloak sign-in button", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "BrickArt Dashboard" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in with Keycloak" })).toBeVisible();
});

test("an unauthenticated visit to /dashboard redirects to /login", async ({ page }) => {
  await page.goto("/dashboard/pricing");
  await expect(page).toHaveURL(/\/login/);
});
