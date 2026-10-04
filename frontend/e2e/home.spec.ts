import { test, expect } from "@playwright/test";

test("hero shows the live 3D scene and the before/after slider moves", async ({ page }) => {
  await page.goto("/");

  // The three.js build replaces the old static hero image.
  await expect(page.locator("main canvas").first()).toBeVisible({ timeout: 15_000 });

  const slider = page.getByRole("slider", { name: "Compare your photo with the mosaic" });
  await slider.scrollIntoViewIfNeeded();
  const photo = page.getByAltText("Original photo");
  await expect(photo).toHaveCSS("clip-path", /inset\(0px 50% 0px 0px\)/);
  await slider.fill("80");
  await expect(photo).toHaveCSS("clip-path", /inset\(0px 20% 0px 0px\)/);
});

test("header Features link scrolls to the features section", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Features" }).click();
  await expect(page.locator("#features")).toBeInViewport();
});

test("mobile layout has no horizontal scroll", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test.describe("dashboard-managed images", () => {
  test.describe.configure({ mode: "serial" });

  // 1×1 PNG.
  const PNG = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  );

  // gallery_1 may hold a real upload on this machine: set it aside for the test
  // and put it back afterwards, whatever happens.
  type Row = NonNullable<Awaited<ReturnType<typeof loadRow>>>;
  let saved: Row | null = null;
  async function loadRow() {
    const { prisma } = await import("@lego/database");
    return prisma.siteImage.findUnique({ where: { slot: "gallery_1" } });
  }

  test.beforeAll(async () => {
    const { prisma } = await import("@lego/database");
    saved = await loadRow();
    await prisma.siteImage.deleteMany({ where: { slot: "gallery_1" } });
  });

  test.afterAll(async () => {
    const { prisma } = await import("@lego/database");
    await prisma.siteImage.deleteMany({ where: { slot: "gallery_1" } });
    if (saved) await prisma.siteImage.create({ data: saved });
    await prisma.$disconnect();
  });

  test("an uploaded image and caption replace the default, and removing it restores the default", async ({ page, request }) => {
    const { prisma } = await import("@lego/database");

    // Default first.
    await page.goto("/");
    await expect(page.getByAltText("Sunset over mountains as a LEGO mosaic")).toHaveAttribute("src", /default-gallery_1/);

    await prisma.siteImage.create({
      data: { slot: "gallery_1", mimeType: "image/png", data: PNG, alt: "Custom alt", title: "My Custom Title", meta: "10 × 10" },
    });

    await page.goto("/");
    const card = page.getByAltText("Custom alt");
    await expect(card).toHaveAttribute("src", /\/api\/site-image\/gallery_1\?v=\d+/);
    await expect(page.getByText("My Custom Title")).toBeVisible();

    const res = await request.get(await card.getAttribute("src") as string);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toBe("image/png");
    expect(Buffer.from(await res.body()).equals(PNG)).toBe(true);
    expect((await request.get("/api/site-image/not_a_slot")).status()).toBe(404);

    await prisma.siteImage.deleteMany({ where: { slot: "gallery_1" } });
    await page.goto("/");
    await expect(page.getByAltText("Sunset over mountains as a LEGO mosaic")).toHaveAttribute("src", /default-gallery_1/);
  });
});
