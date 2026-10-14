# Belstone pilot pass, 14 Oct 2026

The brief for the round that followed the first pilot page ("bit too light"), plus the plans
for the two things that are not built yet. Everything built is in the measured table; nothing
is "done" until its command printed the number.

## 1. Prime directive

> If a requirement in this brief conflicts with the thing being good, break the requirement
> and say which one you broke.

Broken, and said: the ask was "draw club logos from Google". Google image search has no
licence and no stable URL, so crests are fetched once from each club's own site (or its
Wikipedia infobox), stored as files in `public/crests/` and never hotlinked. Where a crest
could not be found cleanly the app shows a monogram, never an invented badge.

## 2. Hard constraints

- stack: what is already here (Next 16.3, React 19, Supabase, Vercel). No new dependency.
- banned: inventing facts about real people. No answers, availability, injuries, line-ups or
  minutes for a named Belstone player in any demo, film or screenshot. Positions are not on
  any public page (team sheets reorder every match; shirt numbers change), so none are guessed:
  the app says "not set" and the picker treats those players as flexible.
- banned: colour alone for status (the maker has deuteranopia). Win is a solid aqua dot, draw a
  solid white one, loss a hollow red ring, and each says the result in words on hover, focus or tap.
- banned: pill shapes. Switch thumbs and tags are square-cut.
- units: pounds sterling per club per month for price; counts for everything else.

## 3. Budget, measured

| metric | target | measured |
|---|---|---|
| unit tests | all green, none skipped | 254 passed |
| typecheck, lint | 0 errors | 0, 0 |
| league points counted from result sheets vs the league table | equal | 27 = 27 (live and frozen snapshot) |
| crests for the 22 league clubs and the cup opponents | all present, files on disk | 27 of 27, test checks every file |
| share image for the pilot link | <= 300 kB, 1200 x 630 | 123 kB, 1200 x 630 |
| pilot page at 390 px | no horizontal scroll | scrollWidth 390 |
| link as WhatsApp's bot sees it | 200, og:title, og:image, noindex | 200, all three present |
| notices on Belstone's board | 0 duplicates, no machine words | 16 deleted; new ones say the result in words |
| ghost fixtures in the diary | 0 | 2 removed or moved by the new reconcile |

## 4. Systems, each with its done-when

1. Cups on the hub. Done when the FA Vase 1 win (4-2 v Baldock Town, 10 Oct) shows as "last time
   out", the three cups show as runs of ties with the next tie dashed, and `home-cups.test.ts` passes.
2. Result dots. Done when every league dot has a result, the last game keeps its own mark under the
   end bead (a Woodley 1-4 loss showed as a white bead before), and the tip reads "Lost 1-4 at Woodley United".
3. Call switch. Done when in, unsure and out are told apart in greyscale (solid, half, struck), a
   player's usual answer shows as a dashed marker, and staff fill the rest as last time in one request.
4. Squad room. Done when "pick for me" is gone, the side fills from last match and the calls (who said
   out stays off), the list pages at 10, filters and an unsaved side survive a reload, and unplaced
   players are never flagged out of position or put in goal.
5. Review page. Done when every figure is counted from results, a figure the data cannot support says
   how many games it counted, and `review-extras.test.ts` passes on both snapshots.
6. Notices and the diary. Done when a rescheduled game moves in place (its calls follow), a dropped one
   goes unless a call or a side hangs off it, and a refresh that only moved the table files nothing.
7. Pilot page. Done when `/pilot/belstone` is public, says 40 pounds from the first screen, shows
   Belstone's own live season and cups, names the boys not the lads and the formation not the shape,
   and the link previews in WhatsApp.
8. The design gate: the call switch. One concept, taken from the fourth official's board that is the
   brand mark: a hairline track, two notches, a square thumb that slides and wears the status shape.

## 5. Verify and stop

- command: `npx vitest run` then `npx tsc --noEmit` then `npx eslint src tests`, then the e2e specs for
  team, lineup, squad and home against a running dev server.
- negative control: the league test that pinned the 26 Sep snapshot went red the moment the snapshot was
  refreshed; it now reads a frozen fixture, and a second test reads the live file for the cups. The
  scorer tally had a real bug (two spellings of one scorer overwrote each other): the case-blind test
  fails on the old code.
- stop: three failed passes on one system hands it back with the numbers.

---

## Plan: pre-match sheet for every player (not built)

Problem: a player opens the app on the bus and sees who is in, not what is asked of him.

Users: a player with a phone; the gaffer who edits it in five minutes on Thursday.

Success: Friday evening every player in the side has a sheet; the gaffer touched only what was
different from last match.

Design:
- Opposition card, from data we already hold: their table row (position, home and away record, goals
  for and against), our result against them this season, and their form once the club's own feed key
  is connected (the feed's fixtures call, one request per opponent).
- Role card, per player: the slot he is named in, the formation, set-piece jobs (corners, throw-ins,
  penalties) picked from a short list, and up to three one-line notes from the gaffer.
- No health data on the sheet, ever; consent and role rules as everywhere else.

Tasks:
1. Migration `0016_match_briefs.sql`: `match_briefs` (fixture_id, club_id, notes, published_at) and
   `player_briefs` (brief_id, player_id, set_pieces text[], notes text[]); RLS: staff write, the linked
   player reads his own row, guests on a writable demo club may both.
2. `src/lib/brief/opposition.ts`: pure summary from a standings row and results (tested on the frozen snapshot).
3. `src/lib/brief/draft.ts`: pre-fills each player's role from the saved side and carries last match's
   set-piece jobs forward, so the gaffer edits the difference.
4. `src/app/team/brief/page.tsx` (staff editor) and a "this week" card on `/player/[id]/hub`.
5. Push: "your sheet for Saturday is ready" through `src/lib/push/send.ts`, once per fixture.
6. Tests: opposition summary, draft carry-forward, an RLS probe (a player reads only his own row), e2e.

Not in scope: video clips per player (the film room covers that), anything about injuries.
