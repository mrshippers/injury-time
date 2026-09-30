/**
 * Pull the season into a club's tables.
 *
 *   npx tsx scripts/refresh-season.ts [club-slug]     (default: belstone)
 *
 * With FWP_API_KEY and FWP_TEAM_ID in the environment it reads Football Web
 * Pages; otherwise it reads scripts/<slug>-<season>.json. Either way it goes
 * through the same normaliser and the same upserts as the app would.
 * Supabase URL and the service role key come from .env.local: Belstone is
 * read-only to everyone else since 0010.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

import { createClient } from "@supabase/supabase-js";

import type { Database } from "../src/lib/types";
import { loadSeason, refreshSeason } from "../src/lib/league";
import type { Snapshot } from "../src/lib/league/normalise";

function loadEnvLocal(): void {
  const p = resolve(__dirname, "..", ".env.local");
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

async function main() {
  loadEnvLocal();
  const slug = process.argv[2] ?? "belstone";
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing");
  const db = createClient<Database>(url, key, { auth: { persistSession: false } });

  const { data: club, error } = await db.from("clubs").select("*").eq("slug", slug).maybeSingle();
  if (error) throw error;
  if (!club) throw new Error(`no club with slug ${slug}; run the seed first`);

  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date());
  const snapPath = resolve(__dirname, `${slug}-${club.season ?? ""}.json`);
  const snapshot = existsSync(snapPath) ? (JSON.parse(readFileSync(snapPath, "utf8")) as Snapshot) : undefined;

  const season = await loadSeason(club, { snapshot, today });
  const report = await refreshSeason(db, club, season, today);
  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
