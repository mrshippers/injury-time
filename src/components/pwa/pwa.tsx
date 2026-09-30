"use client";

/**
 * The app on the home screen: the service worker, the nudge to install it, and
 * the switch for notifications. iPhone only allows push once the app is on the
 * home screen, so the switch says that rather than failing quietly.
 */
import { usePathname } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";

import { removeSubscriptionAction, saveSubscriptionAction } from "@/lib/push/actions";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
const DISMISS_KEY = "it.install.dismissed";
const GHOST =
  "pressable h-10 rounded-[2px] border border-line-strong px-3 text-[12px] font-semibold uppercase tracking-[0.1em] text-ink-dim hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint disabled:opacity-50";
const PRIMARY =
  "pressable h-10 rounded-[2px] bg-mint px-4 text-[12px] font-bold uppercase tracking-[0.12em] text-mint-ink disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mint";

const noop = () => () => {};
const isStandalone = () =>
  typeof window !== "undefined" && (window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true);
const isIOS = () => typeof navigator !== "undefined" && /iPad|iPhone|iPod/.test(navigator.userAgent);
const pushSupported = () => typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

function b64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** Registers /sw.js once per load. No caching in it: live data only. */
export function ServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {});
  }, []);
  return null;
}

/** On a phone, not yet installed: the one-line nudge. Android gets a button, iPhone gets the two taps. */
export function InstallNudge() {
  const pathname = usePathname() ?? "/";
  const standalone = useSyncExternalStore(noop, isStandalone, () => true);
  const ios = useSyncExternalStore(noop, isIOS, () => false);
  const [evt, setEvt] = useState<InstallEvent | null>(null);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    let d = false;
    try {
      d = localStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      d = false;
    }
    const raf = requestAnimationFrame(() => setDismissed(d));
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvt(e as InstallEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("beforeinstallprompt", onPrompt);
    };
  }, []);

  if (standalone || dismissed || (!evt && !ios)) return null;
  if (pathname.startsWith("/login") || pathname.startsWith("/auth") || pathname.startsWith("/checkin") || pathname.startsWith("/claim")) return null;
  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {}
    setDismissed(true);
  };

  return (
    <aside
      aria-label="put injury time on your home screen"
      className="fixed inset-x-3 z-40 border border-line-strong bg-panel p-4 shadow-[0_18px_40px_rgba(0,0,0,0.5)] sm:hidden"
      style={{ bottom: "calc(4rem + env(safe-area-inset-bottom))" }}
    >
      <p className="text-[14px] text-ink">On your home screen, like an app. Match calls land as notifications.</p>
      {ios ? (
        <p className="mt-2 text-[13px] text-ink-dim">
          Tap <span className="text-ink">Share</span>, then <span className="text-ink">Add to Home Screen</span>.
        </p>
      ) : null}
      <div className="mt-3 flex gap-2">
        {evt ? (
          <button
            type="button"
            className={PRIMARY}
            onClick={async () => {
              await evt.prompt();
              await evt.userChoice.catch(() => null);
              setEvt(null);
            }}
          >
            add it
          </button>
        ) : null}
        <button type="button" className={GHOST} onClick={dismiss}>
          not now
        </button>
      </div>
    </aside>
  );
}

type NotifyState = "checking" | "unsupported" | "install-first" | "blocked" | "off" | "on";

/** The switch. Needs a signed-in member of a real club; the page decides whether to show it. */
export function NotifyToggle() {
  const [state, setState] = useState<NotifyState>("checking");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let next: NotifyState;
      if (!pushSupported()) next = isIOS() && !isStandalone() ? "install-first" : "unsupported";
      else if (Notification.permission === "denied") next = "blocked";
      else {
        const reg = await navigator.serviceWorker.ready;
        next = (await reg.pushManager.getSubscription()) ? "on" : "off";
      }
      if (!cancelled) setState(next);
    })().catch(() => !cancelled && setState("unsupported"));
    return () => {
      cancelled = true;
    };
  }, []);

  const turnOn = async () => {
    setBusy(true);
    setError(null);
    try {
      const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!key) throw new Error("notifications aren't set up on this server yet");
      if ((await Notification.requestPermission()) !== "granted") {
        setState("blocked");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(key) }));
      const r = await saveSubscriptionAction(JSON.parse(JSON.stringify(sub)));
      if (!r.ok) {
        await sub.unsubscribe().catch(() => {});
        throw new Error(r.error);
      }
      setState("on");
    } catch (e) {
      setError(e instanceof Error ? e.message : "couldn't turn them on");
    } finally {
      setBusy(false);
    }
  };
  const turnOff = async () => {
    setBusy(true);
    setError(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await removeSubscriptionAction(sub.endpoint);
        await sub.unsubscribe();
      }
      setState("off");
    } catch (e) {
      setError(e instanceof Error ? e.message : "couldn't turn them off");
    } finally {
      setBusy(false);
    }
  };

  const line: Record<NotifyState, string> = {
    checking: "checking this device",
    unsupported: "this browser can't take notifications",
    "install-first": "on iPhone, add injury time to your home screen first (Share, then Add to Home Screen), then turn these on from there",
    blocked: "notifications are blocked for this site in your browser settings",
    off: "off on this device",
    on: "on for this device: notices from the staff and match calls",
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="flex items-center gap-2 text-[13px] text-ink-dim">
        <span aria-hidden className={`inline-block h-2.5 w-2.5 ${state === "on" ? "bg-mint" : "border border-ink-dim"}`} />
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink">notifications</span>
        {line[state]}
      </span>
      {state === "off" ? (
        <button type="button" className={PRIMARY} disabled={busy} onClick={turnOn}>
          {busy ? "turning on" : "turn on"}
        </button>
      ) : state === "on" ? (
        <button type="button" className={GHOST} disabled={busy} onClick={turnOff}>
          {busy ? "turning off" : "turn off"}
        </button>
      ) : null}
      {error ? <p role="alert" className="w-full text-[13px] text-doubt">{error}</p> : null}
    </div>
  );
}
