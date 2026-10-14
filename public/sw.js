// injury time. service worker: shows a push, opens the page it points at.
// No caching: the app is live data, a stale squad is worse than no squad.
//
// A match call carries a token signed for one player (lib/push/call-token.ts).
// Its notification gets answer buttons; a press posts the answer from here, no
// window opened, and the notification is replaced with what was saved.
// Chrome allows two buttons (Notification.maxActions is 2, found by
// tests/sw/lockscreen.spec.ts), so there it is in and out, and "unsure" is a
// tap on the body, which opens the team page. iPhone Safari shows no buttons
// at all: a tap opens the team page, as before.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

const ANSWERS = ["in", "out", "unsure"];
const maxButtons = () => (self.Notification && Notification.maxActions) || 0;

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "injury time.", body: event.data ? event.data.text() : "" };
  }
  const url = typeof data.url === "string" && data.url.startsWith("/") ? data.url : "/";
  const token = data.call && typeof data.call.token === "string" ? data.call.token : null;
  const buttons = token ? ANSWERS.slice(0, maxButtons()) : [];
  // say what the buttons can do, and what they cannot
  const body = !token || buttons.length === 3 ? data.body || ""
    : buttons.length ? `${buttons.join(" or ")} from here. not sure? tap to open the app`
    : "tap to say in, out or unsure";
  event.waitUntil(
    self.registration.showNotification(data.title || "injury time.", {
      body,
      icon: "/icons/icon-192.png",
      badge: "/icons/badge-96.png",
      tag: data.tag,
      data: { url, token, title: data.title || "" },
      ...(buttons.length ? { actions: buttons.map((a) => ({ action: a, title: a })), requireInteraction: true } : {}),
    }),
  );
});

function openPage(url) {
  const href = new URL(url || "/", self.location.origin).href;
  return self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
    for (const w of wins) {
      if (w.url === href && "focus" in w) return w.focus();
    }
    return self.clients.openWindow(href);
  });
}

async function answer(notification, status) {
  const { token, url, title } = notification.data || {};
  try {
    const res = await fetch("/api/call", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, status }),
      credentials: "omit",
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok || !out.ok) throw new Error(out.reason || `status ${res.status}`);
    // the same tag replaces the question with the answer
    await self.registration.showNotification(status === "in" ? "you're in" : status === "out" ? "you're out" : "marked unsure", {
      body: `for ${out.opponent}. change it on the team page any time.`,
      icon: "/icons/icon-192.png",
      badge: "/icons/badge-96.png",
      tag: notification.tag,
      data: { url },
    });
  } catch (e) {
    await self.registration.showNotification(title || "injury time.", {
      body: `that did not save (${e.message}). tap to answer in the app.`,
      icon: "/icons/icon-192.png",
      badge: "/icons/badge-96.png",
      tag: notification.tag,
      data: { url },
    });
  }
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  if (data.token && ANSWERS.includes(event.action)) {
    event.waitUntil(answer(event.notification, event.action));
    return;
  }
  event.waitUntil(openPage(data.url));
});
