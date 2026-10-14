import { getRoster, todayISO } from "@/lib/data";
import { suggestSession } from "@/lib/log/suggest";
import { createClient } from "@/lib/supabase/server";
import { SessionForm } from "@/components/log/SessionForm";

export const dynamic = "force-dynamic";

export default async function LogPage() {
  const { club, players } = await getRoster();
  const today = todayISO();
  const supabase = await createClient();
  const since = new Date(Date.parse(today) - 4 * 86_400_000).toISOString().slice(0, 10);
  const [{ data: played }, { data: logged }] = await Promise.all([
    supabase.from("results").select("match_date, opponent").eq("club_id", club.id).gte("match_date", since).lte("match_date", today),
    supabase.from("sessions").select("session_date").eq("club_id", club.id).eq("kind", "match").gte("session_date", since),
  ]);
  const suggestion = suggestSession(today, played ?? [], new Set((logged ?? []).map((s) => s.session_date as string)));
  return (
    <main className="flex flex-1 flex-col">
      <SessionForm club={club} players={players} today={today} suggestion={suggestion} />
    </main>
  );
}
