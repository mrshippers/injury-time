import { describe, expect, it } from "vitest";

import { PREF_DEFAULTS, PREF_KEYS, withDefaults, whoWants } from "@/lib/push/prefs";

describe("notification preferences", () => {
  it("defaults: reminders off, everything else on", () => {
    expect(PREF_DEFAULTS).toEqual({ training_reminder: false, training_confirm: true, match_calls: true, notices: true });
    expect(PREF_KEYS).toHaveLength(4);
  });
  it("fills what a row leaves out", () => {
    expect(withDefaults(null)).toEqual(PREF_DEFAULTS);
    expect(withDefaults({ training_reminder: true })).toEqual({ ...PREF_DEFAULTS, training_reminder: true });
  });
  it("sends a reminder only to people who turned it on", () => {
    const rows = [{ user_id: "a", training_reminder: true }, { user_id: "b", training_reminder: false }];
    expect(whoWants(["a", "b", "c"], rows, "training_reminder")).toEqual(["a"]);
  });
  it("sends everything else to people with no row, and not to people who turned it off", () => {
    const rows = [{ user_id: "a", match_calls: false }];
    expect(whoWants(["a", "b"], rows, "match_calls")).toEqual(["b"]);
    expect(whoWants(["a", "b"], rows, "notices")).toEqual(["a", "b"]);
    expect(whoWants(["a", "b"], rows, "training_confirm")).toEqual(["a", "b"]);
  });
});
