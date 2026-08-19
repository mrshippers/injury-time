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
  await expect(
    page.getByRole("heading", { level: 1, name, exact: true }),
  ).toBeVisible();
}

test.describe("player profile", () => {
  test("current injury pulses on the body map and is called out", async ({
    page,
  }) => {
    await gotoPlayer(page, "Bobby Ashworth");

    // Bobby's live injury: right hamstring. Hamstrings only exist on the back
    // figure, and on a back view his right side is the viewer's right.
    const current = page.locator(
      '[data-view="back"][data-region="hamstring"][data-side="right"]',
    );
    await expect(current).toHaveCount(1);
    await expect(current).toHaveAttribute("data-step", "current");
    await expect(current).toHaveClass(/im-pulse/);

    // ...and the other hamstring is untouched.
    await expect(
      page.locator(
        '[data-view="back"][data-region="hamstring"][data-side="left"]',
      ),
    ).toHaveAttribute("data-step", "0");

    // A hamstring must never be drawn on the front figure.
    await expect(
      page.locator('[data-view="front"][data-region="hamstring"]'),
    ).toHaveCount(0);

    // The callout chip names the region, the severity and the return date.
    const chip = page.locator('[data-callout="chip"]');
    await expect(chip).toHaveCount(1);
    await expect(chip).toContainText("hamstring");
    await expect(chip).toContainText("moderate");
    await expect(chip).toContainText(/out → \d{2} \w{3} \d{2}/);

    // The history row for a live injury is marked ongoing.
    await expect(page.getByRole("row", { name: /hamstring/ })).toContainText(
      "ongoing",
    );
  });

  test("resolved injuries tint their regions, unhurt regions stay clear", async ({
    page,
  }) => {
    await gotoPlayer(page, "Theo Braithwaite");

    // Two resolved injuries, both on his left: a 21-day hamstring and a 7-day
    // calf. Longer time out means a stronger tint, so they must differ.
    const tinted = page.locator('[data-live="1"]');
    await expect(tinted).toHaveCount(2);

    await expect(
      page.locator(
        '[data-view="back"][data-region="hamstring"][data-side="left"]',
      ),
    ).toHaveAttribute("data-step", "2");
    await expect(
      page.locator('[data-view="back"][data-region="calf"][data-side="left"]'),
    ).toHaveAttribute("data-step", "1");

    // Nothing is currently pulsing: he is fit.
    await expect(page.locator(".im-pulse")).toHaveCount(0);
  });

  test("hovering a tinted region opens its injury tooltip", async ({ page }) => {
    await gotoPlayer(page, "Theo Braithwaite");

    await page
      .locator('[data-view="back"][data-region="hamstring"][data-side="left"]')
      .hover();

    const tooltip = page.getByRole("tooltip");
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toContainText("hamstring");
    await expect(tooltip).toContainText("minor");
    await expect(tooltip).toContainText("21 days");
  });

  test("the acwr tile shows a real ratio when there is enough history", async ({
    page,
  }) => {
    await gotoPlayer(page, "Theo Braithwaite");

    const tile = page
      .locator("div", { has: page.getByText("// acwr", { exact: true }) })
      .last();
    // A real ratio, never a fabricated one - and never the "no reading" glyph,
    // which is what `insufficient_data` renders instead of a sentinel number.
    const value = tile.locator(".num").first();
    await expect(value).toHaveText(/^\d+\.\d{2}$/);
    await expect(value).not.toHaveText("\u2014");
  });

  test("no serious or critical accessibility violations", async ({ page }) => {
    await gotoPlayer(page, "Bobby Ashworth");

    const results = await new AxeBuilder({ page }).analyze();
    const blocking = results.violations.filter((v) =>
      ["serious", "critical"].includes(v.impact ?? ""),
    );
    expect(
      blocking.map((v) => `${v.id} (${v.impact}) x${v.nodes.length}`),
    ).toEqual([]);
  });
});
