import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/**
 * Core product constraint: a volunteer manager logs a full session in under
 * 60 seconds, at most two taps per player, no typing. This spec drives that
 * exact flow against the seeded demo squad and WRITES a real session - kind
 * stays 'training' with the default 60' minutes and rpe 5 for every player
 * so it doesn't distort the seeded storylines. Run once, not in a loop.
 */
test("logs a full session in under 60 seconds and hands off to /squad", async ({
  page,
}) => {
  await page.goto("/log");
  await expect(page.getByText("// log a session")).toBeVisible();

  const a11yResults = await new AxeBuilder({ page }).analyze();
  const seriousOrCritical = a11yResults.violations.filter(
    (v) => v.impact === "serious" || v.impact === "critical",
  );
  expect(
    seriousOrCritical,
    JSON.stringify(seriousOrCritical, null, 2),
  ).toEqual([]);

  // Only fit/doubt players (and any injured/suspended player already opted
  // back in) render as an interactive row by default - that's the roster a
  // manager actually taps through on a normal night.
  const rows = page.locator('[data-testid="player-row"]');
  const rowCount = await rows.count();
  const toLog = Math.min(rowCount, 16);
  expect(toLog).toBeGreaterThan(0);

  const tapStart = Date.now();
  for (let i = 0; i < toLog; i++) {
    await rows.nth(i).getByRole("radio", { name: "rpe 5" }).click();
  }
  const tapElapsedMs = Date.now() - tapStart;
  console.log(`tapped rpe for ${toLog} players in ${tapElapsedMs}ms`);
  expect(tapElapsedMs).toBeLessThan(60_000);

  await page.getByRole("button", { name: /save session/i }).click();
  await page.waitForURL("**/squad", { timeout: 15_000 });
  await expect(page).toHaveURL(/\/squad$/);
});
