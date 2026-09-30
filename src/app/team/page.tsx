import Link from "next/link";

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

export const metadata = { title: "the team - injury time." };

/**
 * The squad's page. A player opens it on the bus: who are we playing, am I
 * in, what did the gaffer say. Everything on it moves in real time.
 */
export default async function TeamPage() {
  const { viewer, next, daysUntil, players, calls, notices, attendance, now, asOf } = await getTeamPage();
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
        {viewer.guest ? (
          <p className="text-[13px] leading-relaxed text-ink-dim">
            <span aria-hidden className="mr-2 inline-block h-2.5 w-2.5 border border-ink-dim align-[-1px]" />
            <span className="mr-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink">notifications</span>
            come with a club account: the gaffer&apos;s notices and match calls, straight to your phone
          </p>
        ) : (
          <NotifyToggle />
        )}
      </div>
      <header className="mb-6">
        <p className="annot">{`// the team · ${viewer.club.name.toLowerCase()}`}</p>
        {next ? (
          <>
            <h1 className="display mt-2 text-4xl sm:text-5xl">
              {next.venue === "H" ? `${next.opponent} at home` : `away at ${next.opponent}`}
              <span aria-hidden className="ml-[0.08em] inline-block h-[0.14em] w-[0.14em] bg-mint align-baseline" />
            </h1>
            <p className="mt-3 text-[14px] text-ink-dim sm:text-[13.5px]">
              <span className="num text-ink">{longDate(next.match_date)}</span>
              {next.kickoff ? <span className="num"> · {next.kickoff}</span> : null}
              {" · "}
              {next.competition}
              {daysUntil !== null ? <span className="num text-gold"> · {daysAwayWord(daysUntil)}</span> : null}
            </p>
            <Link
              href="/matchday"
              className="pressable mt-4 inline-flex h-10 items-center rounded-[2px] border border-line-strong bg-pitch px-3 text-[12px] font-semibold uppercase tracking-[0.1em] text-ink hover:bg-panel-2"
            >
              matchday screen
            </Link>
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
        {viewer.guest ? (
          <p className="annot mt-3 text-gold-dim">{"// guest view · you can call for anyone, a signed-in player calls only for themselves"}</p>
        ) : (
          <p className="annot mt-3 text-gold-dim">{`// signed in as ${viewer.role}`}</p>
        )}
      </header>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <div className="flex flex-col gap-5">
          {next ? (
            <CallBoard
              clubId={viewer.club.id}
              fixture={next}
              players={players}
              calls={calls}
              role={viewer.role}
              ownPlayerId={viewer.role === "player" ? viewer.playerId : null}
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
