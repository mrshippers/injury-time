import { expect, test } from "@playwright/test";

/** Every context starts on the fictional club; nothing a test writes may land on Belstone. */
const KILBURN = {
  cookies: [{ name: "it.club", value: "kilburn-athletic", domain: "localhost", path: "/", expires: -1, httpOnly: false, secure: false, sameSite: "Lax" as const }],
  origins: [],
};

/**
 * The team page on two phones at once. A call made on one lands on the other
 * without a reload; a notice posted on one lands at the top of the other.
 * Runs against the public demo club, where a guest may call for anyone.
 */
test.describe("the team page", () => {
  test("a call made in one browser appears in another without a reload", async ({ browser }) => {
    const a = await browser.newContext({ storageState: KILBURN });
    const b = await browser.newContext({ storageState: KILBURN });
    const pageA = await a.newPage();
    const pageB = await b.newPage();
    await pageA.goto("/team");
    await pageB.goto("/team");

    const rowsA = pageA.getByTestId("call-row");
    await expect(rowsA.first()).toBeVisible();
    // pick a row that is not already "unsure", so the change is observable
    const count = await rowsA.count();
    let idx = -1;
    for (let i = 0; i < count; i += 1) {
      if ((await rowsA.nth(i).getAttribute("data-status")) !== "unsure") {
        idx = i;
        break;
      }
    }
    expect(idx).toBeGreaterThanOrEqual(0);
    const playerId = await rowsA.nth(idx).getAttribute("data-player");
    await expect(pageB.locator(`[data-player="${playerId}"]`)).not.toHaveAttribute("data-status", "unsure");

    // wait a beat for the socket to be up on B before writing on A
    await pageB.waitForTimeout(1200);
    await rowsA.nth(idx).getByRole("radio", { name: "unsure" }).click();
    await expect(rowsA.nth(idx)).toHaveAttribute("data-status", "unsure");

    // B never reloads; the row changes by itself
    await expect(pageB.locator(`[data-player="${playerId}"]`)).toHaveAttribute("data-status", "unsure", { timeout: 8000 });
    await expect(pageB.getByTestId("count-line")).toContainText("unsure");

    // put it back so the demo reads the same next time
    await rowsA.nth(idx).getByRole("radio", { name: "in" }).click();
    await expect(pageB.locator(`[data-player="${playerId}"]`)).toHaveAttribute("data-status", "in", { timeout: 8000 });

    await a.close();
    await b.close();
  });

  test("a notice posted in one browser lands at the top of another", async ({ browser }) => {
    const a = await browser.newContext({ storageState: KILBURN });
    const b = await browser.newContext({ storageState: KILBURN });
    const pageA = await a.newPage();
    const pageB = await b.newPage();
    await pageA.goto("/team");
    await pageB.goto("/team");
    await pageB.waitForTimeout(1200);

    const title = `e2e notice ${Date.now()}`;
    await pageA.getByRole("button", { name: "post" }).click();
    await pageA.getByLabel("title").fill(title);
    await pageA.getByRole("button", { name: "post to squad" }).click();
    await expect(pageA.getByTestId("notice").first()).toContainText(title);
    await expect(pageB.getByTestId("notice").first()).toContainText(title, { timeout: 8000 });
    await expect(pageB.getByRole("status")).toContainText("new notice");

    await a.close();
    await b.close();
  });

  test("the call is a radio group and the page fits a phone", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/team");
    await expect(page.getByRole("radiogroup").first()).toBeVisible();
    const wide = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(wide).toBe(false);
  });
});
