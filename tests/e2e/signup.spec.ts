import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * Sign-up in a minute, end to end, through the real magic link. Runs only
 * against the local stack (scripts/stack/up.sh), whose SMTP catcher hands the
 * test the email: it creates clubs and users, which must never land on the
 * live project.
 */
const SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const LOCAL_STACK = /^http:\/\/(localhost|127\.0\.0\.1):/.test(SUPABASE);
test.skip(!LOCAL_STACK, "needs the local stack (scripts/stack/up.sh): this test creates clubs and users");

const SQUAD_20 = [
  "1 Danny Flynn GK", "2 Oscar Lane RB", "3 Sam Hughes LB", "4 Jack Kimber CB", "5 James Kimber CB",
  "6 Tom O'Brien DM", "7 Jordan Mcnally CM", "8 Ryan Patel CM", "9 Kushan Thomaj ST", "10 Marcus de Souza CAM",
  "11 Hodje Joaquim LW", "12 Nathan Cole", "14 Josh Wright", "16 Ben Ward MF", "17 Callum Price FW",
  "18 Ellis Grant ST", "19 Liam McCarthy MF", "21 Frankie Yeo Jnr DM", "22 Ty Reid RW", "23 Kai Bennett GK",
];

async function magicLink(email: string): Promise<string> {
  for (let i = 0; i < 40; i += 1) {
    const res = await fetch(`${SUPABASE}/__mail?to=${encodeURIComponent(email)}`);
    if (res.ok) {
      const { body } = (await res.json()) as { body: string };
      const href = /href="([^"]+)"/.exec(body)?.[1];
      if (href) return href.replace(/&amp;/g, "&");
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`no magic link arrived for ${email}`);
}

async function signIn(page: Page, email: string, form: { field: RegExp; button: RegExp }) {
  await page.getByLabel(form.field).fill(email);
  await page.getByRole("button", { name: form.button }).click();
  await expect(page.getByRole("status")).toContainText(email);
  await page.goto(await magicLink(email));
}

async function noBlockingAxe(page: Page, where: string) {
  const results = await new AxeBuilder({ page }).analyze();
  const blocking = results.violations.filter((v) => ["serious", "critical"].includes(v.impact ?? ""));
  expect(blocking.map((v) => `${where}: ${v.id} (${v.impact}) x${v.nodes.length}`)).toEqual([]);
}

test.describe("sign-up in a minute", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("a manager signs a club up, pastes 20 players and lands on the hub inside 60 s and 6 screens", async ({ page }) => {
    const stamp = Date.now().toString(36);
    const email = `gaffer-${stamp}@probe.test`;
    const club = `Probe Town ${stamp}`;
    let screens = 0;
    const t0 = Date.now();

    await page.goto("/start");
    screens += 1; // 1: your email
    await expect(page.getByRole("heading", { level: 1 })).toContainText("your club, in a minute");
    await noBlockingAxe(page, "start/email");
    await signIn(page, email, { field: /your email/i, button: /send me a sign-in link/i });

    await expect(page).toHaveURL(/\/start$/);
    screens += 1; // 2: the club
    await expect(page.getByText(`signed in as ${email}`)).toBeVisible();
    await noBlockingAxe(page, "start/club");
    await page.getByLabel(/club name/i).fill(club);
    await page.getByLabel(/league/i).fill("Combined Counties League");
    await page.getByLabel(/adult side/i).check();
    await page.getByRole("button", { name: /make the club/i }).click();

    screens += 1; // 3: the squad
    await expect(page.getByRole("heading", { name: new RegExp(`${club}: paste the squad`) })).toBeVisible();
    await page.getByLabel(/the squad/i).fill(SQUAD_20.join("\n"));
    await expect(page.getByText("20 players read")).toBeVisible();
    await noBlockingAxe(page, "start/squad");
    await page.getByRole("button", { name: /add 20 players/i }).click();

    screens += 1; // 4: next
    await expect(page.getByRole("status")).toContainText("20 players in.");
    await page.getByRole("link", { name: /to the club hub/i }).click();

    screens += 1; // 5: the hub, as this club
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator("body")).toContainText(club);
    const seconds = (Date.now() - t0) / 1000;
    console.log(`sign-up: ${seconds.toFixed(1)} s, ${screens} screens, at 390 x 844`);
    expect(seconds).toBeLessThanOrEqual(60);
    expect(screens).toBeLessThanOrEqual(6);

    // the squad is really there, read back through the API as that manager would see it
    await page.goto("/squad");
    await expect(page.locator("body")).toContainText("Kushan Thomaj");
    await expect(page.locator("body")).toContainText("Frankie Yeo Jnr");
  });

  test("a manager invites a coach; the coach joins as coach and nothing more", async ({ browser }) => {
    const stamp = Date.now().toString(36);
    const gaffer = await browser.newPage();
    await gaffer.goto("/start");
    await signIn(gaffer, `gaffer2-${stamp}@probe.test`, { field: /your email/i, button: /send me a sign-in link/i });
    await gaffer.getByLabel(/club name/i).fill(`Invite Town ${stamp}`);
    await gaffer.getByLabel(/league/i).fill("Hellenic League");
    await gaffer.getByLabel(/adult side/i).check();
    await gaffer.getByRole("button", { name: /make the club/i }).click();
    await gaffer.getByRole("button", { name: /skip for now/i }).click();

    await gaffer.goto("/club");
    await gaffer.getByRole("button", { name: /invite a coach/i }).click();
    const url = (await gaffer.getByRole("status").filter({ hasText: "/join/" }).locator("p.num").textContent())!.trim();
    expect(url).toMatch(/\/join\/[0-9a-f-]{36}$/);

    // a different person, a different browser
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const coach = await ctx.newPage();
    await coach.goto(url);
    await expect(coach.getByRole("heading", { level: 1 })).toContainText("join as coach");
    await signIn(coach, `coach-${stamp}@probe.test`, { field: /your email/i, button: /send me a sign-in link/i });
    await expect(coach).toHaveURL(/\/join\//);
    await coach.getByRole("button", { name: /join as coach/i }).click();
    await expect(coach).toHaveURL(/\/$/);
    await expect(coach.locator("body")).toContainText(`Invite Town ${stamp}`);

    // the link is spent
    const again = await ctx.newPage();
    await again.goto(url);
    await expect(again.locator("main")).toContainText("has been used or has run out");

    await gaffer.reload();
    await expect(gaffer.getByRole("list", { name: "staff invites" })).toContainText("joined");
    await ctx.close();
  });
});
