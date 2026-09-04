import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.describe("the hub", () => {
  test("the season is the headline, the vitals carry live answers, and the modules are one row", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    // one hero reading: points when the season is in, availability when it is not
    const season = page.getByRole("region", { name: /the season/i });
    await expect(season).toContainText(/pts|of \d+/);
    await expect(page.getByRole("region", { name: /next match/i })).toContainText(/\(A\)|\(H\)/i);
    // the watch list is a reading or an honest sentence, never a fabricated number
    await expect(page.getByRole("region", { name: /watch before you pick/i })).toContainText(/red zone|undercooked|pushing it|no training logged|pick on form/i);
    // no jargon on the hub
    await expect(page.locator("main")).not.toContainText(/acwr/i);
    const tiles = page.getByRole("list").filter({ has: page.getByText("// squad", { exact: true }) }).getByRole("link");
    await expect(tiles).toHaveCount(6);
  });

  test("a club with a league feed shows the points line with its pace lines and christmas", async ({ page }) => {
    await page.context().addCookies([{ name: "it.club", value: "belstone", url: "http://localhost:3111" }]);
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/belstone/i);
    const line = page.getByRole("img", { name: /points after each league game/i }).first();
    await expect(line).toBeVisible();
    await expect(line).toContainText(/promotion pace/i);
    await expect(line).toContainText(/christmas/i);
    await expect(page.getByRole("region", { name: /the season/i })).toContainText(/a game/);
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
