import type { LoadFlag } from "@/lib/load-engine";

import { FLAG_LABEL } from "./format";

const FILL: Record<LoadFlag, string> = {
  cold: "bg-cold",
  ok: "bg-fit",
  watch: "bg-doubt",
  red: "bg-out",
};

/**
 * 8px square. Red pulses on a 2s opacity cycle so a spike catches the eye in a
 * 22-row scan; movement is opacity-only and drops out under reduced motion.
 */
export function FlagDot({ flag }: { flag: LoadFlag }) {
  return (
    <span className="inline-flex items-center">
      <span
        aria-hidden
        className={`block size-2 rounded-[1px] ${FILL[flag]} ${
          flag === "red" ? "animate-pulse motion-reduce:animate-none" : ""
        }`}
      />
      <span className="sr-only">{FLAG_LABEL[flag]}</span>
    </span>
  );
}
