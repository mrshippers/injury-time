import { describe, expect, it } from "vitest";

import { parseSquadPaste } from "@/lib/signup/paste";

// Thirty lines the way they arrive: a WhatsApp list, a sheet column, a team sheet.
const MESSY = [
  "Squad 26/27:",
  "1 Danny Flynn GK",
  "Jordan Mcnally, MF, 7",
  "KUSHAN THOMAJ\tST\t9",
  "james kimber (cb) 5",
  "Jack Kimber #4 defender",
  "• Hodje Joaquim - winger - 11",
  "Tom O'Brien 6 (c)",
  "Liam McCarthy, Midfielder",
  "Ade Ola",
  "Sam Hughes | LB | 3",
  "Kai Bennett 23 keeper",
  "Marcus de Souza / CAM / 10",
  "Ryan Patel 8 cm",
  "Josh Wright (14)",
  "  Oscar Lane   2   rb  ",
  "No. 17 Callum Price fwd",
  "Ben Ward 16 sub",
  "Ellis Grant 🔥 18 st",
  "Zak Mohammed 99",
  "Lewis Hart 120",
  "Nathan Cole 12 15",
  "Harry Dean gk mf",
  "Dylan Shaw 7",
  "Jordan Mcnally 19",
  "Frankie Yeo Jnr 21 dm",
  "Ty Reid 22 lw",
  "--",
  "Elijah Brooks2 FW",
  "Charlie Moss rwb 24",
];

describe("pasting a squad", () => {
  const r = parseSquadPaste(MESSY.join("\n"));
  const byName = new Map(r.players.map((p) => [p.name, p]));

  it("reads thirty messy lines", () => {
    expect(MESSY).toHaveLength(30);
  });

  it("gets every name, position and number right on the lines it accepts", () => {
    expect(r.players).toEqual([
      { name: "Danny Flynn", position: "GK", number: 1 },
      { name: "Jordan Mcnally", position: "MF", number: 7 },
      { name: "Kushan Thomaj", position: "FW", number: 9 },
      { name: "James Kimber", position: "DF", number: 5 },
      { name: "Jack Kimber", position: "DF", number: 4 },
      { name: "Hodje Joaquim", position: "FW", number: 11 },
      { name: "Tom O'Brien", position: null, number: 6 },
      { name: "Liam McCarthy", position: "MF", number: null },
      { name: "Ade Ola", position: null, number: null },
      { name: "Sam Hughes", position: "DF", number: 3 },
      { name: "Kai Bennett", position: "GK", number: 23 },
      { name: "Marcus de Souza", position: "MF", number: 10 },
      { name: "Ryan Patel", position: "MF", number: 8 },
      { name: "Josh Wright", position: null, number: 14 },
      { name: "Oscar Lane", position: "DF", number: 2 },
      { name: "Callum Price", position: "FW", number: 17 },
      { name: "Ben Ward", position: null, number: 16 },
      { name: "Ellis Grant", position: "FW", number: 18 },
      { name: "Zak Mohammed", position: null, number: 99 },
      { name: "Dylan Shaw", position: null, number: null },
      { name: "Frankie Yeo Jnr", position: "MF", number: 21 },
      { name: "Ty Reid", position: "FW", number: 22 },
      { name: "Charlie Moss", position: "DF", number: 24 },
    ]);
  });

  it("says why it left a line out, and never guesses", () => {
    expect(r.skipped.map((s) => [s.line.trim(), s.reason])).toEqual([
      ["Squad 26/27:", "a heading, not a player"],
      ["Lewis Hart 120", "120 is not a squad number (1 to 99)"],
      ["Nathan Cole 12 15", "two numbers (12 and 15)"],
      ["Harry Dean gk mf", "two positions (GK and MF)"],
      ["Dylan Shaw 7", "number 7 is taken by someone above; Dylan Shaw added without one"],
      ["Jordan Mcnally 19", "Jordan Mcnally is listed twice"],
      ["--", "no name on this line"],
      ["Elijah Brooks2 FW", "\"Brooks2\" is not a name, a number or a position"],
    ]);
  });

  it("accounts for every line: accepted plus skipped, the clash counted once each way", () => {
    // Dylan Shaw is both accepted (no number) and noted
    expect(r.players.length + r.skipped.length - 1).toBe(30);
    expect(byName.get("Dylan Shaw")?.number).toBeNull();
  });
});

describe("a numbered list is not a list of shirts", () => {
  it("drops 1. 2. 3. when they run in order", () => {
    const r = parseSquadPaste("1. Danny Flynn\n2. Jordan Mcnally 7\n3) Kai Bennett");
    expect(r.players).toEqual([
      { name: "Danny Flynn", position: null, number: null },
      { name: "Jordan Mcnally", position: null, number: 7 },
      { name: "Kai Bennett", position: null, number: null },
    ]);
  });
  it("keeps the number when the list does not run 1, 2, 3", () => {
    const r = parseSquadPaste("7. Jordan Mcnally\n9. Kushan Thomaj");
    expect(r.players.map((p) => p.number)).toEqual([7, 9]);
  });
  it("skips a heading and blank lines", () => {
    const r = parseSquadPaste("Defenders:\n\n\nJames Kimber 5");
    expect(r.players).toEqual([{ name: "James Kimber", position: null, number: 5 }]);
    expect(r.skipped).toEqual([{ line: "Defenders:", reason: "a heading, not a player" }]);
  });
  it("caps a paste at sixty lines and says so", () => {
    const r = parseSquadPaste(Array.from({ length: 62 }, (_, i) => `Player ${String.fromCharCode(65 + (i % 26))}${String.fromCharCode(65 + Math.floor(i / 26)).repeat(2)}`).join("\n"));
    expect(r.players).toHaveLength(60);
    expect(r.skipped).toHaveLength(2);
  });
});
