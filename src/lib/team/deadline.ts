/**
 * When answers close for a match. A deadline is the gaffer's to set; until it passes a player can change
 * his mind, after it only staff can. Pure: the caller passes "now", so the board and the tests agree.
 */
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function isClosed(closesAt: string | null | undefined, nowMs: number): boolean {
  return !!closesAt && Date.parse(closesAt) <= nowMs;
}

/** "Thu 21:00", in the reader's own clock. */
export function closeLabel(closesAt: string): string {
  const d = new Date(closesAt);
  return `${DAYS[d.getDay()]} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** "in 2 days", "in 5 hours", "in 40 min"; null once it has passed. */
export function timeLeft(closesAt: string, nowMs: number): string | null {
  const ms = Date.parse(closesAt) - nowMs;
  if (ms <= 0) return null;
  const min = Math.ceil(ms / 60000);
  if (min < 60) return `in ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 48) return `in ${h} hour${h === 1 ? "" : "s"}`;
  return `in ${Math.floor(h / 24)} days`;
}

/**
 * One-tap deadlines for a match: two nights before at 9pm, the night before at 9pm. Built in the browser's
 * local time (the gaffer's clock), only the ones still ahead of now.
 */
export function presets(matchDate: string, nowMs: number): { label: string; iso: string }[] {
  const [y, m, d] = matchDate.split("-").map(Number);
  return [2, 1]
    .map((back) => {
      const at = new Date(y, m - 1, d - back, 21, 0, 0);
      return { label: `${DAYS[at.getDay()]} 9pm`, iso: at.toISOString() };
    })
    .filter((p) => Date.parse(p.iso) > nowMs);
}
