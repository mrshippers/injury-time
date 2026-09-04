"use client";

/**
 * The clip room: the film on the left, what happened on the right, and the
 * analyst's read underneath. Tag an event at the player's current second,
 * click a mark to jump back to it, press analyse and Tuesday writes itself.
 */
import { useCallback, useEffect, useId, useMemo, useRef, useState, useTransition } from "react";

import { analyseClipAction, saveEventsAction } from "@/lib/film/actions";
import { clock, parseClock } from "@/lib/film/urls";
import { CHART } from "@/lib/tokens/charts";
import { CLIP_EVENT_KINDS, type Clip, type ClipAnalysis, type ClipEvent, type ClipEventKind } from "@/lib/types";

type SquadPlayer = { id: string; name: string; position: string; squad_number: number | null };

const KIND_LABEL: Record<ClipEventKind, string> = {
  goal: "goal",
  chance: "chance",
  shot: "shot",
  save: "save",
  turnover: "turnover",
  press: "press",
  set_piece: "set piece",
  injury: "injury",
  sub: "sub",
  note: "note",
};

const FIELD =
  "rounded-[2px] border border-line-strong bg-pitch px-2.5 py-2 text-[13px] text-ink [color-scheme:dark] placeholder:text-ink-faint focus-visible:outline focus-visible:outline-2 focus-visible:outline-mint focus-visible:-outline-offset-1";
const LABEL = "block text-[10.5px] tracking-[0.14em] uppercase text-ink-dim";
const BUTTON =
  "pressable h-9 rounded-[2px] px-4 text-[12px] font-bold uppercase tracking-[0.12em] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mint disabled:cursor-not-allowed disabled:opacity-50";

/* ── the YouTube player, only when the film is embeddable ─────────────── */

type YTPlayer = {
  getCurrentTime: () => number;
  getDuration: () => number;
  seekTo: (s: number, allowSeekAhead: boolean) => void;
  playVideo: () => void;
};
type YTNamespace = { Player: new (el: HTMLIFrameElement, opts: { events: { onReady: () => void } }) => YTPlayer };
declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

function useYouTube(iframe: React.RefObject<HTMLIFrameElement | null>, enabled: boolean) {
  const player = useRef<YTPlayer | null>(null);
  const [ready, setReady] = useState(false);
  const [duration, setDuration] = useState(0);
  useEffect(() => {
    if (!enabled || !iframe.current) return;
    let cancelled = false;
    const attach = () => {
      if (cancelled || !window.YT || !iframe.current) return;
      player.current = new window.YT.Player(iframe.current, {
        events: {
          onReady: () => {
            if (cancelled) return;
            setReady(true);
            const d = player.current?.getDuration() ?? 0;
            if (d > 0) setDuration(d);
          },
        },
      });
    };
    if (window.YT?.Player) attach();
    else {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        prev?.();
        attach();
      };
      if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
        const s = document.createElement("script");
        s.src = "https://www.youtube.com/iframe_api";
        s.async = true;
        document.head.appendChild(s);
      }
    }
    return () => {
      cancelled = true;
    };
  }, [enabled, iframe]);
  return { player, ready, duration };
}

/* ── the room ─────────────────────────────────────────────────────────── */

