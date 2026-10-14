import { describe, expect, it } from "vitest";

import { mapAppearances } from "@/lib/league/fwp";
import { compareNames, planSquadImport, type SquadPlayer } from "@/lib/squad/import";

import fwp from "../fixtures/fwp-appearances.json";

// The fixture is in the documented FWP shape, not a recording (no key in this repo yet).
const feed = mapAppearances(fwp);

describe("squad from the feed", () => {
  it("reads the appearance list", () => {
    expect(feed).toHaveLength(21);
    expect(feed[0]).toEqual({ name: "Daniel Flynn", apps: 15 });
  });

  it("run twice: the first creates the squad, the second creates nothing", () => {
    // the manager already typed three in, one of them as "Danny"
    let squad: SquadPlayer[] = [
      { id: "m1", name: "Jordan McNally" },
      { id: "m2", name: "Kimber James" },
      { id: "m3", name: "Danny Flynn" },
    ];
    const first = planSquadImport(feed, squad);
    const report = (p: ReturnType<typeof planSquadImport>) =>
      `created ${p.create.length}, matched ${p.matched.length}, held ${p.review.length}, skipped ${p.skipped.length}` +
      (p.skipped.length ? ` (${p.skipped.map((s) => `${s.name || "(blank)"}: ${s.reason}`).join("; ")})` : "");
    console.log(`first run:  ${report(first)}`);
    expect(first.matched.map((m) => [m.feedName, m.playerId, m.how])).toEqual([
      ["Jordan Mcnally", "m1", "same"],
      ["James Kimber", "m2", "reordered"],
    ]);
    // Danny vs Daniel is not an equivalence: held for the manager, not merged, not duplicated
    expect(first.review).toEqual([{ feedName: "Daniel Flynn", apps: 15, looksLike: [{ id: "m3", name: "Danny Flynn" }] }]);
    expect(first.skipped).toEqual([{ name: "", reason: "no usable name in the feed" }]);
    expect(first.create).toHaveLength(17);

    // what the action does with the plan: create the new ones
    squad = [...squad, ...first.create.map((c, i) => ({ id: `n${i}`, name: c.name }))];
    const second = planSquadImport(feed, squad);
    console.log(`second run: ${report(second)}`);
    expect(second.create).toHaveLength(0);
    expect(second.matched).toHaveLength(19);
    expect(second.review).toHaveLength(1); // Danny is still the manager's call
  });

  it("never merges two Kimbers on an initial", () => {
    const squad = [{ id: "a", name: "James Kimber" }, { id: "b", name: "Jack Kimber" }];
    const p = planSquadImport([{ name: "J Kimber", apps: 3 }], squad);
    expect(p.matched).toEqual([]);
    expect(p.review[0].looksLike.map((l) => l.id).sort()).toEqual(["a", "b"]);
  });

  it("an exact name wins over an initial that also fits", () => {
    const squad = [{ id: "a", name: "James Kimber" }, { id: "b", name: "J Kimber" }];
    expect(planSquadImport([{ name: "James Kimber", apps: 1 }], squad).matched[0].playerId).toBe("a");
  });

  it("two feed names for one player: the second is skipped, not merged", () => {
    const squad = [{ id: "a", name: "Tom Smith" }];
    const p = planSquadImport([{ name: "Tom Smith", apps: 1 }, { name: "Smith Tom", apps: 1 }], squad);
    expect(p.matched).toHaveLength(1);
    expect(p.skipped[0].reason).toContain("two feed names for one player");
  });

  it("only equivalences are ever a match", () => {
    expect(compareNames("Frankie Yeo Jnr", "frankie yeo").kind).toBe("same");
    expect(compareNames("Marcus de Souza", "Marcus De Sóuza").kind).toBe("same");
    expect(compareNames("Tim Smith", "Tom Smith").kind).toBe("near");
  });
});
