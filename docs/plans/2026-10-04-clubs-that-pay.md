# From demo to clubs that pay, 4 Oct 2026

Implementation brief for roadmap sections 03 (worth adding next) and 04 (a real
product). This is a contract, not a plan. Nothing below gets built until this brief
is agreed. Nothing is "done" until its verify command has run and the measured
column is filled in.

What the repo already has, so nothing gets rebuilt: magic-link auth (`login/actions.ts`),
roles and RLS (`0008`), player claim links (`0012`, `lib/hub/claim.ts`), web push with
a service worker that opens a URL (`0013`, `lib/push/send.ts`, `public/sw.js`), a
per-club Football Web Pages key proven by a real sync (`0009`, `lib/club/actions.ts`),
a season review (`lib/review/season.ts`), and an FWP appearances mapper that returns
**name + apps only, no shirt numbers** (`lib/league/fwp.ts` `mapAppearances`, marked
unverified until a real key runs).

What it does not have: any way for a club to create itself. Every real club today
was seeded by hand.

---

## 1. Prime directive

> If a requirement in this brief conflicts with the thing being good, break the
> requirement and say which one you broke.

One ordering rule sits under it and is not open to deviation: **no real club's
health data goes live before system 5 (consent and deletion) passes.** Sign-up
(system 1) creates real clubs, so system 5 ships in the same release as system 1
or before it. Never after.

## 2. Hard constraints

- **stack:** what is already here. Next 16.3 (read `node_modules/next/dist/docs/`
  before touching routing, caching or server actions), React 19, Supabase
  (Postgres + RLS + auth), Vercel, `web-push`, vitest, Playwright + axe.
- **one codebase:** the PWA is the product. The App Store build, when it comes, is
  a thin wrapper around the same URL. No second UI, no React Native, no fork.
- **banned:**
  - scraping the league site's HTML. Squad data comes from the club's own FWP key
    or from text the manager pastes. Nothing else.
  - Injury Time holding an FWP key of its own for a real club.
  - free-text medical notes outside the role-gated notes in system 5 (0001's rule
    stands everywhere else).
  - a new paid dependency, an image SaaS, or a headless browser at request time
    for the season card.
  - per-player pricing, a second plan, free trials with card capture, or any
    Stripe code before the pricing gate in system 8 opens.
  - writing to Belstone or any real club from a test. Tests run on Kilburn
    Athletic (fictional) or a club the test creates and deletes.
  - under-18 players on a real club. The schema refuses them until parental
    consent and safeguarding are specified in a brief of their own.
- **units:** seconds and milliseconds for time, kilobytes for files, pixels for
  images (1080 x 1350 is the card), pounds sterling per club per month for price,
  counts for everything else. A bare number with no unit in a budget is a bug.

## 3. Budget

Written before code. The measured column is filled at the end, from the verify
commands, not from memory.

| metric | target | measured |
|---|---|---|
| sign-up, link to club with squad, Playwright at 390 x 844 | <= 60 s wall clock, <= 6 screens | |
| sign-up, required fields before the club exists | <= 3 (club name, league, your role) | |
| squad paste, 20 lines to 20 players | <= 2 s server time | |
| lock-screen answer, action tap to `match_calls` row | p95 <= 3000 ms over 50 runs | |
| lock-screen answer, rows written per tap | exactly 1 (upsert, never a duplicate) | |
| lock-screen answer, answers accepted with an expired or forged token | 0 | |
| season card PNG | 1080 x 1350 px, <= 300 kB, render <= 1500 ms p95 | |
| season card, text overflow across the fit grid | 0 cells | |
| squad from feed, re-run on an imported squad | 0 new rows, 0 duplicates | |
| squad from feed, appearance-list players created | >= 95% of the list, 100% with a reason for each skip | |
| health data readable by a role that should not see it (RLS probe) | 0 rows | |
| health data left after a deletion request | 0 rows across every table that names the player | |
| axe violations on new screens (sign-up, invite, consent, card) | 0 serious or critical | |
| existing suite | `npm run verify` green, no test skipped | |

## 4. Systems

Ordered by dependency, not by appeal. Each one is done only when its line is true
and its command printed the number.

