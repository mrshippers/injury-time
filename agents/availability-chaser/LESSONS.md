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
