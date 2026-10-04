/**
 * The season card's text, swept: player-name length (rows) against the widest
 * stat (columns, digits), with four stats on the card (the most it carries).
 *
 *   .  name and numbers at full size
 *   s  fits after stepping a size down, or the name breaks onto two lines
 *   X  does not fit at the smallest size: the route refuses (500) rather than clip
 *
 * Names are built from real surnames, each row ending in the widest of them, so
 * a row is the hard case for its length, not an average one. Measured with
 * Geist's own advance widths (lib/card/geist-widths.ts).
 *
 *   npm run grid:card-fit
 */
import { CARD, NAME_LINES, NAME_SIZES, fitStats, fitText } from "../src/lib/card/fit";

const WORDS = ["Wolverhampton", "Mwamba", "Ashworth", "Woodward", "McMillan", "Wawrzyniak", "Bamidele", "Oluwaseun", "Hammond", "Moss", "Ward", "Ola", "Yeo"];
function nameOf(length: number): string {
  // greedy: widest words first, then trim to length on a word boundary or a cut
  let name = "";
  for (const w of WORDS) {
    const next = name ? `${name} ${w}` : w;
    if (next.length <= length) name = next;
  }
  return (name + " " + "Wamwamwamwamwamwam").slice(0, length).trim();
}

const LENGTHS = [4, 8, 12, 16, 20, 24, 28, 32];
const DIGITS = [1, 2, 3, 4];
const inner = CARD.width - CARD.pad * 2;
let clipped = 0;

console.log(`name ${NAME_SIZES[0]} to ${NAME_SIZES[NAME_SIZES.length - 1]} px over ${NAME_LINES} lines in ${inner} px; four stats\n`);
console.log("chars  digits:" + DIGITS.map((d) => String(d).padStart(3)).join("") + "   the name at that length");
for (const n of LENGTHS) {
  const name = nameOf(n);
  const nameFit = fitText(name, inner, NAME_SIZES, NAME_LINES, -0.02);
  const cells = DIGITS.map((d) => {
    const statFit = fitStats(Array.from({ length: 4 }, () => "8".repeat(d)));
    if (!nameFit || !statFit) {
      clipped += 1;
      return "X";
    }
    return nameFit.stepped || nameFit.lines.length > 1 || statFit.stepped ? "s" : ".";
  });
  console.log(String(n).padStart(5) + " ".repeat(8) + cells.map((c) => c.padStart(3)).join("") + `   ${name}${nameFit ? ` (${nameFit.size}px, ${nameFit.lines.length} line${nameFit.lines.length > 1 ? "s" : ""})` : ""}`);
}
console.log(`\ncells that would clip: ${clipped}`);
process.exit(clipped ? 1 : 0);
