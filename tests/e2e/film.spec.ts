import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/**
 * The film room runs on Kilburn Athletic's example clips. The guest viewer
 * defaults to Belstone once W1 seeds it, so the spec pins the club cookie.
 */
test.use({ extraHTTPHeaders: {} });

test.beforeEach(async ({ context }) => {
  await context.addCookies([{ name: "it.club", value: "kilburn-athletic", domain: "localhost", path: "/" }]);
});

test.describe("the film room", () => {
  test("lists the club's film with status and event counts, and offers the add form", async ({ page }) => {
    await page.goto("/film");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const list = page.getByRole("region", { name: /film/i }).first();
    await expect(list.getByRole("link").first()).toBeVisible();
    await expect(page.getByText(/\d+ events? tagged/)).toBeVisible();
    await expect(page.getByLabel("link")).toBeVisible();
    await expect(page.getByRole("button", { name: /add to the room/i })).toBeDisabled();
  });

  test("a clip page shows the timeline marks and the tag form", async ({ page }) => {
    await page.goto("/film");
    await page.getByRole("region", { name: /film/i }).first().getByRole("link").first().click();
    await expect(page.getByRole("region", { name: /what happened/i })).toBeVisible();
    await expect(page.getByRole("img", { name: /tagged moments/i })).toBeVisible();
    await expect(page.getByRole("region", { name: /the match room/i })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "time", exact: true })).toBeVisible();
  });

  test("the add form refuses a link it cannot read", async ({ page }) => {
    await page.goto("/film");
    await page.getByLabel("link").fill("https://example.com/not-a-video");
    await expect(page.getByText(/other/)).toBeVisible();
    await page.getByLabel("link").fill("https://www.youtube.com/watch?v=short");
    await expect(page.getByText(/not a link we can read/)).toBeVisible();
    await expect(page.getByRole("button", { name: /add to the room/i })).toBeDisabled();
  });

  for (const width of [1440, 390]) {
    test(`no horizontal scroll at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/film");
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(scrollWidth).toBeLessThanOrEqual(width);
    });
  }

  test("no serious or critical accessibility violations", async ({ page }) => {
    await page.goto("/film");
    const results = await new AxeBuilder({ page }).exclude("iframe").analyze();
    const blocking = results.violations.filter((v) => ["serious", "critical"].includes(v.impact ?? ""));
    expect(blocking.map((v) => `${v.id} (${v.impact}) x${v.nodes.length}`)).toEqual([]);
  });
});
