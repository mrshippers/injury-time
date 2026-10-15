# Pass three: Belstone pilot follow-ups (15 Oct 2026)

## Built this pass
- Pilot page rewritten in Jamal's voice: no price lead (price lives in the small print), "management platform", no "already in it", close is "Fancy it? Let's talk." + email.
- The full stop after a club's name in headings is the club crest (`ClubStop`), mint square when no crest.
- Captain: picked in the squad room, saved with the side (`lineups.captain`, migration 0016), never club-wide. Last match's captain carries over while he's in the eleven.
- Answers deadline: `fixtures.calls_close_at` (0016). One-tap presets (two nights before 9pm, night before 9pm), countdown on the board, after it players can't change an answer (app and push route both refuse), staff can; the non-answerers listed by name.
- Matchday weather: Open-Meteo at the ground, kick-off to final whistle, only inside the 16-day forecast window. Grounds from `scripts/grounds/grounds.json` (sourced per row; a club with no confirmed ground shows nothing).
- First niche analytic: "after half time" on the review (points won from behind, dropped from ahead), from half-time scores the feed already has.
- Film re-rendered sharper (4K capture, lanczos to 1080p, CRF 18) with a slight FM-style panel gloss; opens on the season, price near the end.

## Veo
Confirmed 15 Oct: Veo has an API, invite-only for integration partners (api.veo.co -> "Veo API Is Invite Only"; contact the account rep with the intended use). No Zapier/webhooks/RSS. Manual MP4 download (follow-cam only, no analytics) and public share links exist; AI processing takes up to 8 h.
- Now: paste the public share link once per match (film page takes it); a Sunday-morning nudge "paste Saturday's Veo link" lines up with processing time.
- Next: apply as a Veo integration partner (Jamal to send; one paragraph: non-league squad app, pull each club's new recordings weekly with the club's consent). If accepted, a weekly cron pulls the match list and links per club.

## xG, honestly
No provider covers step 5-7. Realistic route: a 3-second shot logger on the match log (tap the pitch where the shot came from, foot/header/pen), scored with a published logistic model (Soccermatics distance+angle fit on Wyscout England data; penalties flat ~0.79). Trained on pro football, so show it as relative shot quality (ours vs theirs, game to game), never as a precise probability. Veo Analytics has shot maps but no xG and its data isn't exportable without the API. Not building computer vision ourselves.

## Analytics backlog, ranked
1. After half time (built) -> extend with goals in 15-minute bands once goal minutes are logged.
2. Availability reliability (private to the manager): reply rate, late drop-outs, median reply time, from calls the app already holds. Who to chase Thursday, not Saturday.
3. Training vs minutes: attendance beside starts and minutes, a fair basis for selection. Needs attendance logged weekly.
Skipped: on-pitch plus/minus (samples too small at this level).

## Waiting on Jamal
- The four screenshots from the unsent message (#1 swipe box target, #3/#4 the pitch reference and the Arsenal easter egg).
- Positions for the 21 Belstone players, or one saved side.
