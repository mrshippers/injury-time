import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.describe("the hub", () => {
  test("every module tile carries a live answer, and the next match is on the page", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Kilburn Athletic");
    await expect(page.getByText(/\d+ of \d+ available/)).toBeVisible();
    await expect(page.getByRole("region", { name: /next match/i })).toContainText(/\(A\)|\(H\)/);
    await expect(page.getByRole("region", { name: /watch before you pick/i })).toContainText(/red zone/i);
    // no jargon on the hub
    await expect(page.locator("main")).not.toContainText(/acwr/i);
    const tiles = page.getByRole("list").filter({ has: page.getByText("// squad room") }).getByRole("link");
    await expect(tiles).toHaveCount(6);
  });

  for (const width of [1440, 390]) {
    test(`no horizontal scroll at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/");
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }

  test("no serious or critical accessibility violations", async ({ page }) => {
    await page.goto("/");
    const results = await new AxeBuilder({ page }).analyze();
    const blocking = results.violations.filter((v) => ["serious", "critical"].includes(v.impact ?? ""));
    expect(blocking.map((v) => `${v.id} (${v.impact}) x${v.nodes.length}`)).toEqual([]);
  });
});
