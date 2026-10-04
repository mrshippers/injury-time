import { CALL_TOKEN_TTL_SECONDS, callTokenSecret, signCallToken } from "./call-token";

/** A signer for match-call buttons, or null when no secret is set (buttons off, pushes still go). Server only. */
export function callSigner(nowSeconds = Math.floor(Date.now() / 1000)): ((playerId: string, fixtureId: string) => string) | null {
  const secret = callTokenSecret();
  if (!secret) return null;
  return (playerId, fixtureId) => signCallToken({ playerId, fixtureId, exp: nowSeconds + CALL_TOKEN_TTL_SECONDS }, secret);
}
