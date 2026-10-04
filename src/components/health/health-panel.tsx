import { createClient } from "@/lib/supabase/server";
import type { Viewer } from "@/lib/viewer";

import { ConsentLinkButton, DeleteNote, EraseButton, NoteForm } from "./health-panel-client";

/**
 * The lawful side of a player's health record (0014), on the staff view: has
 * the player consented, the notes only medical and the player read, and
 * erasure on request. A demo club shows none of it: its players are invented
 * or public.
 */
export default async function HealthPanel({ viewer, player, currentInjuryId }: { viewer: Viewer; player: { id: string; name: string }; currentInjuryId: string | null }) {
  if (viewer.guest || viewer.club.is_demo) return null;
  const own = viewer.playerId === player.id;
  const staff = viewer.can("view_squad_health");
  if (!own && !staff) return null;
  const first = player.name.split(" ")[0];
  const supabase = await createClient();
  const [{ data: consent }, notesRes] = await Promise.all([
    supabase.from("health_consents").select("given_at, withdrawn_at, wording_version").eq("player_id", player.id).maybeSingle(),
    viewer.role === "medical" || own
      ? supabase.from("medical_notes").select("id, body, created_at").eq("player_id", player.id).order("created_at", { ascending: false }).limit(20)
      : Promise.resolve({ data: null }),
  ]);
  const live = consent && !consent.withdrawn_at;
  const notes = notesRes.data ?? null;

  return (
    <section aria-labelledby="health-h" className="mt-14 border-t border-line pt-8">
      <p className="annot" id="health-h">{"// consent and notes"}</p>
      <p className="mt-3 flex items-center gap-3 text-[14px] text-ink">
        <span aria-hidden className={`inline-block h-2.5 w-2.5 ${live ? "bg-mint" : "border border-ink-dim"}`} />
        {live
          ? `${first} consented ${consent.given_at.slice(0, 10)} (wording ${consent.wording_version})`
          : consent?.withdrawn_at
            ? `${first} withdrew consent ${consent.withdrawn_at.slice(0, 10)}: nothing new about their health can be recorded`
            : `${first} has not consented yet: injuries, doubts and notes cannot be recorded until they do`}
      </p>
      {staff && !live ? (
        <div className="mt-4">
          <ConsentLinkButton playerId={player.id} firstName={first} />
        </div>
      ) : null}

      {notes ? (
        <div className="mt-8">
          <h3 className="text-[15px] font-semibold text-ink">Medical notes</h3>
          {notes.length ? (
            <ul className="mt-2 border-t border-line">
              {notes.map((n) => (
                <li key={n.id} className="flex items-baseline gap-4 border-b border-line py-2.5 text-[14px]">
                  <span className="num w-24 shrink-0 text-[12px] text-ink-dim">{n.created_at.slice(0, 10)}</span>
                  <span className="min-w-0 flex-1 text-ink">{n.body}</span>
                  {viewer.role === "medical" ? <DeleteNote noteId={n.id} playerId={player.id} /> : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-[13.5px] text-ink-dim">none</p>
          )}
          {viewer.role === "medical" && live ? <NoteForm playerId={player.id} injuryId={currentInjuryId} /> : null}
        </div>
      ) : staff ? (
        <p className="mt-6 text-[13px] text-ink-dim">Medical notes are for medical staff and the player only.</p>
      ) : null}

      {viewer.role === "manager" || viewer.role === "medical" ? (
        <div className="mt-8">
          <EraseButton playerId={player.id} firstName={first} />
        </div>
      ) : null}
    </section>
  );
}
