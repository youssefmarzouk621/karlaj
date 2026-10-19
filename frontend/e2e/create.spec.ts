import { test, expect } from "@playwright/test";
import { join } from "node:path";

const IMAGES = join(__dirname, "..", "..", "mosaic-generator", "test_images");

test("upload step rejects a file that isn't JPEG or PNG", async ({ page }) => {
  await page.goto("/create");
  await page.setInputFiles('input[type="file"]', {
    name: "notes.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("not an image"),
  });
  // (Next's route announcer is also role=alert, so match on the message.)
  await expect(page.getByRole("alert").filter({ hasText: "isn't a JPEG or PNG" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue" })).toBeDisabled();
});

// Needs the mosaic-generator service on :8002, like the other generation specs.
test("create flow: size step, cancel while generating, result tabs", async ({ page }) => {
  test.setTimeout(150_000);

  await page.goto("/create");
  await page.setInputFiles('input[type="file"]', join(IMAGES, "21.jpg"));
  await expect(page.getByText("good resolution")).toBeVisible();
  await expect(page.getByText("Photo ready")).toBeVisible();

  // The ready state is still a dropzone: a second file replaces the first.
  await page.setInputFiles('input[type="file"]', join(IMAGES, "wed.jpg"));
  await expect(page.getByText("wed.jpg")).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();

  // Picking a size updates the selection and the summary.
  await expect(page.getByRole("heading", { name: "Pick your size" })).toBeVisible();
  const card = page.getByRole("button", { name: "48 × 48" }).first();
  await card.click();
  await expect(card).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("2,304")).toBeVisible();

  // The "in your space" panel follows the size: a drawn room where there's no
  // photo mockup, and the real framed-photo mockup where there is one.
  await expect(page.getByRole("img", { name: /living room setting/i })).toBeVisible();
  await page.getByRole("button", { name: "64 × 64" }).first().click();
  await expect(page.getByAltText(/framed in a living room setting/i)).toBeVisible();
  await card.click();

  // Cancelling mid-generation returns to the size step, no error shown.
  await page.getByRole("button", { name: "Generate mosaic" }).click();
  await expect(page.getByRole("heading", { name: "Building your mosaic…" })).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("heading", { name: "Pick your size" })).toBeVisible();
  await expect(page.getByText(/Something went wrong|Server error/)).toHaveCount(0);

  // Generate for real and walk the result tabs.
  await page.getByRole("button", { name: "Generate mosaic" }).click();
  await expect(page.getByRole("heading", { name: "Your LEGO mosaic is ready" })).toBeVisible({
    timeout: 90_000,
  });
  await expect(page.getByRole("tab", { name: "Framed print" })).toHaveAttribute("aria-selected", "true");
  await page.getByRole("tab", { name: "Before / after" }).click();
  await expect(page.getByRole("slider", { name: "Compare original photo and LEGO mosaic" })).toBeVisible();

  // Parts list collapses to the top colors until expanded.
  const rows = page.getByTestId("parts-row");
  await expect(rows).toHaveCount(8);
  await page.getByRole("button", { name: /Show all \d+ colors/ }).click();
  expect(await rows.count()).toBeGreaterThan(8);
});

test("a failed generation shows a meaningful message, not a status code", async ({ page }) => {
  await page.goto("/create");
  await page.setInputFiles('input[type="file"]', join(IMAGES, "21.jpg"));
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "48 × 48" }).first().click();

  // A bare 500 with no message of its own.
  await page.route("**/api/convert", (route) =>
    route.fulfill({ status: 500, contentType: "text/html", body: "<h1>oops</h1>" }),
  );
  await page.getByRole("button", { name: "Generate mosaic" }).click();
  await expect(page.getByText("Something went wrong on our side")).toBeVisible();
  await expect(page.getByText(/Server error/)).toHaveCount(0);

  // The message the API sends when the mosaic builder is down is shown as-is.
  await page.unroute("**/api/convert");
  await page.route("**/api/convert", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "Our mosaic builder is temporarily unavailable. Please try again in a few minutes." }),
    }),
  );
  await page.getByRole("button", { name: "Generate mosaic" }).click();
  await expect(page.getByText("temporarily unavailable")).toBeVisible();

  // Network failure.
  await page.unroute("**/api/convert");
  await page.route("**/api/convert", (route) => route.abort("failed"));
  await page.getByRole("button", { name: "Generate mosaic" }).click();
  await expect(page.getByText("couldn't reach the server")).toBeVisible();
});

