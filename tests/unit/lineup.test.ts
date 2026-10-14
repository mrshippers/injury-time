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

describe("pickXI with nobody placed, last time's side and the calls", () => {
  const unplaced = (n: number): SquadRow => {
    const r = row(n, "MF");
    return { ...r, player: { ...r.player, external_stats: { position_confirmed: false } as never } };
  };

  it("a player with no position set fills an outfield slot and is never flagged out of position", () => {
    const rows = [row(1, "GK"), ...[2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(unplaced)];
    const xi = pickXI(rows, f442);
    expect(xi.picks.filter((p) => p.row)).toHaveLength(11);
    expect(xi.picks.some((p) => p.outOfPosition)).toBe(false);
  });

  it("never puts a player with no position in goal", () => {
    const xi = pickXI([unplaced(2), unplaced(3)], f442);
    expect(xi.picks[0].slot.role).toBe("GK");
    expect(xi.picks[0].row).toBeNull();
  });

  it("names last time's eleven again before anyone else", () => {
    const rows = [row(1, "GK"), row(2, "DF"), row(3, "DF"), row(12, "DF"), row(13, "DF"), row(14, "DF")];
    const xi = pickXI(rows, f442, { prefer: new Set(["p1", "p12", "p13", "p14", "p2"]) });
    const ids = xi.picks.filter((p) => p.slot.role === "DF").map((p) => p.row?.player.id);
    expect(ids.sort()).toEqual(["p12", "p13", "p14", "p2"]);
    // the one left over is not in a defensive slot: last time's four hold those
    expect(xi.picks.find((p) => p.row?.player.id === "p3")?.slot.role).not.toBe("DF");
  });

  it("leaves out who said out, and puts unsure behind who said in", () => {
    const rows = [row(1, "GK"), row(2, "DF"), row(3, "DF"), row(4, "DF"), row(5, "DF"), row(6, "DF")];
    const calls = new Map([["p2", "out"], ["p3", "unsure"], ["p4", "in"]] as const);
    const xi = pickXI(rows, f442, { calls });
    const dfs = xi.picks.filter((p) => p.slot.role === "DF").map((p) => p.row?.player.id);
    expect(dfs).toEqual(["p4", "p5", "p6", "p3"]);
    expect(xi.bench.map((r) => r.player.id)).toEqual([]);
    expect(xi.picks.every((p) => p.row?.player.id !== "p2")).toBe(true);
  });
});

describe("the default when nothing else separates them", () => {
  it("picks the man who has played most", () => {
    const withApps = (n: number, apps: number): SquadRow => {
      const r = row(n, "DF");
      return { ...r, player: { ...r.player, external_stats: { apps } as never } };
    };
    const rows = [row(1, "GK"), withApps(2, 3), withApps(3, 18), withApps(4, 17), withApps(5, 16), withApps(6, 15)];
    const xi = pickXI(rows, f442);
    const dfs = xi.picks.filter((p) => p.slot.role === "DF").map((p) => p.row?.player.id);
    expect(dfs.sort()).toEqual(["p3", "p4", "p5", "p6"]);
  });
});

describe("players nobody has placed", () => {
  it("the scorers go up front and the rest sit behind them", () => {
    const flex = (n: number, apps: number, goals: number): SquadRow => {
      const r = row(n, "MF");
      return { ...r, player: { ...r.player, external_stats: { apps, goals, position_confirmed: false } as never } };
    };
    const rows = [row(1, "GK"), flex(2, 15, 12), flex(3, 15, 9), ...[4, 5, 6, 7, 8, 9, 10, 11].map((n) => flex(n, 15, 0))];
    const xi = pickXI(rows, f442);
    const front = xi.picks.filter((p) => p.slot.role === "FW").map((p) => p.row?.player.id).sort();
    expect(front).toEqual(["p2", "p3"]);
  });
});
