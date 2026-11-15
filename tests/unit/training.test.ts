import { describe, expect, it } from "vitest";

import { suggestSession } from "@/lib/log/suggest";
import {
  addDays,
  draftLine,
  draftNight,
  dueNights,
  isoWeekday,
  londonNow,
  nightKey,
  nightLabel,
  nightsBetween,
  type ScheduleRow,
} from "@/lib/log/training";

const tue: ScheduleRow = { id: "s-tue", weekday: 2, start_time: "19:30:00", minutes: 90, default_rpe: 6, active_from: "2026-08-01", active_to: null };
const thu: ScheduleRow = { id: "s-thu", weekday: 4, start_time: "19:30:00", minutes: 90, default_rpe: 7, active_from: "2026-08-01", active_to: null };
const none = new Set<string>();

describe("dates", () => {
  it("numbers weekdays Monday 1 to Sunday 7", () => {
    expect(isoWeekday("2026-11-09")).toBe(1);
    expect(isoWeekday("2026-11-10")).toBe(2);
    expect(isoWeekday("2026-11-15")).toBe(7);
  });
  it("adds days across a month end and a leap day", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
  });
  it("reads the London clock in both BST and GMT", () => {
    expect(londonNow(new Date("2026-10-24T18:30:00Z"))).toEqual({ date: "2026-10-24", time: "19:30" });
    expect(londonNow(new Date("2026-10-25T19:30:00Z"))).toEqual({ date: "2026-10-25", time: "19:30" });
  });
  it("keeps the London date when UTC is a day behind", () => {
    expect(londonNow(new Date("2026-07-01T23:30:00Z"))).toEqual({ date: "2026-07-02", time: "00:30" });
  });
});

describe("nightsBetween", () => {
  it("lists each scheduled weekday in the range, oldest first", () => {
    const n = nightsBetween([thu, tue], "2026-11-09", "2026-11-15");
    expect(n.map((x) => x.date)).toEqual(["2026-11-10", "2026-11-12"]);
    expect(n[0]).toMatchObject({ scheduleId: "s-tue", startTime: "19:30", minutes: 90, defaultRpe: 6 });
  });
  it("respects the active window on both ends", () => {
    const row = { ...tue, active_from: "2026-11-10", active_to: "2026-11-17" };
    expect(nightsBetween([row], "2026-11-01", "2026-11-30").map((x) => x.date)).toEqual(["2026-11-10", "2026-11-17"]);
  });
  it("is empty with no schedule", () => {
    expect(nightsBetween([], "2026-11-01", "2026-11-30")).toEqual([]);
  });
});

describe("dueNights", () => {
  const at = (date: string, time: string) => ({ date, time });
  // a schedule that began that week, so earlier Tuesdays are not in play
  const from = (date: string, row: ScheduleRow = tue): ScheduleRow => ({ ...row, active_from: date });

  it("is not due while the night is on or has not started", () => {
    expect(dueNights({ schedule: [from("2026-11-10")], now: at("2026-11-10", "18:00"), logged: none, skipped: none })).toEqual([]);
    expect(dueNights({ schedule: [from("2026-11-10")], now: at("2026-11-10", "20:59"), logged: none, skipped: none })).toEqual([]);
  });
  it("is due once the night has finished", () => {
    const d = dueNights({ schedule: [from("2026-11-10")], now: at("2026-11-10", "21:00"), logged: none, skipped: none });
    expect(d.map((x) => x.date)).toEqual(["2026-11-10"]);
  });
  it("is due the next morning", () => {
    expect(dueNights({ schedule: [tue], now: at("2026-11-11", "08:00"), logged: none, skipped: none })).toHaveLength(1);
  });
  it("lists newest first across two nights", () => {
    const d = dueNights({ schedule: [tue, thu], now: at("2026-11-13", "09:00"), logged: none, skipped: none });
    expect(d.map((x) => x.date)).toEqual(["2026-11-12", "2026-11-10"]);
  });
  it("drops a night that is logged", () => {
    const d = dueNights({ schedule: [tue, thu], now: at("2026-11-13", "09:00"), logged: new Set([nightKey("s-tue", "2026-11-10")]), skipped: none });
    expect(d.map((x) => x.date)).toEqual(["2026-11-12"]);
  });
  it("drops a night that is skipped", () => {
    const d = dueNights({ schedule: [tue, thu], now: at("2026-11-13", "09:00"), logged: none, skipped: new Set([nightKey("s-thu", "2026-11-12")]) });
    expect(d.map((x) => x.date)).toEqual(["2026-11-10"]);
  });
  it("stops asking after a week", () => {
    const on = (date: string) => dueNights({ schedule: [tue], now: at(date, "09:00"), logged: none, skipped: none }).map((x) => x.date);
    expect(on("2026-11-17")).toEqual(["2026-11-10"]);
    expect(on("2026-11-18")).toEqual(["2026-11-17"]);
  });
  it("never asks about a night before the schedule began", () => {
    const row = { ...tue, active_from: "2026-11-11" };
    expect(dueNights({ schedule: [row], now: at("2026-11-12", "09:00"), logged: none, skipped: none })).toEqual([]);
  });
  it("waits for the next date when the night runs past midnight", () => {
    const late = { ...tue, start_time: "22:30:00", minutes: 120, active_from: "2026-11-10" };
    expect(dueNights({ schedule: [late], now: at("2026-11-10", "23:59"), logged: none, skipped: none })).toEqual([]);
    expect(dueNights({ schedule: [late], now: at("2026-11-11", "00:05"), logged: none, skipped: none })).toHaveLength(1);
  });
  it("holds the 19:30 start across the clocks going back", () => {
    // Tuesday 27 October 2026 is GMT; the clocks went back on Sunday 25th
    const now = londonNow(new Date("2026-10-27T21:00:00Z"));
    expect(now).toEqual({ date: "2026-10-27", time: "21:00" });
    expect(dueNights({ schedule: [from("2026-10-27")], now, logged: none, skipped: none }).map((x) => x.date)).toEqual(["2026-10-27"]);
  });
});