test("the size step recommends sizes matching the photo's shape and keeps the rest", async ({ page }) => {
  await page.goto("/create");

  // Portrait photo (672×1000): portrait sizes are recommended, the least-
  // cropping one (80×128 crops ~7%) preselected; every size shows its crop.
  await page.setInputFiles('input[type="file"]', join(IMAGES, "21.jpg"));
  await expect(page.getByText("Photo ready")).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Pick your size" })).toBeVisible();
  const recommended = page.getByRole("group", { name: "Recommended for your photo" });
  const other = page.getByRole("group", { name: "Other sizes" });
  const tall = recommended.getByRole("button", { name: /80 × 128/ });
  await expect(tall).toHaveAttribute("aria-pressed", "true");
  await expect(tall.getByTestId("crop-badge")).toHaveText("Crops 7%");
  await expect(recommended.getByRole("button", { name: /48 × 96/ }).getByTestId("crop-badge")).toHaveText(
    "Crops 26%",
  );
  // Square sizes aren't hidden — they're under "Other sizes", still selectable.
  const square48 = other.getByRole("button", { name: /48 × 48/ });
  await expect(square48.getByTestId("crop-badge")).toHaveText("Crops 33%");
  await square48.click();
  await expect(square48).toHaveAttribute("aria-pressed", "true");

  // Square photo: square sizes recommended (using the whole photo), the
  // portrait ones moved to "Other sizes".
  await page.getByRole("button", { name: "Back" }).click();
  await page.setInputFiles('input[type="file"]', join(IMAGES, "album drake.jpeg"));
  await expect(page.getByText("album drake.jpeg")).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(recommended.getByRole("button", { name: /48 × 48/ }).getByTestId("crop-badge")).toHaveText(
    "Full photo",
  );
  await expect(other.getByRole("button", { name: /80 × 128/ })).toBeVisible();
  await expect(recommended.getByRole("button", { name: /80 × 128/ })).toHaveCount(0);
});

test("dragging the photo in the crop preview sets the crop sent to the generator", async ({ page }) => {
  const sent: Record<string, string>[] = [];
  await page.route("**/api/convert", async (route) => {
    const body = route.request().postDataBuffer()?.toString("latin1") ?? "";
    const field = (name: string) => body.match(new RegExp(`name="${name}"\\r\\n\\r\\n([^\\r]*)`))?.[1] ?? "";
    sent.push({ crop_x: field("crop_x"), crop_y: field("crop_y") });
    await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "stop here" }) });
  });

  await page.goto("/create");
  // The GTA cover (0.90) is wider than 80×128 (0.625): the crop slides sideways.
  await page.setInputFiles('input[type="file"]', join(IMAGES, "gta6.jpg"));
  await expect(page.getByText("Photo ready")).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: /80 × 128/ }).first().click();

  // Untouched: centered.
  await page.getByRole("button", { name: "Generate mosaic" }).click();
  await expect.poll(() => sent.length).toBe(1);
  expect(sent[0]).toEqual({ crop_x: "0.5", crop_y: "0.5" });

  // Drag the photo to the right: the window moves toward the photo's left edge.
  const box = await page.getByTestId("crop-box").boundingBox();
  if (!box) throw new Error("crop box not rendered");
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 40, cy, { steps: 5 });
  await page.mouse.up();

  await page.getByRole("button", { name: "Generate mosaic" }).click();
  await expect.poll(() => sent.length).toBe(2);
  expect(Number(sent[1].crop_x)).toBeLessThan(0.5);
  expect(sent[1].crop_y).toBe("0.5");
});
