/**
 * The RLS probe. Against a Postgres with every migration applied (scripts/db/local.sh),
 * it signs a real-shaped club up through create_club, brings staff in through invites,
 * players in through claims, then acts as each role and prints how many of one
 * player's health rows each can read. Then it proves the consent gate, the adults-only
 * rule, the invite rules, and erasure. Exits 1 on the first expectation that fails.
 *
 *   npm run db:probe
 *
 * Acting as someone is what PostgREST does: role authenticated (or anon) and the
 * JWT subject in request.jwt.claim.sub, which auth.uid() reads.
 */
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";

const URL = process.env.PGURL;
if (!URL) {
  console.error('PGURL is not set: eval "$(scripts/db/local.sh)" first');
  process.exit(2);
}

type Who = { label: string; id: string | null; role: "anon" | "authenticated" };
type Out = { ok: true; rows: string[] } | { ok: false; error: string };

function sql(body: string, who?: Who): Out {
  const pre = who
    ? `set local role ${who.role}; select set_config('request.jwt.claim.sub', '${who.id ?? ""}', true);`
    : "";
  try {
    const out = execFileSync("psql", ["-X", "-q", "-At", "-v", "ON_ERROR_STOP=1", URL!, "-c", `begin; ${pre} ${body}; commit;`], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    // set_config prints its value; keep only the body's output
    const rows = out.split("\n").filter((l) => l !== "" && l !== (who?.id ?? "") && l !== "BEGIN" && l !== "COMMIT");
    return { ok: true, rows };
  } catch (e) {
    const err = (e as { stderr?: string }).stderr ?? String(e);
    return { ok: false, error: err.replace(/\s+/g, " ").trim() };
  }
}

let failed = 0;
function expect(name: string, cond: boolean, detail = "") {
  console.log(`${cond ? "ok  " : "FAIL"} ${name}${detail ? `  (${detail})` : ""}`);
  if (!cond) failed += 1;
}
const one = (o: Out) => (o.ok ? o.rows[o.rows.length - 1] ?? "" : `ERROR ${o.error}`);
const must = (o: Out, what: string): string => {
  if (!o.ok) {
    console.error(`setup failed at ${what}: ${o.error}`);
    process.exit(1);
  }
  return o.rows[o.rows.length - 1] ?? "";
};

// ── people ──────────────────────────────────────────────────────────────────
const user = (label: string): Who => ({ label, id: randomUUID(), role: "authenticated" });
const manager = user("manager");
const coach = user("coach");
const medical = user("medical");
const teammate = user("teammate");
const self = user("the player");
const outsider = user("outsider");
const anon: Who = { label: "anon", id: null, role: "anon" };
for (const u of [manager, coach, medical, teammate, self, outsider]) must(sql(`insert into auth.users (id, email) values ('${u.id}', '${u.label.replace(/ /g, "")}@probe.test')`), `user ${u.label}`);

// ── sign-up ─────────────────────────────────────────────────────────────────
console.log("\nsign-up");
const refusedKids = sql(`select public.create_club('Probe Youth', 'Probe League', 'manager', false)`, manager);
expect("a side that is not confirmed adult is refused", !refusedKids.ok && refusedKids.error.includes("adults_only"));
const anonClub = sql(`select public.create_club('Probe FC', 'Probe League', 'manager', true)`, anon);
expect("anon cannot sign a club up", !anonClub.ok);
const cid = must(sql(`select public.create_club('  Probe   FC ', 'Probe League Division One', 'manager', true)`, manager), "create_club");
expect("create_club returns the club and makes the caller its manager", one(sql(`select role from public.club_members where club_id = '${cid}' and user_id = '${manager.id}'`)) === "manager");
expect("the name is tidied and the slug is made", one(sql(`select name || '|' || slug || '|' || is_demo from public.clubs where id = '${cid}'`)) === "Probe FC|probe-fc|false");
must(sql(`select public.create_club('Probe FC', 'Probe League', 'manager', true)`, manager), "second club");
must(sql(`select public.create_club('Probe FC', 'Probe League', 'manager', true)`, manager), "third club");
expect("a clashing name gets the next slug", one(sql(`select string_agg(slug, ',' order by slug) from public.clubs where created_by = '${manager.id}'`)) === "probe-fc,probe-fc-2,probe-fc-3");
const fourth = sql(`select public.create_club('Probe Four', 'Probe League', 'manager', true)`, manager);
expect("a fourth club from one account is refused", !fourth.ok && fourth.error.includes("three clubs"));

// ── staff invites ───────────────────────────────────────────────────────────
console.log("\nstaff invites");
const coachToken = must(sql(`select public.mint_staff_invite('${cid}', 'coach')`, manager), "mint coach");
const medToken = must(sql(`select public.mint_staff_invite('${cid}', 'medical')`, manager), "mint medical");
expect("a coach cannot mint an invite", !sql(`select public.mint_staff_invite('${cid}', 'coach')`, outsider).ok);
expect("an invite cannot make a manager", !sql(`select public.mint_staff_invite('${cid}', 'manager')`, manager).ok);
expect("anon reads what an invite is for", one(sql(`select club_name || '|' || role || '|' || usable from public.staff_invite_status('${coachToken}')`, anon)) === "Probe FC|coach|true");
must(sql(`select public.accept_staff_invite('${coachToken}')`, coach), "coach accepts");
must(sql(`select public.accept_staff_invite('${medToken}')`, medical), "medical accepts");
expect("the coach joined as coach", one(sql(`select role from public.club_members where club_id = '${cid}' and user_id = '${coach.id}'`)) === "coach");
expect("the medical joined as medical", one(sql(`select role from public.club_members where club_id = '${cid}' and user_id = '${medical.id}'`)) === "medical");
const reused = sql(`select public.accept_staff_invite('${coachToken}')`, outsider);
expect("a used invite is refused", !reused.ok && reused.error.includes("used or has expired"));
const stale = must(sql(`select public.mint_staff_invite('${cid}', 'coach')`, manager), "mint stale");
must(sql(`update public.staff_invites set expires_at = now() - interval '1 minute' where token = '${stale}'`), "expire");
expect("an expired invite is refused", !sql(`select public.accept_staff_invite('${stale}')`, outsider).ok);
expect("a made-up invite is refused", !sql(`select public.accept_staff_invite('${randomUUID()}')`, outsider).ok);
expect("the outsider is still on no club", one(sql(`select count(*) from public.club_members where user_id = '${outsider.id}'`)) === "0");
expect("anon cannot read the invites table", !sql(`select count(*) from public.staff_invites`, anon).ok);

// ── the squad ───────────────────────────────────────────────────────────────
console.log("\nthe squad");
const pidSelf = must(sql(`insert into public.players (club_id, name, position) values ('${cid}', 'Sam Self', 'MF') returning id`, manager), "player self");
const pidMate = must(sql(`insert into public.players (club_id, name, position) values ('${cid}', 'Tom Mate', 'DF') returning id`, coach), "player mate");
for (const [pid, who] of [[pidSelf, self], [pidMate, teammate]] as const) {
  const tok = must(sql(`select public.mint_player_claim('${pid}')`, manager), "mint claim");
  must(sql(`select public.claim_player('${tok}')`, who), "claim");
}
expect("a player cannot add a player", !sql(`insert into public.players (club_id, name, position) values ('${cid}', 'Sneaky Add', 'FW')`, teammate).ok);

// ── the consent gate ────────────────────────────────────────────────────────
console.log("\nconsent");
const injury = (pid: string) => `insert into public.injuries (club_id, player_id, body_region, side, severity, occurred_on) values ('${cid}', '${pid}', 'hamstring', 'left', 'minor', current_date) returning id`;
const before = sql(injury(pidSelf), medical);
expect("an injury for a player with no consent fails on health_consent_required", !before.ok && before.error.includes("health_consent_required"), before.ok ? "it was accepted" : "");
const doubt = sql(`insert into public.availability_events (club_id, player_id, status) values ('${cid}', '${pidSelf}', 'doubt')`, coach);
expect("a doubt without consent is refused", !doubt.ok && doubt.error.includes("health_consent_required"));
expect("a suspension without consent is fine (it says nothing about the body)", sql(`insert into public.availability_events (club_id, player_id, status) values ('${cid}', '${pidSelf}', 'suspended')`, coach).ok);
expect("staff cannot give consent for a player", !sql(`select public.give_health_consent('${pidSelf}', '1995-04-01', 'v1')`, manager).ok);
const kid = sql(`select public.give_health_consent('${pidSelf}', (current_date - interval '17 years')::date, 'v1')`, self);
expect("an under-18 date of birth is refused", !kid.ok && kid.error.includes("under_18"));
expect("the player gives consent, adult date of birth", one(sql(`select public.give_health_consent('${pidSelf}', '1995-04-01', 'v1')`, self)) === "given");
expect("the teammate cannot read the date of birth", one(sql(`select count(*) from public.health_consents where player_id = '${pidSelf}'`, teammate)) === "0");

// health rows about the player, written by the staff who would write them
const injuryId = must(sql(injury(pidSelf), medical), "injury after consent");
must(sql(`insert into public.availability_events (club_id, player_id, status, injury_id) values ('${cid}', '${pidSelf}', 'injured', '${injuryId}')`, medical), "availability");
must(sql(`insert into public.rtp_steps (club_id, injury_id, stage, target_date) values ('${cid}', '${injuryId}', 'jogging', current_date + 7)`, medical), "rtp");
must(sql(`insert into public.medical_notes (club_id, player_id, injury_id, body) values ('${cid}', '${pidSelf}', '${injuryId}', 'grade 1, no imaging needed')`, medical), "note");
expect("a manager cannot write a medical note", !sql(`insert into public.medical_notes (club_id, player_id, body) values ('${cid}', '${pidSelf}', 'x')`, manager).ok);
const sid = must(sql(`insert into public.sessions (club_id, session_date, kind) values ('${cid}', current_date, 'training') returning id`, coach), "session");
must(sql(`insert into public.session_loads (club_id, session_id, player_id, rpe, minutes) values ('${cid}', '${sid}', '${pidSelf}', 6, 70)`, coach), "load");
must(sql(`insert into public.player_checkin_links (player_id) values ('${pidSelf}')`), "checkin link");
const link = must(sql(`select token from public.player_checkin_links where player_id = '${pidSelf}'`), "link token");
must(sql(`select public.submit_checkin('${link}', true, 3, 6, 'yes')`, anon), "checkin");
expect("a player cannot write an injury, even their own", !sql(injury(pidSelf), self).ok);

// ── the matrix ──────────────────────────────────────────────────────────────
console.log("\nrows about one player readable, by who is asking");
const tables: [string, string][] = [
  ["injuries", `player_id = '${pidSelf}'`],
  ["availability_events", `player_id = '${pidSelf}'`],
  ["session_loads", `player_id = '${pidSelf}'`],
  ["rtp_steps", `injury_id = '${injuryId}'`],
  ["medical_notes", `player_id = '${pidSelf}'`],
  ["player_checkins", `player_id = '${pidSelf}'`],
  ["health_consents", `player_id = '${pidSelf}'`],
];
const people = [anon, outsider, teammate, self, coach, manager, medical];
// what each may see: a number, or 0 for nothing
const allowed: Record<string, Record<string, boolean>> = {
  injuries: { "the player": true, coach: true, manager: true, medical: true },
  availability_events: { "the player": true, coach: true, manager: true, medical: true },
  session_loads: { "the player": true, coach: true, manager: true, medical: true },
  rtp_steps: { "the player": true, coach: true, manager: true, medical: true },
  medical_notes: { "the player": true, medical: true },
  player_checkins: { "the player": true, coach: true, manager: true, medical: true },
  health_consents: { "the player": true, coach: true, manager: true, medical: true },
};
const width = 20;
console.log("".padEnd(width) + people.map((p) => p.label.padStart(11)).join(""));
for (const [t, where] of tables) {
  const cells = people.map((p) => {
    const o = sql(`select count(*) from public.${t} where ${where}`, p);
    const n = o.ok ? Number(one(o)) : 0; // a permission error is zero rows readable
    const ok = allowed[t][p.label] ? n > 0 : n === 0;
    if (!ok) failed += 1;
    return `${o.ok ? n : "denied"}${ok ? "" : "!"}`.padStart(11);
  });
  console.log(t.padEnd(width) + cells.join(""));
}
console.log("(! = not what the rules allow)");

// ── withdrawal and erasure ──────────────────────────────────────────────────
console.log("\nwithdrawal and erasure");
expect("the teammate cannot erase someone else", !sql(`select public.erase_player_health('${pidSelf}')`, teammate).ok);
expect("the coach cannot erase", !sql(`select public.erase_player_health('${pidSelf}')`, coach).ok);
expect("the player withdraws", one(sql(`select public.withdraw_health_consent('${pidSelf}')`, self)) === "withdrawn");
const after = sql(injury(pidSelf), medical);
expect("after withdrawal nothing new is written", !after.ok && after.error.includes("health_consent_required"));
const counts = one(sql(`select public.erase_player_health('${pidSelf}')`, manager));
console.log(`     erased: ${counts}`);
const left = tables.map(([t, where]) => `${t}=${one(sql(`select count(*) from public.${t} where ${where}${t === "health_consents" ? " and (withdrawn_at is null or date_of_birth is not null)" : ""}`))}`);
console.log(`     left (as the database owner, past RLS): ${left.join(" ")}`);
expect("0 health rows remain about the player in any table", left.every((l) => l.endsWith("=0")));
expect("the erasure is logged, without its content", one(sql(`select count(*) || '|' || bool_and(counts ? 'injuries') from public.health_erasures where player_id = '${pidSelf}'`)) === "1|true");
expect("the manager can see the erasure happened", one(sql(`select count(*) from public.health_erasures where player_id = '${pidSelf}'`, manager)) === "1");
expect("the player is still in the squad", one(sql(`select count(*) from public.players where id = '${pidSelf}'`)) === "1");

// ── first-week check ───────────────────────────────────────────────────────
console.log("\nfirst week");
const fixture = must(sql(`insert into public.fixtures (club_id, match_date, opponent, venue, competition) values ('${cid}', current_date + 3, 'Probe Rovers', 'H', 'League') returning id`), "fixture");
must(sql(`insert into public.match_calls (club_id, fixture_id, player_id, status, via) values ('${cid}', '${fixture}', '${pidMate}', 'in', 'push')`), "push call");
expect("first-week check reads from the database", one(sql(`select squad_in || '|' || staff_joined || '|' || push_answered from public.first_week_check('${cid}')`, manager)) === "false|true|true");
expect("an outsider gets no first-week row", one(sql(`select count(*) from public.first_week_check('${cid}')`, outsider)) === "0");

console.log(failed ? `\n${failed} FAILED` : "\nall held");
process.exit(failed ? 1 : 0);
