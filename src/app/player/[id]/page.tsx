import Link from "next/link";
import { notFound } from "next/navigation";

import { getPlayerProfile } from "@/lib/data";
import { getViewer } from "@/lib/viewer";
import AvailabilityTimeline from "@/components/player/availability-timeline";
import BodyMap from "@/components/player/body-map";
import InjuryTable from "@/components/player/injury-table";
import LanguageToggle, { HealthProvider } from "@/components/player/language-toggle";
import LoadSparkline from "@/components/player/load-sparkline";
import PlayerHeader from "@/components/player/player-header";
import StatTiles from "@/components/player/stat-tiles";

export default async function PlayerPage(props: PageProps<"/player/[id]">) {
  const { id } = await props.params;
  const [profile, viewer] = await Promise.all([getPlayerProfile(id), getViewer()]);
  if (!profile) notFound();

  const defaultMode = profile.club.settings?.health_language ?? "plain";
  const canEditBody = viewer.guest || viewer.can("edit_body");

  return (
    <HealthProvider defaultMode={defaultMode}>
      <main className="mx-auto w-full max-w-[1280px] flex-1 px-6 py-10 sm:px-10 lg:px-16">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link href="/squad" className="pressable inline-flex items-center gap-2 text-sm text-ink-dim hover:text-ink">
            <span aria-hidden>←</span> squad
          </Link>
          <LanguageToggle />
        </div>

        <div className="mt-6">
          <PlayerHeader player={profile.player} availability={profile.availability} />
        </div>

        <div className="mt-8">
          <StatTiles
            weekLoad={profile.weekLoad}
            acwr={profile.acwr}
            weekChange={profile.weekChange}
            readiness={profile.readiness}
            stats={profile.stats}
            loads={profile.loads}
            asOf={profile.asOf}
          />
        </div>

        <div className="mt-8">
          <LoadSparkline
            loads={profile.loads}
            asOf={profile.asOf}
            flag={profile.flag}
            readiness={profile.readiness}
            acwr={profile.acwr}
            weekChange={profile.weekChange}
            injuries={profile.injuries}
          />
        </div>

        <div className="mt-14 grid grid-cols-1 items-start gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,440px)]">
          <BodyMap
            injuries={profile.injuries}
            asOf={profile.asOf}
            playerId={profile.player.id}
            initialParams={profile.player.body_params}
            canEdit={canEditBody}
          />

          <div className="flex flex-col gap-12">
            <InjuryTable injuries={profile.injuries} asOf={profile.asOf} />
            <AvailabilityTimeline events={profile.availabilityHistory} />
          </div>
        </div>

        <p className="annot mt-16 text-gold-dim">{`// as of ${profile.asOf} · ${profile.club.name}`}</p>
      </main>
    </HealthProvider>
  );
}
