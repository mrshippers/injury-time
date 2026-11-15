/**
 * Which pushes a person wants, per club. No row means the defaults: training
 * reminders are off until a player asks, everything else is on. Pure, shared by
 * the settings panel, the sender and the tests.
 */
import type { NotificationPrefs } from "@/lib/types";

export const PREF_KEYS = ["training_reminder", "training_confirm", "match_calls", "notices"] as const;
export type PrefKey = (typeof PREF_KEYS)[number];
export type Prefs = Record<PrefKey, boolean>;

export const PREF_DEFAULTS: Prefs = { training_reminder: false, training_confirm: true, match_calls: true, notices: true };

export const PREF_META: Record<PrefKey, { label: string; note: string }> = {
  training_reminder: { label: "training reminder", note: "players: the morning of a training night" },
  training_confirm: { label: "confirm training", note: "staff: the morning after, until it is confirmed or marked not held" },
  match_calls: { label: "match calls", note: "players: when you are asked if you are in" },
  notices: { label: "notices", note: "posts from the club" },
};

type Row = Partial<Pick<NotificationPrefs, "user_id" | PrefKey>>;

export function withDefaults(row?: Row | null): Prefs {
  return {
    training_reminder: row?.training_reminder ?? PREF_DEFAULTS.training_reminder,
    training_confirm: row?.training_confirm ?? PREF_DEFAULTS.training_confirm,
    match_calls: row?.match_calls ?? PREF_DEFAULTS.match_calls,
    notices: row?.notices ?? PREF_DEFAULTS.notices,
  };
}

/** Of these people, who wants this kind of push. A person with no row gets the default. */
export function whoWants(userIds: readonly string[], rows: readonly (Row & { user_id: string })[], key: PrefKey): string[] {
  const by = new Map(rows.map((r) => [r.user_id, withDefaults(r)]));
  return userIds.filter((id) => (by.get(id) ?? PREF_DEFAULTS)[key]);
}
