-- The pricing gate (docs/plans/2026-10-04-clubs-that-pay.md, system 8).
-- No Stripe code is merged until this returns gate_open = true: three real
-- clubs that each used Injury Time in four consecutive weeks (a match call or
-- a logged session in every one of those weeks). Read-only; run against
-- production with the read-only role and paste the output into the PR.
--
--   psql "$DATABASE_URL" -f scripts/pricing-gate.sql
with activity as (
  select club_id, date_trunc('week', updated_at)::date as wk from public.match_calls
  union
  select club_id, date_trunc('week', session_date)::date from public.sessions
),
real_activity as (
  select a.club_id, a.wk from activity a join public.clubs c on c.id = a.club_id where not c.is_demo
),
runs as (
  -- gaps and islands: consecutive weeks share (week - row_number weeks)
  select club_id, wk, wk - (row_number() over (partition by club_id order by wk) * 7)::int as island
  from (select distinct club_id, wk from real_activity) d
),
streaks as (
  select club_id, count(*) as weeks, min(wk) as from_wk, max(wk) as to_wk from runs group by club_id, island
),
best as (
  select distinct on (s.club_id) c.name, s.weeks, s.from_wk, s.to_wk
  from streaks s join public.clubs c on c.id = s.club_id
  order by s.club_id, s.weeks desc
)
select name, weeks as longest_run_of_weeks, from_wk, to_wk, weeks >= 4 as counts
from best
order by weeks desc;

select count(*) filter (where weeks >= 4) as clubs_past_four_weeks, count(*) filter (where weeks >= 4) >= 3 as gate_open
from (
  select club_id, max(weeks) as weeks from (
    select club_id, count(*) as weeks from (
      select club_id, wk, wk - (row_number() over (partition by club_id order by wk) * 7)::int as island
      from (select distinct a.club_id, a.wk from (
        select club_id, date_trunc('week', updated_at)::date as wk from public.match_calls
        union select club_id, date_trunc('week', session_date)::date from public.sessions
      ) a join public.clubs c on c.id = a.club_id where not c.is_demo) d
    ) r group by club_id, island
  ) s group by club_id
) t;
