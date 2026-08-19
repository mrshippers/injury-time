/**
 * Training-load engine for Injury Time.
 *
 * Pure TypeScript: no I/O, no framework imports, no clock. Every function takes
 * the reference date (`asOf`) from its caller, so the same inputs always produce
 * the same outputs and every result is reproducible in a test or a backfill.
 *
 * Session load is sRPE: RPE (1-10) x session minutes, giving a dimensionless
 * arbitrary unit (AU). A 70-minute session at RPE 6 is 420 AU.
 */

/** One session's load, keyed by calendar day. */
export interface LoadEntry {
  /** ISO calendar date, `yyyy-mm-dd`. */
  readonly date: string;
  /** Session load in AU (sRPE = RPE x minutes). */
  readonly load: number;
}

/** Acute:chronic workload ratio, or an explicit statement that we cannot compute one. */
export type AcwrResult =
  | { readonly kind: "ratio"; readonly value: number }
  | { readonly kind: "insufficient_data" };

/** Week-on-week change as a fraction (0.462 = +46.2%), or an explicit gap. */
export type WeekOnWeekResult =
  | { readonly kind: "pct"; readonly value: number }
  | { readonly kind: "insufficient_data" };

/** Availability flag shown against a player. `cold` means "no ACWR", never "fine". */
export type LoadFlag = "cold" | "ok" | "watch" | "red";

/** Injectable band edges for {@link flagFor}. */
export interface AcwrThresholds {
  /** Below this the player is undercooked. Band is strictly below. */
  readonly watchLow: number;
  /** Above this the player is ramping. Band is strictly above. */
  readonly watchHigh: number;
  /** Above this the ramp is a red flag. Band is strictly above. */
  readonly redHigh: number;
}

/**
 * Default ACWR bands.
 *
 * Gabbett, T. J. (2016). "The training-injury prevention paradox: should
 * athletes be training smarter and harder?" British Journal of Sports Medicine,
 * 50(5), 273-280. Gabbett reports a "sweet spot" around 0.8-1.3 and a sharply
 * raised injury risk above ~1.5.
 *
 * CAVEAT: those bands are derived from full-time athletes on smooth, high-volume
 * chronic loads. Non-league footballers train twice a week around a job, so a
 * single extra match can move the ratio 25% on its own and the chronic average
 * is built from far fewer sessions. Treat these numbers as a starting point, not
 * a clinical boundary - which is why they are a parameter, and why
 * `scripts/grid.ts` sweeps them against realistic part-time patterns.
 */
export const DEFAULT_ACWR_THRESHOLDS: AcwrThresholds = {
  watchLow: 0.8,
  watchHigh: 1.3,
  // 1.4, not Gabbett's 1.5: the scripts/grid.ts sweep over part-time
  // patterns showed 1.5+ lets a doubled week slip to watch, while 1.4
  // reds both genuine spikes and no benign pattern. Non-league chronic
  // load is built from ~3 sessions/week, so one extra match moves the
  // ratio far more than it does for the full-time athletes the 1.5
  // band was derived from.
  redHigh: 1.4,
};

const MS_PER_DAY = 86_400_000;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Converts `yyyy-mm-dd` to a whole day number (days since the Unix epoch) so all
 * window arithmetic is integer subtraction - no timezones, no DST, no drift.
 */
function toDayNumber(date: string): number {
  if (!ISO_DATE.test(date)) {
    throw new RangeError(`Expected an ISO yyyy-mm-dd date, received: ${JSON.stringify(date)}`);
  }
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  const day = Number(date.slice(8, 10));
  const utc = Date.UTC(year, month - 1, day);
  // Round-trip guard: rejects 2026-02-30 and friends, which Date.UTC would roll over.
  if (Number.isNaN(utc) || new Date(utc).toISOString().slice(0, 10) !== date) {
    throw new RangeError(`Not a real calendar date: ${date}`);
  }
  return utc / MS_PER_DAY;
}

function toLoadValue(load: number, date: string): number {
  if (typeof load !== "number" || !Number.isFinite(load)) {
    throw new RangeError(`Load for ${date} must be a finite number, received: ${String(load)}`);
  }
  return load;
}

/** Sums every entry falling in the 7 days ending at `endDay` inclusive. */
function blockSum(loads: readonly LoadEntry[], endDay: number): number {
  const startDay = endDay - 6;
  let total = 0;
  for (const entry of loads) {
    const day = toDayNumber(entry.date);
    if (day >= startDay && day <= endDay) {
      total += toLoadValue(entry.load, entry.date);
    }
  }
  return total;
}

