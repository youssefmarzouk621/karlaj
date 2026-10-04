import { test, expect } from "@playwright/test";
import { join } from "node:path";

const IMG = join(__dirname, "..", "..", "mosaic-generator", "test_images", "21.jpg");

test("pricing lists every size from the database and links into the create flow", async ({ page }) => {
  const { prisma } = await import("@lego/database");
  const sizes = await prisma.mosaicSize.findMany({ orderBy: { sortOrder: "asc" } });
  const enabled = sizes.filter((s) => s.enabled);
  test.skip(enabled.length < 2, "needs at least two enabled sizes");

  await page.goto("/pricing");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Priced by size");
  const cards = page.getByTestId("price-card");
  await expect(cards).toHaveCount(sizes.length);

  // A priced, enabled size shows the admin's price and a link that preselects it.
  const target = enabled[enabled.length - 1];
  const card = cards.filter({ hasText: `${target.width} × ${target.height}` }).first();
  if (target.displayPrice) await expect(card).toContainText(target.displayPrice);
  const cta = card.getByRole("link", { name: /Start with/ });
  await expect(cta).toHaveAttribute("href", `/create?size=${target.width}x${target.height}`);

  // Following it lands on the size step with that size already selected.
  await cta.click();
  await page.setInputFiles('input[type="file"]', IMG);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Pick your size" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: `${target.width} × ${target.height}` }).first(),
  ).toHaveAttribute("aria-pressed", "true");
});

test("pricing has no horizontal scroll on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/pricing");
  await expect(page.getByTestId("price-card").first()).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
