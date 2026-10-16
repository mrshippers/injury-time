import { crestFor, monogram } from "@/lib/crests";

/**
 * A club's crest beside its name, drawn slightly see-through so a column of
 * badges never out-shouts the words. No crest on file: two letters in a
 * square-cut frame, never a stock shield. Decorative: the name is always
 * written next to it, so it is hidden from screen readers.
 */
export function Crest({ team, size = 22, className = "", plain = false }: { team: string; size?: number; className?: string; /** no monogram when there is no crest */ plain?: boolean }) {
  const src = crestFor(team);
  if (!src) {
    if (plain) return null;
    return (
      <span
        aria-hidden
        className={`num inline-flex shrink-0 items-center justify-center border border-line-strong text-ink-dim ${className}`}
        style={{ width: size, height: size, fontSize: Math.max(9, Math.round(size * 0.4)), letterSpacing: "0.04em" }}
      >
        {monogram(team)}
      </span>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" aria-hidden width={size} height={size} loading="lazy" decoding="async" className={`inline-block shrink-0 object-contain opacity-80 ${className}`} style={{ width: size, height: size }} />;
}

/**
 * The full stop after a club's name in a heading is the club's own crest, sized to the type. A club with
 * no crest on file keeps the mint square, so the heading still lands.
 */
export function ClubStop({ team }: { team: string }) {
  const src = crestFor(team);
  if (!src) return <span aria-hidden className="ml-[0.08em] inline-block h-[0.14em] w-[0.14em] bg-mint align-baseline" />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" aria-hidden decoding="async" className="ml-[0.04em] inline-block h-[0.76em] w-auto align-baseline object-contain opacity-80" />;
}
