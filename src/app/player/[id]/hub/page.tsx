import Link from "next/link";
import { notFound } from "next/navigation";

import { HubCall, HubEditor, ShareLink } from "@/components/hub/hub-client";
import { Shirt } from "@/components/hub/shirt";
import { getHub, shortDate } from "@/lib/hub/data";
import { POSITION_WORD } from "@/lib/hub/hub";
import { clock } from "@/lib/film/urls";
import { getViewer } from "@/lib/viewer";

export const dynamic = "force-dynamic";

const SQUAD_POSITION: Record<string, string> = { GK: "goalkeeper", DF: "defender", MF: "midfielder", FW: "forward" };
const KIND_WORD: Record<string, string> = { goal: "goal", save: "save", chance: "chance made", shot: "shot", press: "press won", set_piece: "set piece" };
const MILESTONE_MARK: Record<string, string> = { first: "1st", hattrick: "HT", brace: "x2", streak: "run", apps: "apps", goals: "gls" };

function Section({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={className} aria-label={label}>
      <h2 className="annot">{`// ${label}`}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default async function PlayerHubPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const [hub, viewer] = await Promise.all([getHub(id), getViewer()]);
  if (!hub) notFound();
  const { player, profile, stats, club } = hub;
  const first = player.name.split(" ")[0];
  const surname = player.name.split(" ").slice(-1)[0];
  const position = profile?.best_position ? POSITION_WORD[profile.best_position] : player.external_stats?.position_confirmed === false ? null : SQUAD_POSITION[player.position];
  const logged = stats.source === "log";
  const tiles: [string, string | number][] = [
    ["apps", stats.apps],
    ["goals", stats.goals],
    ...(logged ? ([["assists", stats.assists], ["minutes", stats.minutes]] as [string, number][]) : []),
  ];
  const share = hub.clubGoals ? Math.round((stats.goals / hub.clubGoals) * 100) : 0;
  const road = [...(profile?.previous_clubs ?? []), club.name];
  const about: [string, string | null][] = [
    ["walk-out song", profile?.walkout_song ?? null],
    ["boots", profile?.boots ?? null],
    ["grew up on", profile?.hero ?? null],
  ];

  return (
    <main className="mx-auto w-full max-w-[1180px] flex-1 px-4 py-7 sm:px-10 sm:py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/squad" className="pressable inline-flex min-h-11 items-center gap-2 text-sm text-ink-dim hover:text-ink sm:min-h-0">
          <span aria-hidden>←</span> squad
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          {viewer.can("view_squad_health") ? (
            <Link href={`/player/${player.id}`} className="pressable text-[12px] uppercase tracking-[0.12em] text-ink-dim hover:text-ink">
              staff view
            </Link>
          ) : null}
          <ShareLink path={`/player/${player.id}/hub`} />
        </div>
      </div>

      {/* the programme page */}
      <header className="mt-8 grid grid-cols-1 items-end gap-8 border-b border-line-strong pb-10 md:grid-cols-[minmax(0,1fr)_220px]">
        <div className="min-w-0">
          <p className="annot">{`// ${club.name}${club.season ? ` · ${club.season}` : ""}`}</p>
          <h1 className="display mt-3 text-5xl leading-[0.95] sm:text-7xl">{player.name}</h1>
          {profile?.nickname ? <p className="mt-3 display text-2xl italic text-gold">&ldquo;{profile.nickname}&rdquo;</p> : null}
          <p className="mt-5 text-sm uppercase tracking-[0.14em] text-ink-dim">
            {[position, profile?.preferred_foot ? (profile.preferred_foot === "both" ? "two-footed" : `${profile.preferred_foot} foot`) : null].filter(Boolean).join(" · ") || "position not confirmed"}
          </p>
          {profile?.bio ? <blockquote className="mt-6 max-w-[56ch] border-l-2 border-gold pl-4 text-[17px] leading-relaxed text-ink">{profile.bio}</blockquote> : null}
        </div>
        <Shirt name={profile?.shirt_name ?? surname.toUpperCase()} number={player.squad_number} colours={club.colours} />
      </header>

      {/* the season in numbers */}
      <section aria-label="season numbers" className="mt-10">
        <div className="flex flex-wrap items-end gap-x-12 gap-y-6">
          {tiles.map(([label, n]) => (
            <div key={label}>
              <p className="num text-6xl leading-none text-ink sm:text-7xl">{n}</p>
              <p className="mt-2 text-[11px] uppercase tracking-[0.14em] text-ink-dim">{label}</p>
            </div>
          ))}
          {hub.strike ? (
            <div>
              <p className="text-2xl text-gold">{hub.strike}</p>
              <p className="mt-2 text-[11px] uppercase tracking-[0.14em] text-ink-dim">strike rate</p>
            </div>
          ) : null}
        </div>
        <p className="num mt-4 text-[12px] text-ink-faint">{hub.statsLine}</p>
      </section>

      {hub.pinned ? (
        <Link
          href={`/film/${hub.pinned.clipId}?t=${hub.pinned.t}`}
          className="pressable mt-10 flex flex-wrap items-baseline gap-x-4 gap-y-1 border border-gold/40 bg-panel px-5 py-4 hover:border-gold"
        >
          <span className="annot">{"// the one"}</span>
          <span className="text-lg text-ink">{`${KIND_WORD[hub.pinned.kind]} · ${hub.pinned.title}`}</span>
          <span className="num text-[13px] text-gold">{`▶ ${clock(hub.pinned.t)}`}</span>
        </Link>
      ) : null}

      <div className="mt-14 grid grid-cols-1 gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
        <Section label="the season in goals">
          {hub.goals.length ? (
            <>
              <ol className="border-t border-line">
                {hub.goals.map((g) => (
                  <li key={g.date} className="grid grid-cols-[64px_minmax(0,1fr)_auto] items-baseline gap-3 border-b border-line py-3">
                    <span className="num text-[12.5px] text-ink-dim">{shortDate(g.date)}</span>
                    <span className="min-w-0">
                      <span className="text-ink">{`v ${g.opponent}`}</span>
                      <span className="ml-2 text-[12px] text-ink-faint">{[g.venue === "H" ? "home" : g.venue === "A" ? "away" : null, g.competition, g.score].filter(Boolean).join(" · ")}</span>
                    </span>
                    <span className="num flex items-center gap-1.5 text-gold" aria-label={`${g.goals} goal${g.goals > 1 ? "s" : ""}`}>
                      <span aria-hidden className="tracking-[0.1em]">{"●".repeat(Math.min(g.goals, 5))}</span>
                      <span className="text-[13px]">{g.goals}</span>
                    </span>
                  </li>
                ))}
              </ol>
              {share ? <p className="mt-4 text-[13px] text-ink-dim">{`${stats.goals} of ${club.name}'s ${hub.clubGoals} this season, ${share}%.`}</p> : null}
            </>
          ) : (
            <p className="text-[14px] text-ink-dim">{stats.apps ? "no goals on the sheet yet. keep turning up." : "nothing logged yet this season."}</p>
          )}
        </Section>

        <div className="flex flex-col gap-12">
          <Section label="milestones">
            {hub.won.length ? (
              <ul className="flex flex-col gap-3">
                {hub.won.map((m, i) => (
                  <li key={i} className="flex items-baseline gap-3">
                    <span className="num inline-flex h-7 min-w-9 items-center justify-center border border-gold px-1 text-[10.5px] font-bold uppercase tracking-[0.06em] text-gold">{MILESTONE_MARK[m.kind]}</span>
                    <span>
                      <span className="text-ink">{m.title}</span>
                      {m.detail ? <span className="ml-2 text-[12.5px] text-ink-dim">{m.detail}</span> : null}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[14px] text-ink-dim">the first one is the next game.</p>
            )}
          </Section>

          {hub.next.length ? (
            <Section label="next up">
              <ul className="flex flex-col gap-4">
                {hub.next.map((n) => (
                  <li key={n.title}>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-ink">{n.title}</span>
                      <span className="num text-[13px] text-ink-dim">{`${n.left} to go`}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}

          {hub.nextMatch ? (
            <Section label="next match">
              <p className="text-lg text-ink">{`${hub.nextMatch.fixture.venue === "H" ? "home to" : "away at"} ${hub.nextMatch.fixture.opponent}`}</p>
              <p className="num mt-1 text-[12.5px] text-ink-dim">
                {[shortDate(hub.nextMatch.fixture.match_date), hub.nextMatch.fixture.kickoff, hub.nextMatch.fixture.competition].filter(Boolean).join(" · ")}
              </p>
              <div className="mt-4">
                {hub.canCall ? (
                  <HubCall fixtureId={hub.nextMatch.fixture.id} playerId={player.id} initial={hub.nextMatch.call} />
                ) : (
                  <p className="text-[13px] text-ink-dim">{hub.nextMatch.call ? `called: ${hub.nextMatch.call}` : "no call yet"}</p>
                )}
              </div>
            </Section>
          ) : null}
        </div>
      </div>

      {hub.moments.length ? (
        <Section label="on film" className="mt-14">
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {hub.moments.map((m) => (
              <li key={`${m.clipId}@${m.t}`}>
                <Link href={`/film/${m.clipId}?t=${m.t}`} className="pressable flex items-baseline justify-between gap-3 border border-line px-4 py-3 hover:border-line-strong">
                  <span className="min-w-0">
                    <span className="text-ink">{KIND_WORD[m.kind]}</span>
                    <span className="ml-2 text-[12.5px] text-ink-dim">{m.opponent ? `v ${m.opponent}` : m.title}</span>
                  </span>
                  <span className="num shrink-0 text-[13px] text-gold">{`▶ ${clock(m.t)}`}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      <Section label={`about ${first}`} className="mt-14">
        {profile ? (
          <>
            <dl className="grid grid-cols-1 gap-x-10 gap-y-4 sm:grid-cols-3">
              {about.map(([k, val]) => (
                <div key={k}>
                  <dt className="text-[11px] uppercase tracking-[0.14em] text-ink-dim">{k}</dt>
                  <dd className="mt-1 text-ink">{val ?? <span className="text-ink-faint">not said</span>}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-8">
              <p className="text-[11px] uppercase tracking-[0.14em] text-ink-dim">the road here</p>
              <ol className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-2">
                {road.map((c, i) => (
                  <li key={`${c}-${i}`} className="flex items-center gap-2">
                    <span className={i === road.length - 1 ? "text-gold" : "text-ink"}>{c}</span>
                    {i < road.length - 1 ? <span aria-hidden className="text-ink-faint">→</span> : null}
                  </li>
                ))}
              </ol>
            </div>
          </>
        ) : (
          <p className="max-w-[60ch] text-[14px] text-ink-dim">
            {hub.readOnly
              ? `${first} hasn't filled this in. ${club.name} is a real club shown from its public league figures, so this page is ${first}'s to write once the club links them.`
              : `nothing here yet. the nickname, the shirt, the walk-out song, the clubs before this one: it's ${first}'s page to fill.`}
          </p>
        )}
        {hub.canEdit ? (
          <div className="mt-8">
            <HubEditor playerId={player.id} profile={profile} moments={hub.moments} startOpen={false} />
          </div>
        ) : null}
      </Section>
    </main>
  );
}
