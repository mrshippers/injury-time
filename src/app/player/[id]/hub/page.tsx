import Link from "next/link";
import { notFound } from "next/navigation";

import { HandOver, HubCall, HubEditor, ShareLink } from "@/components/hub/hub-client";
import { SeasonCardShare } from "@/components/hub/season-card-share";
import { Shirt } from "@/components/hub/shirt";
import { getHub, shortDate } from "@/lib/hub/data";
import { POSITION_WORD } from "@/lib/hub/hub";
import { clock } from "@/lib/film/urls";
import { getViewer } from "@/lib/viewer";
import { ConsentForm } from "@/components/health/consent-form";
import { Crest } from "@/components/club/crest";
import { crestFor } from "@/lib/crests";
import AvailabilityTimeline from "@/components/player/availability-timeline";
import BodyMap from "@/components/player/body-map";
import InjuryTable from "@/components/player/injury-table";
import LanguageToggle, { HealthProvider } from "@/components/player/language-toggle";
import LoadSparkline from "@/components/player/load-sparkline";
import RtpPanel from "@/components/player/rtp-panel";
import StatTiles from "@/components/player/stat-tiles";
import { getPlayerProfile } from "@/lib/data";
import type { RtpStep } from "@/lib/types";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** the latest date of birth that is 18 today (the database checks it again) */
const adultBorn = () => {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() - 18);
  return d.toISOString().slice(0, 10);
};

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
  const isCaptain = !!(player.external_stats as { captain?: boolean } | null)?.captain;
  // the full health breakdown: the player on their own page, staff, and anyone looking at a public club
  const seesHealth = viewer.playerId === player.id || viewer.can("view_squad_health") || viewer.guest;
  const health = seesHealth ? await getPlayerProfile(player.id) : null;
  let rtpSteps: RtpStep[] = [];
  const currentInjury = health?.injuries.find((i) => i.resolved_on === null) ?? null;
  if (currentInjury) rtpSteps = ((await (await createClient()).from("rtp_steps").select("*").eq("injury_id", currentInjury.id)).data ?? []) as RtpStep[];
  const tiles: [string, string | number][] = [
    ["apps", stats.apps],
    ["goals", stats.goals],
    ...(logged ? ([["assists", stats.assists], ["minutes", stats.minutes]] as [string, number][]) : []),
  ];
  // the player's own say over their health data (0014), on their own page
  const ownReal = viewer.playerId === player.id && !club.is_demo;
  const consent = ownReal
    ? (await (await createClient()).from("health_consents").select("withdrawn_at").eq("player_id", player.id).maybeSingle()).data
    : null;
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
      {club.is_demo || viewer.playerId === player.id || (!viewer.guest && viewer.role !== "player") ? (
        <div className="mt-4 flex justify-end">
          <SeasonCardShare playerId={player.id} firstName={first} fileName={`${player.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-season`} />
        </div>
      ) : null}

      {/* the programme page */}
      <header className="mt-8 grid grid-cols-1 items-end gap-8 border-b border-line-strong pb-10 md:grid-cols-[minmax(0,1fr)_220px]">
        <div className="min-w-0">
          <p className="annot flex items-center gap-2">
            <Crest team={club.name} size={22} plain />
            {`// ${club.name}${club.season ? ` · ${club.season}` : ""}`}
          </p>
          <h1 className="display mt-3 text-5xl leading-[0.95] sm:text-7xl">{player.name}</h1>
          {profile?.nickname ? <p className="mt-3 display text-2xl italic text-gold">&ldquo;{profile.nickname}&rdquo;</p> : null}
          <p className="mt-5 flex flex-wrap gap-1.5">
            {[
              position,
              profile?.preferred_foot ? (profile.preferred_foot === "both" ? "two-footed" : `${profile.preferred_foot} foot`) : null,
              player.squad_number !== null ? `no. ${player.squad_number}` : null,
            ]
              .filter(Boolean)
              .map((t) => (
                <span key={t} className="plate plate-sm num bg-panel-2 py-1 text-[11.5px] font-semibold uppercase tracking-[0.1em] text-ink">
                  {t}
                </span>
              ))}
            {isCaptain ? <span className="plate plate-sm num bg-gold/20 py-1 text-[11.5px] font-semibold uppercase tracking-[0.1em] text-gold">captain</span> : null}
          </p>
          {profile?.bio ? <blockquote className="mt-6 max-w-[56ch] border-l-2 border-gold pl-4 text-[17px] leading-relaxed text-ink">{profile.bio}</blockquote> : null}
        </div>
        <Shirt name={profile?.shirt_name ?? surname.toUpperCase()} number={player.squad_number} colours={club.colours} captain={isCaptain} crest={crestFor(club.name)} />
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
          className="pressable mt-10 flex flex-wrap items-baseline gap-x-4 gap-y-1 plate plate-sm border-gold/40 bg-panel px-5 py-4 hover:border-gold"
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
                    <span className="num inline-flex h-7 min-w-9 items-center justify-center plate plate-sm border-gold px-1 text-[10.5px] font-bold uppercase tracking-[0.06em] text-gold">{MILESTONE_MARK[m.kind]}</span>
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
                <Link href={`/film/${m.clipId}?t=${m.t}`} className="pressable flex items-baseline justify-between gap-3 plate plate-sm px-4 py-3 hover:bg-panel-2">
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
            {`nothing here yet. the nickname, the shirt, the walk-out song, the clubs before this one: it's ${first}'s page to fill.`}
          </p>
        )}
        {hub.canEdit ? (
          <div className="mt-8">
            <HubEditor playerId={player.id} profile={profile} moments={hub.moments} startOpen={false} />
          </div>
        ) : null}
      </Section>

      {hub.claimed || hub.canHandOver || hub.demoHandOver ? (
        <Section label="whose page" className="mt-14 border-t border-line pt-10">
          {hub.claimed ? (
            <p className="flex items-center gap-3 text-[14px] text-ink">
              <span aria-hidden className="inline-block h-2.5 w-2.5 bg-mint" />
              {`claimed: ${first} runs this page from their own account`}
            </p>
          ) : hub.canHandOver ? (
            <>
              <p className="mb-4 flex items-center gap-3 text-[14px] text-ink-dim">
                <span aria-hidden className="inline-block h-2.5 w-2.5 plate plate-sm border-ink-dim" />
                {`not claimed yet. hand it over and ${first} fills it in from their own phone.`}
              </p>
              <HandOver playerId={player.id} firstName={first} />
            </>
          ) : (
            <p className="max-w-[62ch] text-[14px] text-ink-dim">
              <span aria-hidden className="mr-3 inline-block h-2.5 w-2.5 plate plate-sm border-ink-dim align-middle" />
              {`the manager hands this page over with a link: ${first} signs in with an email, says it's them, and it's theirs.`}
            </p>
          )}
        </Section>
      ) : null}

      {health ? (
        <HealthProvider defaultMode={health.club.settings?.health_language ?? "plain"}>
          <section aria-label="health" className="mt-16 border-t border-line-strong pt-10">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="annot">{"// health"}</h2>
              <LanguageToggle />
            </div>
            <div className="mt-6">
              <StatTiles weekLoad={health.weekLoad} acwr={health.acwr} weekChange={health.weekChange} readiness={health.readiness} stats={health.stats} loads={health.loads} asOf={health.asOf} />
            </div>
            <div className="mt-8">
              <LoadSparkline loads={health.loads} asOf={health.asOf} flag={health.flag} readiness={health.readiness} acwr={health.acwr} weekChange={health.weekChange} injuries={health.injuries} />
            </div>
            <div className="mt-12 grid grid-cols-1 items-start gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
              <BodyMap injuries={health.injuries} asOf={health.asOf} playerId={player.id} initialParams={health.player.body_params} canEdit={false} />
              <div className="flex flex-col gap-12">
                {currentInjury ? <RtpPanel injury={currentInjury} steps={rtpSteps} asOf={health.asOf} canEdit={false} /> : null}
                <InjuryTable injuries={health.injuries} asOf={health.asOf} />
                <AvailabilityTimeline events={health.availabilityHistory} />
              </div>
            </div>
          </section>
        </HealthProvider>
      ) : null}

      {ownReal ? (
        <Section label="your health data" className="mt-14 border-t border-line pt-10">
          <ConsentForm route={{ kind: "account", playerId: player.id }} clubName={club.name} consented={!!consent && !consent.withdrawn_at}  maxDob={adultBorn()} />
        </Section>
      ) : null}
    </main>
  );
}
