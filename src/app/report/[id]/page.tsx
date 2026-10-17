import Link from "next/link";
import { notFound } from "next/navigation";

import { Crest } from "@/components/club/crest";
import { ReportDraft } from "@/components/no2/report-draft";
import { shortDate } from "@/components/squad/format";
import { aiConfigured } from "@/lib/ai/claude";
import { getNote } from "@/lib/ai/notes";
import type { MatchReport } from "@/lib/ai/schemas";
import { createClient } from "@/lib/supabase/server";
import type { Result } from "@/lib/types";
import { getViewer } from "@/lib/viewer";

export const dynamic = "force-dynamic";
export const metadata = { title: "match report - injury time." };

/** One result, and the No.2's draft report for it: the website piece and the post, ready to copy. */
export default async function ReportPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const viewer = await getViewer();
  const supabase = await createClient();
  const { data } = await supabase.from("results").select("*").eq("id", id).eq("club_id", viewer.club.id).maybeSingle();
  if (!data) notFound();
  const r = data as Result;
  const stored = await getNote<MatchReport>(viewer.club.id, "report", id);
  const t = r.goals_for > r.goals_against ? "W" : r.goals_for === r.goals_against ? "D" : "L";
  return (
    <main className="mx-auto w-full max-w-[900px] flex-1 px-4 py-7 sm:px-8 sm:py-9">
      <Link href="/stats" className="pressable inline-flex items-center gap-2 text-sm text-ink-dim hover:text-ink">
        <span aria-hidden>←</span> stats
      </Link>
      <p className="annot mt-6">{`// match report · ${shortDate(r.match_date).toLowerCase()} · ${r.competition.toLowerCase()}`}</p>
      <div className="mt-3 flex flex-wrap items-center gap-4">
        <h1 className="display text-4xl sm:text-5xl">
          {viewer.club.name} {r.goals_for}-{r.goals_against}
        </h1>
        <span className="flex items-center gap-2 text-[20px] text-ink">
          <Crest team={r.opponent} size={30} />
          {r.opponent} <span className="num text-[13px] text-ink-dim">({r.venue})</span>
        </span>
        <span className="plate plate-sm num bg-panel-2 py-1 text-[12px] font-semibold text-ink">{t}</span>
      </div>
      <p className="num mt-3 text-[12.5px] text-ink-dim">
        {r.ht_for !== null && r.ht_against !== null ? `ht ${r.ht_for}-${r.ht_against}` : ""}
        {r.attendance ? ` · crowd ${r.attendance}` : ""}
        {(r.scorers ?? []).length ? ` · ${(r.scorers ?? []).join(", ")}` : ""}
      </p>
      {aiConfigured() || stored ? <ReportDraft resultId={r.id} initial={stored?.body ?? null} /> : null}
    </main>
  );
}