describe("draftNight", () => {
  const night = nightsBetween([tue], "2026-11-10", "2026-11-10")[0];
  const squad = [
    { id: "a", name: "Dan Ruck", status: "fit" as const },
    { id: "b", name: "Kit Owusu", status: null },
    { id: "c", name: "Sam Pell", status: "injured" as const },
    { id: "d", name: "Joe Imo", status: "suspended" as const },
    { id: "e", name: "Tom Vale", status: "doubt" as const },
  ];

  it("puts in everyone not injured or suspended, at the schedule's minutes and effort", () => {
    const d = draftNight(night, squad, []);
    expect(d.entries).toEqual([
      { playerId: "a", rpe: 6, minutes: 90 },
      { playerId: "b", rpe: 6, minutes: 90 },
      { playerId: "e", rpe: 6, minutes: 90 },
    ]);
    expect(d.left.map((l) => l.playerId)).toEqual(["c", "d"]);
    expect(d.fromCheckins).toBe(0);
  });
  it("uses a player's own check-in from the next day", () => {
    const d = draftNight(night, squad, [{ player_id: "a", checkin_on: "2026-11-11", last_rpe: 8 }]);
    expect(d.entries.find((e) => e.playerId === "a")?.rpe).toBe(8);
    expect(d.entries.find((e) => e.playerId === "b")?.rpe).toBe(6);
    expect(d.fromCheckins).toBe(1);
  });
  it("ignores a check-in from before the night or more than two days after", () => {
    const d = draftNight(night, squad, [
      { player_id: "a", checkin_on: "2026-11-10", last_rpe: 9 },
      { player_id: "b", checkin_on: "2026-11-13", last_rpe: 9 },
    ]);
    expect(d.entries.every((e) => e.rpe === 6)).toBe(true);
    expect(d.fromCheckins).toBe(0);
  });
  it("takes the earliest check-in and skips one with no effort", () => {
    const d = draftNight(night, squad, [
      { player_id: "a", checkin_on: "2026-11-12", last_rpe: 3 },
      { player_id: "a", checkin_on: "2026-11-11", last_rpe: 7 },
      { player_id: "b", checkin_on: "2026-11-11", last_rpe: null },
    ]);
    expect(d.entries.find((e) => e.playerId === "a")?.rpe).toBe(7);
    expect(d.entries.find((e) => e.playerId === "b")?.rpe).toBe(6);
  });
  it("does not use the check-in of an injured player", () => {
    const d = draftNight(night, squad, [{ player_id: "c", checkin_on: "2026-11-11", last_rpe: 5 }]);
    expect(d.entries.some((e) => e.playerId === "c")).toBe(false);
  });
});

describe("lines", () => {
  const night = nightsBetween([tue], "2026-11-10", "2026-11-10")[0];
  it("says how many and how hard", () => {
    expect(draftLine(draftNight(night, [{ id: "a", name: "A", status: null }, { id: "b", name: "B", status: null }], []))).toBe("2 players, effort 6");
    expect(draftLine(draftNight(night, [{ id: "a", name: "A", status: null }], []))).toBe("1 player, effort 6");
    expect(draftLine(draftNight(night, [], []))).toBe("nobody available");
  });
  it("names the night", () => {
    expect(nightLabel(night)).toBe("Tuesday 19:30");
  });
});

describe("suggestSession with a schedule", () => {
  const due = dueNights({ schedule: [tue], now: { date: "2026-11-11", time: "08:00" }, logged: none, skipped: none });
  it("opens on the due night when no match is waiting", () => {
    expect(suggestSession("2026-11-11", [], none, due)).toEqual({ kind: "training", night: due[0] });
  });
  it("still opens on a recent unlogged match first", () => {
    expect(suggestSession("2026-11-11", [{ match_date: "2026-11-08", opponent: "Staines" }], none, due)).toEqual({ kind: "match", date: "2026-11-08", opponent: "Staines" });
  });
  it("is plain training with nothing due", () => {
    expect(suggestSession("2026-11-11", [], none, [])).toEqual({ kind: "training" });
  });
});
