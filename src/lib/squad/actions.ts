"use server";

/**
 * Squad management and the saved side. Every input is re-validated here
 * against the domain unions: a Server Action is a public POST endpoint, not a
 * private function, and the form is not the boundary.
 */
import { revalidatePath } from "next/cache";

import { FORMATION_TEMPLATES } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import { POSITIONS, type ExternalStats, type Position } from "@/lib/types";
import { getViewer } from "@/lib/viewer";

export type ActionResult<T = undefined> = { ok: true; value?: T } | { ok: false; error: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function position(value: unknown): Position {
  if (typeof value !== "string" || !(POSITIONS as readonly string[]).includes(value)) {
    throw new Error(`position must be one of ${POSITIONS.join(", ")}`);
  }
  return value as Position;
}

function name(value: unknown): string {
  if (typeof value !== "string") throw new Error("a name is needed");
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (trimmed.length < 2 || trimmed.length > 60) throw new Error("a name is 2 to 60 characters");
  return trimmed;
}

function number(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 99) throw new Error("a squad number is 1 to 99");
  return n;
}

function uuid(value: unknown, field: string): string {
  if (typeof value !== "string" || !UUID.test(value)) throw new Error(`${field} is not a valid id`);
  return value;
}

function fail(error: unknown): ActionResult<never> {
  return { ok: false, error: error instanceof Error ? error.message : "could not save that" };
}

export async function addPlayerAction(input: { name: string; position: string; number?: number | string | null }): Promise<ActionResult<{ id: string }>> {
  try {
    const viewer = await getViewer();
    if (!viewer.can("manage_squad")) throw new Error("only a manager can add a player");
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("players")
      .insert({
        club_id: viewer.club.id,
        name: name(input.name),
        position: position(input.position),
        squad_number: number(input.number),
        external_stats: { position_confirmed: true },
      })
      .select("id")
      .single();
    if (error) throw new Error(error.code === "23505" ? "that squad number is taken" : error.message);
    revalidatePath("/squad");
    return { ok: true, value: { id: data.id as string } };
  } catch (e) {
    return fail(e);
  }
}

export async function editPlayerAction(input: { id: string; name: string; position: string; number?: number | string | null }): Promise<ActionResult> {
  try {
    const viewer = await getViewer();
    if (!viewer.can("manage_squad")) throw new Error("only a manager can edit a player");
    const supabase = await createClient();
    const { data: current, error: readErr } = await supabase
      .from("players")
      .select("external_stats")
      .eq("id", uuid(input.id, "player"))
      .eq("club_id", viewer.club.id)
      .single();
    if (readErr) throw readErr;
    const stats = { ...((current?.external_stats as ExternalStats | null) ?? {}), position_confirmed: true };
    const { error } = await supabase
      .from("players")
      .update({ name: name(input.name), position: position(input.position), squad_number: number(input.number), external_stats: stats })
      .eq("id", input.id)
      .eq("club_id", viewer.club.id);
    if (error) throw new Error(error.code === "23505" ? "that squad number is taken" : error.message);
    revalidatePath("/squad");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** Confirm a position for a player the league feed brought in without one. */
export async function setPositionAction(input: { id: string; position: string }): Promise<ActionResult> {
  try {
    const viewer = await getViewer();
    if (!viewer.can("manage_squad") && !viewer.can("pick_side")) throw new Error("only staff can set a position");
    const supabase = await createClient();
    const { data: current, error: readErr } = await supabase
      .from("players")
      .select("external_stats")
      .eq("id", uuid(input.id, "player"))
      .eq("club_id", viewer.club.id)
      .single();
    if (readErr) throw readErr;
    const stats = { ...((current?.external_stats as ExternalStats | null) ?? {}), position_confirmed: true };
    const { error } = await supabase
      .from("players")
      .update({ position: position(input.position), external_stats: stats })
      .eq("id", input.id)
      .eq("club_id", viewer.club.id);
    if (error) throw error;
    revalidatePath("/squad");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** Retire today. The row stays (history is history); the board stops listing him. */
export async function retirePlayerAction(input: { id: string }): Promise<ActionResult> {
  try {
    const viewer = await getViewer();
    if (!viewer.can("manage_squad")) throw new Error("only a manager can retire a player");
    const supabase = await createClient();
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date());
    const { error } = await supabase
      .from("players")
      .update({ retired_on: today })
      .eq("id", uuid(input.id, "player"))
      .eq("club_id", viewer.club.id);
    if (error) throw error;
    revalidatePath("/squad");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function saveLineupAction(input: { fixtureId: string; formation: string; xi: (string | null)[]; bench: string[] }): Promise<ActionResult> {
  try {
    const viewer = await getViewer();
    if (!viewer.can("pick_side")) throw new Error("only a manager or coach can save a side");
    if (!FORMATION_TEMPLATES.some((t) => t.name === input.formation)) throw new Error("unknown formation");
    if (!Array.isArray(input.xi) || input.xi.length !== 11) throw new Error("a side is eleven slots");
    const xi = input.xi.map((id) => (id === null ? null : uuid(id, "player")));
    const bench = (Array.isArray(input.bench) ? input.bench : []).map((id) => uuid(id, "player"));
    const supabase = await createClient();
    const { error } = await supabase.from("lineups").upsert(
      {
        club_id: viewer.club.id,
        fixture_id: uuid(input.fixtureId, "fixture"),
        formation: input.formation,
        xi,
        bench,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "club_id,fixture_id" },
    );
    if (error) throw error;
    revalidatePath("/squad");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
