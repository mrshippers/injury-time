import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ClubStop } from "@/components/club/crest";
import { CupsSection } from "@/components/home/cups";
import { SeasonLine } from "@/components/home/season-line";
import { TrySwitch } from "@/components/pilot/try-switch";
import { todayISO } from "@/lib/data";
import { getHomeSeason } from "@/lib/home/data";
import { ordinal, seasonContext } from "@/lib/home/season-context";
import { PILOT_CLUBS, pilotBaseUrl } from "@/lib/pilot/clubs";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Params = { club: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { club } = await params;
  const c = PILOT_CLUBS[club];
  if (!c) return {};
  const title = `Injury Time for ${c.name}`;
  const description = "A management platform for non-league clubs. In, out or unsure from the boys' phones, the eleven fills itself, the season and the cups in one place.";
  return {
    metadataBase: new URL(pilotBaseUrl()),
    title,
    description,
    // a pitch for one gaffer, not a page for search engines
    robots: { index: false, follow: false },
    openGraph: { title, description, type: "website", siteName: "injury time.", url: `/pilot/${club}` },
    twitter: { card: "summary_large_image", title, description },
  };
}

const H2 = "display text-[28px] leading-[1.05] text-ink sm:text-[34px]";
const P = "max-w-[56ch] text-[16px] leading-[1.6] text-ink-dim";

/** A lamp and a word: live is a filled lamp, next is a hollow one. Shape and word, never colour alone. */
function Lamp({ on, word }: { on: boolean; word: string }) {
  return (
    <span className="num inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-dim">
      <span aria-hidden className={`inline-block size-2.5 rounded-full ${on ? "bg-[var(--win)]" : "border-[1.5px] border-ink-dim"}`} />
      {word}
    </span>
  );
}

