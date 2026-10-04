/**
 * A squad pasted in, one player per line, the way managers actually have it:
 * a WhatsApp list, a column from a spreadsheet, last season's team sheet.
 *
 *   7 Jordan Mcnally
 *   Jordan Mcnally, MF, 7
 *   Jordan Mcnally (7) midfielder
 *   1. Jordan Mcnally            <- a numbered list, not shirt 1
 *   JORDAN MCNALLY	CM	7        <- tabs from a sheet, shouted
 *
 * Pure. Never invents: a line with no position gives a null position (the
 * squad room asks for it), a line with no number gives a null number, and a
 * line it cannot read is returned with the reason rather than guessed at.
 */
import type { Position } from "@/lib/types";

export type PastedPlayer = { name: string; position: Position | null; number: number | null };
export type PasteResult = { players: PastedPlayer[]; skipped: { line: string; reason: string }[] };

export const PASTE_MAX_LINES = 60;

const POSITION_WORDS: Record<string, Position> = {
  gk: "GK", goalkeeper: "GK", keeper: "GK", goalie: "GK", gkp: "GK",
  df: "DF", def: "DF", defender: "DF", cb: "DF", lb: "DF", rb: "DF", fb: "DF", lwb: "DF", rwb: "DF", "centre-back": "DF", "full-back": "DF", centreback: "DF", fullback: "DF",
  mf: "MF", mid: "MF", midfielder: "MF", midfield: "MF", cm: "MF", dm: "MF", cdm: "MF", am: "MF", cam: "MF", lm: "MF", rm: "MF",
  fw: "FW", fwd: "FW", forward: "FW", striker: "FW", st: "FW", cf: "FW", winger: "FW", wing: "FW", lw: "FW", rw: "FW", att: "FW", attacker: "FW",
};
// words that sit on team sheets but are not part of anyone's name
const NOISE = new Set(["c", "capt", "captain", "vc", "sub", "subs", "new", "trial", "triallist", "loan"]);

const LIST_INDEX = /^\s*(\d{1,2})\s*[.)]\s+(?=\D)/;

function titleCase(name: string): string {
  // only when the paste shouted or whispered; "McNally" and "de Souza" as typed are kept
  if (name !== name.toUpperCase() && name !== name.toLowerCase()) return name;
  return name
    .toLowerCase()
    .replace(/(^|[\s'-])(\p{L})/gu, (_, sep: string, c: string) => sep + c.toUpperCase())
    .replace(/\bMc(\p{L})/gu, (_, c: string) => `Mc${c.toUpperCase()}`);
}

export function parseSquadPaste(text: string): PasteResult {
  const raw = String(text ?? "")
    .split(/\r?\n/)
    .map((l) => l.replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, "").trim())
    .filter((l) => l.length > 0);

  const players: PastedPlayer[] = [];
  const skipped: PasteResult["skipped"] = [];
  if (raw.length > PASTE_MAX_LINES) {
    for (const line of raw.slice(PASTE_MAX_LINES)) skipped.push({ line, reason: `more than ${PASTE_MAX_LINES} lines; add the rest after` });
  }
  const lines = raw.slice(0, PASTE_MAX_LINES);

  // "1. Name / 2. Name / 3. Name" is a list, not shirts 1, 2, 3: every line
  // carries an "N." or "N)" and the Ns run 1, 2, 3 in order
  const indices = lines.map((l) => LIST_INDEX.exec(l)?.[1]);
  const isNumberedList = lines.length >= 2 && indices.every((n, i) => n !== undefined && Number(n) === i + 1);

  const seenNames = new Set<string>();
  const seenNumbers = new Set<number>();

  for (const original of lines) {
    let line = original.replace(/^[-*•·>]+\s*/, "");
    if (isNumberedList) line = line.replace(LIST_INDEX, "");

    if (/:\s*$/.test(line) && line.split(/\s+/).length <= 5) {
      skipped.push({ line: original, reason: "a heading, not a player" });
      continue;
    }

    let position: Position | null = null;
    let number: number | null = null;
    let conflict: string | null = null;
    const nameParts: string[] = [];

    // fields: tabs, commas, pipes, slashes; then words inside each
    const tokens = line
      .split(/[\t,|;/]+/)
      .flatMap((f) => f.replace(/[()[\]{}]/g, " ").split(/\s+/))
      .map((t) => t.trim())
      .filter(Boolean);

    for (const token of tokens) {
      const bare = token.replace(/^#|\.$/g, "").replace(/^no\.?$/i, "");
      if (bare === "") continue;
      const lower = bare.toLowerCase();
      if (/^\d{1,3}$/.test(bare)) {
        const n = Number(bare);
        if (n < 1 || n > 99) conflict = `${bare} is not a squad number (1 to 99)`;
        else if (number !== null && number !== n) conflict = `two numbers (${number} and ${n})`;
        else number = n;
        continue;
      }
      if (POSITION_WORDS[lower]) {
        const p = POSITION_WORDS[lower];
        if (position !== null && position !== p) conflict = `two positions (${position} and ${p})`;
        else position = p;
        continue;
      }
      if (NOISE.has(lower) || !/[\p{L}\d]/u.test(bare)) continue;
      if (/\d/.test(bare)) {
        conflict = `"${token}" is not a name, a number or a position`;
        continue;
      }
      nameParts.push(bare);
    }

    const name = titleCase(nameParts.join(" ").replace(/\s+/g, " ").trim());
    if (conflict) {
      skipped.push({ line: original, reason: conflict });
      continue;
    }
    if (name.length < 2 || !/\p{L}/u.test(name)) {
      skipped.push({ line: original, reason: "no name on this line" });
      continue;
    }
    if (name.length > 60) {
      skipped.push({ line: original, reason: "a name is 60 characters at most" });
      continue;
    }
    const key = name.toLowerCase();
    if (seenNames.has(key)) {
      skipped.push({ line: original, reason: `${name} is listed twice` });
      continue;
    }
    seenNames.add(key);
    if (number !== null && seenNumbers.has(number)) {
      // keep the player, drop the clash: the manager sorts the shirt out in the squad room
      skipped.push({ line: original, reason: `number ${number} is taken by someone above; ${name} added without one` });
      number = null;
    }
    if (number !== null) seenNumbers.add(number);
    players.push({ name, position, number });
  }

  return { players, skipped };
}
