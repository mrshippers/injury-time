/**
 * Club configuration that is policy, not data: who can do what, how health is
 * worded, which shapes a side can take, and where the season feed comes from.
 * Pure constants and types; safe to import anywhere.
 */
import type { ClubRole, Position } from "@/lib/types";

/* ── roles ──────────────────────────────────────────────────────────────── */

export type Capability =
  | "pick_side"
  | "log_session"
  | "set_availability"
  | "edit_injuries"
  | "edit_body"
  | "post_notice"
  | "manage_squad"
  | "manage_film"
  | "call_self"
  | "view_squad_health"
  | "view_own_health";

export const ROLE_META: Record<ClubRole, { label: string; blurb: string; can: readonly Capability[] }> = {
  manager: {
    label: "manager",
    blurb: "picks the side, sees everything",
    can: [
      "pick_side",
      "log_session",
      "set_availability",
      "edit_injuries",
      "post_notice",
      "manage_squad",
      "manage_film",
      "view_squad_health",
    ],
  },
  coach: {
    label: "coach",
    blurb: "runs sessions, logs them, posts to the squad",
    can: ["pick_side", "log_session", "set_availability", "post_notice", "manage_film", "view_squad_health"],
  },
  medical: {
    label: "medical",
    blurb: "physio or S&C: injuries, availability, the body",
    can: ["log_session", "set_availability", "edit_injuries", "edit_body", "post_notice", "view_squad_health"],
  },
  player: {
    label: "player",
    blurb: "calls in or out, sees their own numbers",
    can: ["call_self", "view_own_health"],
  },
};

export function can(role: ClubRole | null, capability: Capability): boolean {
  if (!role) return false;
  return ROLE_META[role].can.includes(capability);
}

/* ── health language ─────────────────────────────────────────────────────── */

/**
 * `plain` is the word and the sentence a gaffer says; `detailed` shows the
 * physio the numbers underneath (ratio, week change, load in AU). Stored on
 * the club (`clubs.settings.health_language`) and overridable per browser.
 */
export const HEALTH_LANGUAGES = ["plain", "detailed"] as const;
export type HealthLanguage = (typeof HEALTH_LANGUAGES)[number];
export const HEALTH_LANGUAGE_META: Record<HealthLanguage, { label: string; blurb: string }> = {
  plain: { label: "plain", blurb: "a word and what to do about it" },
  detailed: { label: "detailed", blurb: "the numbers a physio or S&C coach wants" },
};
export const HEALTH_LANGUAGE_STORAGE_KEY = "injury-time.health-language";

/* ── formations ──────────────────────────────────────────────────────────── */

/**
 * The shapes actually used at this level, most common first. `rows` is
 * outfield lines from the back; the keeper is implied. `roles` gives each
 * slot its position so the auto-pick knows who belongs where.
 */
export type FormationTemplate = {
  name: string;
  rows: number[];
  roles: Position[][];
  note: string;
};

export const FORMATION_TEMPLATES: FormationTemplate[] = [
  { name: "4-2-3-1", rows: [4, 2, 3, 1], roles: [["DF", "DF", "DF", "DF"], ["MF", "MF"], ["MF", "MF", "MF"], ["FW"]], note: "the default shape at every level now" },
  { name: "4-3-3", rows: [4, 3, 3], roles: [["DF", "DF", "DF", "DF"], ["MF", "MF", "MF"], ["FW", "FW", "FW"]], note: "wide forwards, one pivot" },
  { name: "4-4-2", rows: [4, 4, 2], roles: [["DF", "DF", "DF", "DF"], ["MF", "MF", "MF", "MF"], ["FW", "FW"]], note: "two up top, non-league's own" },
  { name: "3-5-2", rows: [3, 5, 2], roles: [["DF", "DF", "DF"], ["MF", "MF", "MF", "MF", "MF"], ["FW", "FW"]], note: "wing-backs, three at the back" },
  { name: "3-4-3", rows: [3, 4, 3], roles: [["DF", "DF", "DF"], ["MF", "MF", "MF", "MF"], ["FW", "FW", "FW"]], note: "front three, back three" },
  { name: "4-1-4-1", rows: [4, 1, 4, 1], roles: [["DF", "DF", "DF", "DF"], ["MF"], ["MF", "MF", "MF", "MF"], ["FW"]], note: "one sitter, a flat four ahead" },
  { name: "4-4-1-1", rows: [4, 4, 1, 1], roles: [["DF", "DF", "DF", "DF"], ["MF", "MF", "MF", "MF"], ["FW"], ["FW"]], note: "a ten off the striker" },
  { name: "5-3-2", rows: [5, 3, 2], roles: [["DF", "DF", "DF", "DF", "DF"], ["MF", "MF", "MF"], ["FW", "FW"]], note: "away from home, sit in" },
  { name: "3-4-2-1", rows: [3, 4, 2, 1], roles: [["DF", "DF", "DF"], ["MF", "MF", "MF", "MF"], ["FW", "FW"], ["FW"]], note: "two behind one" },
  { name: "4-3-1-2", rows: [4, 3, 1, 2], roles: [["DF", "DF", "DF", "DF"], ["MF", "MF", "MF"], ["MF"], ["FW", "FW"]], note: "narrow diamond" },
  { name: "5-4-1", rows: [5, 4, 1], roles: [["DF", "DF", "DF", "DF", "DF"], ["MF", "MF", "MF", "MF"], ["FW"]], note: "hold what you have" },
  { name: "4-5-1", rows: [4, 5, 1], roles: [["DF", "DF", "DF", "DF"], ["MF", "MF", "MF", "MF", "MF"], ["FW"]], note: "pack the middle" },
];

/* ── season feed ─────────────────────────────────────────────────────────── */

/**
 * Football Web Pages covers Steps 1-6 and gives non-league clubs a free key on
 * request (FWP-API-Key header, ten requests a minute). Until the key is in
 * place the app reads the committed snapshot in `scripts/belstone-2026-27.json`.
 */
export const SEASON_FEED = {
  provider: "footballwebpages",
  baseUrl: "https://api.footballwebpages.co.uk/v2",
  keyHeader: "FWP-API-Key",
  keyEnv: "FWP_API_KEY",
  teamEnv: "FWP_TEAM_ID",
  rateLimitPerMinute: 10,
  endpoints: {
    fixtures: "fixtures-results.json",
    table: "league-table.json",
    progress: "league-progress.json",
    appearances: "appearances.json",
    goalscorers: "goalscorers.json",
    attendances: "attendances.json",
    formGuide: "form-guide.json",
  },
} as const;

/** Where a "good season" sits for a 22-team Step 6 division: points per game. */
export const SEASON_BENCHMARKS = {
  /** 42 games; 2.0 ppg has been enough for the top two most seasons */
  promotionPpg: 2.0,
  playoffPpg: 1.75,
  midTablePpg: 1.3,
  gamesInSeason: 42,
  christmasCutoff: "12-25",
} as const;
