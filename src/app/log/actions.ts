"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logSession, type LoadEntryInput } from "@/lib/data";
import { SESSION_KINDS, type SessionKind } from "@/lib/types";

export type LogSessionInput = {
  sessionDate: string;
  kind: SessionKind;
  opponent?: string;
  entries: LoadEntryInput[];
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Validate and persist a session logged from /log. This is invoked directly
 * from the client form as a server function, not a native <form> submit, so
 * every field is untrusted input - re-check shape and bounds here even
 * though the UI already constrains them.
 */
export async function logSessionAction(input: LogSessionInput): Promise<void> {
  if (typeof input.sessionDate !== "string" || !DATE_RE.test(input.sessionDate)) {
    throw new Error("invalid session date");
  }
  if (!SESSION_KINDS.includes(input.kind)) {
    throw new Error("invalid session kind");
  }
  if (!Array.isArray(input.entries) || input.entries.length === 0) {
    throw new Error("at least one player must be logged");
  }

  const entries: LoadEntryInput[] = input.entries.map((e) => {
    if (typeof e.playerId !== "string" || !e.playerId) {
      throw new Error("invalid player");
    }
    if (!Number.isInteger(e.rpe) || e.rpe < 1 || e.rpe > 10) {
      throw new Error("rpe must be an integer 1-10");
    }
    if (!Number.isInteger(e.minutes) || e.minutes < 1 || e.minutes > 180) {
      throw new Error("minutes must be an integer 1-180");
    }
    return { playerId: e.playerId, rpe: e.rpe, minutes: e.minutes };
  });

  const opponent =
    input.kind === "match" && typeof input.opponent === "string"
      ? input.opponent.trim().slice(0, 60) || undefined
      : undefined;

  await logSession({
    sessionDate: input.sessionDate,
    kind: input.kind,
    opponent,
    entries,
  });

  revalidatePath("/squad");
  redirect("/squad");
}
