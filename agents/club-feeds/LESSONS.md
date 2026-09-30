# club-feeds lessons

Read before a pass (retrieve). Append after a verified outcome (record), failures first.

- 2026-09-30: shipped with no config and no test; its three endings are now pinned in
  tests/unit/club-feed.test.ts, and a mutation that skips a keyless club quietly
  turns it red. (seen 1x, held 1x, last: 2026-09-30)
- the FWP key is the club's, per club. Injury Time holds none. Never try one club's
  key against another club, never return a key in a response.
  (seen 1x, held 1x, last: 2026-09-30)
- refreshSeason dates the table by the data's as_of; for a live FWP read that is the
  read date, which is honest. The re-stamping bug was the snapshot path only.
  (seen 1x, held 1x, last: 2026-09-30)
