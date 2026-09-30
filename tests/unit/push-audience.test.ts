import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));
const { audienceUsers, pushToUsers } = await import("@/lib/push/send");

describe("who a push reaches", () => {
  const members = [
    { user_id: "gaffer", role: "manager" as const },
    { user_id: "physio", role: "medical" as const },
    { user_id: "p1", role: "player" as const },
    { user_id: "p2", role: "player" as const },
  ];
  it("only the roles the notice is for", () => {
    expect(audienceUsers(members, ["player"])).toEqual(["p1", "p2"]);
    expect(audienceUsers(members, ["medical"])).toEqual(["physio"]);
  });
  it("never the person who posted it", () => {
    expect(audienceUsers(members, ["manager", "player"], "gaffer")).toEqual(["p1", "p2"]);
  });
  it("says it skipped, rather than pretending it sent, when the keys are missing", async () => {
    delete process.env.VAPID_PRIVATE_KEY;
    expect(await pushToUsers("c", ["p1"], { title: "t", url: "/" })).toEqual({ sent: 0, pruned: 0, failed: 0, skipped: "not configured" });
  });
});