export function ClipRoom({
  clip,
  embedUrl,
  videoId,
  players,
  canEdit,
  analysisAvailable,
}: {
  clip: Clip;
  embedUrl: string | null;
  videoId: string | null;
  players: SquadPlayer[];
  canEdit: boolean;
  analysisAvailable: boolean;
}) {
  const id = useId();
  const iframe = useRef<HTMLIFrameElement | null>(null);
  const { player, ready, duration } = useYouTube(iframe, Boolean(embedUrl && videoId));

  const [events, setEvents] = useState<ClipEvent[]>(clip.events);
  const [analysis, setAnalysis] = useState<ClipAnalysis | null>(clip.analysis);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSave] = useTransition();
  const [analysing, startAnalyse] = useTransition();

  const [time, setTime] = useState("");
  const [kind, setKind] = useState<ClipEventKind>("goal");
  const [playerId, setPlayerId] = useState("");
  const [note, setNote] = useState("");

  const byId = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  const span = Math.max(duration, events.reduce((m, e) => Math.max(m, e.t), 0) * 1.1, 60);

  const persist = useCallback(
    (next: ClipEvent[]) => {
      setEvents(next);
      startSave(async () => {
        const r = await saveEventsAction(clip.id, next);
        setError(r.ok ? null : r.error);
      });
    },
    [clip.id],
  );

  const addEvent = () => {
    const t = parseClock(time);
    if (t === null) {
      setError("give the moment a time, like 5:12");
      return;
    }
    const e: ClipEvent = { t, kind };
    if (playerId) e.player_id = playerId;
    if (note.trim()) e.note = note.trim();
    persist([...events, e].sort((a, b) => a.t - b.t));
    setTime("");
    setNote("");
  };

  const removeEvent = (i: number) => persist(events.filter((_, j) => j !== i));

  const seek = (t: number) => {
    if (player.current && ready) {
      player.current.seekTo(t, true);
      player.current.playVideo();
    }
  };

  const now = () => {
    if (player.current && ready) setTime(clock(Math.floor(player.current.getCurrentTime())));
  };

  const analyse = () =>
    startAnalyse(async () => {
      const r = await analyseClipAction(clip.id);
      if (r.ok) {
        setAnalysis(r.analysis);
        setError(null);
      } else setError(r.error);
    });

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:items-start">
        {/* the film */}
        <section aria-labelledby={`${id}-film`} className="border border-line bg-panel">
          <div className="flex items-baseline justify-between border-b border-line px-4 py-2">
            <p className="annot" id={`${id}-film`}>{"// the film"}</p>
            <a href={clip.url} target="_blank" rel="noreferrer" className="num text-[11px] text-ink-dim underline-offset-4 hover:text-ink hover:underline max-sm:inline-block max-sm:py-3 max-sm:-my-3">
              open at source
            </a>
          </div>
          {embedUrl ? (
            <div className="relative aspect-video w-full bg-pitch">
              <iframe
                ref={iframe}
                src={embedUrl}
                title={clip.title}
                className="absolute inset-0 h-full w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          ) : (
            <div className="flex aspect-video w-full flex-col items-start justify-end gap-2 bg-pitch px-5 py-5">
              <p className="annot">{clip.source === "veo" ? "// veo match" : "// film elsewhere"}</p>
              <p className="max-w-[40ch] text-[13px] text-ink-dim">
                {clip.source === "veo"
                  ? "Veo film opens in the Veo app until the partner api is wired. Tag from there with the clock; the marks and the analysis still work here."
                  : "This film does not play here. Open it at source and tag by the clock."}
              </p>
              <a href={clip.url} target="_blank" rel="noreferrer" className={`${BUTTON} inline-flex items-center bg-mint text-mint-ink`}>
                open the film
              </a>
            </div>
          )}
          <Timeline events={events} span={span} byId={byId} onSeek={seek} />
        </section>

        {/* what happened */}
        <section aria-labelledby={`${id}-events`} className="border border-line bg-panel">
          <div className="flex items-baseline justify-between border-b border-line px-4 py-2">
            <p className="annot" id={`${id}-events`}>{"// what happened"}</p>
            <p className="num text-[11px] text-ink-dim">
              {events.length} event{events.length === 1 ? "" : "s"}
              {saving ? " · saving" : ""}
            </p>
          </div>

          {events.length === 0 ? (
            <p className="px-4 py-4 text-[13px] text-ink-dim">Nothing tagged yet. Watch, and mark the moments that matter.</p>
          ) : (
            <ol className="max-h-[360px] overflow-y-auto">
              {events.map((e, i) => {
                const p = e.player_id ? byId.get(e.player_id) : null;
                return (
                  <li key={`${e.t}-${e.kind}-${i}`} className="grid grid-cols-[52px_minmax(0,1fr)_auto] items-baseline gap-x-3 border-b border-line px-4 py-2 last:border-b-0">
                    <button type="button" onClick={() => seek(e.t)} className="num pressable text-left text-[12.5px] text-gold underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-mint">
                      {clock(e.t)}
                    </button>
                    <span className="min-w-0 text-[13px] text-ink">
                      <span className={`font-semibold ${e.kind === "goal" ? "text-mint" : e.kind === "injury" ? "text-out" : ""}`}>{KIND_LABEL[e.kind]}</span>
                      {p ? <span className="text-ink-dim"> · {p.name}</span> : null}
                      {e.note ? <span className="block truncate text-[12px] text-ink-dim">{e.note}</span> : null}
                    </span>
                    {canEdit ? (
                      <button
                        type="button"
                        onClick={() => removeEvent(i)}
                        aria-label={`remove ${KIND_LABEL[e.kind]} at ${clock(e.t)}`}
                        className="pressable text-[11px] uppercase tracking-[0.1em] text-ink-faint hover:text-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-mint"
                      >
                        remove
                      </button>
                    ) : null}
                  </li>
                );
              })}
            </ol>
          )}

          {canEdit ? (
            <form
              className="border-t border-line px-4 py-3"
              onSubmit={(ev) => {
                ev.preventDefault();
                addEvent();
              }}
            >
              <p className="annot text-gold-dim">{"// tag a moment"}</p>
              <div className="mt-2 grid grid-cols-[1fr_auto] gap-2">
                <div>
                  <label className={LABEL} htmlFor={`${id}-t`}>time</label>
                  <input id={`${id}-t`} value={time} onChange={(e) => setTime(e.target.value)} placeholder="5:12" inputMode="numeric" className={`${FIELD} num mt-1 w-full`} />
                </div>
                <div className="flex items-end">
                  <button type="button" onClick={now} disabled={!ready} className={`${BUTTON} border border-line-strong bg-panel-2 text-ink-dim hover:text-ink`}>
                    now
                  </button>
                </div>
              </div>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div>
                  <label className={LABEL} htmlFor={`${id}-k`}>what</label>
                  <select id={`${id}-k`} value={kind} onChange={(e) => setKind(e.target.value as ClipEventKind)} className={`${FIELD} mt-1 w-full`}>
                    {CLIP_EVENT_KINDS.map((k) => (
                      <option key={k} value={k}>{KIND_LABEL[k]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={LABEL} htmlFor={`${id}-p`}>who</label>
                  <select id={`${id}-p`} value={playerId} onChange={(e) => setPlayerId(e.target.value)} className={`${FIELD} mt-1 w-full`}>
                    <option value="">nobody in particular</option>
                    {players.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.squad_number !== null ? `${p.squad_number} ` : ""}{p.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <label className={`${LABEL} mt-2`} htmlFor={`${id}-n`}>note</label>
              <input id={`${id}-n`} value={note} onChange={(e) => setNote(e.target.value)} maxLength={240} placeholder="far post from a corner" className={`${FIELD} mt-1 w-full`} />
              <div className="mt-3 flex items-center justify-between gap-3">
                <p role="status" className="min-h-[16px] text-[12px] text-out">{error ?? ""}</p>
                <button type="submit" className={`${BUTTON} bg-mint text-mint-ink`}>add</button>
              </div>
            </form>
          ) : null}
        </section>
      </div>

      {/* the analyst */}
      <section aria-labelledby={`${id}-analysis`} className="border border-line bg-panel">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-2 sm:px-5">
          <p className="annot" id={`${id}-analysis`}>{"// the match room"}</p>
          <div className="flex items-center gap-3">
            {analysis ? (
              <p className="num hidden text-[11px] text-ink-dim sm:block">
                {analysis.model} · {analysis.generated_at.slice(0, 10)}
              </p>
            ) : null}
            {canEdit ? (
              <button
                type="button"
                onClick={analyse}
                disabled={analysing || !analysisAvailable || events.length === 0}
                title={!analysisAvailable ? "no analysis key on this server" : events.length === 0 ? "tag at least one moment first" : undefined}
                className={`${BUTTON} whitespace-nowrap bg-mint text-mint-ink`}
              >
                {analysing ? "reading the film" : analysis ? "analyse again" : "analyse"}
              </button>
            ) : null}
          </div>
        </div>

        {analysis ? (
          <AnalysisPanel analysis={analysis} byId={byId} />
        ) : (
          <p className="px-4 py-5 text-[13px] text-ink-dim sm:px-5">
            {!analysisAvailable
              ? "No analysis key on this server, so nothing gets written here. Set ANTHROPIC_API_KEY and it comes alive."
              : events.length === 0
                ? "Tag the moments first. The analyst only writes from what you mark, never from what it imagines."
                : "Press analyse and this fills with what to do on the day and what Tuesday looks like."}
          </p>
        )}
        {analysing ? (
          <p className="annot px-4 pb-4 text-gold-dim sm:px-5" aria-live="polite">{"// reading the film"}</p>
        ) : null}
      </section>
    </div>
  );
}

/* ── the timeline strip ───────────────────────────────────────────────── */

function Timeline({
  events,
  span,
  byId,
  onSeek,
}: {
  events: ClipEvent[];
  span: number;
  byId: Map<string, SquadPlayer>;
  onSeek: (t: number) => void;
}) {
  const W = 640;
  const H = 64;
  const base = 40;
  const x = (t: number) => 12 + (t / span) * (W - 24);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * span);
  return (
    <figure className="border-t border-line px-3 py-2">
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-16 w-full" role="img" aria-label={`${events.length} tagged moments across ${clock(span)} of film`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={x(t)} x2={x(t)} y1={base - 6} y2={base + 6} stroke={CHART.gridStrong} strokeWidth={1} />
            <text x={x(t)} y={base + 20} textAnchor="middle" fill="var(--ink-faint)" fontSize={CHART.tick.size} fontFamily={CHART.tick.family} letterSpacing={1}>
              {clock(t)}
            </text>
          </g>
        ))}
        <line x1={12} x2={W - 12} y1={base} y2={base} stroke={CHART.grid} strokeWidth={CHART.hairline} className="chart-draw" pathLength={1} />
        {events.map((e, i) => {
          const goal = e.kind === "goal";
          const bad = e.kind === "injury";
          const p = e.player_id ? byId.get(e.player_id) : null;
          const fill = goal ? CHART.accent : bad ? CHART.bad : "var(--ink)";
          return (
            <g
              key={`${e.t}-${i}`}
              role="button"
              tabIndex={0}
              aria-label={`${KIND_LABEL[e.kind]} at ${clock(e.t)}${p ? `, ${p.name}` : ""}`}
              onClick={() => onSeek(e.t)}
              onKeyDown={(ev) => {
                if (ev.key === "Enter" || ev.key === " ") {
                  ev.preventDefault();
                  onSeek(e.t);
                }
              }}
              className="cursor-pointer outline-none focus-visible:[&>circle]:stroke-[var(--mint)]"
              style={{ animationDelay: `${i * CHART.motion.staggerDot}ms` }}
            >
              <rect x={x(e.t) - 42} y={base - 42} width={84} height={84} fill="transparent" />
              <circle cx={x(e.t)} cy={base} r={goal ? CHART.beadRadius + 1 : CHART.markRadius + 0.6} fill={fill} stroke="var(--panel)" strokeWidth={1.5} className="chart-pop" style={{ animationDelay: `${i * CHART.motion.staggerDot}ms` }} />
              {goal ? (
                <text x={x(e.t)} y={base - 12} textAnchor="middle" fill={CHART.annotation} fontSize={CHART.tick.size} fontFamily={CHART.tick.family} letterSpacing={1.2}>
                  {(p?.name.split(" ").at(-1) ?? "goal").toLowerCase()}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
      <figcaption className="annot text-gold-dim">{"// tap a mark to jump the film there"}</figcaption>
    </figure>
  );
}

/* ── the analysis, laid out like a whiteboard ─────────────────────────── */

function AnalysisPanel({ analysis, byId }: { analysis: ClipAnalysis; byId: Map<string, SquadPlayer> }) {
  return (
    <div className="px-4 py-4 sm:px-5">
      <p className="display max-w-[58ch] text-[19px] text-ink sm:text-[22px]">{analysis.summary}</p>
      <div className="mt-5 grid grid-cols-1 gap-px bg-line sm:grid-cols-2">
        <div className="bg-panel pr-0 sm:pr-5">
          <p className="annot">{"// on the day"}</p>
          <ol className="mt-2 flex flex-col gap-2">
            {analysis.gameday.map((g, i) => (
              <li key={i} className="grid grid-cols-[22px_minmax(0,1fr)] gap-2 text-[13.5px] leading-snug text-ink">
                <span className="num text-gold">{i + 1}</span>
                <span>{g}</span>
              </li>
            ))}
          </ol>
        </div>
        <div className="bg-panel pl-0 pt-4 sm:pl-5 sm:pt-0">
          <p className="annot">{"// tuesday"}</p>
          <ol className="mt-2 flex flex-col gap-2">
            {analysis.training.map((t, i) => (
              <li key={i} className="grid grid-cols-[22px_minmax(0,1fr)] gap-2 text-[13.5px] leading-snug text-ink">
                <span className="num text-gold">{i + 1}</span>
                <span>{t}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
      {analysis.players.length > 0 ? (
        <div className="mt-5">
          <p className="annot">{"// by name"}</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {analysis.players.map((n) => {
              const p = byId.get(n.player_id);
              return (
                <li key={n.player_id} className="max-w-[320px] rounded-[2px] border border-line-strong bg-panel-2 px-3 py-2">
                  <p className="text-[12.5px] font-bold lowercase text-ink">
                    {p?.squad_number !== null && p?.squad_number !== undefined ? <span className="num mr-1.5 text-gold">{p.squad_number}</span> : null}
                    {p?.name ?? "unknown"}
                  </p>
                  <p className="mt-0.5 text-[12px] leading-snug text-ink-dim">{n.note}</p>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
