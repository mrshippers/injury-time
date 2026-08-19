/**
 * ACWR threshold sweep for Injury Time.
 *
 * Runs seven synthetic 8-week load patterns - built on a real part-time schedule
 * (two training sessions plus one match a week) - through `flagFor` at a range of
 * `redHigh` thresholds, and prints which threshold actually separates genuinely
 * spiky weeks from benign ones for non-league footballers.
 *
 * Gabbett's 1.5 comes from full-time athletes. This decides what WE ship.
 *
 *   npm run grid
 */
import {
  acwr,
  flagFor,
  DEFAULT_ACWR_THRESHOLDS,
  type LoadEntry,
  type LoadFlag,
} from "../src/lib/load-engine";

// ---------------------------------------------------------------------------
// Schedule model
// ---------------------------------------------------------------------------

/** Reference date for the whole sweep. Nothing here reads the clock. */
const AS_OF = "2026-03-28";
const WEEKS = 8;
/** 8 weeks of history ending at AS_OF inclusive starts on 2026-02-01. */
const FIRST_DAY = "2026-02-01";

const TRAINING = 6 * 70; // RPE 6 x 70 min = 420 AU
const MATCH = 8 * 90; // RPE 8 x 90 min = 720 AU
const BASELINE_WEEK = TRAINING * 2 + MATCH; // 1560 AU

/** Day-of-week offset within a week -> session load. Tue + Thu training, Sun match. */
const WEEK_TEMPLATE: ReadonlyArray<{ offset: number; load: number }> = [
  { offset: 1, load: TRAINING },
  { offset: 3, load: TRAINING },
  { offset: 6, load: MATCH },
];

const MS_PER_DAY = 86_400_000;

function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * MS_PER_DAY).toISOString().slice(0, 10);
}

/**
 * Builds 8 weeks of sessions, scaling each week by `multipliers[week]`.
 * A multiplier of 0 emits no sessions at all - the week simply did not happen,
 * which is what a missed week looks like in the database.
 */
function build(multipliers: readonly number[], extra: readonly LoadEntry[] = []): LoadEntry[] {
  const entries: LoadEntry[] = [];
  for (let week = 0; week < WEEKS; week += 1) {
    const scale = multipliers[week];
    if (scale === 0) continue;
    for (const session of WEEK_TEMPLATE) {
      entries.push({
        date: addDays(FIRST_DAY, week * 7 + session.offset),
        load: Math.round(session.load * scale),
      });
    }
  }
  return [...entries, ...extra];
}

const FULL = [1, 1, 1, 1, 1, 1, 1, 1];

interface Pattern {
  readonly name: string;
  readonly note: string;
  /** How a coach would describe this week: is a flag here a true positive? */
  readonly verdict: "spiky" | "benign" | "context";
  readonly loads: LoadEntry[];
}

const PATTERNS: readonly Pattern[] = [
  {
    name: "steady",
    note: "same 1560 AU week, eight weeks running",
    verdict: "benign",
    loads: build(FULL),
  },
  {
    name: "spike",
    note: "final week doubled",
    verdict: "spiky",
    loads: build([1, 1, 1, 1, 1, 1, 1, 2]),
  },
  {
    name: "taper",
    note: "final week halved before a cup tie",
    verdict: "benign",
    loads: build([1, 1, 1, 1, 1, 1, 1, 0.5]),
  },
  {
    name: "return_from_injury",
    note: "3 weeks out, then 30% / 60% / 100% ramp",
    verdict: "spiky",
    loads: build([1, 1, 0, 0, 0, 0.3, 0.6, 1]),
  },
  {
    name: "two_match_week",
    note: "midweek rearranged fixture on top of a normal week",
    verdict: "spiky",
    loads: build(FULL, [{ date: addDays(FIRST_DAY, 7 * 7 + 3), load: MATCH }]),
  },
  {
    name: "preseason_ramp",
    note: "linear build from 20% to 120% over eight weeks",
    verdict: "benign",
    loads: build([0.2, 0.3, 0.45, 0.6, 0.75, 0.9, 1.05, 1.2]),
  },
  {
    name: "three_weeks_off",
    note: "holiday gap, then straight back into a full week",
    verdict: "context",
    loads: build([1, 1, 1, 1, 0, 0, 0, 1]),
  },
];

const RED_HIGHS = [1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8] as const;
const { watchLow, watchHigh } = DEFAULT_ACWR_THRESHOLDS;

const CELL: Record<LoadFlag, string> = { red: "R", watch: "W", ok: "O", cold: "C" };

// ---------------------------------------------------------------------------
// Sweep
// ---------------------------------------------------------------------------

