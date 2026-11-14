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
  const description = "A management platform for non-league clubs. Players respond in, out or unsure from their phones, the side selects itself, the opposition is analysed before every game and the match report is written after it.";
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
          <p className="mt-3 max-w-[40ch] text-[17px] leading-snug text-ink">A club management platform for non-league.</p>
          <div className="mt-8 flex flex-col gap-4">
            <p className={P}>Yes gaff, hope you&apos;re well.</p>
            <p className={P}>
              This is the thing I was telling you about. It&apos;s a club management platform: players say in or out from their phones, the team sheet selects itself from who is available, every player has a fitness page, and the league table, cups and matchday forecast are in one place.
            </p>
            <p className={P}>
              Before every game it analyses the opposition from the league table: home and away record, form, style of games, and our record against similar sides. The analyst turns that into a plan. After the game it drafts the match report for the website and socials.
            </p>
            <p className={P}>I&apos;ve loaded Belstone&apos;s squad and results, so have a look.</p>
            <p className={P}>
              One thing I need your help with. The league data comes from Football Web Pages and they only give keys to clubs. Could I cc you into an email to them saying I&apos;m doing the data analysis
              for the club?
            </p>
            <p className="text-[20px] font-extrabold tracking-[-0.01em] text-ink">Jamal</p>
          </div>
        </div>
        <div className="min-w-0">
          <video
            className="aspect-video w-full  bg-panel"
            src="/pilot/belstone-pilot.mp4"
            poster="/pilot/belstone-pilot-poster.jpg"
            autoPlay
            muted
            loop
            playsInline
            controls
            preload="metadata"
            aria-label="Eighteen seconds: Belstone's season as a points line, the cups, one tap to answer, the side filling itself on a floodlit pitch."
          />
          <p className="num mt-2 text-[11.5px] text-ink-dim">18 seconds, no sound needed</p>
        </div>
      </section>

      {/* ── what it does ── */}
      <section className="mt-24" aria-labelledby="does-h">
        <p className="annot" id="does-h">{"// what it does"}</p>

        <div data-reveal className="mt-8 grid items-center gap-8 lg:grid-cols-2">
          <div>
            <h2 className={H2}>Who&apos;s in on Saturday</h2>
            <p className={`${P} mt-4`}>
              Each player has one switch: in, out or unsure. It appears on every phone immediately. Set a closing time, answer for anyone who has not responded, or fill the rest with their last answers in one tap.
            </p>
          </div>
          <div>
            <TrySwitch />
          </div>
        </div>

        <div data-reveal className="mt-20">
          <h2 className={H2}>Know who you&apos;re playing</h2>
          <p className={`${P} mt-4`}>
            Before every game: win, draw and loss probabilities, xG for both sides, and the read. Their home and away record, recent form, style of games, our record against similar sides and our record from behind at half time. The analyst then writes the plan: our advantage, their threats, and how to play if we lead or trail.
          </p>
          <figure className="mt-8">
            {/* a phone gets the phone layout, so the words stay readable */}
            <picture>
              <source media="(max-width: 640px)" srcSet="/pilot/belstone-opposition-m.jpg" width={716} height={1583} />
              { }
              <img src="/pilot/belstone-opposition.jpg" alt="The opposition read for Staines and Lammas: 38% win, 24% draw, 38% lose, xG 1.53 each, then the read line by line" width={2232} height={906} className="h-auto w-full bg-panel/50" loading="lazy" />
            </picture>
          </figure>
        </div>

        <div data-reveal className="mt-20 grid items-center gap-8 lg:grid-cols-2">
          <div className="lg:order-2">
            <h2 className={H2}>The side picks itself</h2>
            <p className={`${P} mt-4`}>
              Open the squad room and the eleven is already there: last match&apos;s side, with anyone who&apos;s out swapped for the next best. Anyone who said out stays off the pitch. Choose a formation (4-2-3-1,
              4-4-2, 3-5-2 and the rest), drag or tap to swap, pick the captain, save it for the match.
            </p>
          </div>
          <figure className="lg:order-1">
            <video
              src="/pilot/belstone-side.mp4"
              poster="/pilot/belstone-side.jpg"
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              width={756}
              height={520}
              aria-label="The squad room for Belstone: the starting eleven on a floodlit pitch in a 4-2-3-1, with the camera moving slowly"
              className="h-auto w-full  bg-panel"
            />
          </figure>
        </div>

        <div data-reveal className="mt-20 grid items-center gap-8 lg:grid-cols-2">
          <div>
            <h2 className={H2}>Every player&apos;s fitness</h2>
            <p className={`${P} mt-4`}>
              Each player has a page with a 3D body model that highlights injuries, a plain fit, doubt or out status, and a return-to-play plan. Check-ins use a private link and only start once the player consents.
            </p>
          </div>
          <figure className="mx-auto w-full max-w-[424px]">
            <video
              src="/pilot/body-turn.mp4"
              poster="/pilot/body-turn.jpg"
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              width={424}
              height={480}
              aria-label="A player's 3D body turning a full circle, with a hamstring injury lit on the back of the right leg"
              className="h-auto w-full  bg-panel"
            />
          </figure>
        </div>

        <div data-reveal className="mt-20">
          <h2 className={H2}>The whole season, cups included</h2>
          <p className={`${P} mt-4`}>
            Leagues and cups together. The FA Vase, Herts Cup and CCL Challenge Cup share the same diary and season page. Each dot on the line is a game; hover or tap it for the score.
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

        <div data-reveal className="mt-20 grid items-center gap-8 lg:grid-cols-2">
          <div className="lg:order-2">
            <h2 className={H2}>The report writes itself</h2>
            <p className={`${P} mt-4`}>
              Once the score is in, one tap drafts the match report and a social post from the score, half-time score, scorers and crowd. Nothing is invented and nothing is posted for you. The analyst also answers questions about the season from the results, with the numbers.
            </p>
          </div>
          <figure className="lg:order-1">
            <picture>
              <source media="(max-width: 640px)" srcSet="/pilot/belstone-report-m.jpg" width={780} height={1998} />
              { }
              <img src="/pilot/belstone-report.jpg" alt="Match report for Belstone 4-2 Baldock Town: the website piece and the social post, each with a copy button" width={1740} height={1340} className="h-auto w-full bg-panel/50" loading="lazy" />
            </picture>
          </figure>
        </div>

        <div data-reveal className="mt-20 grid items-center gap-8 lg:grid-cols-2">
          <div>
            <h2 className={H2}>The pack for the committee</h2>
            <p className={`${P} mt-4`}>
              At the end of the season, one page: home against away, goals by half, the scorers, the crowds, the cups, where you finished. Every number is counted from the results, and where something can&apos;t be
              counted it says so. There&apos;s a print button.
            </p>
          </div>
          <figure>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/pilot/belstone-review.jpg" alt="Belstone's season review: the league record, home against away, the table around the club" width={1100} height={712} className="h-auto w-full  bg-panel/50" loading="lazy" />
          </figure>
        </div>
      </section>

      {/* ── less clicking ── */}
      <section className="mt-24 border-t border-line pt-8" data-reveal aria-labelledby="clicks-h">
        <p className="annot" id="clicks-h">{"// fewer clicks, because it's football"}</p>
        <ul className="mt-5 grid gap-x-10 gap-y-3 sm:grid-cols-2">
          {[
            "The side is pre-filled from the last match and who said in.",
            "One tap fills answers for everyone who has not responded, using their last answers.",
            "The result form opens on the game awaiting a score.",
            "The match log opens on the game you played on Saturday.",
            "It remembers your formation, your filters and a side you haven't saved yet.",
            "Squad numbers and appearances come from the league's pages, so there is nothing to type.",
          ].map((t) => (
            <li key={t} className="relative pl-5 text-[15px] leading-snug text-ink">
              <span aria-hidden className="absolute left-0 top-[0.62em] h-px w-3 bg-gold" />
              {t}
            </li>
          ))}
        </ul>
      </section>

      {/* ── web or app ── */}
      <section className="mt-16 border-t border-line pt-8" data-reveal aria-labelledby="web-h">
        <p className="annot" id="web-h">{"// on the web and on the phone"}</p>
        <h2 className={`${H2} mt-4`}>No app store, nothing to download</h2>
        <p className={`${P} mt-4`}>
          It&apos;s a website that lives on the home screen like an app. Open the link, tap Share then Add to Home Screen on an iPhone (Android offers it itself). Match calls arrive as notifications. If clubs want a
          store version later, it&apos;s the same thing in a wrapper.
        </p>
      </section>

      {/* ── what's next ── */}
      <section className="mt-16 border-t border-line pt-8" data-reveal aria-labelledby="next-h">
        <p className="annot" id="next-h">{"// where it's going"}</p>
        <p className="num mt-2 text-[11.5px] text-ink-dim">swipe for more →</p>
        <div className="swipe-row -mx-4 mt-5 flex snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain px-4 pb-4 sm:-mx-8 sm:px-8">
          <article className="w-[84%] max-w-[360px] shrink-0 snap-start  bg-panel/60 p-5 sm:w-[340px]">
            <h3 className="display text-[22px] text-ink">Veo, connected</h3>
            <div className="mt-4 flex flex-col gap-3 text-[14px] leading-snug text-ink-dim">
              <p>
                <Lamp on word="live" />
                <br />
                Paste a Veo or YouTube link, tag goals and key moments, and jump to the exact second.
              </p>
              <p>
                <Lamp on={false} word="next" />
                <br />
                Direct from the camera once Veo opens its partner connection.
              </p>
            </div>
          </article>
          <article className="w-[84%] max-w-[360px] shrink-0 snap-start  bg-panel/60 p-5 sm:w-[340px]">
            <h3 className="display text-[22px] text-ink">Player health</h3>
            <div className="mt-4 flex flex-col gap-3 text-[14px] leading-snug text-ink-dim">
              <p>
                <Lamp on word="live" />
                <br />
                Fit, doubt or out status, a return-to-play plan, and check-ins by private link with player consent.
              </p>
              <p>
                <Lamp on={false} word="next" />
                <br />
                A workload flag once four weeks of sessions are logged.
              </p>
            </div>
          </article>
          <article className="w-[84%] max-w-[360px] shrink-0 snap-start  bg-panel/60 p-5 sm:w-[340px]">
            <h3 className="display text-[22px] text-ink">Pre-match, for every player</h3>
            <div className="mt-4 flex flex-col gap-3 text-[14px] leading-snug text-ink-dim">
              <p>
                <Lamp on={false} word="next" />
                <br />
                Before every game each player receives a sheet: the opponent and their form, what the formation asks of the player, and set-piece duties. The manager edits it before it is sent.
              </p>
            </div>
          </article>
          <article className="w-[84%] max-w-[360px] shrink-0 snap-start  bg-panel/60 p-5 sm:w-[340px]">
            <h3 className="display text-[22px] text-ink">Answers by a deadline</h3>
            <div className="mt-4 flex flex-col gap-3 text-[14px] leading-snug text-ink-dim">
              <p>
                <Lamp on word="live" />
                <br />
                Set a closing time, such as Thursday 9pm. Players see the countdown and anyone who has not answered appears in one list.
              </p>
            </div>
          </article>
          <article className="w-[84%] max-w-[360px] shrink-0 snap-start  bg-panel/60 p-5 sm:w-[340px]">
            <h3 className="display text-[22px] text-ink">Matchday weather</h3>
            <div className="mt-4 flex flex-col gap-3 text-[14px] leading-snug text-ink-dim">
              <p>
                <Lamp on word="live" />
                <br />
                The forecast for kick-off at the ground, home or away, from the week before: rain, wind and temperature, to help choose boots.
              </p>
            </div>
          </article>
        </div>
      </section>

      {/* ── the terms ── */}
      <section className="mt-16 border-t border-line pt-8" data-reveal aria-labelledby="terms-h">
        <p className="annot" id="terms-h">{"// the small print, in plain words"}</p>
        <ul className="mt-5 grid gap-x-10 gap-y-3 sm:grid-cols-2">
          {[
            "No health information without player consent.",
            "No under-18s. Nothing is sold or shared.",
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
