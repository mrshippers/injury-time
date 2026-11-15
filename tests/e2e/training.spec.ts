import { expect, test, type Page } from "@playwright/test";

/**
 * Recurring training: the manager sets a weekly night, the night that has
 * passed waits on /log, and one tap confirms it. Runs on the fictional club.
 * Each test sets up its own night on a weekday no other test uses, starting
 * six days back so a night appears once. The demo club has seeded training
 * one and four days ago, then every three or four days back; a logged session
 * covers its night, so those days never show as due and the tests avoid them.
 */
const london = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date());
const shift = (date: string, n: number) => new Date(Date.parse(`${date}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const weekdayName = (date: string) => new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "long" }).format(new Date(`${date}T00:00:00Z`));

async function addNight(page: Page, date: string, from: string) {
  await page.goto("/club");
  const section = page.locator("section", { hasText: "Weekly training nights" });
  await section.getByLabel("day", { exact: true }).selectOption({ label: weekdayName(date) });
  await section.getByLabel("starts", { exact: true }).fill("07:00");
  await section.getByLabel("minutes", { exact: true }).fill("60");
  await section.getByLabel("usual effort", { exact: true }).selectOption("6");
  await section.getByLabel("from", { exact: true }).fill(from);
  await section.getByRole("button", { name: "add night" }).click();
  await expect(section.getByText("training night added")).toBeVisible();
}

test("a night that has passed is confirmed in one tap and stops being asked about", async ({ page }) => {
  const night = shift(london(), -2);
  await addNight(page, night, shift(london(), -6));

  await page.goto("/log");
  const card = page.locator(`[data-night="${night}"]`);
  await expect(card).toContainText(`${weekdayName(night)} 07:00`);
  await expect(card).toContainText(/\d+ players?, effort 6/);

  await card.getByRole("button", { name: "confirm" }).click();
  await expect(page.getByText(/logged: \d+ players?, effort 6/)).toBeVisible();
  await expect(page.locator(`[data-night="${night}"]`)).toHaveCount(0);

  // confirmed once: it does not come back
  await page.reload();
  await expect(page.locator(`[data-night="${night}"]`)).toHaveCount(0);
});

test("a night that was not held is marked and does not count", async ({ page }) => {
  const night = shift(london(), -3);
  await addNight(page, night, shift(london(), -6));

  await page.goto("/log");
  const card = page.locator(`[data-night="${night}"]`);
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: "not held" }).click();
  await expect(page.getByText(/marked as not held/)).toBeVisible();
  await page.reload();
  await expect(page.locator(`[data-night="${night}"]`)).toHaveCount(0);
});

test("edit opens the logger on that night, and saving it confirms the night", async ({ page }) => {
  const night = shift(london(), -6);
  await addNight(page, night, night);

  await page.goto("/log");
  await page.locator(`[data-night="${night}"]`).getByRole("link", { name: "edit" }).click();
  await expect(page).toHaveURL(/\/log\?night=/);
  await expect(page.getByText(`opened on ${weekdayName(night)} 07:00, ${night}`)).toBeVisible();
  // the usual effort is already set for everyone, so the session can be saved as it stands
  await expect(page.getByRole("button", { name: /save session/i })).toBeEnabled();
  await page.getByRole("button", { name: /save session/i }).click();
  await page.waitForURL("**/squad", { timeout: 15_000 });

  await page.goto("/log");
  await expect(page.locator(`[data-night="${night}"]`)).toHaveCount(0);
});

test("the schedule lists the nights and a night can be stopped", async ({ page }) => {
  const night = shift(london(), -5);
  await addNight(page, night, shift(london(), -5));
  const section = page.locator("section", { hasText: "Weekly training nights" });
  const row = section.getByRole("listitem").filter({ hasText: weekdayName(night) }).first();
  await expect(row).toContainText("07:00");
  await expect(row).toContainText("60 min");
  await row.getByRole("button", { name: "stop" }).click();
  await expect(section.getByText("training night stopped")).toBeVisible();
});
