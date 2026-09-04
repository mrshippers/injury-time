import Link from "next/link";
import { notFound } from "next/navigation";

import { ClipRoom } from "@/components/film/clip-room";
import { analysisConfigured } from "@/lib/film/analyse";
import { gameForClip, getClip, listSquad } from "@/lib/film/data";
import { parseFilmUrl } from "@/lib/film/urls";
import { getViewer } from "@/lib/viewer";

export const dynamic = "force-dynamic";

export default async function ClipPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const viewer = await getViewer();
  const clip = await getClip(viewer.club.id, id);
  if (!clip) notFound();
  const [{ result, fixture }, squad] = await Promise.all([gameForClip(viewer.club.id, clip), listSquad(viewer.club.id)]);
  const parsed = parseFilmUrl(clip.url);

  const game = result
    ? `${viewer.club.name} ${result.goals_for} ${result.goals_against} ${result.opponent} (${result.venue}) · ${result.competition}`
    : fixture
      ? `v ${fixture.opponent} (${fixture.venue}) · ${fixture.competition}`
      : clip.opponent
        ? `v ${clip.opponent}`
        : null;

  return (
    <main className="mx-auto w-full max-w-[1240px] flex-1 px-4 py-7 sm:px-8 sm:py-9">
      <Link href="/film" className="pressable inline-flex items-center gap-2 text-sm text-ink-dim hover:text-ink">
        <span aria-hidden>←</span> film room
      </Link>
      <header className="mt-5">
        <p className="annot">{`// ${clip.source === "veo" ? "veo" : clip.source === "youtube" ? "youtube" : "film"} · ${clip.status}`}</p>
        <h1 className="display mt-2 text-4xl sm:text-5xl">{clip.title}</h1>
        {game ? <p className="num mt-2 text-[12.5px] text-ink-dim">{game}{clip.match_date ? ` · ${clip.match_date}` : ""}</p> : null}
      </header>

      <div className="mt-7">
        <ClipRoom
          clip={clip}
          embedUrl={parsed?.embedUrl ?? null}
          videoId={parsed?.source === "youtube" ? parsed.id : null}
          players={squad.map((p) => ({ id: p.id, name: p.name, position: p.position, squad_number: p.squad_number }))}
          canEdit={viewer.can("manage_film")}
          analysisAvailable={analysisConfigured()}
        />
      </div>
    </main>
  );
}