export default async function PilotPage({ params }: { params: Promise<Params> }) {
  const { club: slug } = await params;
  const cfg = PILOT_CLUBS[slug];
  if (!cfg) notFound();

  // the season on this page is the club's real public season, read live
  const supabase = await createClient();
  const { data: club } = await supabase.from("clubs").select("id, name").eq("slug", slug).maybeSingle();
  const asOf = todayISO();
  const season = club ? await getHomeSeason(club.id, asOf) : null;
  const ctx = season ? seasonContext({ results: season.results, standings: season.standings, progress: season.progress, fixtures: season.fixtures, asOf }) : null;

  return (
    <main data-pilot className="mx-auto w-full max-w-[1120px] flex-1 px-4 pb-24 pt-6 sm:px-8">
      <header className="flex flex-wrap items-baseline justify-between gap-3 border-b border-line pb-4">
        <p className="display text-[24px] text-ink">
          injury time<span className="text-mint">.</span>
        </p>
        <p className="annot">{`// a pilot for ${cfg.name.toLowerCase()}`}</p>
      </header>

      {/* ── the letter, then the film ── */}
      <section className="mt-10 grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        <div>
          <p className="annot">{`// for ${cfg.name.toLowerCase()}`}</p>
          <h1 className="display mt-3 text-[clamp(40px,6vw,64px)] leading-[1.02] text-ink">
            Injury Time
            <ClubStop team={cfg.name} />
          </h1>
          <p className="mt-3 max-w-[40ch] text-[17px] leading-snug text-ink">A management platform for clubs at our level.</p>
          <div className="mt-8 flex flex-col gap-4">
            <p className={P}>Hey gaffer,</p>
            <p className={P}>Jamal here, Belstone alumni.</p>
            <p className={P}>
              I&apos;ve built something for running a non-league side. The boys say in, out or unsure from their phones, the eleven fills itself from who&apos;s available, and the season sits in one place with
              the cups in it.
            </p>
            <p className={P}>I&apos;ve set it up with Belstone&apos;s squad and results from the league pages, so what&apos;s below is your actual season.</p>
            <p className="text-[20px] font-extrabold tracking-[-0.01em] text-ink">Jamal</p>
          </div>
        </div>
        <div className="min-w-0">
          <video
            className="aspect-video w-full border border-line bg-panel"
            src="/pilot/belstone-pilot.mp4"
            poster="/pilot/belstone-pilot-poster.jpg"
            autoPlay
            muted
            loop
            playsInline
            controls
            preload="metadata"
            aria-label="Twenty seconds: the price, Belstone's season as a points line, the cups, one tap to answer, the side filling itself."
          />
          <p className="num mt-2 text-[11.5px] text-ink-dim">20 seconds, no sound needed</p>
        </div>
      </section>

      {/* ── what it does ── */}
      <section className="mt-24" aria-labelledby="does-h">
        <p className="annot" id="does-h">{"// what it does"}</p>

        <div className="mt-8 grid items-center gap-8 lg:grid-cols-2">
          <div>
            <h2 className={H2}>Who&apos;s in on Saturday</h2>
            <p className={`${P} mt-4`}>
              Every player gets one switch: in, out or unsure. It shows on everyone&apos;s phone as soon as it&apos;s tapped. Set a time answers close, and anyone who&apos;s gone quiet you
              answer for, or fill the rest with what they said last time in one tap.
            </p>
          </div>
          <div>
            <TrySwitch />
            <p className="num mt-2 text-[11.5px] text-ink-dim">Try it. It&apos;s the real switch, on a row that isn&apos;t a real player.</p>
          </div>
        </div>

        <div className="mt-20 grid items-center gap-8 lg:grid-cols-2">
          <div className="lg:order-2">
            <h2 className={H2}>The side picks itself</h2>
            <p className={`${P} mt-4`}>
              Open the squad room and the eleven is already there: last match&apos;s side, with anyone who&apos;s out swapped for the next best. Anyone who said out stays off the pitch. Choose a formation (4-2-3-1,
              4-4-2, 3-5-2 and the rest), drag or tap to swap, pick the captain, save it for the match.
            </p>
          </div>
          <figure className="lg:order-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/pilot/belstone-side.jpg" alt="The squad room for Belstone: the eleven on a floodlit pitch, 4-2-3-1, our own goal at the bottom" width={756} height={521} className="h-auto w-full border border-line" loading="lazy" />
            <figcaption className="num mt-2 text-[11.5px] text-ink-dim">Belstone&apos;s squad, from the public appearances list. Positions aren&apos;t public, so until you set them the side is a first guess: most-played, scorers up front.</figcaption>
          </figure>
        </div>

        <div className="mt-20">
          <h2 className={H2}>The whole season, cups included</h2>
          <p className={`${P} mt-4`}>
            Not just the league. The FA Vase, the Herts Cup and the CCL Challenge Cup sit in the same diary and the same season page. Every dot on the line is a game: hover it, or tap it, and it tells you the
            score.
          </p>
          {ctx && season ? (
            <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)] lg:items-end">
              <div>
                <p className="display text-[96px] leading-[0.9] text-ink">
                  {ctx.points}
                  <span className="ml-2 text-[28px] text-ink-dim">pts</span>
                </p>
                <p className="num mt-2 text-[12px] uppercase tracking-[0.12em] text-ink-dim">
                  {ctx.position ? `${ordinal(ctx.position)} of ${ctx.teams} · ` : ""}
                  {ctx.played} played
                </p>
              </div>
              <div className="min-w-0">
                <SeasonLine ctx={ctx} results={season.results} fixtures={season.fixtures} asOf={asOf} />
              </div>
            </div>
          ) : null}
          {season ? <CupsSection results={season.results} fixtures={season.fixtures} asOf={asOf} /> : null}
        </div>

        <div className="mt-20 grid items-center gap-8 lg:grid-cols-2">
          <div>
            <h2 className={H2}>The pack for the committee</h2>
            <p className={`${P} mt-4`}>
              At the end of the season, one page: home against away, goals by half, the scorers, the crowds, the cups, where you finished. Every number is counted from the results, and where something can&apos;t be
              counted it says so. There&apos;s a print button.
            </p>
          </div>
          <figure>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/pilot/belstone-review.jpg" alt="Belstone's season review: the league record, home against away, the table around the club" width={1100} height={712} className="h-auto w-full border border-line" loading="lazy" />
          </figure>
        </div>
      </section>

      {/* ── less clicking ── */}
      <section className="mt-24 border-t border-line pt-8" aria-labelledby="clicks-h">
        <p className="annot" id="clicks-h">{"// fewer clicks, because it's football"}</p>
        <ul className="mt-5 grid gap-x-10 gap-y-3 sm:grid-cols-2">
          {[
            "The side fills itself from last match and who said in.",
            "One tap answers for everyone who hasn't, as they did last time.",
            "The result form opens on the game that's waiting for its score.",
            "The match log opens on the game you played on Saturday.",
            "It remembers your formation, your filters and a side you haven't saved yet.",
            "Squad numbers and apps come from the league's own pages, so nobody types them.",
          ].map((t) => (
            <li key={t} className="relative pl-5 text-[15px] leading-snug text-ink">
              <span aria-hidden className="absolute left-0 top-[0.62em] h-px w-3 bg-gold" />
              {t}
            </li>
          ))}
        </ul>
      </section>

      {/* ── web or app ── */}
      <section className="mt-16 border-t border-line pt-8" aria-labelledby="web-h">
        <p className="annot" id="web-h">{"// on the web and on the phone"}</p>
        <h2 className={`${H2} mt-4`}>No app store, nothing to download</h2>
        <p className={`${P} mt-4`}>
          It&apos;s a website that lives on the home screen like an app. Open the link, tap Share then Add to Home Screen on an iPhone (Android offers it itself). Match calls arrive as notifications. If clubs want a
          store version later, it&apos;s the same thing in a wrapper.
        </p>
      </section>

      {/* ── what's next ── */}
      <section className="mt-16 border-t border-line pt-8" aria-labelledby="next-h">
        <p className="annot" id="next-h">{"// where it's going"}</p>
        <p className="num mt-2 text-[11.5px] text-ink-dim">swipe for more →</p>
        <div className="swipe-row -mx-4 mt-5 flex snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain px-4 pb-4 sm:-mx-8 sm:px-8">
          <article className="w-[84%] max-w-[360px] shrink-0 snap-start border border-line bg-panel p-5 sm:w-[340px]">
            <h3 className="display text-[22px] text-ink">Veo, connected</h3>
            <div className="mt-4 flex flex-col gap-3 text-[14px] leading-snug text-ink-dim">
              <p>
                <Lamp on word="live" />
                <br />
                Paste a Veo or YouTube link, tag the goals and key moments, and jump straight to the second.
              </p>
              <p>
                <Lamp on={false} word="next" />
                <br />
                Straight from the camera, once Veo opens its partner connection.
              </p>
            </div>
          </article>
          <article className="w-[84%] max-w-[360px] shrink-0 snap-start border border-line bg-panel p-5 sm:w-[340px]">
            <h3 className="display text-[22px] text-ink">Player health</h3>
            <div className="mt-4 flex flex-col gap-3 text-[14px] leading-snug text-ink-dim">
              <p>
                <Lamp on word="live" />
                <br />
                Fit, doubt or out in plain English, a return-to-play ladder, check-ins by private link where the player says yes first.
              </p>
              <p>
                <Lamp on={false} word="next" />
                <br />
                A load flag once four weeks of sessions are logged.
              </p>
            </div>
          </article>
          <article className="w-[84%] max-w-[360px] shrink-0 snap-start border border-line bg-panel p-5 sm:w-[340px]">
            <h3 className="display text-[22px] text-ink">Pre-match, for every player</h3>
            <div className="mt-4 flex flex-col gap-3 text-[14px] leading-snug text-ink-dim">
              <p>
                <Lamp on={false} word="next" />
                <br />
                Before every game each player gets his own sheet: who you&apos;re playing and how they&apos;re doing, what the formation asks of him, his job on set pieces. The gaffer edits it before it goes out.
              </p>
            </div>
          </article>
          <article className="w-[84%] max-w-[360px] shrink-0 snap-start border border-line bg-panel p-5 sm:w-[340px]">
            <h3 className="display text-[22px] text-ink">Answers by a deadline</h3>
            <div className="mt-4 flex flex-col gap-3 text-[14px] leading-snug text-ink-dim">
              <p>
                <Lamp on word="live" />
                <br />
                Set when answers close, Thursday 9pm say. The boys see the clock, and whoever hasn&apos;t answered by then shows up in one list.
              </p>
            </div>
          </article>
          <article className="w-[84%] max-w-[360px] shrink-0 snap-start border border-line bg-panel p-5 sm:w-[340px]">
            <h3 className="display text-[22px] text-ink">Matchday weather</h3>
            <div className="mt-4 flex flex-col gap-3 text-[14px] leading-snug text-ink-dim">
              <p>
                <Lamp on word="live" />
                <br />
                The forecast for kick-off at the ground, home or away, from the week before: rain, wind, temperature. Moulds or studs, sorted.
              </p>
            </div>
          </article>
        </div>
      </section>

      {/* ── the terms ── */}
      <section className="mt-16 border-t border-line pt-8" aria-labelledby="terms-h">
        <p className="annot" id="terms-h">{"// the small print, in plain words"}</p>
        <ul className="mt-5 grid gap-x-10 gap-y-3 sm:grid-cols-2">
          {[
            "£40 a month for the club, not per player. Players and staff all included.",
            "The first four weeks are free and there's no card. If you don't like it, bin it, nothing owed.",
            "No health information unless the player says yes first.",
            "No under-18s, and nothing sold or shared, ever.",
          ].map((t) => (
            <li key={t} className="relative pl-5 text-[15px] leading-snug text-ink">
              <span aria-hidden className="absolute left-0 top-[0.62em] h-px w-3 bg-gold" />
              {t}
            </li>
          ))}
        </ul>
      </section>

      {/* ── close ── */}
      <section className="mt-16 border-t border-line pt-10">
        <h2 className="display text-[clamp(30px,4.4vw,46px)] text-ink">
          Fancy it?
        </h2>
        <p className={`${P} mt-4`}>
          Let&apos;s talk.{" "}
          <a href="mailto:jamal@strydeos.com" className="text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink">
            jamal@strydeos.com
          </a>
        </p>
      </section>
    </main>
  );
}
