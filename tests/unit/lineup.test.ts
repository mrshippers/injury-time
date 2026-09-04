import { describe, expect, it } from "vitest";
import { FORMATIONS, pickXI } from "../../src/lib/lineup";
import type { SquadRow } from "../../src/lib/data";
import type { Position } from "../../src/lib/types";

function row(n: number, position: Position, status: "fit" | "injured" = "fit", key: "steady" | "red" = "steady"): SquadRow {
  return {
    player: { id: `p${n}`, club_id: "c", name: `P${n}`, position, squad_number: n, user_id: null, body_params: null, external_stats: null, retired_on: null, created_at: "" },
    availability: status === "fit" ? null : { player_id: `p${n}`, club_id: "c", status, return_date: null, injury_id: null, noted_on: "" },
    weekLoad: 0,
    acwr: { kind: "insufficient_data" },
    weekChange: { kind: "insufficient_data" },
    flag: key === "red" ? "red" : "ok",
    readiness: { key, word: key, gloss: "", flag: key === "red" ? "red" : "ok", ratio: null },
    stats: { apps: 0, starts: 0, minutes: 0, goals: 0, assists: 0, yellow: 0, red: 0 },
  };
}

const f442 = FORMATIONS.find((f) => f.name === "4-4-2")!;

describe("pickXI", () => {
  it("every formation has eleven slots and one keeper", () => {
    for (const f of FORMATIONS) {
      expect(f.slots).toHaveLength(11);
      expect(f.slots.filter((s) => s.role === "GK")).toHaveLength(1);
    }
  });

  it("fills own roles first and leaves an unfillable slot empty rather than inventing", () => {
    const rows = [row(1, "GK"), row(2, "DF"), row(3, "DF"), row(4, "DF"), row(5, "MF"), row(6, "MF"), row(7, "MF"), row(8, "MF"), row(9, "FW")];
    const xi = pickXI(rows, f442);
    const filled = xi.picks.filter((p) => p.row);
    expect(filled).toHaveLength(9);
    // fourth DF slot borrows nobody because midfield is exhausted after its own slots
    expect(xi.picks.filter((p) => p.outOfPosition)).toHaveLength(0);
    expect(xi.bench).toHaveLength(0);
  });

  it("borrows from a neighbouring role when one is short and marks it", () => {
    const rows = [row(1, "GK"), row(2, "DF"), row(3, "DF"), row(4, "DF"), row(5, "MF"), row(6, "MF"), row(7, "MF"), row(8, "MF"), row(14, "MF"), row(9, "FW"), row(10, "FW")];
    const xi = pickXI(rows, f442);
    const borrowed = xi.picks.filter((p) => p.outOfPosition);
    expect(borrowed).toHaveLength(1);
    expect(borrowed[0].slot.role).toBe("DF");
    expect(borrowed[0].row?.player.position).toBe("MF");
  });

  it("prefers steady over red zone and never picks the injured", () => {
    const rows = [row(1, "GK"), row(13, "GK", "fit", "red"), row(9, "FW", "injured")];
    const xi = pickXI(rows, f442);
    expect(xi.picks[0].row?.player.id).toBe("p1");
    expect(xi.bench.map((r) => r.player.id)).toEqual(["p13"]);
    expect(xi.unavailable.map((r) => r.player.id)).toEqual(["p9"]);
  });
});
