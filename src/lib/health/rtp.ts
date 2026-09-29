/**
 * Return to play: a fixed ladder of stages, sized by severity, spread evenly
 * to the date the physio chooses. The return date is theirs; the app never
 * invents one. Pure, tested once.
 */
import type { Severity, RtpStage, RtpStep } from "@/lib/types";

export const LADDER: Record<Severity, RtpStage[]> = {
  knock: ["full_training", "match_fit"],
  minor: ["jogging", "running", "full_training", "match_fit"],
  moderate: ["walking", "jogging", "running", "sprinting", "ball_work", "full_training", "match_fit"],
  severe: ["rest", "walking", "jogging", "running", "sprinting", "ball_work", "full_training", "match_fit"],
};

export const STAGE_WORD: Record<RtpStage, { plain: string; detailed: string }> = {
  rest: { plain: "resting it", detailed: "offload / protection" },
  walking: { plain: "walking without pain", detailed: "pain-free gait" },
  jogging: { plain: "jogging", detailed: "straight-line jog, ~50%" },
  running: { plain: "running", detailed: "running, up to ~80%" },
  sprinting: { plain: "sprinting", detailed: "max velocity, change of direction" },
  ball_work: { plain: "ball work on his own", detailed: "non-contact technical" },
  full_training: { plain: "full training", detailed: "full contact training" },
  match_fit: { plain: "ready for a game", detailed: "cleared for match play" },
};

const DAY = 86_400_000;
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);

export function planSteps(severity: Severity, occurredOn: string, returnOn: string, today: string): { stage: RtpStage; target_date: string }[] | { error: string } {
  const start = Math.max(Date.parse(occurredOn), Date.parse(today));
  const end = Date.parse(returnOn);
  if (Number.isNaN(end)) return { error: "pick the date he should be ready for a game" };
  const stages = LADDER[severity];
  const span = Math.round((end - start) / DAY);
  if (span < stages.length - 1) return { error: `${stages.length} stages need at least ${stages.length - 1} days; pick a later date` };
  return stages.map((stage, i) => ({
    stage,
    target_date: iso(start + Math.round(((i + 1) * (end - start)) / stages.length / DAY) * DAY),
  }));
}

export type RtpStatus = {
  done: number;
  total: number;
  /** the first stage not yet done */
  next: RtpStep | null;
  /** the next stage's date has passed and it is not ticked */
  behind: boolean;
  /** the match_fit date */
  readyOn: string | null;
};

export function rtpStatus(steps: readonly RtpStep[], today: string): RtpStatus {
  const sorted = [...steps].sort((a, b) => a.target_date.localeCompare(b.target_date));
  const next = sorted.find((s) => !s.done_on) ?? null;
  return {
    done: sorted.filter((s) => s.done_on).length,
    total: sorted.length,
    next,
    behind: !!next && next.target_date < today,
    readyOn: sorted.find((s) => s.stage === "match_fit")?.target_date ?? null,
  };
}
