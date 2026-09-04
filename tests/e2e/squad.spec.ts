import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/**
 * The squad list half of the room. Club-agnostic: a guest may land on
 * Belstone (real season, no medical data) or the demo club, so every spec
 * reads what is on the page rather than assuming a name.
 */
test.beforeEach(async ({ page }) => {
  await page.goto("/squad");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("renders the squad, one row per player, with a count line", async ({ page }) => {
  const rows = page.locator("tbody tr[data-player]");
  const n = await rows.count();
  expect(n).toBeGreaterThanOrEqual(11);
  await expect(page.getByText(new RegExp(`${n} in the squad`))).toBeVisible();
  const onPitch = await page.locator("tbody tr[data-on-pitch]").count();
  expect(onPitch).toBeGreaterThanOrEqual(9);
  await expect(page.getByText(new RegExp(`${onPitch} on the pitch`))).toBeVisible();
});

test("every availability state on the board is legible as text, not colour alone", async ({ page }) => {
  const body = page.locator("tbody");
  await expect(body.getByText("FIT", { exact: true }).first()).toBeVisible();
  await expect(body).not.toContainText("NaN");
  await expect(body).not.toContainText(/acwr/i);
});

test("a player without four weeks of data reads as no reading, never a number", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const unknown = page.getByTitle("needs 28 days of data");
  if ((await unknown.count()) === 0) test.skip(true, "everyone has a reading");
  await expect(unknown.first()).toContainText("NO READING");
});

test("columns sort and the header says which way", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const name = page.getByRole("columnheader", { name: /^name/ });
  await expect(page.getByRole("columnheader", { name: /^#/ })).toHaveAttribute("aria-sort", "ascending");
  await name.getByRole("button").click();
  await expect(name).toHaveAttribute("aria-sort", "ascending");
  const first = await page.locator("tbody tr[data-player] th a").first().textContent();
  await name.getByRole("button").click();
  await expect(name).toHaveAttribute("aria-sort", "descending");
  const last = await page.locator("tbody tr[data-player] th a").first().textContent();
  expect(first).not.toEqual(last);
});

test("filters narrow the list and the count follows", async ({ page }) => {
  const all = await page.locator("tbody tr[data-player]").count();
  // filter on a position that exists on this board
  const positions = await page.locator("tbody tr[data-player]").evaluateAll((trs) =>
    trs.map((tr) => (tr.querySelectorAll("td")[1]?.textContent ?? "").trim()).filter((p) => /^(GK|DF|MF|FW)$/.test(p)),
  );
  const pick = ["GK", "DF", "MF", "FW"].find((p) => positions.includes(p) && positions.filter((x) => x === p).length < positions.length) ?? positions[0] ?? "MF";
  await page.getByRole("group", { name: "position" }).getByRole("button", { name: pick }).click();
  const some = await page.locator("tbody tr[data-player]").count();
  expect(some).toBeGreaterThanOrEqual(1);
  expect(some).toBeLessThanOrEqual(all);
  if (some < all) await expect(page.getByText(new RegExp(`${some} of ${all}`))).toBeVisible();
  await page.getByRole("group", { name: "position" }).getByRole("button", { name: "all" }).click();
  const firstName = (await page.locator("tbody tr[data-player] th a").first().textContent())!.trim();
  await page.getByRole("searchbox", { name: /search the squad/i }).fill(firstName.split(" ")[0]);
  await expect(page.locator("tbody tr[data-player]").first()).toContainText(firstName);
  expect(await page.locator("tbody tr[data-player]").count()).toBeLessThan(all);
});

for (const width of [1440, 390]) {
  test(`no horizontal scroll at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(500);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
}

test("status popover opens, traps Escape, and returns focus to its trigger", async ({ page }) => {
  const name = (await page.locator("tbody tr[data-player] th a").first().textContent())!.trim();
  const trigger = page.getByRole("button", { name: `set availability for ${name}` });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: `set availability for ${name}` });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("radio", { name: "injured" }).check();
  await expect(dialog.getByRole("combobox", { name: "body region" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("a manager can open the add-player form and an edit row", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole("button", { name: "add a player" }).click();
  await expect(page.getByRole("form", { name: "add a player" })).toBeVisible();
  await page.getByRole("button", { name: "close" }).click();
  const name = (await page.locator("tbody tr[data-player] th a").first().textContent())!.trim();
  await page.getByRole("button", { name: `edit ${name}` }).click();
  const form = page.getByRole("form", { name: `edit ${name}` });
  await expect(form).toBeVisible();
  await expect(form.getByRole("button", { name: "retire" })).toBeVisible();
  await form.getByRole("button", { name: "cancel" }).click();
  await expect(form).toBeHidden();
});

test("axe reports no serious or critical violations", async ({ page }) => {
  const results = await new AxeBuilder({ page }).exclude("canvas").analyze();
  const blocking = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(
    blocking.map((v) => `${v.id} (${v.impact}) x${v.nodes.length}: ${v.nodes[0]?.target.join(" ")}`),
    "serious/critical accessibility violations",
  ).toEqual([]);
});
