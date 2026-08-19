import { getRoster, todayISO } from "@/lib/data";
import { SessionForm } from "@/components/log/SessionForm";

export default async function LogPage() {
  const { club, players } = await getRoster();
  return (
    <main className="flex flex-1 flex-col">
      <SessionForm club={club} players={players} today={todayISO()} />
    </main>
  );
}
