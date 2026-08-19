"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, useTransition } from "react";

import { setAvailabilityAction } from "@/app/squad/actions";
import {
  AVAILABILITY_STATUSES,
  SEVERITIES,
  SIDES,
  type AvailabilityStatus,
  type BodyRegion,
  type Severity,
  type Side,
} from "@/lib/types";

import {
  BODY_REGION_GROUPS,
  BODY_REGION_LABEL,
  SEVERITY_LABEL,
  SIDE_LABEL,
  STATUS_OPTION_LABEL,
} from "./format";

const PANEL_WIDTH = 268;
/** Room the injured form needs; below this we open upwards instead. */
const PANEL_ESTIMATE = 330;

type Placement = {
  left: number;
  /** Anchored from whichever edge keeps the panel on screen. */
  top?: number;
  bottom?: number;
  origin: "top right" | "bottom right";
};

const FIELD =
  "num w-full rounded-[2px] border border-line-strong bg-panel px-2 py-1.5 text-[12.5px] text-ink [color-scheme:dark] focus-visible:outline focus-visible:outline-2 focus-visible:outline-mint focus-visible:-outline-offset-1";

export function StatusMenu({
  playerId,
  playerName,
  current,
}: {
  playerId: string;
  playerName: string;
  current: AvailabilityStatus;
}) {
  const id = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const [mounted, setMounted] = useState(false);
  const [shown, setShown] = useState(false);
  const [placement, setPlacement] = useState<Placement | null>(null);

  const [status, setStatus] = useState<AvailabilityStatus>(current);
  const [returnDate, setReturnDate] = useState("");
  const [region, setRegion] = useState<BodyRegion | "">("");
  const [side, setSide] = useState<Side>("left");
  const [severity, setSeverity] = useState<Severity>("minor");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const close = useCallback(
    (returnFocus: boolean) => {
      setShown(false);
      if (returnFocus) triggerRef.current?.focus();
    },
    [],
  );

  const open = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const spaceBelow = window.innerHeight - rect.bottom;
    const flipUp = spaceBelow < PANEL_ESTIMATE && rect.top > spaceBelow;
    const width = Math.min(PANEL_WIDTH, window.innerWidth - 16);
    setPlacement({
      left: Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8)),
      ...(flipUp
        ? { bottom: window.innerHeight - rect.top + 6 }
        : { top: rect.bottom + 6 }),
      origin: flipUp ? "bottom right" : "top right",
    });
    setStatus(current);
    setReturnDate("");
    setRegion("");
    setError(null);
    setMounted(true);
  }, [current]);

  // Paint the panel closed, then flip to open on the next frame so the
  // transition actually runs (a mount straight into the end state does not).
  useLayoutEffect(() => {
    if (!mounted) return;
    const frame = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(frame);
  }, [mounted]);

  // Unmount only after the close transition has had its 190ms.
  useEffect(() => {
    if (mounted && !shown) {
      const timer = window.setTimeout(() => setMounted(false), 200);
      return () => window.clearTimeout(timer);
    }
  }, [mounted, shown]);

  useEffect(() => {
    if (!shown) return;
    panelRef.current?.querySelector<HTMLElement>("input, select, button")?.focus();
  }, [shown]);

  useEffect(() => {
    if (!mounted) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      close(false);
    };
    const onScrollOrResize = () => close(false);
    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("resize", onScrollOrResize);
    window.addEventListener("scroll", onScrollOrResize, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("resize", onScrollOrResize);
      window.removeEventListener("scroll", onScrollOrResize, true);
    };
  }, [mounted, close]);

  function onPanelKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.stopPropagation();
      close(true);
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = panelRef.current?.querySelectorAll<HTMLElement>(
      'button, select, input:not([type="radio"]), [href], input[type="radio"]:checked',
    );
    if (!focusable || focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement as HTMLElement | null;
    if (event.shiftKey && (active === first || !panelRef.current?.contains(active))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = {
      playerId,
      status,
      returnDate: returnDate || undefined,
      injury:
        status === "injured" && region
          ? { bodyRegion: region, side, severity }
          : undefined,
    };
    // Optimistic: the panel goes as soon as the write is dispatched, and only
    // comes back if the server refused it.
    close(true);
    startTransition(async () => {
      const result = await setAvailabilityAction(payload);
      if (!result.ok) {
        setError(result.error);
        setMounted(true);
      }
    });
  }

  const wantsReturnDate = status !== "fit";

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={mounted}
        aria-label={`set availability for ${playerName}`}
        onClick={() => (mounted ? close(true) : open())}
        className="pressable num relative z-10 rounded-[2px] border border-line px-1.5 py-1 text-[10.5px] tracking-[0.08em] text-ink-dim hover:border-line-strong hover:bg-panel-2 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-mint focus-visible:-outline-offset-1"
      >
        SET
      </button>

      {mounted && placement ? (
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="false"
          aria-label={`set availability for ${playerName}`}
          onKeyDown={onPanelKeyDown}
          style={{
            left: placement.left,
            top: placement.top,
            bottom: placement.bottom,
            width: Math.min(PANEL_WIDTH, typeof window === "undefined" ? PANEL_WIDTH : window.innerWidth - 16),
            transformOrigin: placement.origin,
          }}
          className={`fixed z-50 border border-line-strong bg-panel-2 p-3 text-left shadow-[0_18px_44px_rgba(0,0,0,0.55)] transition-[opacity,transform] duration-[190ms] ease-[var(--ease-out-strong)] motion-reduce:transition-opacity ${
            shown ? "scale-100 opacity-100" : "scale-[0.97] opacity-0 motion-reduce:scale-100"
          }`}
        >
          <p className="annot">{"// set status"}</p>
          <p className="mt-1 mb-3 truncate text-[13px] font-semibold text-ink">{playerName}</p>

          <form onSubmit={submit}>
            <fieldset className="border-0 p-0">
              <legend className="mb-1.5 text-[11px] text-ink-faint">availability</legend>
              <div className="grid grid-cols-2 gap-1.5">
                {AVAILABILITY_STATUSES.map((option) => (
                  <label key={option} className="block">
                    <input
                      type="radio"
                      name={`${id}-status`}
                      value={option}
                      checked={status === option}
                      onChange={() => setStatus(option)}
                      className="peer sr-only"
                    />
                    <span className="pressable block cursor-pointer rounded-[2px] border border-line bg-panel px-2 py-1.5 text-center text-[12px] text-ink-dim peer-checked:border-mint peer-checked:text-mint peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-mint peer-focus-visible:-outline-offset-1 hover:border-line-strong hover:text-ink">
                      {STATUS_OPTION_LABEL[option]}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            {status === "injured" ? (
              <div className="mt-3 grid gap-2">
                <label className="grid gap-1 text-[11px] text-ink-faint">
                  body region
                  <select
                    required
                    value={region}
                    onChange={(event) => setRegion(event.target.value as BodyRegion)}
                    className={FIELD}
                  >
                    <option value="">choose a region</option>
                    {BODY_REGION_GROUPS.map((group) => (
                      <optgroup key={group.label} label={group.label}>
                        {group.regions.map((value) => (
                          <option key={value} value={value}>
                            {BODY_REGION_LABEL[value]}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="grid gap-1 text-[11px] text-ink-faint">
                    side
                    <select
                      value={side}
                      onChange={(event) => setSide(event.target.value as Side)}
                      className={FIELD}
                    >
                      {SIDES.map((value) => (
                        <option key={value} value={value}>
                          {SIDE_LABEL[value]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-1 text-[11px] text-ink-faint">
                    severity
                    <select
                      value={severity}
                      onChange={(event) => setSeverity(event.target.value as Severity)}
                      className={FIELD}
                    >
                      {SEVERITIES.map((value) => (
                        <option key={value} value={value}>
                          {SEVERITY_LABEL[value]}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>
            ) : null}

            {wantsReturnDate ? (
              <label className="mt-2 grid gap-1 text-[11px] text-ink-faint">
                expected return
                <input
                  type="date"
                  value={returnDate}
                  onChange={(event) => setReturnDate(event.target.value)}
                  className={FIELD}
                />
              </label>
            ) : null}

            {error ? (
              <p role="alert" className="mt-2 text-[11.5px] text-out">
                {error}
              </p>
            ) : null}

            <div className="mt-3 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => close(true)}
                className="pressable rounded-[2px] px-2 py-1.5 text-[12px] text-ink-dim hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-mint"
              >
                cancel
              </button>
              <button
                type="submit"
                disabled={pending}
                className="pressable rounded-[2px] bg-mint px-3 py-1.5 text-[12px] font-bold text-mint-ink disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-mint focus-visible:outline-offset-2"
              >
                {pending ? "saving" : "save"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}
