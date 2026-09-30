import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { exchangeCodeForSession: async () => ({ error: null }) } }),
}));

const { GET } = await import("@/app/auth/callback/route");
const land = async (next: string | null) => {
  const u = new URL("https://injury-time.vercel.app/auth/callback?code=abc");
  if (next !== null) u.searchParams.set("next", next);
  const res = await GET(new Request(u) as never);
  return new URL(res.headers.get("location")!).toString();
};

describe("auth callback: back to the claim, never off the site", () => {
  it("returns a player to their claim link", async () => {
    expect(await land("/claim/9f1c2b7e-1111-4222-8333-944455556666")).toBe("https://injury-time.vercel.app/claim/9f1c2b7e-1111-4222-8333-944455556666");
  });
  it("defaults to the squad", async () => {
    expect(await land(null)).toBe("https://injury-time.vercel.app/squad");
  });
  it.each(["//evil.example/x", "/\\\\evil.example", "https://evil.example", "evil.example", "javascript:alert(1)"])("refuses %s", async (bad) => {
    expect(await land(bad)).toBe("https://injury-time.vercel.app/squad");
  });
});
