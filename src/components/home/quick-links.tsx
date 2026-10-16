import Link from "next/link";

/** The three things a gaffer does from the hub, as a column of slanted plates that lean in on hover. */
export function QuickLinks({ links }: { links: { href: string; label: string; detail: string }[] }) {
  return (
    <nav aria-label="from here" className="flex flex-col gap-2">
      {links.map((l) => (
        <Link
          key={l.href + l.label}
          href={l.href}
          className="plate group flex items-baseline justify-between gap-4 bg-panel py-3 transition-[transform,background-color] duration-200 ease-[var(--ease-out-strong)] hover:translate-x-1 hover:bg-panel-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint motion-reduce:transition-none"
        >
          <span className="text-[15px] font-semibold text-ink">{l.label}</span>
          <span className="num flex items-center gap-2 text-[11.5px] text-ink-dim">
            {l.detail}
            <span aria-hidden className="text-mint transition-transform duration-200 group-hover:translate-x-0.5">→</span>
          </span>
        </Link>
      ))}
    </nav>
  );
}
