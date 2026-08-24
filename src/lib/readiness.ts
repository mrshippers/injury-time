/**
 * Readiness vocabulary: the load engine's flag translated into a word a
 * non-league gaffer or physio would use, plus one line saying what to do.
 *
 * The ratio itself (ACWR) stays available for anyone who wants it, but it is
 * never the headline. "Red zone" is what changes what happens on Tuesday;
 * "1.47" is not.
 */
import {
  DEFAULT_ACWR_THRESHOLDS,
  type AcwrResult,
  type LoadFlag,
} from "@/lib/load-engine";

export type ReadinessKey = "unknown" | "undercooked" | "steady" | "pushing" | "red";

export type Readiness = {
  key: ReadinessKey;
  /** One or two words, lowercase, the board label. */
  word: string;
  /** A single plain sentence: what it means and what to do about it. */
  gloss: string;
  /** The engine flag it was derived from, for colour tokens. */
  flag: LoadFlag;
  /** The ratio, if there is one, for a title attribute or a detail line. */
  ratio: number | null;
};

const WORDS: Record<ReadinessKey, { word: string; gloss: string }> = {
  unknown: {
    word: "no reading",
    gloss: "needs four weeks of sessions logged before load means anything",
  },
  undercooked: {
    word: "undercooked",
    gloss: "doing less than his usual, sharpness will drop if it carries on",
  },
  steady: {
    word: "steady",
    gloss: "training about what his body is used to",
  },
  pushing: {
    word: "pushing it",
    gloss: "doing more than usual, ease him off on the next training night",
  },
  red: {
    word: "red zone",
    gloss: "big jump on his usual load, the week a hamstring goes",
  },
};

export function readinessFor(acwr: AcwrResult, flag: LoadFlag): Readiness {
  if (acwr.kind === "insufficient_data" || flag === "cold") {
    return { key: "unknown", ...WORDS.unknown, flag: "cold", ratio: null };
  }
  const ratio = acwr.value;
  let key: ReadinessKey;
  if (flag === "red") key = "red";
  else if (flag === "ok") key = "steady";
  else key = ratio < DEFAULT_ACWR_THRESHOLDS.watchLow ? "undercooked" : "pushing";
  return { key, ...WORDS[key], flag, ratio };
}

/** Tailwind text token per readiness, so the word is never colour-only. */
export const READINESS_TEXT: Record<ReadinessKey, string> = {
  unknown: "text-cold",
  undercooked: "text-doubt",
  steady: "text-fit",
  pushing: "text-doubt",
  red: "text-out",
};

/** CSS custom property per readiness, for SVG / 3D fills. */
export const READINESS_VAR: Record<ReadinessKey, string> = {
  unknown: "var(--cold)",
  undercooked: "var(--doubt)",
  steady: "var(--fit)",
  pushing: "var(--doubt)",
  red: "var(--out)",
};

/** Sort weight for picking a side: steadiest first, red last. */
export const READINESS_RANK: Record<ReadinessKey, number> = {
  steady: 0,
  pushing: 1,
  undercooked: 2,
  unknown: 3,
  red: 4,
};
