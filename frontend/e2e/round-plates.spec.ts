import { test, expect } from "@playwright/test";
import { join } from "node:path";

const IMAGES = join(__dirname, "..", "..", "mosaic-generator", "test_images");

// A canned 4x4 all-white mosaic built from round 1x1 plates (4073). /api/convert
// is mocked, so this checks the rendering only — no generator needed.
const WHITE: [number, number, number] = [255, 255, 255];

function roundResult(shape: "round" | undefined) {
  const placements = Array.from({ length: 16 }, (_, i) => ({
    part_id: "4073",
    part_name: "1x1 Round Plate",
    color_id: 1,
    rgb: WHITE,
    row: Math.floor(i / 4),
    col: i % 4,
    brick_width: 1,
    brick_height: 1,
    ...(shape ? { shape } : {}),
  }));
  return {
    job_id: "round-test",
    artworkId: "round-test",
    width: 4,
    height: 4,
    grid: Array.from({ length: 4 }, () => [1, 1, 1, 1]),
    placements,
    parts_list: [
      { part_id: "4073", part_name: "1x1 Round Plate", color_id: 1, color_name: "White", rgb: WHITE, quantity: 16 },
    ],
    total_parts: 16,
    bags: [],
  };
}

/** RGB of the framed-print canvas at a fraction of one cell, in cell (0, 0). */
async function pixelInFirstCell(page: import("@playwright/test").Page, fx: number, fy: number) {
  return page.getByTestId("mosaic-canvas").evaluate(
    (el, [x, y]) => {
      const canvas = el as HTMLCanvasElement;
      const cell = canvas.width / 4;
      const d = canvas.getContext("2d")!.getImageData(Math.floor(cell * x), Math.floor(cell * y), 1, 1).data;
      return [d[0], d[1], d[2]];
    },
    [fx, fy]
  );
}

for (const [label, shape] of [
  ["shape from the generator", "round"],
  ["older artwork, part id only", undefined],
] as const) {
  test(`round plates render as discs on the base (${label})`, async ({ page }) => {
    await page.route("**/api/convert", (route) => route.fulfill({ json: roundResult(shape) }));

    await page.goto("/create");
    await page.setInputFiles('input[type="file"]', join(IMAGES, "21.jpg"));
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: "Generate mosaic" }).click();
    await expect(page.getByRole("heading", { name: "Your LEGO mosaic is ready" })).toBeVisible();
    await expect(page.getByTestId("mosaic-canvas")).toBeVisible();

    // Center of a plate: the plate color. Corner of the cell: the dark base
    // showing between round plates (a square plate would be white here too).
    expect(await pixelInFirstCell(page, 0.5, 0.5)).toEqual([255, 255, 255]);
    const corner = await pixelInFirstCell(page, 0.03, 0.03);
    expect(Math.max(...corner)).toBeLessThan(40);
  });
}