/** Rounds half away from zero, so -0.4615 and 0.4615 round symmetrically. */
function round(value: number, decimalPlaces: number): number {
  const factor = 10 ** decimalPlaces;
  // The trailing `+ 0` normalises -0 to 0.
  return (Math.sign(value) * Math.round(Math.abs(value) * factor)) / factor + 0;
}

/**
 * Total load over the 7 days ending at `asOf` inclusive (`asOf - 6` ... `asOf`).
 * A session exactly 7 days before `asOf` is outside this window.
 */
export function acuteLoad(loads: readonly LoadEntry[], asOf: string): number {
  return blockSum(loads, toDayNumber(asOf));
}

/**
 * Mean of the four trailing 7-day block sums covering the 28 days ending `asOf`
 * inclusive. Blocks with no sessions count as 0 - a missed week is a real drop in
 * chronic load, not a gap to be skipped over.
 */
export function chronicWeeklyAvg(loads: readonly LoadEntry[], asOf: string): number {
  const asOfDay = toDayNumber(asOf);
  let total = 0;
  for (let block = 0; block < 4; block += 1) {
    total += blockSum(loads, asOfDay - block * 7);
  }
  return total / 4;
}

/**
 * Acute:chronic workload ratio, rounded to 2dp.
 *
 * Returns `insufficient_data` - a distinct union member carrying no number -
 * when there is no full 28 days of history behind `asOf`, or when the chronic
 * average is 0. There is deliberately no sentinel ratio: a fabricated 0, -1 or
 * 1.0 would render as a real reading in the squad list, and "we don't know yet"
 * has to stay visibly different from "this player is fine".
 */
export function acwr(loads: readonly LoadEntry[], asOf: string): AcwrResult {
  const asOfDay = toDayNumber(asOf);
  const windowStartDay = asOfDay - 27;

  let earliestDay: number | null = null;
  for (const entry of loads) {
    const day = toDayNumber(entry.date);
    if (earliestDay === null || day < earliestDay) {
      earliestDay = day;
    }
  }
  if (earliestDay === null || earliestDay > windowStartDay) {
    return { kind: "insufficient_data" };
  }

  const chronic = chronicWeeklyAvg(loads, asOf);
  if (chronic === 0) {
    return { kind: "insufficient_data" };
  }

  return { kind: "ratio", value: round(acuteLoad(loads, asOf) / chronic, 2) };
}

/**
 * Change from last week's block (`asOf - 13` ... `asOf - 7`) to this week's
 * (`asOf - 6` ... `asOf`), as a fraction rounded to 3dp: 0.462 is +46.2%.
 *
 * Returns `insufficient_data` when last week's block sums to 0 (the percentage
 * would be infinite) or when there is no recorded session before this week at
 * all - a player's first week has nothing to compare against.
 */
export function weekOnWeekChange(loads: readonly LoadEntry[], asOf: string): WeekOnWeekResult {
  const asOfDay = toDayNumber(asOf);
  const thisWeekStartDay = asOfDay - 6;

  const hasPriorData = loads.some((entry) => toDayNumber(entry.date) < thisWeekStartDay);
  if (!hasPriorData) {
    return { kind: "insufficient_data" };
  }

  const lastWeek = blockSum(loads, asOfDay - 7);
  if (lastWeek === 0) {
    return { kind: "insufficient_data" };
  }

  const thisWeek = blockSum(loads, asOfDay);
  return { kind: "pct", value: round((thisWeek - lastWeek) / lastWeek, 3) };
}

/**
 * Maps a player's ACWR onto an availability flag.
 *
 * - `cold`  - no ACWR available (see {@link acwr}); we are not claiming anything.
 * - `watch` - below `watchLow` (undercooked) or above `watchHigh` up to and
 *             including `redHigh` (ramping).
 * - `red`   - strictly above `redHigh`.
 * - `ok`    - inside `watchLow` ... `watchHigh` inclusive.
 *
 * Thresholds are injectable so the band edges are a product decision made
 * against real part-time data, not a constant baked into the engine.
 */
export function flagFor(
  loads: readonly LoadEntry[],
  asOf: string,
  thresholds: AcwrThresholds = DEFAULT_ACWR_THRESHOLDS,
): LoadFlag {
  const result = acwr(loads, asOf);
  if (result.kind === "insufficient_data") {
    return "cold";
  }

  const ratio = result.value;
  if (ratio > thresholds.redHigh) {
    return "red";
  }
  if (ratio < thresholds.watchLow || ratio > thresholds.watchHigh) {
    return "watch";
  }
  return "ok";
}
