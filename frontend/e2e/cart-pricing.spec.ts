import { test, expect } from "@playwright/test";
import { join } from "node:path";

/**
 * Cart money is stored, not derived at render time: `/api/cart/items` reprices
 * the cart inside the mutation's transaction and writes `carts.subtotal` /
 * `carts.total` plus a `cart_extra_charges` snapshot, and the cart page renders
 * straight off those rows.
 *
 * This drives the real flow (generate → add to cart → cart page → remove) and
 * checks the two ends agree: what the reprice returned is what a fresh server
 * render of /cart shows, before and after a reload. A regression to summing in
 * the component would still pass on the first render, so the reload — a render
 * that can only come from the database — is the assertion that matters.
 *
 * Requires the mosaic-generator service on :8002, like mosaic-quality.spec.ts.
 */

const IMAGES = join(__dirname, "..", "..", "mosaic-generator", "test_images");

/** Same formatting the order summary uses (millimes → "800 TND"). */
function formatMillimes(millimes: number): string {
  return `${(millimes / 1000).toLocaleString("en-US", { maximumFractionDigits: 3 })} TND`;
}

test("cart totals are persisted server-side and survive a reload", async ({ page }) => {
  test.setTimeout(120_000);

  await page.goto("/create");
  await page.setInputFiles('input[type="file"]', join(IMAGES, "21.jpg"));
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Pick your size" })).toBeVisible();
  await page.getByRole("button", { name: "48 × 48" }).first().click();

  await page.getByRole("button", { name: "Generate mosaic" }).click();
  await expect(page.getByRole("heading", { name: "Your LEGO mosaic is ready" })).toBeVisible({
    timeout: 90_000,
  });

  // The add response carries the freshly stored totals — the reference every
  // assertion below compares against. Its body is read from inside the event
  // handler: waiting until after the click's follow-up work has settled loses
  // it ("no data found for resource").
  let addBody: Promise<{ subtotal: number; chargesTotal: number; total: number }> | null = null;
  page.on("response", (r) => {
    if (r.url().includes("/api/cart/items") && r.request().method() === "POST") {
      addBody = r.json();
    }
  });
  await page.getByRole("button", { name: "Add to Cart" }).click();
  await expect(page.getByRole("button", { name: "Remove from Cart" })).toBeVisible();
  expect(addBody, "the add-to-cart request should have been made").not.toBeNull();
  const totals = await addBody!;

  expect(totals.subtotal, "a catalog-size artwork should be priced").toBeGreaterThan(0);
  expect(totals.total).toBe(totals.subtotal + totals.chargesTotal);

  await page.goto("/cart");
  const subtotal = page.getByTestId("cart-subtotal");
  const total = page.getByTestId("cart-total");
  await expect(subtotal).toHaveText(formatMillimes(totals.subtotal));
  await expect(total).toHaveText(formatMillimes(totals.total));

  // Every enabled extra charge was snapshotted onto the cart, so the summary
  // lists them from that snapshot rather than from live pricing config.
  const chargeCount = await page.getByTestId("cart-charge").count();
  if (totals.chargesTotal > 0) {
    expect(chargeCount, "charges in the total should be itemized").toBeGreaterThan(0);
  }

  await page.reload();
  await expect(page.getByTestId("cart-subtotal")).toHaveText(formatMillimes(totals.subtotal));
  await expect(page.getByTestId("cart-total")).toHaveText(formatMillimes(totals.total));
  await expect(page.getByTestId("cart-charge")).toHaveCount(chargeCount);

  await page.getByRole("button", { name: "Remove" }).click();
  await expect(page.getByRole("heading", { name: "Your cart is empty" })).toBeVisible();

  // Emptying the cart has to zero the stored total too — otherwise the row is
  // left owing the extra charges and nothing else.
  await page.goto("/cart");
  await expect(page.getByRole("heading", { name: "Your cart is empty" })).toBeVisible();
});
