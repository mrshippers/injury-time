import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));
const { audienceUsers, matchCallItems, pushToUsers } = await import("@/lib/push/send");
const { verifyCallToken, signCallToken } = await import("@/lib/push/call-token");

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

describe("a match call, one payload per player", () => {
  const fixture = { id: "ffffffff-ffff-4fff-8fff-fffffffffff1", opponent: "Hendon" };
  const players = [
    { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1", user_id: "u1" },
    { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2", user_id: null },
    { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3", user_id: "u3" },
  ];
  const secret = "s".repeat(40);
  const sign = (pid: string, fid: string) => signCallToken({ playerId: pid, fixtureId: fid, exp: 2_000_000_000 }, secret);

  it("reaches only players with an account, each with buttons signed for them alone", () => {
    const items = matchCallItems(fixture, players, sign);
    expect(items.map((i) => i.userId)).toEqual(["u1", "u3"]);
    const claims = items.map((i) => verifyCallToken(i.payload.call?.token, secret, 1_000_000_000));
    expect(claims.map((c) => (c.ok ? c.claim.playerId : c.reason))).toEqual([players[0].id, players[2].id]);
    expect(items[0].payload).toMatchObject({ url: "/team", tag: `call:${fixture.id}`, title: "are you in for Hendon?" });
  });
  it("without a secret the push still goes, with no buttons", () => {
    const items = matchCallItems(fixture, players, null);
    expect(items.every((i) => i.payload.call === undefined)).toBe(true);
    expect(items[0].payload.body).toBe("tap to say in, out or unsure");
  });
});
