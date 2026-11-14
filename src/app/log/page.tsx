import { DueNights, type DueCard } from "@/components/log/DueNights";
import { SessionForm, type NightPrefill } from "@/components/log/SessionForm";
import { loadTraining } from "@/lib/club/training-data";
import { getRoster, todayISO } from "@/lib/data";
import { suggestSession } from "@/lib/log/suggest";
import { addDays, draftLine, draftNight, nightLabel } from "@/lib/log/training";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/viewer";

export const dynamic = "force-dynamic";

export default async function LogPage({ searchParams }: { searchParams: Promise<{ night?: string }> }) {
  const sp = await searchParams;
  const [{ club, players }, viewer] = await Promise.all([getRoster(), getViewer()]);
  const today = todayISO();
  const supabase = await createClient();
  const since = new Date(Date.parse(today) - 4 * 86_400_000).toISOString().slice(0, 10);
  const [{ data: played }, { data: logged }, training] = await Promise.all([
    supabase.from("results").select("match_date, opponent").eq("club_id", club.id).gte("match_date", since).lte("match_date", today),
    supabase.from("sessions").select("session_date").eq("club_id", club.id).eq("kind", "match").gte("session_date", since),
    loadTraining(supabase, club.id),
  ]);

  // the player's own effort for each night, from the check-in the day after
  const oldest = training.due.at(-1)?.date;
  const { data: checkins } = oldest
    ? await supabase.from("player_checkins").select("player_id, checkin_on, last_rpe").eq("club_id", club.id).gte("checkin_on", addDays(oldest, 1))
    : { data: [] };
  const roster = players.map((p) => ({ id: p.id, name: p.name, status: p.status }));
  const draftOf = (n: (typeof training.due)[number]) => draftNight(n, roster, checkins ?? []);

  // "edit" on a card reopens this page on that night
  const [editId, editDate] = (sp.night ?? "").split(":");
  const editing = training.due.find((n) => n.scheduleId === editId && n.date === editDate);

  const suggestion = editing
    ? ({ kind: "training", night: editing } as const)
    : suggestSession(today, played ?? [], new Set((logged ?? []).map((s) => s.session_date as string)), training.due);

  let prefill: NightPrefill | undefined;
  if (suggestion.kind === "training" && suggestion.night) {
    const n = suggestion.night;
    const draft = draftOf(n);
    // only the efforts that differ from the schedule's usual are set per player
    prefill = {
      scheduleId: n.scheduleId,
      date: n.date,
      label: nightLabel(n),
      minutes: n.minutes,
      rpe: n.defaultRpe,
      rows: Object.fromEntries(draft.entries.filter((e) => e.rpe !== n.defaultRpe).map((e) => [e.playerId, e.rpe])),
    };
  }

  const cards: DueCard[] = training.due
    .filter((n) => !(editing && n.scheduleId === editing.scheduleId && n.date === editing.date))
    .map((n) => {
      const d = draftOf(n);
      return {
        scheduleId: n.scheduleId,
        date: n.date,
        label: nightLabel(n),
        line: draftLine(d),
        fromCheckins: d.fromCheckins,
        left: d.left.map((l) => l.name),
        canConfirm: !viewer.readOnly && viewer.can("log_session"),
      };
    });

  return (
    <main className="flex flex-1 flex-col">
      <DueNights cards={cards} />
      <SessionForm key={prefill ? `${prefill.scheduleId}|${prefill.date}` : suggestion.kind} club={club} players={players} today={today} suggestion={suggestion} prefill={prefill} />
    </main>
  );
}
