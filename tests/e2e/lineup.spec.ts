import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.describe("lineup", () => {
  test("auto-picks a full eleven from the fit players and never the injured", async ({ page }) => {
    await page.goto("/lineup");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const xi = page.getByRole("region", { name: /the eleven/i }).getByRole("listitem");
    await expect(xi).toHaveCount(11);
    await expect(page.getByRole("region", { name: /the eleven/i })).not.toContainText("Bobby Ashworth");
    await expect(page.getByRole("region", { name: /not available/i })).toContainText("Bobby Ashworth");
    await expect(page.getByRole("region", { name: /not available/i })).toContainText("Kofi Asante");
    // a keeper in the keeper slot
    await expect(xi.first()).toContainText("GK");
    await expect(xi.first()).toContainText("Marcus Oyelaran");
  });

  test("changing formation re-picks and is remembered", async ({ page }) => {
    await page.goto("/lineup");
    await page.getByRole("button", { name: "4-3-3" }).click();
    const xi = page.getByRole("region", { name: /the eleven/i }).getByRole("listitem");
    await expect(xi.filter({ hasText: /^FW/ })).toHaveCount(3);
    await page.reload();
    await expect(page.getByRole("button", { name: "4-3-3" })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "4-4-2" }).click();
  });

  test("a slot can be swapped with a bench player", async ({ page }) => {
    await page.goto("/lineup");
    const xiList = page.getByRole("region", { name: /the eleven/i });
    const firstDF = xiList.getByRole("button").filter({ hasText: /^DF/ }).first();
    const before = await firstDF.textContent();
    await firstDF.click();
    await expect(page.getByText("now pick who goes there")).toBeVisible();
    const benchRegion = page.getByRole("region", { name: /bench/i });
    const sub = benchRegion.getByRole("button").first();
    const subName = (await sub.textContent()) ?? "";
    await sub.click();
    await expect(firstDF).not.toHaveText(before ?? "");
    await expect(page.getByRole("region", { name: /bench/i })).not.toContainText(subName.replace(/^\w+\s*\d+/, "").trim().slice(0, 8) || "zzz");
  });

  test("the 3D pitch mounts and no serious accessibility violations", async ({ page }) => {
    await page.goto("/lineup");
    await expect(page.getByTestId("pitch").locator("canvas")).toBeVisible({ timeout: 20_000 });
    const results = await new AxeBuilder({ page }).exclude("canvas").analyze();
    const blocking = results.violations.filter((v) => ["serious", "critical"].includes(v.impact ?? ""));
    expect(blocking.map((v) => `${v.id} (${v.impact}) x${v.nodes.length}`)).toEqual([]);
  });
});
