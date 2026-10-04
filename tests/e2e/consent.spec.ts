import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * Health data, lawful before live (0014), through the real UI: on a club that
 * signed up for real, a doubt cannot be recorded until the player consents
 * from their own link; then it can; then the player deletes it all. Local
 * stack only (scripts/stack/up.sh): it creates clubs and users.
 */
const SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
test.skip(!/^http:\/\/(localhost|127\.0\.0\.1):/.test(SUPABASE), "needs the local stack (scripts/stack/up.sh)");

async function signUp(page: Page, stamp: string) {
  const email = `consent-${stamp}@probe.test`;
  await page.goto("/start");
  await page.getByLabel(/your email/i).fill(email);
  await page.getByRole("button", { name: /send me a sign-in link/i }).click();
  await expect(page.getByRole("status")).toContainText(email);
  let link = "";
  for (let i = 0; i < 40 && !link; i += 1) {
    const res = await fetch(`${SUPABASE}/__mail?to=${encodeURIComponent(email)}`);
    if (res.ok) link = (/href="([^"]+)"/.exec(((await res.json()) as { body: string }).body)?.[1] ?? "").replace(/&amp;/g, "&");
    else await new Promise((r) => setTimeout(r, 250));
  }
  await page.goto(link);
  await page.getByLabel(/club name/i).fill(`Consent FC ${stamp}`);
  await page.getByLabel(/league/i).fill("Wessex League");
  await page.getByLabel(/adult side/i).check();
  await page.getByRole("button", { name: /make the club/i }).click();
  await page.getByLabel(/the squad/i).fill("7 Sam Self MF\n9 Tom Mate FW");
  await page.getByRole("button", { name: /add 2 players/i }).click();
  await expect(page.getByRole("status")).toContainText("2 players in.");
}

async function markDoubt(page: Page, name: string) {
  await page.goto("/squad");
  await page.getByRole("button", { name: `set availability for ${name}` }).first().click();
  const sheet = page.getByRole("dialog", { name: `set availability for ${name}` });
  await sheet.getByRole("radio", { name: "doubt" }).check();
  await sheet.getByRole("button", { name: "save" }).click();
  return sheet;
}

test("no consent, no doubt; consent from the player's link, then it saves; then the player deletes it all", async ({ page, browser }) => {
  const stamp = Date.now().toString(36);
  await signUp(page, stamp);

  // 1. the manager tries; the database refuses; the manager is told what to do
  const sheet = await markDoubt(page, "Sam Self");
  // the panel closes as the write goes and comes back only on a refusal; the first action on a cold dev server compiles first
  await expect(sheet.getByRole("alert")).toContainText("has not given consent for health data yet", { timeout: 20_000 });

  // 2. the manager fetches the player's consent link from the player's page
  await page.goto("/squad");
  await page.getByRole("link", { name: "Sam Self" }).first().click();
  await expect(page.getByText("Sam has not consented yet")).toBeVisible();
  await page.getByRole("button", { name: "Sam's consent link" }).click();
  const url = (await page.getByRole("status").filter({ hasText: "/consent/" }).locator("span.num").textContent())!.trim();

  // 3. the player, no account, a phone
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const player = await phone.newPage();
  await player.goto(url);
  await expect(player.getByRole("heading", { level: 1 })).toContainText("sam");
  await expect(player.getByText("Only medical staff and you can read them")).toBeVisible();
  const axe = await new AxeBuilder({ page: player }).analyze();
  expect(axe.violations.filter((v) => ["serious", "critical"].includes(v.impact ?? "")).map((v) => v.id)).toEqual([]);
  // under 18 is refused by the database, whatever the form allows
  await player.getByLabel(/your date of birth/i).fill("1995-04-01");
  await player.getByRole("button", { name: "I agree" }).click();
  await expect(player.getByRole("status").first()).toContainText("You have given consent");

  // 4. now the doubt saves
  const again = await markDoubt(page, "Sam Self");
  await expect(again).toBeHidden({ timeout: 10_000 });
  await page.goto("/squad");
  await page.getByRole("link", { name: "Sam Self" }).first().click();
  await expect(page.getByText(/Sam consented \d{4}-\d{2}-\d{2} \(wording v1\)/)).toBeVisible();

  // 5. the player deletes everything from the same link
  await player.reload();
  await player.getByRole("button", { name: "delete my health data" }).click();
  await player.getByRole("button", { name: "yes, delete it all" }).click();
  await expect(player.getByRole("status").last()).toContainText(/Deleted: [1-9]\d* records?\. Consent withdrawn\./);

  // 6. and the manager can no longer record a doubt
  const after = await markDoubt(page, "Sam Self");
  await expect(after.getByRole("alert")).toContainText("has not given consent", { timeout: 20_000 });
  await phone.close();
});
