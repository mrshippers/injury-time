/**
 * One way to ask Claude for structured words, server-side only. Opus 5.5 with server-side refusal fallbacks
 * on (a declined request re-runs on another model inside the same call, so a squad page never dead-ends),
 * a Zod schema for the answer, and the system prompt cached since it never changes between calls.
 */
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";

export const NO2_MODEL = "claude-opus-5-5";

export function aiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export type AiResult<T> = { ok: true; value: T; model: string } | { ok: false; error: string };

export async function askStructured<S extends z.ZodType>(opts: {
  system: string;
  user: string;
  schema: S;
  effort?: "low" | "medium" | "high";
  maxTokens?: number;
}): Promise<AiResult<z.infer<S>>> {
  if (!aiConfigured()) return { ok: false, error: "the No.2 isn't switched on here yet" };
  const client = new Anthropic();
  try {
    const response = await client.beta.messages.parse({
      model: NO2_MODEL,
      max_tokens: opts.maxTokens ?? 4000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: [{ type: "text", text: opts.system, cache_control: { type: "ephemeral" } }],
      output_config: { effort: opts.effort ?? "medium", format: betaZodOutputFormat(opts.schema) },
      messages: [{ role: "user", content: opts.user }],
    });
    if (response.stop_reason === "refusal") return { ok: false, error: "the No.2 wouldn't write that one" };
    const out = response.parsed_output as z.infer<S> | null;
    if (!out) return { ok: false, error: "the No.2 came back with nothing usable" };
    return { ok: true, value: out, model: response.model || NO2_MODEL };
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) return { ok: false, error: "the No.2's key was rejected" };
    if (err instanceof Anthropic.RateLimitError) return { ok: false, error: "the No.2 is busy, try again in a minute" };
    if (err instanceof Anthropic.APIError) return { ok: false, error: `the No.2 couldn't answer (${err.status ?? "api"})` };
    return { ok: false, error: "the No.2 couldn't answer" };
  }
}
