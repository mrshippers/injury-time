import { answerCall, callTokenSecret, type CallStore } from "@/lib/push/call-token";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * The service worker's answer to a match call, from the buttons on the
 * notification. No session: the signed token is the credential (see
 * lib/push/call-token.ts), checked before the service role touches anything.
 */
export const dynamic = "force-dynamic";

const londonToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date());

export async function POST(request: Request) {
  const secret = callTokenSecret();
  if (!secret) return Response.json({ ok: false, reason: "answers from notifications are not switched on" }, { status: 503 });
  let body: { token?: unknown; status?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ ok: false, reason: "not json" }, { status: 400 });
  }

  const db = createAdminClient();
  const store: CallStore = {
    async player(id) {
      const { data } = await db.from("players").select("club_id, retired_on").eq("id", id).maybeSingle();
      return data;
    },
    async fixture(id) {
      const { data } = await db.from("fixtures").select("club_id, match_date, opponent, calls_close_at").eq("id", id).maybeSingle();
      return data;
    },
    async club(id) {
      const { data } = await db.from("clubs").select("is_demo, demo_writable").eq("id", id).maybeSingle();
      return data;
    },
    async upsertCall(row) {
      const { error } = await db.from("match_calls").upsert(row, { onConflict: "fixture_id,player_id" });
      if (error) throw error;
    },
  };

  try {
    const r = await answerCall({ token: body.token, status: body.status }, { store, secret, nowSeconds: Math.floor(Date.now() / 1000), today: londonToday() });
    return r.ok ? Response.json(r) : Response.json(r, { status: r.code });
  } catch {
    return Response.json({ ok: false, reason: "the call could not be saved" }, { status: 500 });
  }
}
