# Stats, review, board, and where AI earns its place (17 Oct 2026)

## Built
- Nav: hub · squad · matchday · stats · review · board. Log and film come off the bar (routes still work; log is reached from matchday, film is a section of stats).
- Stats (/stats): competition filter (every game / league / each cup), venue filter, record strip, every result with ht score and scorers, by-competition table, goals by half + after half time, scorers; film analysis at the foot. Filters are URLs.
- Board (/club): committee strip (position, league record, cups alive, home crowds) + the season pack link, then the club's settings.
- Player page: full health breakdown on the player's own page (and for staff / public clubs), kit in the club's real colours, crest, captain plate.
- Matchday: drag-to-answer switch with icons (tick / ? / cross). Read-only clubs keep answers in the browser.

## Next on stats
- Goals in 15-minute bands once goal minutes are logged (the log gets one field: the minute).
- Head-to-head per opponent (league double, last meeting) from the results already held.
- Player stats table (apps, goals, minutes per goal) per competition.

## Where AI genuinely adds value (ranked)
1. Opponent brief before every match: their last five, home/away form, top scorers, how they lost; written in two short paragraphs from data we already hold (FWP results for the whole league). Zero new input from the gaffer.
2. Match report draft for the club's socials after the result lands: score, scorers, the moment, in the club's voice; the gaffer edits, never auto-posts.
3. Film analysis (exists): tagged clips -> Tuesday's session and Saturday's plan.
4. Ask the season a question in plain words ("how do we do away after going behind?") answered from the stats tables, with the numbers shown.
5. Availability nudge copy: the chaser message written per player in the gaffer's voice.
If (1) or (2) runs on a schedule unattended, it is an agent: build it to the agent-stack spec (harness, done-when, heartbeat, handover to email), not as a loose cron.
