import { describe, expect, it } from "vitest";

import { suggestSession } from "@/lib/log/suggest";

const played = [{ match_date: "2026-10-10", opponent: "Baldock Town" }, { match_date: "2026-10-06", opponent: "Bovingdon" }];

describe("suggestSession", () => {
  it("opens on the match played in the last three days", () => {
    expect(suggestSession("2026-10-12", played, new Set())).toEqual({ kind: "match", date: "2026-10-10", opponent: "Baldock Town" });
  });
  it("is training once the match is more than three days old", () => {
    expect(suggestSession("2026-10-14", played, new Set())).toEqual({ kind: "training" });
  });
  it("is training when the match is already logged", () => {
    expect(suggestSession("2026-10-12", played, new Set(["2026-10-10"]))).toEqual({ kind: "training" });
  });
  it("never suggests a match still to come", () => {
    expect(suggestSession("2026-10-12", [{ match_date: "2026-10-17", opponent: "Staines" }], new Set())).toEqual({ kind: "training" });
  });
});
