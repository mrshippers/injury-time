/**
 * The analysis call. Server-side only: the key never leaves the process. One
 * request, structured output, the model id kept with the result so a page can
 * say what produced it.
 */
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

import { CLIP_EVENT_KINDS, type ClipAnalysis } from "@/lib/types";

import { ANALYST_SYSTEM, buildAnalysisMessage, type AnalysisContext } from "./prompt";

export const ANALYSIS_MODEL = "claude-opus-5";

const AnalysisSchema = z.object({
  summary: z.string(),
  gameday: z.array(z.string()),
  training: z.array(z.string()),
  players: z.array(z.object({ player_id: z.string(), note: z.string() })),
});

export type AnalysisOutcome =
  | { ok: true; analysis: ClipAnalysis }
  | { ok: false; error: string };

export function analysisConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/** Events with an unknown kind never reach the prompt. */
export function cleanEvents(events: AnalysisContext["events"]): AnalysisContext["events"] {
  const kinds = new Set<string>(CLIP_EVENT_KINDS);
  return events.filter((e) => kinds.has(e.kind) && Number.isFinite(e.t));
}

export async function analyseFilm(ctx: AnalysisContext): Promise<AnalysisOutcome> {
  if (!analysisConfigured()) {
    return { ok: false, error: "no analysis key on this server: set ANTHROPIC_API_KEY" };
  }
  const client = new Anthropic();
  const known = new Set(ctx.players.map((p) => p.id));
  try {
    const response = await client.messages.parse({
      model: ANALYSIS_MODEL,
      max_tokens: 4000,
      system: ANALYST_SYSTEM,
      output_config: { effort: "medium", format: zodOutputFormat(AnalysisSchema) },
      messages: [{ role: "user", content: buildAnalysisMessage({ ...ctx, events: cleanEvents(ctx.events) }) }],
    });
    if (response.stop_reason === "refusal") {
      return { ok: false, error: "the analyst declined this film" };
    }
    const out = response.parsed_output;
    if (!out) return { ok: false, error: "the analyst did not return a usable answer" };
    return {
      ok: true,
      analysis: {
        summary: out.summary.trim(),
        gameday: out.gameday.map((s) => s.trim()).filter(Boolean),
        training: out.training.map((s) => s.trim()).filter(Boolean),
        players: out.players.filter((p) => known.has(p.player_id)).map((p) => ({ player_id: p.player_id, note: p.note.trim() })),
        generated_at: new Date().toISOString(),
        model: response.model || ANALYSIS_MODEL,
      },
    };
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) return { ok: false, error: "the analysis key was rejected" };
    if (err instanceof Anthropic.RateLimitError) return { ok: false, error: "the analyst is busy, try again in a minute" };
    if (err instanceof Anthropic.APIError) return { ok: false, error: `analysis failed (${err.status ?? "api"})` };
    return { ok: false, error: "analysis failed" };
  }
}
