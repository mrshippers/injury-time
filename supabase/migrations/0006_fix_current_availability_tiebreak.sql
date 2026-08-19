-- current_availability ordered by created_at alone ties inside a single
-- transaction (seed) and on same-day status flips; noted_on leads, then
-- created_at, then id, so "latest" is deterministic.
create or replace view public.current_availability
with (security_invoker = true) as
select distinct on (player_id)
  player_id, club_id, status, return_date, injury_id, noted_on
from public.availability_events
order by player_id, noted_on desc, created_at desc, id desc;
