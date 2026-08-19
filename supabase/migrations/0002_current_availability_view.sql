-- Current availability = the latest availability_event per player.
--
-- security_invoker means the view is read with the caller's own privileges, so
-- the RLS on availability_events applies. Without it the view would run as its
-- owner (postgres) and quietly hand every club's squad to every caller.
create view public.current_availability
with (security_invoker = true) as
select distinct on (ae.player_id)
  ae.player_id,
  ae.club_id,
  ae.status,
  ae.return_date,
  ae.injury_id,
  ae.noted_on
from public.availability_events ae
order by ae.player_id, ae.created_at desc, ae.id desc;

comment on view public.current_availability is
  'Latest availability event per player. Read-only projection of the availability_events log.';
