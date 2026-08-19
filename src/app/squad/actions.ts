"use server";

import { revalidatePath } from "next/cache";

import { setAvailability } from "@/lib/data";
import {
  AVAILABILITY_STATUSES,
  BODY_REGIONS,
  SEVERITIES,
  SIDES,
  type AvailabilityStatus,
  type BodyRegion,
  type Severity,
  type Side,
} from "@/lib/types";

/**
 * Wire shape for the status quick-change. Deliberately hand-validated below:
 * a Server Action is reachable by direct POST, not just through our popover,
 * so every field is re-checked here against the domain unions rather than
 * trusted because the client form only offers valid options.
 */
export type SetAvailabilityInput = {
  playerId: string;
  status: string;
  returnDate?: string;
  injury?: {
    bodyRegion: string;
    side: string;
    severity: string;
  };
};

export type SetAvailabilityResult =
  | { ok: true }
  | { ok: false; error: string };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function oneOf<T extends string>(
  allowed: readonly T[],
  value: unknown,
  field: string,
): T {
  if (typeof value !== "string" || !(allowed as readonly string[]).includes(value)) {
    throw new Error(`${field} must be one of: ${allowed.join(", ")}`);
  }
  return value as T;
}

export async function setAvailabilityAction(
  input: SetAvailabilityInput,
): Promise<SetAvailabilityResult> {
  try {
    if (typeof input?.playerId !== "string" || input.playerId.length === 0) {
      throw new Error("playerId is required");
    }
    const status: AvailabilityStatus = oneOf(
      AVAILABILITY_STATUSES,
      input.status,
      "status",
    );

    let returnDate: string | undefined;
    if (input.returnDate) {
      if (!ISO_DATE.test(input.returnDate)) {
        throw new Error("returnDate must be an ISO yyyy-mm-dd date");
      }
      returnDate = input.returnDate;
    }

    let injury:
      | { bodyRegion: BodyRegion; side: Side; severity: Severity }
      | undefined;
    if (status === "injured") {
      if (!input.injury) {
        throw new Error("an injured player needs a body region");
      }
      injury = {
        bodyRegion: oneOf(BODY_REGIONS, input.injury.bodyRegion, "bodyRegion"),
        side: oneOf(SIDES, input.injury.side, "side"),
        severity: oneOf(SEVERITIES, input.injury.severity, "severity"),
      };
    }

    await setAvailability({ playerId: input.playerId, status, returnDate, injury });
    revalidatePath("/squad");
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "could not save that",
    };
  }
}
