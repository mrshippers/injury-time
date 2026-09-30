# season-refresh lessons

Read before a pass (retrieve). Append after a verified outcome (record), failures first.

- 2026-09-30 FAIL: drift was counted as rows rewritten, not rows changed. Every
  morning for weeks it filed "10 result row(s) refreshed; 20 player(s) updated",
  identical each day, and scored STACK-COMPLETE because the route test mocked
  refreshSeason. Fix: the report carries resultsChanged / playersChanged /
  tableNew, read before the upsert. Rule: a diff is before vs after, never a count
  of what was written. (seen 1x, held 1x, last: 2026-09-30)
- 2026-09-30 FAIL: standings were stamped with the run date, so a snapshot read
  nightly re-filed the 2 Sep table as 4 Sep ... 29 Sep, and the hub read the
  newest stamp as the latest table. 550 fake-dated rows deleted in prod. Rule: data
  carries its own as_of; the run date is when we looked, not what it is.
  (seen 1x, held 1x, last: 2026-09-30)
- 2026-09-30: after 0010 Belstone refuses anon writes. The route and
  scripts/refresh-season.ts write with the service role; RLS no longer scopes this
  job, the club id read by slug does. (seen 1x, held 1x, last: 2026-09-30)
- 2026-09-30: "Kimber" on the scorer sheet is James or Jack. matchPlayer leaves an
  ambiguous surname unmatched; that is correct, never guess a real person's goals.
  (seen 1x, held 1x, last: 2026-09-30)
