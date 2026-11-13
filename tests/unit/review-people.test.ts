import { describe, expect, it } from "vitest";

import { playerRows, staffRows, tenureWord } from "@/lib/review/people";
import type { SeasonStats } from "@/lib/stats";
import type { ClubStaff, StaffAttendance } from "@/lib/types";

const stats = (s: Partial<SeasonStats>): SeasonStats => ({ apps: 0, starts: 0, minutes: 0, goals: 0, assists: 0, yellow: 0, red: 0, source: "log", ...s });

describe("playerRows", () => {
  const players = [
    { id: "a", name: "Aarush", squad_number: 4, position: "DF" as const, external_stats: { apps: 17, goals: 0 } },
    { id: "b", name: "Bertrand", squad_number: 9, position: "FW" as const, external_stats: { apps: 12, goals: 7 } },
    { id: "c", name: "Craige", squad_number: null, position: null, external_stats: null },
  ];
  const rows = playerRows({
    players,
    stats: new Map([["b", stats({ apps: 10, starts: 8, minutes: 760, goals: 6, assists: 2, yellow: 3, red: 0 })]]),
    injuries: [
      { player_id: "a", occurred_on: "2026-09-01", resolved_on: "2026-09-22", expected_return: null },
      { player_id: "a", occurred_on: "2026-11-01", resolved_on: null, expected_return: null },
    ],
    asOf: "2026-11-13",
  });

  it("uses the log when there is one and the feed when there is not", () => {
    const b = rows.find((r) => r.id === "b")!;
    expect(b).toMatchObject({ apps: 10, goals: 6, starts: 8, minutes: 760, assists: 2, yellow: 3, red: 0, source: "log" });
    const a = rows.find((r) => r.id === "a")!;
    expect(a).toMatchObject({ apps: 17, goals: 0, starts: null, assists: null, yellow: null, source: "feed" });
  });

  it("counts injury spells and the days they cost, an open spell to asOf", () => {
    const a = rows.find((r) => r.id === "a")!;
    expect(a.injuries).toBe(2);
    expect(a.daysOut).toBe(21 + 12);
  });

  it("says nothing for a player with no log and no feed", () => {
    const c = rows.find((r) => r.id === "c")!;
    expect(c).toMatchObject({ apps: 0, goals: 0, starts: null, source: "none", injuries: 0 });
  });

  it("orders by apps then goals", () => {
    expect(rows.map((r) => r.id)).toEqual(["a", "b", "c"]);
  });
});

describe("staffRows", () => {
  const staff: ClubStaff[] = [
    { id: "s1", club_id: "c", user_id: null, name: "Dave", title: "physio", role: "medical", joined_on: "2025-08-01", left_on: null, created_at: "" },
    { id: "s2", club_id: "c", user_id: "u", name: "Gaffer", title: "manager", role: "manager", joined_on: "2024-06-01", left_on: null, created_at: "" },
    { id: "s3", club_id: "c", user_id: null, name: "Kit", title: "kit man", role: "other", joined_on: "2026-08-01", left_on: "2026-10-01", created_at: "" },
  ];
  const sessions = [
    { id: "m1", kind: "match" as const, session_date: "2026-08-15" },
    { id: "m2", kind: "match" as const, session_date: "2026-08-22" },
    { id: "t1", kind: "training" as const, session_date: "2026-08-18" },
  ];
  const attendance: StaffAttendance[] = [
    { staff_id: "s1", session_id: "m1", club_id: "c", present: true },
    { staff_id: "s1", session_id: "m2", club_id: "c", present: false },
    { staff_id: "s1", session_id: "t1", club_id: "c", present: true },
  ];
  const rows = staffRows({ staff, attendance, sessions, asOf: "2026-11-13" });

  it("puts the manager first, then coaches, medical, the rest", () => {
    expect(rows.map((r) => r.id)).toEqual(["s2", "s1", "s3"]);
  });

  it("counts matchdays and sessions marked present against those held", () => {
    const dave = rows.find((r) => r.id === "s1")!;
    expect(dave).toMatchObject({ matchdays: 1, sessions: 1, matchdaysHeld: 2, sessionsHeld: 1 });
  });

  it("leaves attendance null for someone never marked, and stops tenure at the day they left", () => {
    const kit = rows.find((r) => r.id === "s3")!;
    expect(kit.matchdays).toBeNull();
    expect(kit.tenureDays).toBe(61);
  });

  it("words tenure", () => {
    expect(tenureWord(10)).toBe("1 wk");
    expect(tenureWord(61)).toBe("2 mo");
    expect(tenureWord(400)).toBe("1 yr 1 mo");
    expect(tenureWord(730)).toBe("2 yrs");
  });
});
