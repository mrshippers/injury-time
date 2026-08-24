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
 * FM's module buttons, with the module's live state on the button. A tile
 * that only says "squad" is a menu; a tile that says "17 of 22 available"
 * is a decision.
 */
export function HubTiles({ tiles }: { tiles: Tile[] }) {
  return (
    <ul className="grid grid-cols-1 gap-px bg-line sm:grid-cols-2 lg:grid-cols-3">
      {tiles.map((t) => (
        <li key={t.href + t.label} className="bg-panel">
          <Link
            href={t.href}
            className="pressable group flex h-full flex-col justify-between gap-6 px-5 py-4 outline-none transition-colors duration-[190ms] hover:bg-panel-2 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-mint"
          >
            <div className="flex items-center justify-between">
              <span className="annot">{`// ${t.label}`}</span>
              <span
                aria-hidden
                className="text-ink-faint transition-transform duration-[190ms] ease-[var(--ease-out-strong)] group-hover:translate-x-1 group-hover:text-mint"
              >
                →
              </span>
            </div>
            <div>
              <p className={`display text-[26px] leading-none ${TONE[t.tone ?? "neutral"]}`}>
                {t.headline}
              </p>
              <p className="mt-2 text-[12.5px] leading-snug text-ink-dim">{t.detail}</p>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
