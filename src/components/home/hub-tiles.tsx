import Link from "next/link";

export type Tile = {
  href: string;
  label: string;
  /** The one number or fact this module is about right now. */
  headline: string;
  /** A second line of detail, plain words. */
  detail: string;
  /** Tone of the headline: what the eye should feel before reading. */
  tone?: "ok" | "warn" | "bad" | "neutral";
};

const TONE: Record<NonNullable<Tile["tone"]>, string> = {
  ok: "text-fit",
  warn: "text-doubt",
  bad: "text-out",
  neutral: "text-ink",
};

/**
 * The modules, one quiet row. A tile that only says "squad" is a menu; a
 * tile that says "17 of 22 available" is a decision. They sit under the
 * vitals as the way in, never as the point.
 */
export function HubTiles({ tiles }: { tiles: Tile[] }) {
  return (
    <ul className="grid grid-cols-2 gap-px bg-line sm:grid-cols-3 lg:grid-cols-6">
      {tiles.map((t) => (
        <li key={t.href + t.label} className="bg-panel">
          <Link
            href={t.href}
            className="pressable group flex h-full flex-col justify-between gap-4 px-4 py-3 outline-none transition-colors duration-[190ms] hover:bg-panel-2 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-mint"
          >
            <span className="annot">{`// ${t.label}`}</span>
            <span>
              <span className={`display block text-[19px] leading-none ${TONE[t.tone ?? "neutral"]}`}>{t.headline}</span>
              <span className="mt-1.5 block text-[11.5px] leading-snug text-ink-dim">{t.detail}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
