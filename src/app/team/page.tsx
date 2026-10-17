import Link from "next/link";

import { Crest } from "@/components/club/crest";
import { MatchWeatherCard } from "@/components/home/match-weather";
import { matchWeather } from "@/lib/weather/grounds";
import { Opposition } from "@/components/scout/opposition";
import { getHomeSeason } from "@/lib/home/data";
import { scoutFacts } from "@/lib/scout/brief";
import { AttendanceTrend } from "@/components/team/attendance-trend";
import { CallBoard } from "@/components/team/call-board";
import { CheckinsPanel } from "@/components/team/checkins-panel";
import { NoticeBoard } from "@/components/team/notice-board";
import { NotifyToggle } from "@/components/pwa/pwa";
import { createClient } from "@/lib/supabase/server";
import type { PlayerCheckin } from "@/lib/types";
import { longDate } from "@/components/squad/format";
import { getTeamPage } from "@/lib/team/data";
import { daysAwayWord, weekdayWord } from "@/lib/team/format";

export const dynamic = "force-dynamic";

export const metadata = { title: "matchday - injury time." };

/**
 * The squad's page. A player opens it on the bus: who are we playing, am I
 * in, what did the gaffer say. Everything on it moves in real time.
 */
export default async function TeamPage() {
  const { viewer, next, daysUntil, players, calls, usual, notices, attendance, now, asOf } = await getTeamPage();
  const weather = next ? await matchWeather(viewer.club.name, next, asOf) : null;
  const season = next ? await getHomeSeason(viewer.club.id, asOf) : null;
  const facts = next && season ? scoutFacts(next, season.standings, season.results) : null;
  // RLS returns rows only to staff of a real club; a guest or a player gets none
  const staff = !viewer.guest && viewer.can("view_squad_health");
  let checkins: PlayerCheckin[] = [];
  if (staff) {
    const { data } = await (await createClient()).from("player_checkins").select("*").eq("club_id", viewer.club.id).eq("checkin_on", asOf);
    checkins = (data ?? []) as PlayerCheckin[];
  }

  return (
    <main className="mx-auto w-full max-w-[1240px] flex-1 px-4 py-7 sm:px-8 sm:py-9">
      <div className="mb-6 border-b border-line pb-4">
        {viewer.guest ? null : <NotifyToggle />}
      </div>
      <header className="mb-6">
        <p className="annot">{`// matchday · ${viewer.club.name.toLowerCase()}`}</p>
        {next ? (
          <>
            <div className="mt-2 flex items-center gap-4">
              <Crest team={next.opponent} size={52} className="max-sm:!size-10" />
              <h1 className="display text-4xl sm:text-5xl">
                {next.venue === "H" ? `${next.opponent} at home` : `away at ${next.opponent}`}
                <span aria-hidden className="ml-[0.08em] inline-block h-[0.14em] w-[0.14em] bg-mint align-baseline" />
              </h1>
            </div>
            <p className="mt-3 text-[14px] text-ink-dim sm:text-[13.5px]">
              <span className="num text-ink">{longDate(next.match_date)}</span>
              {next.kickoff ? <span className="num"> · {next.kickoff}</span> : null}
              {" · "}
              {next.competition}
              {daysUntil !== null ? <span className="num text-gold"> · {daysAwayWord(daysUntil)}</span> : null}
            </p>
            <MatchWeatherCard weather={weather} className="mt-3 max-w-[360px]" />
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href="/matchday"
                className="pressable plate inline-flex h-10 items-center bg-panel-2 text-[12px] font-semibold uppercase tracking-[0.1em] text-ink transition-transform duration-200 hover:translate-x-0.5"
              >
                dugout screen
              </Link>
              <Link
                href="/log"
                className="pressable plate inline-flex h-10 items-center bg-panel text-[12px] font-semibold uppercase tracking-[0.1em] text-ink-dim transition-transform duration-200 hover:translate-x-0.5 hover:text-ink"
              >
                log the session
              </Link>
            </div>
          </>
        ) : (
          <>
            <h1 className="display mt-2 text-4xl sm:text-5xl">
              no match in the diary
              <span aria-hidden className="ml-[0.08em] inline-block h-[0.14em] w-[0.14em] bg-mint align-baseline" />
            </h1>
            <p className="mt-3 text-[13.5px] text-ink-dim">Add the next fixture and the squad can start calling in.</p>
          </>
        )}
        {viewer.guest ? null : (
          <p className="annot mt-3 text-gold-dim">{`// signed in as ${viewer.role}`}</p>
        )}
      </header>

      {next && facts ? <Opposition clubId={viewer.club.id} fixtureId={next.id} facts={facts} /> : null}

      <div className="mt-8 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <div className="flex flex-col gap-5">
          {next ? (
            <CallBoard
              clubId={viewer.club.id}
              fixture={next}
              players={players}
              calls={calls}
              usual={usual}
              role={viewer.role}
              ownPlayerId={viewer.role === "player" ? viewer.playerId : null}
              readOnly={viewer.readOnly}
            />
          ) : null}
          {staff || viewer.club.is_demo ? (
            <CheckinsPanel
              players={players.map((p) => ({ id: p.id, name: p.name, number: p.squad_number }))}
              today={checkins}
              isDemo={viewer.club.is_demo}
              canSend={staff && !viewer.club.is_demo}
            />
          ) : null}
        </div>
        <div className="flex flex-col gap-5">
          <NoticeBoard
            clubId={viewer.club.id}
            notices={notices}
            canPost={viewer.can("post_notice")}
            role={viewer.role}
            fixture={next}
            now={now}
          />
          <AttendanceTrend
            points={attendance}
            next={next ? { opponent: next.opponent, venue: next.venue, weekday: weekdayWord(next.match_date) } : null}
          />
        </div>
      </div>

      <p className="annot mt-6 text-gold-dim">
        in · out · unsure is the player&apos;s own call for the next match&ensp;·&ensp;it lands on every phone the moment it is made&ensp;·&ensp;a notice from the staff does the same
      </p>
    </main>
  );
}