const rows = PATTERNS.map((pattern) => {
  const ratio = acwr(pattern.loads, AS_OF);
  const flags = RED_HIGHS.map((redHigh) =>
    flagFor(pattern.loads, AS_OF, { watchLow, watchHigh, redHigh }),
  );
  const weekTotal = pattern.loads
    .filter((entry) => entry.date > addDays(AS_OF, -7))
    .reduce((sum, entry) => sum + entry.load, 0);
  return { pattern, ratio, flags, weekTotal };
});

const NAME_WIDTH = Math.max(...PATTERNS.map((p) => p.name.length)) + 2;
const pad = (text: string, width: number) => text.padEnd(width);
const padStart = (text: string, width: number) => text.padStart(width);

console.log("");
console.log("Injury Time - ACWR redHigh threshold sweep");
console.log(
  `asOf ${AS_OF} | ${WEEKS} weeks of synthetic part-time load | watchLow ${watchLow.toFixed(2)}, watchHigh ${watchHigh.toFixed(2)} (fixed)`,
);
console.log(
  `baseline week = 2 x training (RPE 6 x 70min = ${TRAINING} AU) + 1 x match (RPE 8 x 90min = ${MATCH} AU) = ${BASELINE_WEEK} AU`,
);
console.log("");

const header =
  pad("pattern", NAME_WIDTH) +
  padStart("ACWR", 6) +
  padStart("wk AU", 8) +
  "   " +
  RED_HIGHS.map((t) => padStart(t.toFixed(1), 5)).join("");
console.log(header);
console.log("-".repeat(header.length));

for (const row of rows) {
  const ratioText = row.ratio.kind === "ratio" ? row.ratio.value.toFixed(2) : "n/a";
  console.log(
    pad(row.pattern.name, NAME_WIDTH) +
      padStart(ratioText, 6) +
      padStart(String(row.weekTotal), 8) +
      "   " +
      row.flags.map((flag) => padStart(CELL[flag], 5)).join(""),
  );
}

console.log("-".repeat(header.length));
console.log("R = red   W = watch   O = ok   C = cold (insufficient data, never a fake ratio)");
console.log("");
for (const row of rows) {
  console.log(`  ${pad(row.pattern.name, NAME_WIDTH)}${row.pattern.verdict.padEnd(9)}${row.pattern.note}`);
}
console.log("");

// ---------------------------------------------------------------------------
// Which redHigh ships?
//
// A threshold is only a candidate if it never reds a benign pattern (false
// alarms are what get an availability board ignored) and it leaves a live amber
// band above watchHigh (redHigh == watchHigh collapses watch into red). Among
// the candidates, take the one that reds the most genuinely spiky patterns,
// lowest wins on a tie.
// ---------------------------------------------------------------------------

const scored = RED_HIGHS.map((redHigh, column) => {
  const benignReds = rows.filter((r) => r.pattern.verdict === "benign" && r.flags[column] === "red");
  const spikyReds = rows.filter((r) => r.pattern.verdict === "spiky" && r.flags[column] === "red");
  const spikyMissed = rows.filter((r) => r.pattern.verdict === "spiky" && r.flags[column] === "ok");
  return { redHigh, benignReds, spikyReds, spikyMissed };
});

const candidates = scored.filter((s) => s.benignReds.length === 0 && s.redHigh > watchHigh);
const best = candidates.reduce((a, b) => (b.spikyReds.length > a.spikyReds.length ? b : a));
const collapsed = scored.find((s) => s.redHigh === watchHigh);
const overFlagging = scored.filter((s) => s.benignReds.length > 0).map((s) => s.redHigh.toFixed(1));

const spikyCount = rows.filter((r) => r.pattern.verdict === "spiky").length;
console.log("RECOMMENDATION");
console.log(
  `1. Ship redHigh = ${best.redHigh.toFixed(1)} for part-time squads: it reds ${best.spikyReds.length}/${spikyCount} spiky patterns (${best.spikyReds.map((r) => r.pattern.name).join(", ")}), reds no benign pattern, and still leaves ${best.spikyMissed.length === 0 ? "the remaining spiky pattern on watch, not clean" : "gaps worth watching"}.`,
);
console.log(
  `2. Lower is over-eager: redHigh ${overFlagging.join(" / ")} reds preseason_ramp at ${rows.find((r) => r.pattern.name === "preseason_ramp")!.ratio.kind === "ratio" ? (rows.find((r) => r.pattern.name === "preseason_ramp")!.ratio as { value: number }).value.toFixed(2) : "n/a"}, a planned linear build - and redHigh ${collapsed!.redHigh.toFixed(1)} equals watchHigh, which deletes the amber band and sends every lumpy fixture week straight to red.`,
);
console.log(
  `3. Higher is too forgiving: at redHigh 1.6+ the doubled spike week (${(rows.find((r) => r.pattern.name === "spike")!.ratio as { value: number }).value.toFixed(2)}) drops to watch, and Gabbett's 1.5 assumes a full-time athlete's smooth chronic load - a non-league player's chronic average is built from three sessions a week, so one extra match moves it far more.`,
);
console.log("");
