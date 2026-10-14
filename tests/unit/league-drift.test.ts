import { describe, expect, it } from "vitest";

import { describeDrift, resultSentence } from "@/lib/league/drift";

const vase = { match_date: "2026-10-10", opponent: "Baldock Town", venue: "H" as const, competition: "FA Vase 1", goals_for: 4, goals_against: 2 };
const woodley = { match_date: "2026-10-03", opponent: "Woodley United", venue: "A" as const, competition: "Combined Counties Div 1", goals_for: 1, goals_against: 4 };
const base = { resultsDetail: [], fixturesAdded: 0, tableNew: false, playersChanged: [] as string[] };

describe("describeDrift", () => {
  it("says a result the way a gaffer would", () => {
    expect(resultSentence(vase)).toBe("Sat 10 Oct, FA Vase 1: won 4-2 v Baldock Town");
    expect(resultSentence(woodley)).toBe("Sat 3 Oct, Combined Counties Div 1: lost 1-4 at Woodley United");
  });
  it("one result is the title, several are a count", () => {
    expect(describeDrift({ ...base, resultsDetail: [vase] }, "Belstone")?.title).toBe("Belstone: won 4-2 v Baldock Town");
    const many = describeDrift({ ...base, resultsDetail: [vase, woodley] }, "Belstone");
    expect(many?.title).toBe("Belstone: 2 new results");
    expect(many?.body.split("\n")[0]).toContain("Sat 3 Oct"); // oldest first
  });
  it("a table or an app count alone is not news", () => {
    expect(describeDrift({ ...base, tableNew: true, playersChanged: ["x"] }, "Belstone")).toBeNull();
  });
  it("a new fixture is news", () => {
    expect(describeDrift({ ...base, fixturesAdded: 1 }, "Belstone")?.body).toBe("One new fixture in the diary.");
  });
});
