import { describe, expect, it } from "vitest";

import { planSteps, rtpStatus } from "../../src/lib/health/rtp";
import type { RtpStep } from "../../src/lib/types";

describe("return-to-play plan", () => {
  it("sizes the ladder by severity and ends on the chosen date", () => {
    const plan = planSteps("minor", "2026-09-20", "2026-10-08", "2026-09-28");
    expect(Array.isArray(plan) && plan.map((s) => s.stage)).toEqual(["jogging", "running", "full_training", "match_fit"]);
    expect(Array.isArray(plan) && plan.at(-1)!.target_date).toBe("2026-10-08");
  });
  it("never schedules a stage in the past", () => {
    const plan = planSteps("moderate", "2026-09-01", "2026-10-20", "2026-09-28");
    expect(Array.isArray(plan) && plan.every((s) => s.target_date > "2026-09-28")).toBe(true);
  });
  it("refuses a date too close for the stages", () => {
    expect(planSteps("severe", "2026-09-27", "2026-09-30", "2026-09-28")).toEqual({ error: "8 stages need at least 7 days; pick a later date" });
  });
});

const step = (stage: RtpStep["stage"], target_date: string, done_on: string | null = null): RtpStep => ({ id: stage, club_id: "c", injury_id: "i", stage, target_date, done_on, created_at: "" });

describe("where he is on it", () => {
  it("counts done stages, finds the next and the ready date", () => {
    const s = rtpStatus([step("jogging", "2026-09-25", "2026-09-25"), step("running", "2026-10-01"), step("match_fit", "2026-10-08")], "2026-09-28");
    expect(s).toMatchObject({ done: 1, total: 3, behind: false, readyOn: "2026-10-08" });
    expect(s.next?.stage).toBe("running");
  });
  it("says he is behind when the next stage's date has gone", () => {
    expect(rtpStatus([step("running", "2026-09-26"), step("match_fit", "2026-10-08")], "2026-09-28").behind).toBe(true);
  });
});
