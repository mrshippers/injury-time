import { expect, test } from "@playwright/test";

// worker-scope types for the code that runs inside sw.evaluate (the DOM lib has none of them)
type ServiceWorkerGlobalScope = { registration: ServiceWorkerRegistration; clients: unknown };
declare const NotificationEvent: {
  new (type: string, init: { notification: Notification; action: string }): Event & { waitUntil(p: Promise<unknown>): void };
};

/**
 * Answering from the lock screen, in a real Chromium: the push handler builds
 * the notification with buttons, a press of "in" posts the signed token to
 * /api/call without opening a window, and the notification becomes the answer.
 * The worker is driven directly (showNotification + a NotificationEvent in its
 * own scope), so this measures the worker, not the OS notification shade.
 */
test("a press of 'in' on the notification answers the call, no window opened", async ({ context, page }) => {
  await context.grantPermissions(["notifications"]);
  const posted: { token: string; status: string }[] = [];
  await context.route("**/api/call", async (route) => {
    posted.push(JSON.parse(route.request().postData() ?? "{}"));
    await route.fulfill({ json: { ok: true, status: "in", opponent: "Hendon" } });
  });

  await page.goto("/");
  await page.evaluate(async () => {
    await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
  });
  const sw = context.serviceWorkers()[0] ?? (await context.waitForEvent("serviceworker"));
  const pagesBefore = context.pages().length;

  const t0 = Date.now();
  const result = await sw.evaluate(async () => {
    const reg = (self as unknown as ServiceWorkerGlobalScope).registration;
    // what the push handler does with a call payload
    const payload = { title: "are you in for Hendon?", body: "answer here: in, out or unsure", url: "/team", tag: "call:f1", call: { token: "signed.token" } };
    const pushEvent = new Event("push") as Event & { data: { json(): unknown }; waitUntil(p: Promise<unknown>): void };
    const waits: Promise<unknown>[] = [];
    pushEvent.data = { json: () => payload } as never;
    pushEvent.waitUntil = (p) => void waits.push(p);
    self.dispatchEvent(pushEvent);
    await Promise.all(waits);
    const [shown] = await reg.getNotifications({ tag: "call:f1" });
    const actions = (shown as Notification & { actions: { action: string }[] }).actions.map((a) => a.action);
    const shownBody = shown.body;
    const max = (Notification as unknown as { maxActions: number }).maxActions;

    // the press
    const click = new NotificationEvent("notificationclick", { notification: shown, action: "in" });
    const clickWaits: Promise<unknown>[] = [];
    click.waitUntil = (p: Promise<unknown>) => void clickWaits.push(p);
    self.dispatchEvent(click);
    await Promise.all(clickWaits);
    const [after] = await reg.getNotifications({ tag: "call:f1" });
    return { actions, max, shownBody, title: after?.title, body: after?.body };
  });
  const ms = Date.now() - t0;

  // as many answers as the browser has buttons for; Chrome has two
  console.log(`Notification.maxActions = ${result.max}; buttons shown: ${result.actions.join(", ")}`);
  expect(result.actions).toEqual(["in", "out", "unsure"].slice(0, result.max));
  if (result.max === 2) expect(result.shownBody).toBe("in or out from here. not sure? tap to open the app");
  expect(posted).toEqual([{ token: "signed.token", status: "in" }]);
  expect(result.title).toBe("you're in");
  expect(result.body).toContain("Hendon");
  expect(context.pages().length).toBe(pagesBefore);
  console.log(`push -> buttons -> press -> answer shown: ${ms} ms in the worker`);
  expect(ms).toBeLessThan(3000);
});

test("a tap on the body (or an iPhone, which shows no buttons) opens the team page", async ({ context, page }) => {
  await context.grantPermissions(["notifications"]);
  let posts = 0;
  await context.route("**/api/call", (route) => {
    posts += 1;
    return route.fulfill({ json: { ok: true } });
  });
  await page.goto("/");
  await page.evaluate(async () => {
    await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
  });
  const sw = context.serviceWorkers()[0] ?? (await context.waitForEvent("serviceworker"));
  // a synthetic click carries no user gesture, so Chrome refuses openWindow; record where the worker goes instead
  const went = await sw.evaluate(async () => {
    const scope = self as unknown as ServiceWorkerGlobalScope;
    const reg = scope.registration;
    const opened: string[] = [];
    (scope.clients as unknown as { openWindow: (u: string) => Promise<null> }).openWindow = async (u: string) => (opened.push(u), null);
    await reg.showNotification("are you in for Hendon?", { tag: "call:f2", data: { url: "/team", token: "signed.token" } });
    const [shown] = await reg.getNotifications({ tag: "call:f2" });
    const click = new NotificationEvent("notificationclick", { notification: shown, action: "" });
    const waits: Promise<unknown>[] = [];
    click.waitUntil = (p: Promise<unknown>) => void waits.push(p);
    self.dispatchEvent(click);
    await Promise.all(waits);
    return opened;
  });
  expect(went.map((u) => new URL(u).pathname)).toEqual(["/team"]);
  expect(posts).toBe(0);
});

test("a refused answer says so and points back to the app, rather than pretending", async ({ context, page }) => {
  await context.grantPermissions(["notifications"]);
  await context.route("**/api/call", (route) => route.fulfill({ status: 409, json: { ok: false, reason: "that match has been played" } }));
  await page.goto("/");
  await page.evaluate(async () => {
    await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
  });
  const sw = context.serviceWorkers()[0] ?? (await context.waitForEvent("serviceworker"));
  const body = await sw.evaluate(async () => {
    const reg = (self as unknown as ServiceWorkerGlobalScope).registration;
    await reg.showNotification("are you in for Old Boys?", { tag: "call:f3", data: { url: "/team", token: "signed.token", title: "are you in for Old Boys?" } });
    const [shown] = await reg.getNotifications({ tag: "call:f3" });
    const click = new NotificationEvent("notificationclick", { notification: shown, action: "out" });
    const waits: Promise<unknown>[] = [];
    click.waitUntil = (p: Promise<unknown>) => void waits.push(p);
    self.dispatchEvent(click);
    await Promise.all(waits);
    const [after] = await reg.getNotifications({ tag: "call:f3" });
    return after?.body;
  });
  expect(body).toContain("did not save (that match has been played)");
});
