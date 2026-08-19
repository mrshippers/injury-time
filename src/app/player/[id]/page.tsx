import Link from "next/link";
import { notFound } from "next/navigation";
import { getPlayerProfile } from "@/lib/data";
import AvailabilityTimeline from "@/components/player/availability-timeline";
import BodyMap from "@/components/player/body-map";
import InjuryTable from "@/components/player/injury-table";
import LoadSparkline from "@/components/player/load-sparkline";
import PlayerHeader from "@/components/player/player-header";
import StatTiles from "@/components/player/stat-tiles";

export default async function PlayerPage(props: PageProps<"/player/[id]">) {
  const { id } = await props.params;
  const profile = await getPlayerProfile(id);
  if (!profile) notFound();

  return (
    <main className="flex-1 px-6 sm:px-10 lg:px-16 py-10 max-w-[1280px] w-full mx-auto">
      <Link
        href="/squad"
        className="pressable inline-flex items-center gap-2 text-sm text-ink-dim hover:text-ink"
      >
        <span aria-hidden>←</span> squad
      </Link>

      <div className="mt-6">
        <PlayerHeader
          player={profile.player}
          availability={profile.availability}
          flag={profile.flag}
        />
      </div>

      <div className="mt-8">
        <StatTiles
          weekLoad={profile.weekLoad}
          acwr={profile.acwr}
          weekChange={profile.weekChange}
          flag={profile.flag}
        />
      </div>

      <div className="mt-8">
        <LoadSparkline
          loads={profile.loads}
          asOf={profile.asOf}
          flag={profile.flag}
        />
      </div>

      <div className="mt-14 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,440px)] gap-10 items-start">
        <BodyMap injuries={profile.injuries} asOf={profile.asOf} />

        <div className="flex flex-col gap-12">
          <InjuryTable injuries={profile.injuries} asOf={profile.asOf} />
          <AvailabilityTimeline events={profile.availabilityHistory} />
        </div>
      </div>

      <p className="annot mt-16 text-gold-dim">
        {`// as of ${profile.asOf} · ${profile.club.name}`}
      </p>
    </main>
  );
}
