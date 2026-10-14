/**
 * Squad-from-the-feed name matching, swept. For each way a feed spells a name
 * differently from the squad (rows) and each match threshold (columns), it
 * runs the real planner against a squad full of near-twins and prints:
 *
 *   ok  every variant matched the right player
 *   ??  none matched; all held for the manager ("looks like Tom Smith: same player?")
 *   --  none matched; all created as new players (a duplicate the manager can retire)
 *   m/r/c  matched / held for review / created, out of the squad
 *   !!  at least one matched the WRONG player: a false merge
 *
 * The threshold is where "held for review" starts; below it a name is a new
 * player. Matching itself rests only on equivalences (lib/squad/import.ts),
 * which is why no column can show !!: the first sweep, with a similarity
 * threshold for matching, showed !!11 on the stranger row at every threshold.
 * The "stranger" row is different people with near names (Tim Smith when only
 * Tom Smith is in the squad): ?? is right for them, !! is a false merge.
 *
 *   npm run grid:squad-match
 */
import { REVIEW_THRESHOLD, planSquadImport, type SquadPlayer } from "../src/lib/squad/import";

const SQUAD: SquadPlayer[] = [
  "James Kimber", "Jack Kimber", "Tom Smith", "Dan Jones", "Sam Hughes", "Josh Wright", "Jordan Mcnally",
  "Hodje Joaquim", "Kushan Thomaj", "Ryan Patel", "Marcus de Souza", "Liam McCarthy", "Oscar Lane",
  "Callum Price", "Ben Ward", "Ellis Grant", "Zak Mohammed", "Frankie Yeo", "Ty Reid", "Charlie Moss",
  "Daniel Flynn", "Kai Bennett", "Nathan Cole", "Lewis Hart", "Harry Dean",
].map((name, i) => ({ id: `p${i}`, name }));

// near-twins who are NOT in the squad: matching any of them merges two people
const STRANGERS = ["Tim Smith", "Dean Jones", "Sean Hughes", "Jake Kimber", "Jack Wright", "Ryan Patil", "Liam McCartney", "Harry Deane", "Nathan Coles", "Ben Ward-Ellis", "Lewis Hunt", "Charlie Ross"];

const mutate = (s: string, at: number) => {
  const i = Math.max(1, Math.min(s.length - 2, at));
  const c = s[i];
  const swap = c === "a" ? "e" : c === "e" ? "a" : c === "o" ? "u" : c === "i" ? "y" : c === " " ? " " : String.fromCharCode(((c.toLowerCase().charCodeAt(0) - 96) % 26) + 97);
  return s.slice(0, i) + swap + s.slice(i + 1);
};
const surnameTypo = (name: string, n: number) => {
  const [first, ...rest] = name.split(" ");
  let sur = rest.join(" ");
  for (let k = 0; k < n; k += 1) sur = mutate(sur, Math.floor(sur.length / 2) + k * 2);
  return `${first} ${sur}`;
};

const VARIANTS: [string, (name: string) => string][] = [
  ["case", (n) => n.toUpperCase()],
  ["accent", (n) => n.replace(/e/, "é").replace(/a/, "á")],
  ["initial", (n) => `${n[0]} ${n.split(" ").slice(1).join(" ")}`],
  ["jnr/snr", (n) => `${n} Jnr`],
  ["swapped order", (n) => `${n.split(" ").slice(1).join(" ")} ${n.split(" ")[0]}`],
  ["typo distance 1", (n) => surnameTypo(n, 1)],
  ["typo distance 2", (n) => surnameTypo(n, 2)],
];

const THRESHOLDS = [0.7, 0.75, 0.8, 0.85, 0.9, 0.95];
const cell = (s: string) => s.padStart(9);

console.log(`squad of ${SQUAD.length}, ${STRANGERS.length} strangers; shipping threshold ${REVIEW_THRESHOLD}\n`);
console.log("variant".padEnd(18) + THRESHOLDS.map((t) => cell(t.toFixed(2))).join(""));

let shippedFalseMerges = 0;
for (const [label, make] of VARIANTS) {
  const row = THRESHOLDS.map((threshold) => {
    let right = 0;
    let wrong = 0;
    let held = 0;
    let created = 0;
    for (const p of SQUAD) {
      const plan = planSquadImport([{ name: make(p.name), apps: 1 }], SQUAD, { reviewThreshold: threshold });
      const m = plan.matched[0];
      if (m && m.playerId === p.id) right += 1;
      else if (m) wrong += 1;
      else if (plan.review.length) held += 1;
      else created += 1;
    }
    if (wrong && threshold === REVIEW_THRESHOLD) shippedFalseMerges += wrong;
    const n = SQUAD.length;
    return wrong ? "!!" : right === n ? "ok" : held === n ? "??" : created === n ? "--" : `${right}/${held}/${created}`;
  });
  console.log(label.padEnd(18) + row.map(cell).join(""));
}
const strangerRow = THRESHOLDS.map((threshold) => {
  const plan = planSquadImport(STRANGERS.map((name) => ({ name, apps: 1 })), SQUAD, { reviewThreshold: threshold });
  if (threshold === REVIEW_THRESHOLD) shippedFalseMerges += plan.matched.length;
  return plan.matched.length ? `!!${plan.matched.length}` : plan.review.length === STRANGERS.length ? "??" : plan.create.length === STRANGERS.length ? "--" : `0/${plan.review.length}/${plan.create.length}`;
});
console.log("stranger".padEnd(18) + strangerRow.map(cell).join(""));

console.log(`\nfalse merges at the shipping threshold (${REVIEW_THRESHOLD}): ${shippedFalseMerges}`);
process.exit(shippedFalseMerges ? 1 : 0);
