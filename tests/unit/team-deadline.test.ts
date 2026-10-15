import { describe, expect, it } from "vitest";

import { closeLabel, isClosed, presets, timeLeft } from "@/lib/team/deadline";

const at = (y: number, m: number, d: number, h = 0, min = 0) => new Date(y, m - 1, d, h, min).getTime();

describe("call deadline", () => {
  const close = new Date(2026, 9, 15, 21, 0).toISOString(); // Thu 15 Oct, 9pm
  it("no deadline is never closed", () => expect(isClosed(null, at(2030, 1, 1))).toBe(false));
  it("closes at the minute, not after", () => {
    expect(isClosed(close, at(2026, 10, 15, 20, 59))).toBe(false);
    expect(isClosed(close, at(2026, 10, 15, 21, 0))).toBe(true);
  });
  it("says the day and time", () => expect(closeLabel(close)).toBe("Thu 21:00"));
  it("counts down in words that fit a glance", () => {
    expect(timeLeft(close, at(2026, 10, 13, 9))).toBe("in 2 days");
    expect(timeLeft(close, at(2026, 10, 15, 16))).toBe("in 5 hours");
    expect(timeLeft(close, at(2026, 10, 15, 20, 20))).toBe("in 40 min");
    expect(timeLeft(close, at(2026, 10, 15, 21, 1))).toBeNull();
  });
  it("offers two nights before and the night before at 9pm, only while they're ahead", () => {
    expect(presets("2026-10-17", at(2026, 10, 14, 12)).map((p) => p.label)).toEqual(["Thu 9pm", "Fri 9pm"]);
    expect(presets("2026-10-17", at(2026, 10, 15, 22)).map((p) => p.label)).toEqual(["Fri 9pm"]);
    expect(presets("2026-10-17", at(2026, 10, 17, 9))).toEqual([]);
  });
});
