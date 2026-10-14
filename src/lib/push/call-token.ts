/**
 * Answering a match call from the notification itself. The push carries a
 * token signed for one player and one fixture; the service worker posts it
 * back with "in", "out" or "unsure". No session cookie is needed (a phone's
 * session may have lapsed since the push left), and none is trusted: the
 * token is the whole credential, so it names exactly one player, one
 * fixture, and an expiry, and the server's HMAC is what makes it true.
 *
 * Replaying a token re-answers the same call for the same player: the write
 * is an upsert on (fixture, player), so a replay can never add a row or touch
 * anyone else's call. That is the whole blast radius, by design.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

import { CALL_STATUSES, type CallStatus } from "@/lib/types";

export const CALL_TOKEN_TTL_SECONDS = 48 * 60 * 60;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type CallClaim = { playerId: string; fixtureId: string; exp: number };

const b64url = (b: Buffer) => b.toString("base64url");

export function callTokenSecret(env: NodeJS.ProcessEnv = process.env): string | null {
  const s = env.CALL_TOKEN_SECRET;
  return s && s.length >= 32 ? s : null;
}

export function signCallToken(claim: CallClaim, secret: string): string {
  const body = `${claim.playerId}.${claim.fixtureId}.${claim.exp}`;
  const mac = createHmac("sha256", secret).update(body).digest();
  return `${b64url(Buffer.from(body))}.${b64url(mac)}`;
}

export type VerifyResult = { ok: true; claim: CallClaim } | { ok: false; reason: "malformed" | "forged" | "expired" };

/** nowSeconds is passed in so tests never read the clock. */
export function verifyCallToken(token: unknown, secret: string, nowSeconds: number): VerifyResult {
  if (typeof token !== "string" || token.length > 400) return { ok: false, reason: "malformed" };
  const [bodyPart, macPart, extra] = token.split(".");
  if (!bodyPart || !macPart || extra !== undefined) return { ok: false, reason: "malformed" };
  const body = Buffer.from(bodyPart, "base64url").toString("utf8");
  const [playerId, fixtureId, expRaw, more] = body.split(".");
  const exp = Number(expRaw);
  if (more !== undefined || !UUID.test(playerId ?? "") || !UUID.test(fixtureId ?? "") || !Number.isInteger(exp)) return { ok: false, reason: "malformed" };
  const want = createHmac("sha256", secret).update(body).digest();
  const got = Buffer.from(macPart, "base64url");
  if (got.length !== want.length || !timingSafeEqual(got, want)) return { ok: false, reason: "forged" };
  if (exp <= nowSeconds) return { ok: false, reason: "expired" };
  return { ok: true, claim: { playerId, fixtureId, exp } };
}

/* ── the answer ───────────────────────────────────────────────────────── */

export type CallStore = {
  player(id: string): Promise<{ club_id: string; retired_on: string | null } | null>;
  fixture(id: string): Promise<{ club_id: string; match_date: string; opponent: string } | null>;
  club(id: string): Promise<{ is_demo: boolean; demo_writable: boolean } | null>;
  upsertCall(row: { club_id: string; fixture_id: string; player_id: string; status: CallStatus; via: "push"; updated_at: string }): Promise<void>;
};

export type AnswerResult =
  | { ok: true; status: CallStatus; opponent: string }
  | { ok: false; code: 400 | 401 | 404 | 409; reason: string };

export async function answerCall(
  input: { token: unknown; status: unknown },
  deps: { store: CallStore; secret: string; nowSeconds: number; today: string },
): Promise<AnswerResult> {
  if (typeof input.status !== "string" || !(CALL_STATUSES as readonly string[]).includes(input.status)) {
    return { ok: false, code: 400, reason: "status is in, out or unsure" };
  }
  const v = verifyCallToken(input.token, deps.secret, deps.nowSeconds);
  if (!v.ok) return { ok: false, code: 401, reason: v.reason === "expired" ? "this call has closed; open the app to answer" : "not a call we sent" };
  const { playerId, fixtureId } = v.claim;
  const [player, fixture] = await Promise.all([deps.store.player(playerId), deps.store.fixture(fixtureId)]);
  if (!player || !fixture || player.club_id !== fixture.club_id || player.retired_on) return { ok: false, code: 404, reason: "that player or match is not at this club" };
  const club = await deps.store.club(player.club_id);
  if (!club || (club.is_demo && !club.demo_writable)) return { ok: false, code: 404, reason: "this club does not take calls" };
  if (fixture.match_date < deps.today) return { ok: false, code: 409, reason: "that match has been played" };
  const status = input.status as CallStatus;
  await deps.store.upsertCall({
    club_id: player.club_id,
    fixture_id: fixtureId,
    player_id: playerId,
    status,
    via: "push",
    updated_at: new Date(deps.nowSeconds * 1000).toISOString(),
  });
  return { ok: true, status, opponent: fixture.opponent };
}
