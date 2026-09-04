import Link from "next/link";

import type { Clip } from "@/lib/types";

const SOURCE_WORD: Record<Clip["source"], string> = {
  veo: "veo",
  youtube: "youtube",
  upload: "upload",
  other: "link",
};

const STATUS_TONE: Record<Clip["status"], string> = {
  new: "text-ink-faint",
  tagged: "text-doubt",
  analysed: "text-fit",
};

function shortDate(iso: string | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${Number(d)} ${months[Number(m) - 1]} ${y.slice(2)}`;
}

/** One row per piece of film. The whole row is the link. */
export function ClipList({ clips }: { clips: Clip[] }) {
  if (clips.length === 0) {
    return (
      <section aria-labelledby="film-list" className="border border-line bg-panel px-5 py-10 text-center">
        <p className="annot" id="film-list">{"// nothing in the room yet"}</p>
        <p className="mt-3 text-[13px] text-ink-dim">Paste the first link on the right. A Veo match or a YouTube highlights reel both work.</p>
      </section>
    );
  }
  return (
    <section aria-labelledby="film-list" className="border border-line bg-panel">
      <div className="flex items-baseline justify-between border-b border-line px-4 py-2 sm:px-5">
        <p className="annot" id="film-list">{"// film"}</p>
        <p className="annot text-gold-dim">newest first</p>
      </div>
      <ul>
        {clips.map((c) => (
          <li key={c.id} className="border-b border-line last:border-b-0">
            <Link
              href={`/film/${c.id}`}
              className="pressable group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-4 py-3 outline-none transition-colors duration-[190ms] hover:bg-panel-2 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-mint sm:px-5"
            >
              <span className="min-w-0">
                <span className="block truncate text-[14px] font-semibold text-ink">{c.title}</span>
                <span className="num mt-0.5 block text-[11.5px] text-ink-dim">
                  {c.opponent ? `v ${c.opponent}` : "no opponent set"}
                  {c.match_date ? ` · ${shortDate(c.match_date)}` : ""}
                  {" · "}
                  {SOURCE_WORD[c.source]}
                  {" · "}
                  {c.events.length} event{c.events.length === 1 ? "" : "s"}
                </span>
              </span>
              <span className={`num text-[11px] font-semibold uppercase tracking-[0.1em] ${STATUS_TONE[c.status]}`}>{c.status}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
