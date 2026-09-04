/**
 * Pure vocabulary for the team page: how a call reads, how a count line is
 * built, how long ago a notice landed. No framework, no I/O, unit-tested.
 */
import type { CallStatus, ClubRole, MatchCall, NotificationKind } from "@/lib/types";

export const CALL_META: Record<CallStatus, { label: string; text: string; fill: string; border: string }> = {
  in: { label: "in", text: "text-fit", fill: "bg-fit", border: "border-fit/40" },
  out: { label: "out", text: "text-out", fill: "bg-out", border: "border-out/40" },
  unsure: { label: "unsure", text: "text-doubt", fill: "bg-doubt", border: "border-doubt/40" },
};

export const KIND_META: Record<NotificationKind, { label: string; glyph: string }> = {
  call: { label: "call", glyph: "//" },
  training: { label: "training", glyph: "tr" },
  match: { label: "match", glyph: "vs" },
  notice: { label: "notice", glyph: "nb" },
  medical: { label: "medical", glyph: "med" },
};

export const ROLE_LABEL: Record<ClubRole, string> = {
  manager: "manager",
  coach: "coach",
  medical: "medical",
  player: "player",
};

export type CallCounts = { in: number; out: number; unsure: number; unanswered: number };

/** Counts for one fixture across a squad; a player without a row is unanswered. */
export function countCalls(playerIds: readonly string[], calls: readonly Pick<MatchCall, "player_id" | "status">[]): CallCounts {
  const byPlayer = new Map(calls.map((c) => [c.player_id, c.status]));
  const counts: CallCounts = { in: 0, out: 0, unsure: 0, unanswered: 0 };
  for (const id of playerIds) {
    const s = byPlayer.get(id);
    if (s === undefined) counts.unanswered += 1;
    else counts[s] += 1;
  }
  return counts;
}

/** `14 in · 3 out · 5 unsure · 2 not answered`. Zeroes are dropped except "in". */
export function countLine(c: CallCounts): string {
  const parts = [`${c.in} in`];
  if (c.out > 0) parts.push(`${c.out} out`);
  if (c.unsure > 0) parts.push(`${c.unsure} unsure`);
  if (c.unanswered > 0) parts.push(`${c.unanswered} not answered`);
  return parts.join(" · ");
}

/** "just now", "2 min ago", "3 hours ago", "yesterday", "4 days ago". */
export function timeAgo(iso: string, now: number = Date.now()): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return h === 1 ? "an hour ago" : `${h} hours ago`;
  const d = Math.round(h / 24);
  if (d === 1) return "yesterday";
  if (d < 14) return `${d} days ago`;
  const w = Math.round(d / 7);
  return `${w} weeks ago`;
}

const DAY = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

/** `2026-09-05` -> `saturday`. UTC date maths, never a local Date. */
export function weekdayWord(iso: string): string {
  return DAY[new Date(`${iso}T00:00:00Z`).getUTCDay()] ?? "";
}

/** "today", "tomorrow", "in 3 days", "3 days ago". */
export function daysAwayWord(days: number): string {
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days === -1) return "yesterday";
  if (days < 0) return `${-days} days ago`;
  return `in ${days} days`;
}
