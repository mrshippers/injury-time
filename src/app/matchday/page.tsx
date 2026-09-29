import Link from "next/link";

import { MatchdayBoard } from "@/components/matchday/matchday-board";
import { longDate } from "@/components/squad/format";
import { getRoster, todayISO } from "@/lib/data";
import { getSavedLineup } from "@/lib/squad/data";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata = { title: "matchday - injury time." };

/**
 * The dugout screen. One phone, one hand, cold fingers: the clock, the XI, the
 * bench, and a sub is two taps. Minutes feed the logger at the whistle; how
 * hard it felt (RPE) is still each player's to say, never guessed here.
 */
export default async function MatchdayPage() {
  const { club, players } = await getRoster();
  const supabase = await createClient();
  const { data: next } = await supabase
    .from("fixtures")
    .select("*")
    .eq("club_id", club.id)
    .gte("match_date", todayISO())
    .order("match_date", { ascending: true })
    .limit(1)
    .maybeSingle();
  const lineup = await getSavedLineup(club.id, next?.id ?? null);
  const names = Object.fromEntries(players.map((p) => [p.id, { name: p.name, number: p.squad_number }]));
  const xi = (lineup?.xi ?? []).filter((id): id is string => !!id && id in names);
  const bench = (lineup?.bench ?? []).filter((id) => id in names && !xi.includes(id));

  return (
    <main className="mx-auto w-full max-w-[760px] flex-1 px-4 py-6 sm:px-8 sm:py-9">
      <p className="annot">{"// matchday"}</p>
      {!next ? (
        <>
          <h1 className="display mt-2 text-4xl">no match in the diary</h1>
          <p className="mt-3 text-[14px] text-ink-dim">Add the next fixture and pick the side, then the dugout screen is ready.</p>
        </>
      ) : xi.length < 7 ? (
        <>
          <h1 className="display mt-2 text-4xl">
            {next.venue === "H" ? `${next.opponent} at home` : `away at ${next.opponent}`}
          </h1>
          <p className="mt-3 text-[14px] text-ink-dim">
            No side saved for {longDate(next.match_date)} yet. Pick the XI in the squad room first; the clock starts from it.
          </p>
          <Link href="/squad" className="pressable mt-5 inline-flex h-11 items-center rounded-[2px] bg-mint px-4 text-[12px] font-bold uppercase tracking-[0.12em] text-mint-ink">
            pick the side
          </Link>
        </>
      ) : (
        <MatchdayBoard
          fixture={{ id: next.id, date: next.match_date, opponent: next.opponent, venue: next.venue }}
          xi={xi}
          bench={bench.length ? bench : players.filter((p) => !xi.includes(p.id) && p.status !== "injured" && p.status !== "suspended").map((p) => p.id)}
          names={names}
        />
      )}
    </main>
  );
}
