import { test, expect } from "@playwright/test";

// The page and API need a Keycloak admin session that Playwright can't obtain
// (see AGENTS.md), so this only covers what an anonymous visitor can reach:
// the page redirects to login and the API refuses — the upload endpoint
// replaces images on the public homepage, so it must not be open.
test("homepage-images page redirects anonymous visitors to login", async ({ page }) => {
  await page.goto("/dashboard/site-images");
  await expect(page).toHaveURL(/\/login/);
});

test("site-images API rejects anonymous requests", async ({ request }) => {
  expect((await request.get("/api/site-images")).status()).toBe(401);
  expect((await request.get("/api/site-images/gallery_1")).status()).toBe(401);
  expect((await request.put("/api/site-images/gallery_1", { multipart: { alt: "x" } })).status()).toBe(401);
  expect((await request.delete("/api/site-images/gallery_1")).status()).toBe(401);
});
