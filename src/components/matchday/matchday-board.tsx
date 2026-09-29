"use client";

/**
 * The dugout board. State lives on this phone (localStorage, per fixture), so a
 * locked screen or a lost signal does not lose the game; nothing is written to
 * the club until the whistle hands the minutes to the logger.
 */
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { MATCHDAY_HANDOFF_KEY, minutesPlayed, type MatchdayHandoff, type SubEvent } from "@/lib/matchday/minutes";

type Phase = "pre" | "first" | "ht" | "second" | "ft";
type Saved = { phase: Phase; startedAt: number | null; firstHalfMins: number; subs: SubEvent[]; fullTime: number | null };
const EMPTY: Saved = { phase: "pre", startedAt: null, firstHalfMins: 0, subs: [], fullTime: null };

const BIG =
  "pressable h-14 rounded-[2px] px-5 text-[14px] font-bold uppercase tracking-[0.12em] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mint disabled:opacity-40";

function load(key: string): Saved {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...EMPTY, ...(JSON.parse(raw) as Saved) } : EMPTY;
  } catch {
    return EMPTY;
  }
}

export function MatchdayBoard({
  fixture,
  xi,
  bench,
  names,
}: {
  fixture: { id: string; date: string; opponent: string; venue: "H" | "A" };
  xi: string[];
  bench: string[];
  names: Record<string, { name: string; number: number | null }>;
}) {
  const key = `injury-time.matchday.${fixture.id}`;
  const router = useRouter();
  const [s, setS] = useState<Saved>(EMPTY);
  const [now, setNow] = useState(() => Date.now());
  const [off, setOff] = useState<string | null>(null);

  // storage is read after mount (the server has none), one frame later so the
  // first paint and hydration agree
  useEffect(() => {
    const id = requestAnimationFrame(() => setS(load(key)));
    return () => cancelAnimationFrame(id);
  }, [key]);
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(s));
    } catch {
      /* private mode: the game still runs, it just will not survive a reload */
    }
  }, [key, s]);
  useEffect(() => {
    if (s.phase !== "first" && s.phase !== "second") return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [s.phase]);

  const running = s.phase === "first" || s.phase === "second";
  const halfMins = running && s.startedAt ? Math.floor((now - s.startedAt) / 60000) : 0;
  const minute = s.phase === "first" ? halfMins : s.phase === "second" ? s.firstHalfMins + halfMins : s.phase === "ht" ? s.firstHalfMins : s.fullTime ?? 0;
  const seconds = running && s.startedAt ? Math.floor((now - s.startedAt) / 1000) % 60 : 0;

  const onPitch = useMemo(() => {
    const set = new Set(xi);
    for (const e of [...s.subs].sort((a, b) => a.minute - b.minute)) {
      if (set.has(e.off)) {
        set.delete(e.off);
        set.add(e.on);
      }
    }
    return [...set];
  }, [xi, s.subs]);
  const available = bench.filter((id) => !onPitch.includes(id) && !s.subs.some((e) => e.off === id));

  const label = (id: string) => {
    const n = names[id];
    return n ? `${n.number ?? ""} ${n.name}`.trim() : "?";
  };

  function kickOff() {
    setS((p) => ({ ...p, phase: p.phase === "ht" ? "second" : "first", startedAt: Date.now() }));
  }
  function halfTime() {
    setS((p) => ({ ...p, phase: "ht", firstHalfMins: Math.max(45, halfMins), startedAt: null }));
  }
  function fullTime() {
    setS((p) => ({ ...p, phase: "ft", fullTime: Math.max(p.firstHalfMins + 45, minute), startedAt: null }));
  }
  function sub(on: string) {
    if (!off) return;
    setS((p) => ({ ...p, subs: [...p.subs, { minute, off, on }] }));
    setOff(null);
  }
  function undo() {
    setS((p) => ({ ...p, subs: p.subs.slice(0, -1) }));
  }
  function toLogger() {
    const minutes = minutesPlayed(xi, s.subs, s.fullTime ?? 90);
    const handoff: MatchdayHandoff = { fixtureId: fixture.id, date: fixture.date, opponent: fixture.opponent, minutes };
    try {
      sessionStorage.setItem(MATCHDAY_HANDOFF_KEY, JSON.stringify(handoff));
    } catch {
      /* the logger opens without the minutes; nothing is lost from this screen */
    }
    router.push("/log");
  }

  return (
    <div>
      <h1 className="display mt-2 text-3xl sm:text-4xl">
        {fixture.venue === "H" ? `v ${fixture.opponent}` : `at ${fixture.opponent}`}
      </h1>

      <div className="mt-6 flex items-end justify-between gap-4 border-y border-line py-5">
        <div>
          <p className="annot">{s.phase === "pre" ? "// not started" : s.phase === "ht" ? "// half-time" : s.phase === "ft" ? "// full-time" : s.phase === "first" ? "// first half" : "// second half"}</p>
          <p className="num mt-1 text-[64px] font-semibold leading-none text-ink" aria-live="off">
            {String(minute).padStart(2, "0")}
            <span className="text-[28px] text-ink-dim">:{String(seconds).padStart(2, "0")}</span>
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          {s.phase === "pre" || s.phase === "ht" ? (
            <button type="button" className={`${BIG} bg-mint text-mint-ink`} onClick={kickOff}>
              {s.phase === "pre" ? "kick off" : "second half"}
            </button>
          ) : null}
          {s.phase === "first" ? (
            <button type="button" className={`${BIG} border border-line-strong bg-panel text-ink`} onClick={halfTime}>
              half-time
            </button>
          ) : null}
          {s.phase === "second" ? (
            <button type="button" className={`${BIG} border border-line-strong bg-panel text-ink`} onClick={fullTime}>
              full-time
            </button>
          ) : null}
          {s.phase === "ft" ? (
            <button type="button" className={`${BIG} bg-mint text-mint-ink`} onClick={toLogger}>
              log the minutes
            </button>
          ) : null}
        </div>
      </div>

      <section aria-labelledby="pitch-h" className="mt-6">
        <p className="annot" id="pitch-h">{off ? `// ${label(off)} off. who comes on?` : "// on the pitch · tap to take off"}</p>
        <ul className="mt-3 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {onPitch.map((id) => (
            <li key={id}>
              <button
                type="button"
                disabled={s.phase === "ft" || s.phase === "pre"}
                aria-pressed={off === id}
                onClick={() => setOff((o) => (o === id ? null : id))}
                className={`pressable flex h-12 w-full items-center justify-between rounded-[2px] border px-3 text-left text-[15px] disabled:opacity-60 ${
                  off === id ? "border-doubt bg-panel-2 text-ink" : "border-line bg-panel text-ink"
                }`}
              >
                <span>{label(id)}</span>
                {off === id ? <span className="num text-[11px] uppercase tracking-[0.1em] text-doubt">coming off</span> : null}
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="bench-h" className="mt-6">
        <p className="annot" id="bench-h">{"// the bench"}</p>
        {available.length ? (
          <ul className="mt-3 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {available.map((id) => (
              <li key={id}>
                <button
                  type="button"
                  disabled={!off}
                  onClick={() => sub(id)}
                  className="pressable flex h-12 w-full items-center justify-between rounded-[2px] border border-line bg-pitch px-3 text-left text-[15px] text-ink-dim enabled:text-ink disabled:opacity-60"
                >
                  <span>{label(id)}</span>
                  {off ? <span className="num text-[11px] uppercase tracking-[0.1em] text-mint">bring on</span> : null}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-[13.5px] text-ink-dim">Nobody left on the bench.</p>
        )}
      </section>

      {s.subs.length ? (
        <section aria-labelledby="subs-h" className="mt-6 border-t border-line pt-4">
          <div className="flex items-center justify-between">
            <p className="annot" id="subs-h">{"// changes"}</p>
            {s.phase !== "ft" ? (
              <button type="button" onClick={undo} className="pressable h-10 px-3 text-[12px] uppercase tracking-[0.1em] text-ink-dim hover:text-ink">
                undo last
              </button>
            ) : null}
          </div>
          <ul className="mt-2 flex flex-col gap-1">
            {s.subs.map((e, i) => (
              <li key={i} className="num text-[13px] text-ink-dim">
                {`${e.minute}'`} <span className="text-ink">{label(e.on)}</span> on for {label(e.off)}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className="mt-8 text-[12.5px] leading-relaxed text-ink-faint">
        Minutes go to the logger at full-time. How hard the game felt (RPE) is each player&apos;s to give there; it is never filled in for them.
      </p>
    </div>
  );
}
