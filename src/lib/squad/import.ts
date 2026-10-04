/**
 * Squad from the feed. When a club connects its Football Web Pages key, the
 * league's appearance list becomes the squad: missing players are created,
 * players already there are left exactly as the manager set them.
 *
 * The one thing it must never do is merge two different people. A false merge
 * hangs one man's appearances on another and nobody notices; a duplicate is a
 * row the manager can see and retire.
 *
 * The grid (scripts/grid-squad-match.ts) settled how: no similarity threshold
 * separates a typo ("Tom Smyth") from a different person ("Tim Smith"); every
 * column that matched typos also merged strangers. So a name is matched only on
 * an equivalence that cannot be two people (case, accents, Jnr, word order, an
 * initial that fits exactly one player). A near miss is held back for the
 * manager to say "same player" or "new"; everything else is a new player.
 */
/** a feed name at least this alike to a squad name is held for the manager, not created */
export const REVIEW_THRESHOLD = 0.85;

const SUFFIXES = new Set(["jnr", "jr", "junior", "snr", "sr", "senior", "ii", "iii"]);

/** lower case, accents off, punctuation off, Jnr/Snr off, single spaces */
export function normaliseName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['’`.]/g, "")
    .replace(/[^a-z\s-]/g, " ")
    .replace(/-/g, " ")
    .split(/\s+/)
    .filter((t) => t && !SUFFIXES.has(t))
    .join(" ");
}

/** Jaro-Winkler similarity, 0 to 1. */
export function jaroWinkler(a: string, b: string): number {
  if (a === b) return 1;
  if (!a.length || !b.length) return 0;
  const range = Math.max(0, Math.floor(Math.max(a.length, b.length) / 2) - 1);
  const aHit = new Array<boolean>(a.length).fill(false);
  const bHit = new Array<boolean>(b.length).fill(false);
  let matches = 0;
  for (let i = 0; i < a.length; i += 1) {
    for (let j = Math.max(0, i - range); j < Math.min(b.length, i + range + 1); j += 1) {
      if (bHit[j] || a[i] !== b[j]) continue;
      aHit[i] = bHit[j] = true;
      matches += 1;
      break;
    }
  }
  if (!matches) return 0;
  let t = 0;
  let k = 0;
  for (let i = 0; i < a.length; i += 1) {
    if (!aHit[i]) continue;
    while (!bHit[k]) k += 1;
    if (a[i] !== b[k]) t += 1;
    k += 1;
  }
  const jaro = (matches / a.length + matches / b.length + (matches - t / 2) / matches) / 3;
  let prefix = 0;
  while (prefix < 4 && a[prefix] === b[prefix]) prefix += 1;
  return jaro + prefix * 0.1 * (1 - jaro);
}

export type NameMatch = { kind: "same" | "reordered" | "initial" | "near"; score: number };

/**
 * How two names relate. "same", "reordered" and "initial" are equivalences a
 * match may rest on; "near" is only a similarity score, 0 to 1, and is never
 * enough on its own to say two names are one person.
 */
export function compareNames(a: string, b: string): NameMatch {
  const na = normaliseName(a);
  const nb = normaliseName(b);
  if (!na || !nb) return { kind: "near", score: 0 };
  if (na === nb) return { kind: "same", score: 1 };
  const ta = na.split(" ");
  const tb = nb.split(" ");
  const sorted = (t: string[]) => [...t].sort().join(" ");
  if (sorted(ta) === sorted(tb)) return { kind: "reordered", score: 1 };
  // an initial against a first name: same surname, same first letter
  if (ta.length === 2 && tb.length === 2) {
    const [fa, sa] = ta;
    const [fb, sb] = tb;
    if (sa === sb && (fa.length === 1 || fb.length === 1) && fa[0] === fb[0]) return { kind: "initial", score: 1 };
  }
  return { kind: "near", score: Math.max(jaroWinkler(na, nb), jaroWinkler(sorted(ta), sorted(tb))) };
}

export type FeedPlayer = { name: string; apps: number };
export type SquadPlayer = { id: string; name: string };

export type ImportPlan = {
  create: FeedPlayer[];
  matched: { feedName: string; playerId: string; playerName: string; how: NameMatch["kind"] }[];
  /** near misses: the manager says "same player" or "new" */
  review: { feedName: string; apps: number; looksLike: { id: string; name: string }[] }[];
  skipped: { name: string; reason: string }[];
};

export function planSquadImport(
  feed: readonly FeedPlayer[],
  squad: readonly SquadPlayer[],
  opts: { reviewThreshold?: number } = {},
): ImportPlan {
  const reviewAt = opts.reviewThreshold ?? REVIEW_THRESHOLD;
  const plan: ImportPlan = { create: [], matched: [], review: [], skipped: [] };
  const taken = new Map<string, string>(); // player id -> feed name that claimed it
  const seenFeed = new Set<string>();

  for (const f of feed) {
    const name = f.name.replace(/\s+/g, " ").trim();
    const key = normaliseName(name);
    if (key.length < 2) {
      plan.skipped.push({ name: f.name, reason: "no usable name in the feed" });
      continue;
    }
    if (seenFeed.has(key)) {
      plan.skipped.push({ name, reason: "listed twice in the feed" });
      continue;
    }
    seenFeed.add(key);

    const compared = squad.map((p) => ({ p, m: compareNames(name, p.name) }));
    const equivalent = compared.filter((c) => c.m.kind !== "near");
    // "same" beats "reordered" beats "initial": James Kimber is James Kimber even with a J Kimber about
    const rank = { same: 0, reordered: 1, initial: 2, near: 3 } as const;
    const bestKind = equivalent.reduce<NameMatch["kind"] | null>((k, c) => (k === null || rank[c.m.kind] < rank[k] ? c.m.kind : k), null);
    const top = equivalent.filter((c) => c.m.kind === bestKind);

    if (top.length === 1) {
      const p = top[0].p;
      const claimedBy = taken.get(p.id);
      if (claimedBy) {
        plan.skipped.push({ name, reason: `${p.name} already matched ${claimedBy}; two feed names for one player` });
        continue;
      }
      taken.set(p.id, name);
      plan.matched.push({ feedName: name, playerId: p.id, playerName: p.name, how: top[0].m.kind });
      continue;
    }
    // two players fit an equivalence (J Kimber: James or Jack), or a near miss: the manager decides
    const near = (top.length > 1 ? top : compared.filter((c) => c.m.score >= reviewAt))
      .sort((a, b) => b.m.score - a.m.score)
      .slice(0, 3)
      .map((c) => ({ id: c.p.id, name: c.p.name }));
    if (near.length) plan.review.push({ feedName: name, apps: f.apps, looksLike: near });
    else plan.create.push({ name, apps: f.apps });
  }
  return plan;
}
