import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.describe("the hub", () => {
  test("the hub is one screen of stages: the next game first, the season and the squad a swipe away", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    // one screen, no page scroll: the stages scroll sideways instead
    const tall = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
    expect(tall).toBeLessThanOrEqual(1);
    const tabs = page.getByRole("tablist", { name: "hub stages" }).getByRole("tab");
    await expect(tabs.first()).toHaveText(/next game/i);
    await expect(page.getByRole("region", { name: /next match/i })).toContainText(/\(A\)|\(H\)/i);
    await page.getByRole("tab", { name: "season" }).click();
    await expect(page.getByRole("group", { name: /: season$/ })).toContainText(/pts|of \d+/);
    await page.getByRole("tab", { name: "squad" }).click();
    // the watch list is a reading or an honest sentence, never a fabricated number
    await expect(page.getByRole("region", { name: /watch before you pick/i })).toContainText(/red zone|undercooked|pushing it|no training logged|pick on form/i);
    await expect(page.locator("main")).not.toContainText(/acwr/i);
  });

  test("a club with a league feed shows the points line with its pace lines and christmas", async ({ page }) => {
    await page.context().addCookies([{ name: "it.club", value: "belstone", url: "http://localhost:3111" }]);
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/belstone/i);
    await page.getByRole("tab", { name: "season" }).click();
    const line = page.getByRole("img", { name: /points after each league game/i }).first();
    await expect(line).toBeVisible();
    await expect(line).toContainText(/promotion pace/i);
    await expect(line).toContainText(/christmas/i);
    await expect(page.getByRole("group", { name: /: season$/ })).toContainText(/a game/);
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
