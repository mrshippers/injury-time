import { describe, expect, it } from "vitest";

import liveSnapshot from "../../scripts/belstone-2026-27.json";
import { homeEdge, leagueAverage, luck, matchOdds, strength, venueForm, type TableRow } from "@/lib/scout/model";

const table = (liveSnapshot as unknown as { table: TableRow[] }).table;
const row = (name: string) => table.find((t) => t.team.startsWith(name))!;

describe("opponent model on the real table", () => {
  it("reads the league's own averages", () => {
    expect(leagueAverage(table)).toBeGreaterThan(1);
    expect(leagueAverage(table)).toBeLessThan(3.5);
    const h = homeEdge(table);
    expect(h).toBeGreaterThanOrEqual(1);
    expect(h).toBeLessThanOrEqual(1.4);
  });
  it("probabilities are a whole and the likeliest scores are ordered", () => {
    const o = matchOdds(row("Belstone"), row("Staines"), "A", table);
    expect(o.win + o.draw + o.loss).toBeCloseTo(1, 2);
    expect(o.scorelines).toHaveLength(3);
    expect(o.scorelines[0].p).toBeGreaterThanOrEqual(o.scorelines[1].p);
  });
  it("home is better than away for the same fixture", () => {
    const home = matchOdds(row("Belstone"), row("Langley"), "H", table);
    const away = matchOdds(row("Belstone"), row("Langley"), "A", table);
    expect(home.win).toBeGreaterThan(away.win);
    expect(home.xgFor).toBeGreaterThan(away.xgFor);
  });
  it("a stronger attack scores more against the same defence", () => {
    const avg = leagueAverage(table);
    expect(strength(row("PFC Victoria"), avg).attack).toBeGreaterThan(strength(row("Spelthorne"), avg).attack);
  });
  it("luck compares points to what the goals say, and venue form reads the split", () => {
    const l = luck(row("Belstone"));
    expect(l.actual).toBe(27);
    expect(Math.abs(l.delta)).toBeLessThan(15);
    const v = venueForm(row("Belstone"));
    expect(v.home).toBeCloseTo(19 / 7, 1);
  });
});
