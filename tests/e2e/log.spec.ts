import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/**
 * Core product constraint: a volunteer manager logs a full session in under
 * 60 seconds. With a session-wide default that is ONE tap for everyone plus
 * save. This spec drives that flow against the seeded demo squad and WRITES
 * a real training session (rpe 5, 60') so it doesn't distort the storylines.
 */
test("one tap logs everyone, an exception is two more, and it hands off to /squad", async ({ page }) => {
  await page.goto("/log");
  await expect(page.getByText("// log a session")).toBeVisible();

  const a11y = await new AxeBuilder({ page }).analyze();
  const blocking = a11y.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);

  const rows = page.locator('[data-testid="player-row"]');
  const rowCount = await rows.count();
  expect(rowCount).toBeGreaterThan(10);

  // nothing is logged until an effort exists
  await expect(page.getByRole("button", { name: /save session/i })).toBeDisabled();

  const tapStart = Date.now();
  await page.getByRole("radiogroup", { name: "effort for everyone" }).getByRole("radio", { name: "rpe 5" }).click();
  // every included row now inherits 5 / 60'
  await expect(rows.first().locator("[data-inherits='1']")).toContainText("5");
  await expect(page.getByRole("button", { name: /save session/i })).toBeEnabled();

  // one exception: open a row, pick a different effort, it turns mint and stops inheriting
  await rows.nth(2).getByRole("button", { name: /tap to change/ }).click();
  await rows.nth(2).getByRole("radio", { name: "rpe 7" }).click();
  await expect(rows.nth(2).locator("[data-inherits='0']")).toContainText("7");
  console.log(`default + one exception in ${Date.now() - tapStart}ms`);
  expect(Date.now() - tapStart).toBeLessThan(60_000);

  await page.getByRole("button", { name: /save session/i }).click();
  await page.waitForURL("**/squad", { timeout: 15_000 });
  await expect(page).toHaveURL(/\/squad$/);
});

test("a match session exposes goals and assists on the row", async ({ page }) => {
  await page.goto("/log");
  await page.getByRole("button", { name: "match", exact: true }).click();
  const rows = page.locator('[data-testid="player-row"]');
  await expect(rows.first().getByRole("button", { name: /goals: 0/ })).toBeVisible();
  await rows.first().getByRole("button", { name: /goals: 0/ }).click();
  await expect(rows.first().getByRole("button", { name: /goals: 1/ })).toBeVisible();
  // minutes default follows the kind: 90 for a match
  await expect(rows.first()).toContainText("90'");
});
