/**
 * What the analyst is told. Pure: takes the club, the game, the film and the
 * squad, returns the system prompt and the message. Kept apart from the API
 * call so a test can read exactly what goes over the wire.
 */
import type { ClipEvent, Player } from "@/lib/types";

export type AnalysisContext = {
  club: { name: string; league: string; division: string | null };
  clip: { title: string; source: string; matchDate: string | null; opponent: string | null };
  result: { venue: "H" | "A"; goalsFor: number; goalsAgainst: number; competition: string } | null;
  fixture: { venue: "H" | "A"; matchDate: string; competition: string; opponent: string } | null;
  events: ClipEvent[];
  players: Pick<Player, "id" | "name" | "position" | "squad_number">[];
  /** readiness word per player id, when the load engine has one */
  readiness: Record<string, string>;
};

export const ANALYST_SYSTEM = `You are the analyst for a non-league football club in England. The people reading you are a volunteer manager, a coach, and a physio who has a day job. They do not read reports; they read a team sheet and a whiteboard.

Write like someone who stood on the touchline. Short sentences. Name players. Give minutes, numbers and reps for drills. Never invent an event that is not in the tagged list; if the film is thin, say what you can and what you would need tagged next time. No jargon a Step 6 dressing room would laugh at, no percentages, no dashes.`;

const KIND_WORD: Record<ClipEvent["kind"], string> = {
  goal: "goal",
  chance: "chance",
  shot: "shot",
  save: "save",
  turnover: "turnover",
  press: "press",
  set_piece: "set piece",
  injury: "injury",
  sub: "substitution",
  note: "note",
};

function clock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function buildAnalysisMessage(ctx: AnalysisContext): string {
  const byId = new Map(ctx.players.map((p) => [p.id, p]));
  const lines: string[] = [];

  lines.push(`Club: ${ctx.club.name}, ${ctx.club.league}${ctx.club.division ? ` ${ctx.club.division}` : ""}.`);
  if (ctx.result) {
    const where = ctx.result.venue === "H" ? "at home" : "away";
    lines.push(
      `The game: ${ctx.club.name} ${ctx.result.goalsFor} ${ctx.result.goalsAgainst} ${ctx.clip.opponent ?? "the opposition"}, ${where}, ${ctx.result.competition}${ctx.clip.matchDate ? `, ${ctx.clip.matchDate}` : ""}.`,
    );
  } else if (ctx.fixture) {
    const where = ctx.fixture.venue === "H" ? "at home" : "away";
    lines.push(`The next game: ${ctx.fixture.opponent}, ${where}, ${ctx.fixture.competition}, ${ctx.fixture.matchDate}.`);
  } else if (ctx.clip.opponent) {
    lines.push(`Opposition: ${ctx.clip.opponent}${ctx.clip.matchDate ? `, ${ctx.clip.matchDate}` : ""}.`);
  }
  lines.push(`Film: "${ctx.clip.title}" (${ctx.clip.source}).`);

  lines.push("");
  lines.push("Tagged events, in order:");
  if (ctx.events.length === 0) {
    lines.push("(none tagged)");
  } else {
    for (const e of [...ctx.events].sort((a, b) => a.t - b.t)) {
      const p = e.player_id ? byId.get(e.player_id) : null;
      const who = p ? ` ${p.name} (${p.position}${p.squad_number !== null ? ` ${p.squad_number}` : ""})` : "";
      lines.push(`${clock(e.t)} ${KIND_WORD[e.kind]}${who}${e.note ? `: ${e.note}` : ""}`);
    }
  }

  lines.push("");
  lines.push("Squad (id, name, position, number, training this week):");
  for (const p of ctx.players) {
    const r = ctx.readiness[p.id];
    lines.push(`${p.id} ${p.name} ${p.position}${p.squad_number !== null ? ` ${p.squad_number}` : ""}${r ? ` ${r}` : ""}`);
  }

  lines.push("");
  lines.push(
    [
      "Produce:",
      "summary: two or three sentences a manager would say to the group on Tuesday.",
      "gameday: three to six things to do on the day (shape, set pieces, who presses whom, who takes what), each one line.",
      "training: three to six drills for the next session because of this film, each with minutes and who is in it, one line each.",
      "players: a short note for each player who appears in the events, keyed by their id from the squad list, and nobody else.",
      "Only use player ids from the squad list above.",
    ].join("\n"),
  );

  return lines.join("\n");
}
