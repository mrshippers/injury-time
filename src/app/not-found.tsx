import Link from "next/link";

const PRIMARY =
  "pressable inline-flex h-11 items-center rounded-[2px] bg-mint px-4 text-[12px] font-bold uppercase tracking-[0.12em] text-mint-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mint";
const SECONDARY =
  "pressable inline-flex h-11 items-center rounded-[2px] border border-line-strong bg-pitch px-4 text-[12px] font-semibold uppercase tracking-[0.1em] text-ink hover:bg-panel-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint";

/**
 * Unmatched URLs and every notFound() (a player or clip this club does not
 * have) land here, inside the layout, so the nav and the club switcher stay
 * put and the way back is one tap.
 */
export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-[1240px] flex-1 flex-col justify-center px-4 py-16 sm:px-8">
      <p className="annot">{"// off the pitch"}</p>
      <h1 className="display mt-3 text-5xl sm:text-7xl">
        nothing here
        <span aria-hidden className="ml-[0.08em] inline-block h-[0.14em] w-[0.14em] bg-mint align-baseline" />
      </h1>
      <p className="mt-4 max-w-[46ch] text-[15px] leading-relaxed text-ink-dim">
        That link points at a player, a clip or a page this club does not have. It may have been removed, or it
        belongs to another club.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/" className={PRIMARY}>
          back to the hub
        </Link>
        <Link href="/squad" className={SECONDARY}>
          the squad
        </Link>
      </div>
    </main>
  );
}
