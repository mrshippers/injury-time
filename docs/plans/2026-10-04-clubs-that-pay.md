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
