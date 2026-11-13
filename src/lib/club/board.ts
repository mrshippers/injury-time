"use server";

import { revalidatePath } from "next/cache";

import { FORMATIONS } from "@/lib/lineup";
import { createAdminClient } from "@/lib/supabase/admin";
import { getViewer } from "@/lib/viewer";
import { STAFF_ROLES, type StaffRole } from "@/lib/types";

import type { ActionState } from "./actions";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const COLOUR = /^#[0-9a-f]{6}$/i;
const SEASON = /^\d{4}(-\d{2})?$/;

const clean = (v: unknown, max: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);

/** The manager of a real club, or anyone on the fictional demo club. Nobody else writes the board. */
async function boardWriter() {
  const viewer = await getViewer();
  const demoOk = viewer.club.is_demo && viewer.club.demo_writable && !viewer.readOnly;
  if (!demoOk && (viewer.guest || viewer.role !== "manager")) return { viewer, error: "only the club's manager changes this" as const };
  return { viewer, error: null };
}

export type ProfileInput = { name: string; league: string; division: string; ground: string; founded: string; home: string; away: string };

/** The club as it names itself: the name on the badge, the league and division, the ground, the colours. */
export async function updateClubProfileAction(input: ProfileInput): Promise<ActionState> {
  const { viewer, error } = await boardWriter();
  if (error) return { ok: false, message: error };
  const name = clean(input.name, 60);
  const league = clean(input.league, 80);
  if (name.length < 2) return { ok: false, message: "a club name is 2 to 60 characters" };
  if (league.length < 2) return { ok: false, message: "a league is 2 to 80 characters" };
  const founded = clean(input.founded, 4);
  if (founded && !/^\d{4}$/.test(founded)) return { ok: false, message: "founded is a year, like 1921" };
  const home = clean(input.home, 7);
  const away = clean(input.away, 7);
  if ((home && !COLOUR.test(home)) || (away && !COLOUR.test(away))) return { ok: false, message: "colours are six hex digits, for example #1b5e20" };
  const colours = { ...(viewer.club.colours ?? {}), ...(home ? { home } : {}), ...(away ? { away } : {}) };
  const { error: e } = await createAdminClient()
    .from("clubs")
    .update({ name, league, division: clean(input.division, 80) || null, ground: clean(input.ground, 80) || null, founded: founded ? Number(founded) : null, colours })
    .eq("id", viewer.club.id);
  if (e) return { ok: false, message: e.message };
  revalidatePath("/", "layout");
  return { ok: true, message: "the club is updated" };
}

export type SeasonInput = { season: string; defaultFormation: string };

/** The season label the review runs on, and the formation the side opens in. */
export async function updateSeasonSetupAction(input: SeasonInput): Promise<ActionState> {
  const { viewer, error } = await boardWriter();
  if (error) return { ok: false, message: error };
  const season = clean(input.season, 7);
  if (season && !SEASON.test(season)) return { ok: false, message: "a season is written 2026-27" };
  const formation = clean(input.defaultFormation, 12);
  if (formation && !FORMATIONS.some((f) => f.name === formation)) return { ok: false, message: "that is not one of the formations" };
  const settings = { ...(viewer.club.settings ?? {}), ...(formation ? { default_formation: formation } : {}) };
  const { error: e } = await createAdminClient().from("clubs").update({ season: season || null, settings }).eq("id", viewer.club.id);
  if (e) return { ok: false, message: e.message };
  revalidatePath("/", "layout");
  return { ok: true, message: "the season is set" };
}

export type StaffInput = { id?: string; name: string; title: string; role: string; joined_on: string; left_on?: string; user_id?: string };

/** Put a member of staff on the books, or change what is on them. */
export async function saveStaffAction(input: StaffInput): Promise<ActionState> {
  const { viewer, error } = await boardWriter();
  if (error) return { ok: false, message: error };
  const name = clean(input.name, 80);
  const title = clean(input.title, 40);
  const role = clean(input.role, 10) as StaffRole;
  if (name.length < 2) return { ok: false, message: "a name is 2 to 80 characters" };
  if (title.length < 2) return { ok: false, message: "a title is 2 to 40 characters: manager, assistant, physio, kit" };
  if (!STAFF_ROLES.includes(role)) return { ok: false, message: "a role is manager, coach, medical or other" };
  if (!DATE.test(input.joined_on)) return { ok: false, message: "the date they came is needed" };
  const left = clean(input.left_on, 10);
  if (left && (!DATE.test(left) || left < input.joined_on)) return { ok: false, message: "the leave date must be on or after the start date" };
  const userId = clean(input.user_id, 36);
  if (userId && !UUID.test(userId)) return { ok: false, message: "that login is not right" };
  const row = { club_id: viewer.club.id, name, title, role, joined_on: input.joined_on, left_on: left || null, ...(userId ? { user_id: userId } : {}) };
  const admin = createAdminClient();
  const q = input.id && UUID.test(input.id) ? admin.from("club_staff").update(row).eq("id", input.id).eq("club_id", viewer.club.id) : admin.from("club_staff").insert(row);
  const { error: e } = await q;
  if (e) return { ok: false, message: e.message.includes("club_staff_club_id_user_id_key") ? "that login is already on the books" : e.message };
  revalidatePath("/club");
  revalidatePath("/review");
  return { ok: true, message: `${name} is on the books` };
}

/** Take a wrong entry off entirely. Leaving is a date, not a delete: set left_on with saveStaffAction. */
export async function removeStaffAction(id: string): Promise<ActionState> {
  const { viewer, error } = await boardWriter();
  if (error) return { ok: false, message: error };
  if (!UUID.test(id)) return { ok: false, message: "that entry is not right" };
  const { error: e } = await createAdminClient().from("club_staff").delete().eq("id", id).eq("club_id", viewer.club.id);
  if (e) return { ok: false, message: e.message };
  revalidatePath("/club");
  revalidatePath("/review");
  return { ok: true, message: "removed" };
}
