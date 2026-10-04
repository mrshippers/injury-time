/**
 * Text fitting for the season card. Satori lays text out but cannot be asked
 * whether it fitted, so the card decides the size first, measuring with Geist's
 * own advance widths (geist-widths.ts, the font the card renders in), and
 * never hands the renderer a line it has not measured.
 */
import { GEIST_UNITS_PER_EM, GEIST_WIDEST, GEIST_WIDTHS } from "./geist-widths";

/** Width in px of one line of text at a font size, from the font's own metrics. */
export function measure(text: string, px: number, letterSpacingEm = 0): number {
  let units = 0;
  for (const ch of text) units += GEIST_WIDTHS[ch.codePointAt(0) ?? 0] ?? GEIST_WIDEST;
  return (units / GEIST_UNITS_PER_EM) * px + Math.max(0, [...text].length - 1) * letterSpacingEm * px;
}

export type Fit = { size: number; lines: string[]; stepped: boolean };

/**
 * The largest size from `sizes` (largest first) at which the text breaks on
 * spaces into at most `maxLines` lines, each within `width`. Null when even
 * the smallest size cannot: the caller must not render it.
 */
export function fitText(text: string, width: number, sizes: readonly number[], maxLines: number, letterSpacingEm = 0): Fit | null {
  const words = text.trim().split(/\s+/).filter(Boolean);
  for (const [i, size] of sizes.entries()) {
    const lines: string[] = [];
    let line = "";
    let ok = true;
    for (const w of words) {
      const next = line ? `${line} ${w}` : w;
      if (measure(next, size, letterSpacingEm) <= width) {
        line = next;
        continue;
      }
      if (!line || measure(w, size, letterSpacingEm) > width) {
        ok = false;
        break;
      }
      lines.push(line);
      line = w;
    }
    if (line) lines.push(line);
    if (ok && lines.length <= maxLines) return { size, lines, stepped: i > 0 };
  }
  return null;
}

/* ── the card's geometry, in px, shared by the renderer and the grid ───── */

export const CARD = { width: 1080, height: 1350, pad: 80 } as const;
export const NAME_SIZES = [128, 112, 96, 84, 72, 64] as const;
export const NAME_LINES = 2;
export const STAT_SIZES = [168, 140, 116, 96, 80] as const;
export const STAT_GAP = 24;

export function statCellWidth(count: number): number {
  return (CARD.width - CARD.pad * 2 - STAT_GAP * (count - 1)) / count;
}

/** One size for every stat number, so the row reads as a row. */
export function fitStats(values: readonly string[]): Fit | null {
  const cell = statCellWidth(values.length);
  for (const [i, size] of STAT_SIZES.entries()) {
    if (values.every((v) => measure(v, size, -0.02) <= cell)) return { size, lines: [...values], stepped: i > 0 };
  }
  return null;
}
