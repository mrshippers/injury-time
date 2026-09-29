import { describe, expect, it } from "vitest";

import { minutesPlayed } from "../../src/lib/matchday/minutes";

const xi = ["a", "b", "c"];

describe("minutes from the touchline", () => {
  it("gives the XI the whole game when nobody comes off", () => {
    expect(minutesPlayed(xi, [], 90)).toEqual({ a: 90, b: 90, c: 90 });
  });
  it("splits a substitution at the minute it happened", () => {
    expect(minutesPlayed(xi, [{ minute: 60, off: "a", on: "d" }], 90)).toEqual({ a: 60, b: 90, c: 90, d: 30 });
  });
  it("handles a sub who is later subbed off, in any tap order", () => {
    const m = minutesPlayed(xi, [{ minute: 80, off: "d", on: "e" }, { minute: 50, off: "a", on: "d" }], 90);
    expect(m).toMatchObject({ a: 50, d: 30, e: 10 });
  });
  it("ignores a tap that takes off someone not on the pitch", () => {
    expect(minutesPlayed(xi, [{ minute: 30, off: "z", on: "d" }], 90)).toEqual({ a: 90, b: 90, c: 90 });
  });
  it("counts a stoppage-time sub as one minute, not zero", () => {
    expect(minutesPlayed(xi, [{ minute: 94, off: "a", on: "d" }], 94)).toMatchObject({ a: 94, d: 1 });
  });
});
