import { FeedKeyForm, ResultForm } from "@/components/club/club-forms";
import { longDate } from "@/components/squad/format";
import { sourceLine } from "@/lib/club/source";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/viewer";

export const dynamic = "force-dynamic";

export const metadata = { title: "the club - injury time." };

/**
 * Where the club's season comes from, and the two ways it gets in: the club's
 * own league-feed key, or the staff typing the result. Injury Time holds no
 * key of its own; each club brings the free one Football Web Pages gives
 * non-league clubs, so every club reads its own data under its own terms.
 */
export default async function ClubPage() {
  const viewer = await getViewer();
  const club = viewer.club;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date());

  // existence only: the key itself never leaves the server
  let feed: { last_sync_at: string | null; last_sync_note: string | null } | null = null;
  if (!viewer.guest && !club.is_demo && viewer.role === "manager") {
    const { data } = await createAdminClient().from("club_feed_keys").select("last_sync_at, last_sync_note").eq("club_id", club.id).maybeSingle();
    feed = data;
  }

  const supabase = await createClient();
  const { data: results } = await supabase
    .from("results")
    .select("match_date, opponent, venue, goals_for, goals_against, competition, source")
    .eq("club_id", club.id)
    .order("match_date", { ascending: false })
    .limit(6);

  const source = sourceLine(club);
  const feedAllowed = !viewer.guest && !club.is_demo && viewer.role === "manager";
  const feedReason = club.is_demo
    ? "This is a public demo club. A real club's manager, signed in, connects the club's own key here."
    : viewer.role !== "manager"
      ? "Only the club's manager connects the league feed."
      : null;
  const resultAllowed = viewer.guest ? club.season_source === "manual" : viewer.role === "manager" || viewer.role === "coach";
  const resultReason = viewer.guest && club.season_source !== "manual"
    ? `${club.name} is a real club shown from its public data, so results are not typed in here.`
    : !resultAllowed
      ? "The manager or a coach enters results."
      : null;

  return (
    <main className="mx-auto w-full max-w-[1000px] flex-1 px-4 py-7 sm:px-8 sm:py-9">
      <header>
        <p className="annot">{"// the club"}</p>
        <h1 className="display mt-2 text-4xl sm:text-5xl">
          {club.name}
          <span aria-hidden className="ml-[0.08em] inline-block h-[0.14em] w-[0.14em] bg-mint align-baseline" />
        </h1>
        <p className="mt-3 max-w-[60ch] text-[14px] leading-relaxed text-ink-dim">{source.long}</p>
        <a href="/review" className="mt-4 inline-block text-[13px] text-ink underline decoration-gold-dim underline-offset-4 hover:text-gold">
          the season review, for the committee
        </a>
      </header>

      <section aria-labelledby="feed-h" className="mt-10 border-t border-line pt-6">
        <p className="annot" id="feed-h">{"// the league feed"}</p>
        <h2 className="mt-2 text-[20px] font-semibold text-ink">Your club&apos;s own key, not ours</h2>
        <ol className="mt-3 flex max-w-[64ch] flex-col gap-2 text-[14px] leading-relaxed text-ink-dim">
          <li>
            <span className="num mr-2 text-gold">01</span>Football Web Pages gives non-league clubs an API key free. The club secretary asks for it from
            footballwebpages.co.uk, as the club.
          </li>
          <li>
            <span className="num mr-2 text-gold">02</span>Paste it here with the team id from your club&apos;s page address. Injury Time checks it
            with a real sync before keeping it, and never shows it again.
          </li>
          <li>
            <span className="num mr-2 text-gold">03</span>Fixtures, results and the table then pull every morning at 06:15. No key, no problem: enter
            results below.
          </li>
        </ol>
        {feed ? (
          <p className="num mt-4 text-[12px] text-ink-dim">
            connected · last sync {feed.last_sync_at ? longDate(feed.last_sync_at.slice(0, 10)) : "never"} · {feed.last_sync_note ?? ""}
          </p>
        ) : null}
        <FeedKeyForm connected={!!feed} allowed={feedAllowed} reason={feedReason} />
      </section>

      <section aria-labelledby="result-h" className="mt-10 border-t border-line pt-6">
        <p className="annot" id="result-h">{"// enter a result"}</p>
        <h2 className="mt-2 text-[20px] font-semibold text-ink">You were there, so it counts</h2>
        <p className="mt-2 max-w-[64ch] text-[14px] leading-relaxed text-ink-dim">
          Cup ties, friendlies, or every game if the club has no feed. The points line and the form rebuild from what you enter.
        </p>
        <ResultForm allowed={resultAllowed} reason={resultReason} today={today} />
        {results?.length ? (
          <ul className="mt-6 border-t border-line" aria-label="latest results">
            {results.map((r) => (
              <li key={`${r.match_date}${r.opponent}`} className="flex items-baseline justify-between gap-4 border-b border-line py-2.5 text-[14px]">
                <span className="num w-24 shrink-0 text-[12px] text-ink-dim">{longDate(r.match_date)}</span>
                <span className="min-w-0 flex-1 truncate text-ink">
                  {r.venue === "H" ? "v" : "at"} {r.opponent}
                  <span className="text-ink-dim"> · {r.competition}</span>
                </span>
                <span className="num text-ink">
                  {r.goals_for}-{r.goals_against}
                </span>
                <span className="num w-16 text-right text-[11px] uppercase tracking-[0.1em] text-ink-faint">{r.source === "manual" ? "entered" : "feed"}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </main>
  );
}
