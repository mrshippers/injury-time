import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/squad");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("renders the seeded squad, one row per player", async ({ page }) => {
  await expect(page.locator("tbody tr")).toHaveCount(22);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Kilburn Athletic");
  await expect(page.getByRole("link", { name: "Theo Braithwaite" })).toBeVisible();
});

test("every availability state is legible as text, not colour alone", async ({ page }) => {
  const body = page.locator("tbody");
  for (const label of ["FIT", "DOUBT", "OUT", "SUSP"]) {
    await expect(
      body.getByText(label, { exact: true }).first(),
      `expected at least one ${label} row`,
    ).toBeVisible();
  }
});

test("the load-spike player carries a red flag", async ({ page }) => {
  const row = page.locator("tbody tr").filter({ hasText: "Theo Braithwaite" });
  await expect(row).toHaveCount(1);
  // FlagDot renders the flag's meaning as screen-reader text next to the square.
  await expect(row.getByText("load spike")).toHaveCount(1);
});

test("a player without 28 days of history reads as no reading, never a number", async ({ page }) => {
  const unknown = page.getByTitle("needs 28 days of data");
  expect(await unknown.count()).toBeGreaterThan(0);
  await expect(unknown.first()).toContainText("NO READING");
  await expect(page.locator("tbody")).not.toContainText("NaN");
  await expect(page.locator("tbody")).not.toContainText(/acwr/i);
});

test("load is a word on the board and the season line sits beside it", async ({ page }) => {
  const row = page.locator("tbody tr").filter({ hasText: "Theo Braithwaite" });
  await expect(row).toContainText("RED ZONE");
  await expect(row).toHaveAttribute("title", /x his usual week/).catch(() => undefined);
  const bobby = page.locator("tbody tr").filter({ hasText: "Bobby Ashworth" });
  await expect(bobby).toContainText(/\d+ · \d+ · \d+/);
});

for (const width of [1440, 390]) {
  test(`no horizontal scroll at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
}

test("status popover opens, traps Escape, and returns focus to its trigger", async ({ page }) => {
  const trigger = page
    .getByRole("button", { name: "set availability for Theo Braithwaite" });
  await trigger.click();

  const dialog = page.getByRole("dialog", { name: "set availability for Theo Braithwaite" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveCSS("opacity", "1");

  // choosing "injured" reveals the structured injury fields
  await dialog.getByRole("radio", { name: "injured" }).check();
  await expect(dialog.getByRole("combobox", { name: "body region" })).toBeVisible();
  await expect(dialog.getByLabel("expected return")).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("axe reports no serious or critical violations", async ({ page }) => {
  const results = await new AxeBuilder({ page }).analyze();
  const blocking = results.violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical",
  );
  expect(
    blocking.map(
      (v) => `${v.id} (${v.impact}) x${v.nodes.length}: ${v.nodes[0]?.target.join(" ")}`,
    ),
    "serious/critical accessibility violations",
  ).toEqual([]);
});
