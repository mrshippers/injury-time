"use client";

import { useState } from "react";

import { CallSwitch } from "@/components/team/call-board";
import type { CallStatus } from "@/lib/types";

/**
 * The call switch, live, on a row that belongs to nobody: "you". It is the real
 * component the squad uses, so what a manager sees here is what the boys get.
 * Nothing is saved and no real player is named.
 */
export function TrySwitch() {
  const [value, setValue] = useState<CallStatus | null>(null);
  return (
    <div className="border border-line bg-panel">
      <div className="flex items-baseline justify-between gap-3 border-b border-line px-4 py-3">
        <p className="annot">{"// who's in"}</p>
        <p className="num text-[12.5px] text-ink" aria-live="polite">
          {value ? `you: ${value}` : "you: not answered"}
        </p>
      </div>
      <div
        className="call-row grid grid-cols-1 items-center gap-3 border-l-[3px] border-transparent px-[13px] py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:px-[17px]"
        data-status={value ?? "none"}
      >
        <p className="display text-[24px] text-ink">
          you
        </p>
        <CallSwitch name="you" value={value} usual="in" large disabled={false} onChoose={setValue} />
      </div>
    </div>
  );
}
