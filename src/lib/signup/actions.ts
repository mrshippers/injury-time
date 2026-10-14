"use server";

/**
 * Sign-up: the club and its squad. create_club() (0015) does the club and the
 * caller's membership in one transaction and refuses anything but an adult
 * side; the squad goes in through the paste parser, as the new manager, so RLS
 * checks it like any other add.
 */
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { CLUB_COOKIE, getViewer } from "@/lib/viewer";

import { parseSquadPaste, type PasteResult } from "./paste";

export type SignupResult = { ok: true; clubId: string } | { ok: false; error: string };

const ROLES = ["manager", "coach", "medical"] as const;

export async function createClubAction(input: { name: string; league: string; role: string; adultSide: boolean }): Promise<SignupResult> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "sign in first" };
  const name = String(input?.name ?? "").trim();
  const league = String(input?.league ?? "").trim();
  if (!(ROLES as readonly string[]).includes(input?.role)) return { ok: false, error: "you sign up as the manager, a coach or medical" };
  if (input?.adultSide !== true) return { ok: false, error: "Injury Time takes adult sides only for now: every player 18 or over" };
  const { data, error } = await supabase.rpc("create_club", { club_name: name, league, my_role: input.role, adult_side: true });
  if (error || !data) return { ok: false, error: (error?.message ?? "could not make the club").replace(/^adults_only: /, "") };
  (await cookies()).set(CLUB_COOKIE, data, { path: "/", sameSite: "lax", httpOnly: true, secure: true, maxAge: 60 * 60 * 24 * 365 });
  revalidatePath("/", "layout");
  return { ok: true, clubId: data };
}

export type PasteOutcome = { ok: true; added: number; skipped: PasteResult["skipped"]; ms: number } | { ok: false; error: string };

export async function addPastedSquadAction(text: string): Promise<PasteOutcome> {
  const t0 = Date.now();
  const viewer = await getViewer();
  if (viewer.guest || viewer.club.is_demo) return { ok: false, error: "sign up your own club to add its squad" };
  if (viewer.role !== "manager" && viewer.role !== "coach") return { ok: false, error: "the manager or a coach adds the squad" };
  if (typeof text !== "string" || text.length > 6000) return { ok: false, error: "paste up to sixty lines" };
  const parsed = parseSquadPaste(text);
  if (!parsed.players.length) return { ok: false, error: "no players found in that paste" };

  const supabase = await createClient();
  const { data: existing, error: rErr } = await supabase.from("players").select("name, squad_number").eq("club_id", viewer.club.id).is("retired_on", null);
  if (rErr) return { ok: false, error: rErr.message };
  const names = new Set((existing ?? []).map((p) => p.name.toLowerCase()));
  const numbers = new Set((existing ?? []).map((p) => p.squad_number).filter((n): n is number => n !== null));
  const skipped = [...parsed.skipped];
  const rows = [];
  for (const p of parsed.players) {
    if (names.has(p.name.toLowerCase())) {
      skipped.push({ line: p.name, reason: `${p.name} is already in the squad` });
      continue;
    }
    let number = p.number;
    if (number !== null && numbers.has(number)) {
      skipped.push({ line: p.name, reason: `number ${number} is already worn; ${p.name} added without one` });
      number = null;
    }
    rows.push({
      club_id: viewer.club.id,
      name: p.name,
      // MF stands in until the manager confirms; the squad room asks
      position: p.position ?? ("MF" as const),
      squad_number: number,
      external_stats: { position_confirmed: p.position !== null },
    });
  }
  if (rows.length) {
    const { error } = await supabase.from("players").insert(rows);
    if (error) return { ok: false, error: error.message };
  }
  revalidatePath("/", "layout");
  return { ok: true, added: rows.length, skipped, ms: Date.now() - t0 };
}

/** The first-week check for the hub (0015): squad in, a staff member joined, a call answered from a push. */
export async function firstWeek(): Promise<{ squad_in: boolean; staff_joined: boolean; push_answered: boolean } | null> {
  const viewer = await getViewer();
  if (viewer.guest || viewer.club.is_demo || viewer.role === "player") return null;
  const { data } = await (await createClient()).rpc("first_week_check", { cid: viewer.club.id });
  return data?.[0] ?? null;
}
