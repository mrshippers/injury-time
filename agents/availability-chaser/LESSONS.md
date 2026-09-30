# availability-chaser lessons

Read before a pass (retrieve). Append after a verified outcome (record), failures first.

- 2026-09-30 FAIL: "never chase Belstone" was a name match (neq name 'Belstone',
  in a constant called CLUB_SLUG_EXCLUDED) and its test emptied the club list, so
  it passed whatever the filter did. A second real club would have been chased.
  Fix: filter on clubs.demo_writable, and the test feeds real rows through a mock
  that applies the filter. Rule: a test for "never X" must put X in the input.
  (seen 1x, held 1x, last: 2026-09-30)
- one chase per fixture, keyed to the fixture: a rerun reads the existing kind=call
  notice and files nothing. (seen 1x, held 1x, last: 2026-09-30)
- 2026-09-30: after 0010 the chaser ran only for demo clubs (anon + demo_writable), so it
  chased no real squad at all and a push from it would reach made-up players. Now service
  role, real clubs plus clubs open to try, Belstone-type public-data clubs excluded; push
  rides on the once-per-fixture notice. Rule: when a guard narrows who an agent can see,
  re-check who it is FOR. (seen 1x, held 1x, last: 2026-09-30)
