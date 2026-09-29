"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import type { Injury } from "@/lib/types";
import { getViewer } from "@/lib/viewer";

import { planSteps } from "./rtp";

type Res = { ok: true } | { ok: false; error: string };
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date());

/** Lay out the ladder for a current injury, replacing any earlier plan. Physio or manager. */
export async function setRtpPlanAction(injuryId: string, returnOn: string): Promise<Res> {
  const viewer = await getViewer();
  if (!viewer.can("edit_injuries")) return { ok: false, error: "only the physio or the manager plans a return" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(returnOn)) return { ok: false, error: "pick a date" };

  const supabase = await createClient();
  const { data: injury, error } = await supabase.from("injuries").select("*").eq("id", injuryId).eq("club_id", viewer.club.id).maybeSingle();
  if (error || !injury) return { ok: false, error: "that injury is not on this club" };
  const inj = injury as Injury;
  if (inj.resolved_on) return { ok: false, error: "that injury is already resolved" };

  const plan = planSteps(inj.severity, inj.occurred_on, returnOn, today());
  if ("error" in plan) return { ok: false, error: plan.error };

  const del = await supabase.from("rtp_steps").delete().eq("injury_id", injuryId);
  if (del.error) return { ok: false, error: del.error.message };
  const ins = await supabase.from("rtp_steps").insert(plan.map((p) => ({ ...p, club_id: viewer.club.id, injury_id: injuryId })));
  if (ins.error) return { ok: false, error: ins.error.message };
  // the plan's end is the expected return everyone else reads
  await supabase.from("injuries").update({ expected_return: returnOn }).eq("id", injuryId);

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function tickRtpStepAction(stepId: string, done: boolean): Promise<Res> {
  const viewer = await getViewer();
  if (!viewer.can("edit_injuries")) return { ok: false, error: "only the physio or the manager ticks a stage" };
  const supabase = await createClient();
  const { error } = await supabase
    .from("rtp_steps")
    .update({ done_on: done ? today() : null })
    .eq("id", stepId)
    .eq("club_id", viewer.club.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}
