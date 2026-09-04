import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * The side lives in the squad room now. These specs do not assume which club
 * a guest lands on (Belstone or the demo), so they read names off the page.
 */
async function open(page: Page) {
  await page.goto("/squad");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByTestId("pitch").locator("canvas")).toBeVisible({ timeout: 20_000 });
}

const xiItems = (page: Page) => page.getByRole("region", { name: /the eleven/i }).getByRole("listitem");

test.describe("the side", () => {
  test("/lineup goes to the squad room", async ({ page }) => {
    await page.goto("/lineup");
    await expect(page).toHaveURL(/\/squad$/);
  });

  test("the shape is a dropdown of real templates, most common first, and is remembered", async ({ page }) => {
    await open(page);
    const shape = page.getByRole("combobox", { name: /shape/i });
    const options = await shape.locator("option").allTextContents();
    expect(options[0]).toMatch(/^4-2-3-1/);
    expect(options).toHaveLength(12);
    await shape.selectOption("3-5-2");
    await expect(xiItems(page)).toHaveCount(11);
    await expect(xiItems(page).filter({ hasText: /^DF/ })).toHaveCount(3);
    // a side saved for the fixture outranks the browser's memory, so save it if we can
    const save = page.getByRole("button", { name: /save for/ });
    if ((await save.count()) > 0) {
      await save.click();
      await expect(page.getByRole("button", { name: "saved" })).toBeVisible({ timeout: 15_000 });
    }
    await page.reload();
    await expect(page.getByRole("combobox", { name: /shape/i })).toHaveValue("3-5-2");
    await page.getByRole("combobox", { name: /shape/i }).selectOption("4-2-3-1");
    const saveBack = page.getByRole("button", { name: /save for/ });
    if ((await saveBack.count()) > 0) {
      await saveBack.click();
      await expect(page.getByRole("button", { name: "saved" })).toBeVisible({ timeout: 15_000 });
    }
  });

  test("a name then a slot puts him in; the old occupant goes back to the list", async ({ page }) => {
    await open(page);
    // a fit player who is not on the pitch
    const spare = page.locator('tbody tr:not([data-on-pitch])').filter({ hasText: "FIT" }).first();
    await expect(spare).toBeVisible();
    const spareName = (await spare.locator("th a").textContent())!.trim();
    await spare.getByRole("button", { name: `select ${spareName}` }).click();
    await expect(page.getByText("now pick the slot he goes in")).toBeVisible();
    const slot = xiItems(page).nth(5).getByRole("button").first();
    const before = (await slot.textContent()) ?? "";
    await slot.click();
    await expect(xiItems(page).nth(5)).toContainText(spareName);
    await expect(xiItems(page).nth(5)).not.toHaveText(before);
    await expect(page.locator(`tbody tr[data-on-pitch]`).filter({ hasText: spareName })).toHaveCount(1);
  });

  test("a slot then another slot swaps them", async ({ page }) => {
    await open(page);
    const a = xiItems(page).nth(1).getByRole("button").first();
    const b = xiItems(page).nth(2).getByRole("button").first();
    const aText = (await a.textContent()) ?? "";
    const bText = (await b.textContent()) ?? "";
    await a.click();
    await expect(page.getByText("now pick a name, or another slot to swap")).toBeVisible();
    await b.click();
    await expect(a).toHaveText(bText);
    await expect(b).toHaveText(aText);
  });

  test("dragging a name from the list onto a shirt on the pitch places him there", async ({ page }) => {
    await open(page);
    const spare = page.locator('tbody tr:not([data-on-pitch])').filter({ hasText: "FIT" }).first();
    const spareName = (await spare.locator("th a").textContent())!.trim();
    const handle = spare.getByRole("button", { name: `select ${spareName}` });
    // a filled slot: its surname label sits on the token
    const filled = xiItems(page).filter({ hasNot: page.getByText("empty", { exact: true }) }).first();
    const filledName = ((await filled.locator("span.min-w-0").evaluate((el) => el.childNodes[0]?.textContent ?? "")) as string).trim();
    const role = (await filled.locator("span").first().textContent())!.trim();
    const surname = filledName.split(" ").at(-1)!;
    const target = page.getByTestId("pitch").getByText(surname, { exact: true }).first();
    await expect(target).toBeVisible();
    const from = (await handle.boundingBox())!;
    const to = (await target.boundingBox())!;
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(from.x + 40, from.y + 10, { steps: 4 });
    await expect(page.getByTestId("pitch")).toHaveAttribute("data-drag", "list");
    await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2 + 8, { steps: 18 });
    await expect(page.getByText(new RegExp(`drop him at ${role}`))).toBeVisible();
    await page.mouse.up();
    await expect(filled).toContainText(spareName);
  });

  test("take him out, then pick for me fills the gap without touching the rest", async ({ page }) => {
    await open(page);
    const status = page.locator('p[aria-live="polite"].num');
    const texts = await xiItems(page).allTextContents();
    const filledIdx = texts.map((t, i) => (t.includes("empty") ? -1 : i)).filter((i) => i >= 0);
    const filledBefore = filledIdx.length;
    const third = xiItems(page).nth(filledIdx[2]);
    const thirdName = (await third.getByRole("button").first().textContent()) ?? "";
    const fourth = xiItems(page).nth(filledIdx[3]);
    const fourthName = (await fourth.getByRole("button").first().textContent()) ?? "";
    await third.getByRole("button", { name: /take .* out of the eleven/ }).click();
    await expect(third).toContainText("empty");
    await expect(status).toContainText(`${filledBefore - 1} of 11`);
    await page.getByRole("button", { name: "pick for me" }).click();
    await expect(third).not.toContainText("empty");
    await expect(third).not.toHaveText(thirdName);
    await expect(fourth.getByRole("button").first()).toHaveText(fourthName);
  });

  test("the side saves for the next fixture and comes back saved", async ({ page }) => {
    await open(page);
    const save = page.getByRole("button", { name: /save for|saved/ });
    if ((await save.count()) === 0) test.skip(true, "no fixture in the diary");
    const a = xiItems(page).nth(1).getByRole("button").first();
    const b = xiItems(page).nth(2).getByRole("button").first();
    await a.click();
    await b.click();
    await expect(save).toHaveText(/save for/);
    await save.click();
    await expect(save).toHaveText("saved", { timeout: 15_000 });
    await page.reload();
    await expect(page.getByTestId("pitch").locator("canvas")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("button", { name: "saved" })).toBeVisible();
  });

  test("the pitch mounts and no serious accessibility violations", async ({ page }) => {
    await open(page);
    const results = await new AxeBuilder({ page }).exclude("canvas").analyze();
    const blocking = results.violations.filter((v) => ["serious", "critical"].includes(v.impact ?? ""));
    expect(blocking.map((v) => `${v.id} (${v.impact}) x${v.nodes.length}: ${v.nodes[0]?.target.join(" ")}`)).toEqual([]);
  });
});
