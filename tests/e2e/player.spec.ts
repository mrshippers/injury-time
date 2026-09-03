import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * Player ids are database UUIDs and change on every reseed, so the spec never
 * hardcodes one: it resolves the link from the squad board, the same way a
 * manager gets here.
 */
async function gotoPlayer(page: Page, name: string): Promise<void> {
  await page.goto("/squad");
  const link = page.getByRole("link", { name, exact: true });
  await expect(link, `${name} should be on the squad board`).toBeVisible();
  await link.click();
  // `.display` lowercases with CSS, so the accessible name keeps its capitals.
  await expect(page.getByRole("heading", { level: 1, name, exact: true })).toBeVisible();
}

test.describe("player profile", () => {
  test("a live injury is listed as current, on the right side, and the figure turns to show it", async ({ page }) => {
    await gotoPlayer(page, "Bobby Ashworth");

    // Bobby's live injury: right hamstring. One chip, marked current.
    const chip = page.locator('[data-region="hamstring"][data-side="right"]');
    await expect(chip).toHaveCount(1);
    await expect(chip).toHaveAttribute("data-step", "current");
    await expect(chip).toContainText("hamstring");
    await expect(chip).toContainText("moderate");
    await expect(chip).toContainText(/out → \d{2} \w{3} \d{2}/);

    // the other hamstring carries nothing
    await expect(page.locator('[data-region="hamstring"][data-side="left"]')).toHaveCount(0);

    // a hamstring is on the back: choosing it turns the figure round
    const figure = page.getByTestId("body-figure");
    await expect(figure).toHaveAttribute("data-facing", "front");
    await chip.click();
    await expect(figure).toHaveAttribute("data-facing", "back");
    await expect(page.getByRole("button", { name: "back" })).toHaveAttribute("aria-pressed", "true");

    // the history row for a live injury is marked ongoing
    await expect(page.getByRole("row", { name: /hamstring/ })).toContainText("ongoing");
  });

  test("resolved injuries tint their regions by days out, and nothing is live", async ({ page }) => {
    await gotoPlayer(page, "Theo Braithwaite");

    // two resolved injuries, both on his left: a 21-day hamstring and a 7-day calf
    const tinted = page.locator('[data-live="1"]');
    await expect(tinted).toHaveCount(2);
    await expect(page.locator('[data-region="hamstring"][data-side="left"]')).toHaveAttribute("data-step", "2");
    await expect(page.locator('[data-region="calf"][data-side="left"]')).toHaveAttribute("data-step", "1");
    await expect(page.locator('[data-step="current"]')).toHaveCount(0);
  });

  test("hovering an injured region opens its tooltip on the figure", async ({ page }) => {
    await gotoPlayer(page, "Theo Braithwaite");
    await page.locator('[data-region="hamstring"][data-side="left"]').hover();
    const tooltip = page.getByRole("tooltip");
    await expect(tooltip).toBeVisible({ timeout: 15_000 });
    await expect(tooltip).toContainText("hamstring");
    await expect(tooltip).toContainText("minor");
    await expect(tooltip).toContainText("21 days");
  });

  test("load is a word with a reason, and the ratio is a footnote", async ({ page }) => {
    await gotoPlayer(page, "Theo Braithwaite");
    const card = page.getByRole("region", { name: /load this week/i });
    await expect(card).toContainText(/red zone/i);
    await expect(card).toContainText("big jump on his usual load");
    // the week reads as sessions and a phrase; the ratio survives only in the title, never a fabricated 1.00
    await expect(card).toContainText(/\d sessions? this week · (well )?(over|under|about) his usual week/);
    await expect(card.locator("[title]")).toHaveAttribute("title", /\d\.\d{2}x his usual week/);
    await expect(card).not.toContainText("\u2014");
    // a season line off the match log
    const season = page.getByRole("region", { name: /this season/i });
    await expect(season).toContainText("apps");
    await expect(season.locator(".num").first()).toHaveText(/^\d+$/);
  });

  test("no serious or critical accessibility violations", async ({ page }) => {
    await gotoPlayer(page, "Bobby Ashworth");
    const results = await new AxeBuilder({ page }).exclude("canvas").analyze();
    const blocking = results.violations.filter((v) => ["serious", "critical"].includes(v.impact ?? ""));
    expect(blocking.map((v) => `${v.id} (${v.impact}) x${v.nodes.length}`)).toEqual([]);
  });
});
