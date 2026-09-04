/**
 * The chart grammar, ported from lieflat-charts (Lupi editorial + Glance) into
 * the Injury Time palette. Every chart in the app draws from these so twelve
 * charts read as one instrument. Values are CSS custom properties where the
 * DOM can use them and plain numbers where SVG needs them.
 *
 * The grammar in one breath: hairline series, a mark per record, the real
 * unit written at the end of the line, a ledger grid with no axis lines,
 * tracked-caps tabular ticks, one annotation in gold where the story turns.
 */
export const CHART = {
  /** Lupi hairline: 0.7px on paper, x1.8 for a dark ground */
  hairline: 1.25,
  /** the emphasised series, still thin */
  lead: 1.75,
  /** a mark per record */
  markRadius: 2.4,
  /** the terminal bead that carries the end reading */
  beadRadius: 3.6,
  /** ledger grid: faint, horizontal only, no axis line */
  grid: "var(--line)",
  gridStrong: "var(--line-strong)",
  /** series ladder by importance: most important = brightest */
  ladder: ["var(--ink)", "var(--ink-dim)", "var(--ink-faint)", "var(--cold)"],
  /** the one annotation colour */
  annotation: "var(--gold)",
  annotationDim: "var(--gold-dim)",
  /** the accent, spent once per chart at most */
  accent: "var(--mint)",
  /** semantic, for the value itself and never a background */
  good: "var(--fit)",
  warn: "var(--doubt)",
  bad: "var(--out)",
  /** type inside the drawing */
  tick: { size: 11, spacing: "0.12em", family: "var(--font-plex-mono), monospace" },
  reading: { size: 12, weight: 700, family: "var(--font-plex-mono), monospace" },
  label: { size: 11.5, family: "var(--font-manrope), system-ui, sans-serif" },
  /** motion: fast in, hard stop, no bounce */
  motion: {
    draw: 700,
    bars: 420,
    easing: "cubic-bezier(0.165, 0.84, 0.44, 1)",
    staggerDot: 12,
    staggerBar: 100,
  },
} as const;

/** A hollow bead when the trend runs against the metric, so shape pairs with colour. */
export function beadFill(against: boolean): { fill: string; stroke: string } {
  return against ? { fill: "var(--panel)", stroke: "var(--doubt)" } : { fill: "var(--ink)", stroke: "var(--ink)" };
}

/**
 * An annotation is a sentence at a point on the drawing: the week a hamstring
 * went, the Christmas line, the game that turned. One per chart, two at most.
 */
export type Annotation = {
  /** x in data units (index, date string, or match number) */
  at: number | string;
  text: string;
  /** which side of the mark the text sits */
  side?: "left" | "right";
  tone?: "gold" | "bad" | "good";
};
