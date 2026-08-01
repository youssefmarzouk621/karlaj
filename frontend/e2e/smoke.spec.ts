import { test, expect } from "@playwright/test";

// Starter smoke coverage for the core pages. Extend this file (or add
// sibling specs) with the page(s) your change actually touches — see the
// "Validating changes" step in AGENTS.md.

test("home page renders the hero", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/BrickArt/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("In bricks.");
});

test("header cart link navigates to an empty cart", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "View cart" }).click();
  await expect(page).toHaveURL(/\/cart$/);
  await expect(page.getByRole("heading", { name: "Your cart is empty" })).toBeVisible();
});

test("create flow starts on the upload step", async ({ page }) => {
  await page.goto("/create");
  await expect(page.getByRole("heading", { name: "Create your LEGO mosaic" })).toBeVisible();
  await expect(page.getByText("Upload a photo")).toBeVisible();
});
