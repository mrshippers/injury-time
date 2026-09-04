import { AddFilmForm } from "@/components/film/add-film-form";
import { ClipList } from "@/components/film/clip-list";
import { analysisConfigured } from "@/lib/film/analyse";
import { listClips, listGames } from "@/lib/film/data";
import { veoConfigured } from "@/lib/film/veo";
import { getViewer } from "@/lib/viewer";

export const dynamic = "force-dynamic";

export const metadata = { title: "the film room - injury time." };

/**
 * The film room. Paste a link, tag what happened, get Tuesday's session and
 * Saturday's plan back. Everything a pro club's analyst does, on a phone.
 */
export default async function FilmPage() {
  const viewer = await getViewer();
  const [clips, games] = await Promise.all([listClips(viewer.club.id), listGames(viewer.club.id)]);
  const analysed = clips.filter((c) => c.status === "analysed").length;
  const tagged = clips.reduce((n, c) => n + c.events.length, 0);

  return (
    <main className="mx-auto w-full max-w-[1240px] flex-1 px-4 py-7 sm:px-8 sm:py-9">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="annot">{"// the film room"}</p>
          <h1 className="display mt-2 text-4xl sm:text-5xl">
            {viewer.club.name}
            <span aria-hidden className="ml-[0.08em] inline-block h-[0.14em] w-[0.14em] bg-mint align-baseline" />
          </h1>
          <p className="mt-2 max-w-[52ch] text-[13px] text-ink-dim">
            Paste a Veo or YouTube link, tag what happened, and the analyst turns it into Saturday&apos;s plan and Tuesday&apos;s session.
          </p>
        </div>
        <p className="num text-[12px] text-ink-dim">
          {clips.length} film{clips.length === 1 ? "" : "s"} · {tagged} events tagged · {analysed} analysed
        </p>
      </header>

      <div className="mt-7 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)] lg:items-start">
        <ClipList clips={clips} />
        <aside className="lg:sticky lg:top-16">
          {viewer.can("manage_film") ? (
            <AddFilmForm fixtures={games.fixtures} results={games.results} />
          ) : (
            <p className="border border-line bg-panel px-5 py-4 text-[13px] text-ink-dim">Staff add film. Ask the gaffer.</p>
          )}
          <p className="annot mt-4 text-gold-dim">
            {analysisConfigured() ? "analyst ready" : "no analysis key on this server"}
            {" · "}
            {veoConfigured() ? "veo connected" : "veo links kept as links until the partner api is wired"}
          </p>
        </aside>
      </div>
    </main>
  );
}
