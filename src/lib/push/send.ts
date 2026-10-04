/**
 * Web push, sent from the server with the service role. Best effort by design:
 * a notice or a chase is already written to the notifications table, which is
 * the record; a push is the tap on the shoulder. A failed or unconfigured push
 * never fails the thing that caused it, and says so in its return value.
 */
import webpush from "web-push";

import { createAdminClient } from "@/lib/supabase/admin";
import type { ClubRole } from "@/lib/types";

export type PushPayload = {
  title: string;
  body?: string;
  url: string;
  tag?: string;
  /** a match call the player can answer from the notification's own buttons (sw.js) */
  call?: { token: string };
};
export type PushReport = { sent: number; pruned: number; failed: number; skipped?: "not configured" | "nobody subscribed" };

let configured: boolean | null = null;
function configure(): boolean {
  if (configured !== null) return configured;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return (configured = false);
  webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? "mailto:jamal@strydeos.com", pub, priv);
  return (configured = true);
}

/** Members of a club in the given roles, minus whoever caused the push. Pure, for the test. */
export function audienceUsers(members: readonly { user_id: string; role: ClubRole }[], roles: readonly ClubRole[], except?: string | null): string[] {
  return [...new Set(members.filter((m) => roles.includes(m.role) && m.user_id !== except).map((m) => m.user_id))];
}

export async function pushToUsers(clubId: string, userIds: readonly string[], payload: PushPayload): Promise<PushReport> {
  return pushEach(clubId, userIds.map((userId) => ({ userId, payload })));
}

/**
 * One payload per person: a match call carries a token signed for that one
 * player, so it cannot be the same bytes for the whole squad.
 */
export async function pushEach(clubId: string, items: readonly { userId: string; payload: PushPayload }[]): Promise<PushReport> {
  if (!configure()) return { sent: 0, pruned: 0, failed: 0, skipped: "not configured" };
  if (!items.length) return { sent: 0, pruned: 0, failed: 0, skipped: "nobody subscribed" };
  const byUser = new Map(items.map((i) => [i.userId, JSON.stringify(i.payload)]));
  const db = createAdminClient();
  const { data, error } = await db.from("push_subscriptions").select("id, user_id, endpoint, p256dh, auth").eq("club_id", clubId).in("user_id", [...byUser.keys()]);
  if (error) throw error;
  if (!data?.length) return { sent: 0, pruned: 0, failed: 0, skipped: "nobody subscribed" };
  const dead: string[] = [];
  let sent = 0;
  let failed = 0;
  await Promise.all(
    data.map(async (s) => {
      const body = byUser.get(s.user_id);
      if (!body) return;
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body, { TTL: 60 * 60 * 24 });
        sent += 1;
      } catch (e) {
        // 404/410: the browser dropped this subscription for good
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) dead.push(s.id);
        else failed += 1;
      }
    }),
  );
  if (dead.length) await db.from("push_subscriptions").delete().in("id", dead);
  return { sent, pruned: dead.length, failed };
}

export async function pushToClub(clubId: string, roles: readonly ClubRole[], payload: PushPayload, except?: string | null): Promise<PushReport> {
  if (!configure()) return { sent: 0, pruned: 0, failed: 0, skipped: "not configured" };
  const db = createAdminClient();
  const { data, error } = await db.from("club_members").select("user_id, role").eq("club_id", clubId);
  if (error) throw error;
  return pushToUsers(clubId, audienceUsers((data ?? []) as { user_id: string; role: ClubRole }[], roles, except), payload);
}

/** One payload per silent player with an account; pure, for the test. */
export function matchCallItems(
  fixture: { id: string; opponent: string },
  players: readonly { id: string; user_id: string | null }[],
  sign: ((playerId: string, fixtureId: string) => string) | null,
): { userId: string; payload: PushPayload }[] {
  return players
    .filter((p): p is { id: string; user_id: string } => Boolean(p.user_id))
    .map((p) => ({
      userId: p.user_id,
      payload: {
        title: `are you in for ${fixture.opponent}?`,
        body: sign ? "answer here: in, out or unsure" : "tap to say in, out or unsure",
        url: "/team",
        tag: `call:${fixture.id}`,
        ...(sign ? { call: { token: sign(p.id, fixture.id) } } : {}),
      },
    }));
}

/**
 * Ask players for a match call, each with buttons signed for them alone. With
 * no CALL_TOKEN_SECRET the push still goes, without buttons: a tap opens the
 * team page, as before.
 */
export async function pushMatchCall(
  clubId: string,
  fixture: { id: string; opponent: string },
  players: readonly { id: string; user_id: string | null }[],
  sign: ((playerId: string, fixtureId: string) => string) | null,
): Promise<PushReport> {
  return pushEach(clubId, matchCallItems(fixture, players, sign));
}