1. **Sign-up in a minute.** `/start`: club name, league (from the FWP league list
   when reachable, free text otherwise), your role. Creates `clubs` + your
   `club_members` row in one transaction, then offers three optional steps in any
   order: invite staff, add squad, connect key. Squad by paste (one player per
   line, `name[, position][, number]`, tolerant of tabs and "7. Name") or by
   system 4. Real clubs created here have `is_demo = false` and adults only.
   Done when: the e2e test signs up a new club at 390 wide, pastes a 20-line
   squad, lands on the hub with 20 players, inside 60 s and 6 screens; and a
   unit test proves the paste parser on 30 messy real-world lines with zero
   wrong positions or numbers.

2. **Staff invite links.** One link per role (coach, medical), single-use,
   expiring in 7 days, built on the claim-token pattern in `0012`. Accepting one
   makes the clicker a member in exactly that role and nothing more.
   Done when: unit tests show a used, expired, or wrong-club token is refused,
   and an RLS probe shows an invited coach cannot read medical notes.

3. **Answer from the lock screen.** The match-call push carries `actions: in /
   out / unsure` and a signed answer token (HMAC over player_id, fixture_id,
   expiry 48 h; secret server-side). `sw.js` `notificationclick` with an
   `event.action` POSTs to `/api/call` with the token; no session cookie needed,
   no window opened. No action (body tap), or a platform without actions
   (iPhone Safari), opens `/team` as today. Writes go through the same upsert
   as the in-app call so realtime boards update.
   Done when: a unit test drives `/api/call` directly 50 times (valid, expired,
   tampered, replayed, other club's fixture) and prints accept/refuse counts that
   match the table; and a Playwright test dispatches a synthetic
   `notificationclick` with `action: "in"` in Chromium and sees the call board
   flip within 3 s.

4. **Squad from the feed.** When a club connects its key (or on demand from the
   squad room), read the appearances list and create missing players. Match on
   normalised name (case, accents, "Jnr", initials); never create a second row
   for a matched player; never overwrite a number or position the manager set.
   FWP gives no shirt numbers today: import leaves numbers empty and says so,
   rather than inventing them. The roadmap line "numbers and all" is broken
   here on purpose and stays broken until a feed field proves otherwise.
   Done when: a unit test runs the importer on a recorded FWP fixture twice and
   prints `created N, matched M, skipped K (reasons)` with the second run
   `created 0`; and the name-match grid (below) has no false merge.

5. **Health data, lawful before live.** Pre-condition for any real club, gate for
   system 9.
   - explicit consent per player, recorded (who, when, wording version) before
     any injury, availability reason, check-in or RTP row can be written for a
     real-club player. Refused at the database, not only in the UI.
   - medical notes: a structured-plus-short-text note visible to `medical` and
     the player themself only; manager sees status and return date, never the
     note.
   - deletion on request: one action removes the player's health rows from
     every table that carries them, and logs that it happened (not what was in
     it).
   - DPIA drafted in `docs/legal/dpia.md` and a solicitor's sign-off recorded
     before system 9. Both are human tasks; the build ships the controls, not the
     legal opinion.
   - adults only: `players.date_of_birth` required on real clubs, under 18
     refused.
   Done when: an RLS probe script signs in as each role on a test club and prints
   rows readable per table (manager reading notes = 0); an insert of an injury
   for a player with no consent fails with the constraint name; and a deletion
   run prints 0 remaining rows per table for that player.

6. **Season card.** `/player/[id]/card.png` via `next/og` `ImageResponse`: name,
   club, season, apps, goals, minutes, availability rate, club colours, the mark.
   No health data on the card, ever (injury counts included). The player shares
   it from the hub with the Web Share API (files), falls back to download.
   Only the player or staff can generate it; demo clubs are open.
   Done when: a unit test renders the card for the fit grid (below) and asserts
   PNG dimensions, size <= 300 kB and no clipped text box; and the e2e test
   fetches it for a Kilburn player in under 1500 ms.

7. **Pilot install.** Belstone plus two or three Step 5 to 7 sides via league
   secretaries, installed from the site (manifest + push already exist). The
   build's part: a `/start` link a secretary can forward, and a per-club
   "first week" check on the hub (squad in, one staff invite used, one call
   answered from a push). Not code-gated beyond that.
   Done when: each pilot club's first-week check reads 3 of 3, from the
   database, not from a conversation.

8. **Pricing.** Per club, one monthly plan through Stripe Checkout + the
   customer portal. Gate: no Stripe code merged until three clubs have used it
   for 30 days each (query: clubs with a `match_calls` row in each of 4
   consecutive weeks >= 3). Price set then, from what those three say, not now.
   Done when: the gate query returns >= 3, and a Stripe test-mode webhook run
   flips a club to `paid` and back on cancel.

9. **The design gate: a stranger's club runs on its own.** A club we have never
   spoken to opens `/start` from a secretary's forward, signs up, has its
   players consent, and a player answers a Saturday call from the lock screen,
   with no message from us at any point. Everything above can pass and this
   still fail: that is the difference between a demo and a product.
   Done when: one real club reaches a first-week check of 3 of 3 with zero
   support contacts logged, and system 5's legal sign-off is recorded.

Out of scope here, named so nobody builds it by accident: the App Store wrapper
(after system 9, a thin shell over the same URL; it also fixes iPhone's missing
notification actions), under-18 sides, a second pricing tier.

## 5. Verify

- **command, per change:** `npm run lint && npx tsc --noEmit && npm run verify`
- **per system:**
  - 1, 2: `npx vitest run tests/unit/signup-paste.test.ts tests/unit/invite.test.ts` and `npx playwright test tests/e2e/signup.spec.ts`
  - 3: `npx vitest run tests/unit/call-token.test.ts` and `npx playwright test tests/e2e/lockscreen.spec.ts`
  - 4: `npx vitest run tests/unit/squad-import.test.ts` and `npm run grid -- squad-match`
  - 5: `npx tsx scripts/rls-probe.ts` against a local Supabase with migrations applied (prints a role x table readable-rows matrix) and `npx vitest run tests/unit/consent.test.ts`
  - 6: `npx vitest run tests/unit/season-card.test.ts` and `npm run grid -- card-fit`
  - 7, 8, 9: the SQL in each done-when, run against production read-only, output pasted into the PR.
- Logic is driven directly (parsers, token signer, importer, renderer, RLS as
  SQL), not through the UI. The e2e tests prove the wiring, not the logic.
- "Done" without that output attached to the PR is refused.

### Grids to print (the design answer, not QA)

`scripts/grid.ts` already exists; add two modes.

- `card-fit`: player name length 4 to 32 characters x stat value width 1 to 4
  digits. Each cell prints `.` (fits at full size), `s` (fits after the
  step-down font), `X` (clips). Ship only with zero `X`.
- `squad-match`: name variant kind (case, accent, initial, Jnr/Snr, swapped
  order, typo distance 1, typo distance 2) x match threshold 0.70 to 0.95 in
  0.05 steps. Each cell prints `ok` (matched the right player), `--` (no match,
  creates a new row), `!!` (merged two different people). Pick the threshold
  from a column with no `!!`; a false merge is worse than a duplicate the
  manager can delete.

## 6. Stop rule

Three failed passes on one system: stop, hand it back with the failing numbers
(the budget row, the grid, the test output). No fourth attempt. System 5 has a
harder stop: any probe showing a role reading health data it should not is a
stop on the first occurrence, not the third.

## Order of work

1. System 5 controls (consent, notes, deletion, adults only) and the RLS probe.
2. System 1 sign-up + paste, system 2 invites. Ship 1, 2 and 5 together.
3. System 3 lock-screen answers.
4. System 4 squad from the feed.
5. System 6 season card.
6. System 7 pilot. DPIA and solicitor in parallel, by a person, from step 1.
7. System 8 when its gate opens. System 9 when a stranger proves it.

---

## Build record, 4 Oct 2026

Built on `claude/implementation-brief-roadmap-8i938o`. Every number below came
out of a command, named beside it. Where a number could not be measured here,
the row says so instead of filling it in.

### Where the numbers came from

There is no Docker or Supabase project in the build container, so the build
brought its own: `scripts/db/local.sh` (Postgres 16 with every migration, for
the RLS probe) and `scripts/stack/up.sh` (Postgres, Supabase Auth and PostgREST
release binaries behind one project URL, plus an SMTP catcher), so the e2e suite
runs the **real magic-link sign-in** end to end. `npm run verify:local` runs
the lot.

### Budget, measured

| metric | target | measured | command |
|---|---|---|---|
| sign-up, link to club with squad, at 390 x 844 | <= 60 s, <= 6 screens | **5.3 to 5.6 s over four runs, 5 screens** (a script typing; a person is slower, the screen count is the fixed part) | `tests/e2e/signup.spec.ts` |
| sign-up, required fields before the club exists | <= 3 | **3 fields + 1 tick** (adults only: see deviation 6) | the form |
| squad paste, 20 lines to 20 players | <= 2 s server time | **not isolated.** The dev server here logged no request timings; the paste sits inside the 5.6 s end-to-end run above. The action returns its own `ms` for a real measurement | signup.spec |
| lock-screen answer, tap to row | p95 <= 3000 ms | **handler p95 0.09 ms in process; press to answer shown 38 ms in the worker.** A real phone and network not measured | `tests/unit/call-token.test.ts`, `tests/sw/lockscreen.spec.ts` |
| lock-screen answer, rows per tap | exactly 1 | **2 rows from 20 accepted taps by 2 players** (upsert) | call-token.test |
| lock-screen answer, expired or forged accepted | 0 | **0 of 30 refused cases** (expired 5, tampered 5, other club 5, played match 5, retired 1, read-only club 4, bad status 5) | call-token.test |
| season card PNG | 1080 x 1350, <= 300 kB, <= 1500 ms p95 | **1080 x 1350, 76.2 kB, p95 84 ms** | `tests/unit/season-card.test.ts` |
| season card, overflow across the fit grid | 0 cells | **0 of 32** | `npm run grid:card-fit` |
| squad from feed, re-run | 0 new, 0 duplicates | **created 0, matched 19, held 1** | `tests/unit/squad-import.test.ts` |
| squad from feed, list players created | >= 95%, every skip with a reason | **19 of 20 named players in automatically (95%), 1 held for the manager with the names it looks like, 1 blank row skipped with its reason.** Fixture is the documented FWP shape, not a recording (no key yet) | squad-import.test |
| health data readable by the wrong role | 0 rows | **0** (matrix below) | `npm run db:probe` |
| health data left after erasure | 0 rows | **0 in all 7 tables** | db:probe |
| axe, new screens | 0 serious or critical | **0** on sign-up (3 screens) and the consent page. The join page and the card image are not axe-tested | signup.spec, consent.spec |
| existing suite | green, nothing skipped | **not green: 39 passed, 4 failed, 0 skipped** on the local stack. 3 are stack gaps that fail the same way on `main` (realtime x2, the Belstone feed chart). 1 is mine: consent.spec step 6, handed back below. Unit: 198 passed | `scripts/stack/e2e.sh`, `vitest run` |

The probe's matrix (rows about one player readable, by who is asking):

```
                           anon   outsider   teammate the player      coach    manager    medical
injuries                      0          0          0          1          1          1          1
availability_events           0          0          0          2          2          2          2
session_loads                 0          0          0          1          1          1          1
rtp_steps                     0          0          0          1          1          1          1
medical_notes            denied          0          0          1          0          0          1
player_checkins          denied          0          0          1          1          1          1
health_consents          denied          0          0          1          1          1          1
```

Against migrations 0001 to 0013 the same probe showed a `player` writing a
"severe knee" injury against a teammate and reading the squad's injuries: every
club member could, through the API, with only the screens hiding it. 0014 closes it.

### The grids

`npm run grid:squad-match`. The first sweep used a similarity threshold to
match, and **merged 11 different people at every threshold** (Tim Smith into Tom
Smith scores like a one-letter typo). There is no threshold that works. Matching now
rests only on equivalences; near misses are held for the manager:

```
variant                0.70     0.75     0.80     0.85     0.90     0.95
case                     ok       ok       ok       ok       ok       ok
accent                   ok       ok       ok       ok       ok       ok
initial              22/3/0   22/3/0   22/3/0   22/3/0   22/2/1   22/2/1
jnr/snr                  ok       ok       ok       ok       ok       ok
swapped order            ok       ok       ok       ok       ok       ok
typo distance 1          ??       ??       ??       ??       ??   0/24/1
typo distance 2      2/23/0   2/23/0   2/23/0   2/23/0   2/23/0   2/6/17
stranger                 ??       ??       ??   0/11/1   0/11/1    0/8/4
false merges at the shipping threshold (0.85): 0
```

`npm run grid:card-fit`: name length 4 to 32 x stat width 1 to 4 digits, 0 cells clip.

### Requirements broken, and why (the prime directive)

1. **"Squad from the feed, numbers and all" (system 4).** The appearance list has
   no shirt numbers. The import leaves them empty and says so.
2. **"In, out and unsure as buttons" (system 3).** Chrome allows two notification
   buttons (`Notification.maxActions` is 2; found by the browser test, not by
   reading). Chrome shows in and out; "unsure" is a tap on the body, which opens the
   team page. iPhone shows none, as the roadmap said.
3. **"Pick the threshold from a column with no !!" (system 4).** No column was
   free of `!!` while similarity could match. Similarity now only decides what is
   held for review.
4. **`players.date_of_birth` (system 5).** Every teammate can read `players`, so
   the date of birth lives on `health_consents` (staff and the player only).
5. **"Availability rate" on the season card (system 6).** It is derived from
   injury status, so it is health data. Assists and minutes replace it.
6. **Adults only is enforced at consent, not at every player row.** Sign-up asks
   for one tick ("an adult side"); each player's date of birth is checked when they
   consent. A date of birth for every pasted name would break the minute and put
   the date where teammates read it.
7. **Load data is read-gated but not write-gated** (`session_loads` rows carry
   minutes and goals too). It is the first open question in `docs/legal/dpia.md`.
8. **Wider than asked:** writes to injuries, availability and loads are now staff
   roles only, and adding players is manager or coach only. A player could write
   them before.
9. **Verify commands as built:** `npm run grid:squad-match` / `grid:card-fit`
   (not `grid -- <mode>`), `npm run db:probe`, `npm run test:sw`,
   `scripts/stack/e2e.sh`.

### Not done, and whose it is

- **System 5, legal:** `docs/legal/dpia.md` is a draft with seven open questions.
  A solicitor's sign-off is a person's job and is not recorded.
- **System 7, pilot:** the first-week check is built (`first_week_check`, on the
  hub for staff until 3 of 3). Finding the clubs is a person's job.
- **System 8, pricing:** no Stripe code, by design. `scripts/pricing-gate.sql` reads
  0 clubs past four weeks: the gate is closed.
- **System 9, the design gate:** not passed. It needs a club nobody has spoken to.
- **Production:** migrations 0014 and 0015 are not applied anywhere but the local
  stack. `CALL_TOKEN_SECRET` (32+ characters) must be set in Vercel for the
  notification buttons; without it, pushes still go, without buttons.
- **Stack gaps:** the local stack has no realtime server and no Belstone season,
  so `team.spec` (two realtime tests) and `home.spec` (the feed chart) fail there
  on `main` too. They need the live project.

### Handed back under the stop rule

**System 5, the refusal the manager sees after an erasure.** `tests/e2e/consent.spec.ts`
step 6 failed on three passes in the full suite (it passed alone once, early):

- what holds: the database refuses the doubt. The squad table shows `0 doubts`
  and Sam still `FIT` at the moment of failure, and `npm run db:probe` proves the
  write is refused after withdrawal and after erasure.
- what fails: the status panel closes as the write goes out and should come back
  with "Sam has not given consent for health data yet". At step 6 it never comes
  back (no dialog, no alert within 20 s). Step 1 (the same refusal, first action
  on a cold server) shows it.
- found on the way and fixed (`status-menu.tsx`): a refusal that lands inside the
  panel's 200 ms close was re-mounting a panel that was still mounted, so nothing
  showed it, and the pending unmount took the error away. That is a real race.
  The fix did not make step 6 pass, so it is either not the cause or not the only one.
- not yet known: whether step 6's save reaches the server at all. The local dev
  server logged no request lines, so the evidence that would settle it is missing.
  The next step is to log the action's result in the browser (`page.on("console")`)
  or watch `/squad`'s POST in the Playwright trace, and only then change code.
