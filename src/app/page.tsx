import Link from "next/link";

export default function Home() {
  return (
    <main className="flex-1 flex flex-col justify-center px-6 sm:px-12 lg:px-24 py-16 relative overflow-hidden">
      {/* faint pitch vignette */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(120% 90% at 20% 10%, rgba(143,227,192,0.05), transparent 55%), radial-gradient(100% 80% at 85% 90%, rgba(201,169,79,0.04), transparent 60%)",
        }}
      />
      <div className="relative max-w-3xl hero-in">
        <p className="annot mb-6">{"// first off the rank"}</p>
        <h1 className="display text-6xl sm:text-8xl">
          injury time
          <span
            aria-hidden
            className="inline-block w-[0.16em] h-[0.16em] bg-mint ml-[0.08em] align-baseline"
          />
        </h1>
        <p className="mt-8 text-lg text-ink-dim max-w-xl leading-relaxed">
          Squad availability and load for a non-league side. Who&apos;s fit,
          who&apos;s cooked, who&apos;s one more Tuesday night on a 3G away from
          a torn hamstring. Nobody down there measures it.
        </p>
        <p className="mt-3 text-lg text-ink max-w-xl font-semibold">
          The gaffer just gets his best eleven on the park more often.
        </p>
        <div className="mt-10 flex flex-wrap gap-4">
          <Link
            href="/squad"
            className="pressable inline-flex items-center gap-2 bg-mint text-mint-ink font-bold px-6 py-3 text-sm tracking-wide"
          >
            the squad room
            <span aria-hidden>→</span>
          </Link>
          <Link
            href="/log"
            className="pressable inline-flex items-center gap-2 border border-line-strong text-ink px-6 py-3 text-sm font-semibold hover:bg-panel"
          >
            log a session
          </Link>
        </div>
        <p className="annot mt-16 text-gold-dim">
          non-league&ensp;·&ensp;physio edge&ensp;·&ensp;small on
          purpose&ensp;·&ensp;your actual world
        </p>
      </div>
    </main>
  );
}
