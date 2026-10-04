import { describe, expect, it } from "vitest";

import { answerCall, signCallToken, verifyCallToken, type CallStore } from "@/lib/push/call-token";

const SECRET = "x".repeat(40);
const NOW = 1_790_000_000; // seconds; the test never reads the clock
const TODAY = "2026-10-04";
const CLUB = "11111111-1111-4111-8111-111111111111";
const OTHER_CLUB = "22222222-2222-4222-8222-222222222222";
const READONLY_CLUB = "33333333-3333-4333-8333-333333333333";
const P1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
const P2 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2";
const P_OTHER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3";
const P_RETIRED = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4";
const P_RO = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5";
const F_NEXT = "ffffffff-ffff-4fff-8fff-fffffffffff1";
const F_PLAYED = "ffffffff-ffff-4fff-8fff-fffffffffff2";
const F_OTHER = "ffffffff-ffff-4fff-8fff-fffffffffff3";
const F_RO = "ffffffff-ffff-4fff-8fff-fffffffffff4";

function memoryStore() {
  const rows = new Map<string, { status: string; via: string }>();
  const store: CallStore = {
    async player(id) {
      return ({ [P1]: { club_id: CLUB, retired_on: null }, [P2]: { club_id: CLUB, retired_on: null }, [P_OTHER]: { club_id: OTHER_CLUB, retired_on: null }, [P_RETIRED]: { club_id: CLUB, retired_on: "2026-09-01" }, [P_RO]: { club_id: READONLY_CLUB, retired_on: null } } as Record<string, { club_id: string; retired_on: string | null }>)[id] ?? null;
    },
    async fixture(id) {
      return ({ [F_NEXT]: { club_id: CLUB, match_date: "2026-10-10", opponent: "Probe Rovers" }, [F_PLAYED]: { club_id: CLUB, match_date: "2026-09-27", opponent: "Old Boys" }, [F_OTHER]: { club_id: OTHER_CLUB, match_date: "2026-10-10", opponent: "Elsewhere" }, [F_RO]: { club_id: READONLY_CLUB, match_date: "2026-10-10", opponent: "Public" } } as Record<string, { club_id: string; match_date: string; opponent: string }>)[id] ?? null;
    },
    async club(id) {
      if (id === READONLY_CLUB) return { is_demo: true, demo_writable: false };
      return { is_demo: false, demo_writable: false };
    },
    async upsertCall(row) {
      rows.set(`${row.fixture_id}:${row.player_id}`, { status: row.status, via: row.via });
    },
  };
  return { store, rows };
}

const tok = (playerId: string, fixtureId: string, exp = NOW + 3600, secret = SECRET) => signCallToken({ playerId, fixtureId, exp }, secret);

describe("call tokens", () => {
  it("round-trips, and refuses tampering, other secrets, expiry and junk", () => {
    const t = tok(P1, F_NEXT);
    expect(verifyCallToken(t, SECRET, NOW)).toEqual({ ok: true, claim: { playerId: P1, fixtureId: F_NEXT, exp: NOW + 3600 } });
    const [body, mac] = t.split(".");
    const swapped = Buffer.from(Buffer.from(body, "base64url").toString().replace(P1, P2)).toString("base64url");
    expect(verifyCallToken(`${swapped}.${mac}`, SECRET, NOW)).toEqual({ ok: false, reason: "forged" });
    expect(verifyCallToken(tok(P1, F_NEXT, NOW + 3600, "y".repeat(40)), SECRET, NOW)).toEqual({ ok: false, reason: "forged" });
    expect(verifyCallToken(tok(P1, F_NEXT, NOW - 1), SECRET, NOW)).toEqual({ ok: false, reason: "expired" });
    expect(verifyCallToken("nonsense", SECRET, NOW)).toEqual({ ok: false, reason: "malformed" });
    expect(verifyCallToken(`${t}.extra`, SECRET, NOW)).toEqual({ ok: false, reason: "malformed" });
  });
});

describe("answering from the lock screen, fifty times", () => {
  it("accepts exactly the valid ones and writes one row per player per match", async () => {
    const { store, rows } = memoryStore();
    const deps = { store, secret: SECRET, nowSeconds: NOW, today: TODAY };
    const statuses = ["in", "out", "unsure"] as const;
    type Case = { kind: string; token: string; status: string; expect: boolean };
    const cases: Case[] = [];
    for (let i = 0; i < 50; i += 1) {
      const s = statuses[i % 3];
      switch (i % 10) {
        case 0: case 1: case 2: cases.push({ kind: "valid", token: tok(i % 2 ? P1 : P2, F_NEXT), status: s, expect: true }); break;
        case 3: cases.push({ kind: "replayed", token: tok(P1, F_NEXT), status: "in", expect: true }); break;
        case 4: cases.push({ kind: "expired", token: tok(P1, F_NEXT, NOW - 60), status: s, expect: false }); break;
        case 5: {
          const [b, m] = tok(P1, F_NEXT).split(".");
          const forged = Buffer.from(Buffer.from(b, "base64url").toString().replace(P1, P2)).toString("base64url");
          cases.push({ kind: "tampered", token: `${forged}.${m}`, status: s, expect: false });
          break;
        }
        case 6: cases.push({ kind: "other club's fixture", token: tok(P1, F_OTHER), status: s, expect: false }); break;
        case 7: cases.push({ kind: "played match", token: tok(P1, F_PLAYED), status: s, expect: false }); break;
        case 8: cases.push({ kind: i === 8 ? "retired player" : "read-only public club", token: i === 8 ? tok(P_RETIRED, F_NEXT) : tok(P_RO, F_RO), status: s, expect: false }); break;
        case 9: cases.push({ kind: "bad status", token: tok(P2, F_NEXT), status: "maybe", expect: false }); break;
      }
    }
    expect(cases).toHaveLength(50);

    const tally = new Map<string, { accepted: number; refused: number }>();
    const ms: number[] = [];
    for (const c of cases) {
      const t0 = performance.now();
      const r = await answerCall({ token: c.token, status: c.status }, deps);
      ms.push(performance.now() - t0);
      const row = tally.get(c.kind) ?? { accepted: 0, refused: 0 };
      if (r.ok) row.accepted += 1;
      else row.refused += 1;
      tally.set(c.kind, row);
      expect(r.ok, `${c.kind}`).toBe(c.expect);
    }

    // the evidence the brief asks for, printed
    console.log("kind                    accepted refused");
    for (const [k, v] of tally) console.log(`${k.padEnd(24)}${String(v.accepted).padStart(8)}${String(v.refused).padStart(8)}`);
    ms.sort((a, b) => a - b);
    console.log(`handler p95 ${ms[Math.floor(ms.length * 0.95)].toFixed(2)} ms (in process; the network and the phone are not in this number)`);
    console.log(`rows written: ${rows.size} (${[...rows.keys()].join(", ")})`);

    // two players answered one match: two rows, however many taps and replays
    expect(rows.size).toBe(2);
    expect([...rows.values()].every((r) => r.via === "push")).toBe(true);
    expect(tally.get("valid")!.accepted + tally.get("replayed")!.accepted).toBe(20);
  });
});
