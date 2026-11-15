import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));
const { confirmPayload, nightsToChase, reminderItems, reminderPayload } = await import("@/lib/push/training");
const { draftNight, dueNights, nightsBetween } = await import("@/lib/log/training");

const tue = { id: "s-tue", weekday: 2, start_time: "19:30:00", minutes: 90, default_rpe: 6, active_from: "2026-11-01", active_to: null };
const night = nightsBetween([tue], "2026-11-10", "2026-11-10")[0];

describe("training pushes", () => {
  it("tells players the time and the length", () => {
    expect(reminderPayload(night)).toMatchObject({ title: "Training tonight at 19:30", body: "90 minutes", url: "/team" });
  });
  it("sends one reminder per player with an account", () => {
    const items = reminderItems([night], [{ user_id: "u1" }, { user_id: null }, { user_id: "u1" }, { user_id: "u2" }]);
    expect(items.map((i) => i.userId)).toEqual(["u1", "u2"]);
  });
  it("sends nothing when there is no night", () => {
    expect(reminderItems([], [{ user_id: "u1" }])).toEqual([]);
  });
  it("asks staff to confirm last night with the draft line", () => {
    const draft = draftNight(night, [{ id: "a", name: "A", status: null }, { id: "b", name: "B", status: "injured" }], []);
    expect(confirmPayload(night, draft, "2026-11-11")).toMatchObject({ title: "Confirm last night's session", body: "1 player, effort 6", url: "/log" });
  });
  it("names the day once it is older than last night", () => {
    const draft = draftNight(night, [], []);
    expect(confirmPayload(night, draft, "2026-11-12").title).toBe("Confirm Tuesday's session");
  });
  it("chases for three mornings, then stops", () => {
    const due = (today: string) => dueNights({ schedule: [tue], now: { date: today, time: "09:00" }, logged: new Set(), skipped: new Set() });
    expect(nightsToChase(due("2026-11-11"), "2026-11-11")).toHaveLength(1);
    expect(nightsToChase(due("2026-11-12"), "2026-11-12")).toHaveLength(1);
    expect(nightsToChase(due("2026-11-13"), "2026-11-13")).toHaveLength(1);
    expect(nightsToChase(due("2026-11-14"), "2026-11-14")).toHaveLength(0);
  });
});
