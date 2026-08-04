import { test, expect } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Drives the real create flow end to end for the images that used to render
 * badly (flat pink, near-white, washed-out skin) and captures what the
 * customer actually sees.
 *
 * Screenshots and a summary land in `mosaic-generator/tests_result/e2e/` and
 * are kept, not asserted away: the point is a durable visual record to compare
 * pipeline changes against. The assertions here only guard the things a
 * machine can judge — that generation succeeded, that the canvas has real
 * pixels, and that the mosaic isn't a single flat color (the "white studio
 * photo renders as one slab of lavender" failure).
 *
 * Requires the mosaic-generator service on :8002 and MOSAIC_SERVICE=
 * mosaic-generator in frontend/.env.
 */

const OUT = join(__dirname, "..", "..", "mosaic-generator", "tests_result", "e2e");
const IMAGES = join(__dirname, "..", "..", "mosaic-generator", "test_images");

/** Studs per side. 48x48 is the smallest enabled catalog size. */
const SIZE = 48;

const CASES = [
  { file: "21.jpg", slug: "21-flat-pink-with-text" },
  { file: "album drake.jpeg", slug: "drake-washed-skin" },
  { file: "wed.jpg", slug: "wed-near-white" },
];

test.beforeAll(() => mkdirSync(OUT, { recursive: true }));

for (const { file, slug } of CASES) {
  test(`create flow renders a usable mosaic for ${file}`, async ({ page }) => {
    test.setTimeout(120_000);

    await page.goto("/create");
    await page.setInputFiles('input[type="file"]', join(IMAGES, file));

    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByRole("heading", { name: "Pick your size" })).toBeVisible();

    // Pick a real catalog size. The step defaults to the smallest allowed
    // dimensions, and 16x16 is too coarse to tell a good mosaic from a bad one
    // — every pipeline change looks identical at 256 studs.
    await page.getByRole("button", { name: `${SIZE} × ${SIZE}` }).first().click();

    // Read the generation result off the wire. The page never prints the piece
    // count as text, and the API response is the authoritative number anyway.
    const convertResponse = page.waitForResponse(
      (r) => r.url().includes("/api/convert") && r.request().method() === "POST"
    );
    await page.getByRole("button", { name: "Generate mosaic" }).click();
    const payload = await (await convertResponse).json();
    await expect(
      page.getByRole("heading", { name: "Your LEGO mosaic is ready" })
    ).toBeVisible({ timeout: 90_000 });

    // The before/after slider's base layer is the one plain 2D render of the
    // mosaic on this page — the 3D scene is WebGL (getImageData is unavailable)
    // and the mockups composite the mosaic into a photo, which would pollute
    // any color measurement.
    const canvas = page.getByTestId("mosaic-canvas");
    await expect(canvas).toBeVisible();

    // Measure the pixels, so a regression to "one flat slab" fails the test
    // instead of quietly producing a pretty screenshot. Sampled on a stride:
    // the canvas is ~900px wide and every 4th pixel is plenty to characterise
    // a mosaic of at most a few dozen flat colors.
    const stats = await canvas.evaluate((el) => {
      const c = el as HTMLCanvasElement;
      const ctx = c.getContext("2d");
      if (!ctx) return null;
      const { data } = ctx.getImageData(0, 0, c.width, c.height);
      const counts = new Map<string, number>();
      let opaque = 0;
      const stride = 4 * 4; // every 4th pixel
      for (let i = 0; i < data.length; i += stride) {
        if (data[i + 3] < 128) continue;
        opaque++;
        const key = `${data[i] >> 3},${data[i + 1] >> 3},${data[i + 2] >> 3}`;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
      if (!counts.size) return null;
      return {
        distinct: counts.size,
        dominantShare: Math.max(...counts.values()) / opaque,
        opaque,
      };
    });

    expect(stats, "a readable 2D mosaic canvas should exist").not.toBeNull();
    // A mosaic built from one or two colors is the failure mode we fixed.
    expect(stats!.distinct, "mosaic should use several colors").toBeGreaterThan(4);
    expect(
      stats!.dominantShare,
      "no single color should swamp the whole mosaic"
    ).toBeLessThan(0.9);

    const ones = (payload.placements ?? []).filter(
      (p: { brick_width: number; brick_height: number }) =>
        p.brick_width === 1 && p.brick_height === 1
    ).length;

    // One file per case: these specs run in parallel workers, and a shared
    // afterAll would have each worker overwrite the others' results.
    writeFileSync(
      join(OUT, `${slug}.json`),
      JSON.stringify(
        {
          slug,
          source: file,
          size: `${payload.width}x${payload.height}`,
          totalParts: payload.total_parts ?? null,
          pct1x1: payload.total_parts ? Math.round((1000 * ones) / payload.total_parts) / 10 : null,
          distinctBrickColors: new Set(
            (payload.parts_list ?? []).map((p: { color_id: number }) => p.color_id)
          ).size,
          canvasDistinctColors: stats!.distinct,
          canvasDominantSharePct: Math.round(stats!.dominantShare * 1000) / 10,
        },
        null,
        2
      )
    );

    await canvas.screenshot({ path: join(OUT, `${slug}-mosaic.png`) });
    await page.screenshot({ path: join(OUT, `${slug}-result-page.png`), fullPage: true });
  });
}
