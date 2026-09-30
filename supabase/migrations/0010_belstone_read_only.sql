-- 0010: the demo clubs split. Kilburn Athletic is fictional and anyone may try
-- the app on it; Belstone is a real club shown from its public data, so it is
-- READ-ONLY to everyone but the server. Reads are unchanged: both stay public.
--
-- Every write policy that allowed "or it is a demo club" now allows "or it is a
-- WRITABLE demo club". Generated from the live policy definitions, one ALTER
-- per policy, so nothing else in each policy moves.

alter table public.clubs add column if not exists demo_writable boolean not null default false;
update public.clubs set demo_writable = true where slug = 'kilburn-athletic';

create or replace function private.is_demo_writable(cid uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (select 1 from public.clubs c where c.id = cid and c.is_demo and c.demo_writable);
$$;
revoke all on function private.is_demo_writable(uuid) from public;
grant execute on function private.is_demo_writable(uuid) to anon, authenticated, service_role;

alter policy availability_events_insert on public.availability_events
  with check ((private.is_demo_writable(club_id) OR private.is_club_member(club_id)));
alter policy availability_events_update on public.availability_events
  using ((private.is_demo_writable(club_id) OR private.is_club_member(club_id)))
  with check ((private.is_demo_writable(club_id) OR private.is_club_member(club_id)));
alter policy clips_write on public.clips
  using ((private.has_role(club_id, '{manager,coach,medical}'::text[]) OR private.is_demo_writable(club_id)))
  with check ((private.has_role(club_id, '{manager,coach,medical}'::text[]) OR private.is_demo_writable(club_id)));
alter policy fixtures_insert on public.fixtures
  with check ((private.is_demo_writable(club_id) OR private.is_club_member(club_id)));
alter policy fixtures_update on public.fixtures
  using ((private.is_demo_writable(club_id) OR private.is_club_member(club_id)))
  with check ((private.is_demo_writable(club_id) OR private.is_club_member(club_id)));
alter policy injuries_insert on public.injuries
  with check ((private.is_demo_writable(club_id) OR private.is_club_member(club_id)));
alter policy injuries_update on public.injuries
  using ((private.is_demo_writable(club_id) OR private.is_club_member(club_id)))
  with check ((private.is_demo_writable(club_id) OR private.is_club_member(club_id)));
alter policy league_progress_write on public.league_progress
  using ((private.has_role(club_id, '{manager,coach}'::text[]) OR private.is_demo_writable(club_id)))
  with check ((private.has_role(club_id, '{manager,coach}'::text[]) OR private.is_demo_writable(club_id)));
alter policy league_standings_write on public.league_standings
  using ((private.has_role(club_id, '{manager,coach}'::text[]) OR private.is_demo_writable(club_id)))
  with check ((private.has_role(club_id, '{manager,coach}'::text[]) OR private.is_demo_writable(club_id)));
alter policy lineups_write on public.lineups
  using ((private.has_role(club_id, '{manager,coach}'::text[]) OR private.is_demo_writable(club_id)))
  with check ((private.has_role(club_id, '{manager,coach}'::text[]) OR private.is_demo_writable(club_id)));
alter policy match_calls_write on public.match_calls
  using ((private.has_role(club_id, '{manager,coach,medical}'::text[]) OR private.is_own_player(player_id) OR private.is_demo_writable(club_id)))
  with check ((private.has_role(club_id, '{manager,coach,medical}'::text[]) OR private.is_own_player(player_id) OR private.is_demo_writable(club_id)));
alter policy notifications_write on public.notifications
  using ((private.has_role(club_id, '{manager,coach,medical}'::text[]) OR private.is_demo_writable(club_id)))
  with check ((private.has_role(club_id, '{manager,coach,medical}'::text[]) OR private.is_demo_writable(club_id)));
alter policy players_insert on public.players
  with check ((private.is_demo_writable(club_id) OR private.is_club_member(club_id)));
alter policy players_update on public.players
  using ((private.is_demo_writable(club_id) OR private.is_club_member(club_id)))
  with check ((private.is_demo_writable(club_id) OR private.is_club_member(club_id)));
alter policy results_write on public.results
  using ((private.has_role(club_id, '{manager,coach}'::text[]) OR private.is_demo_writable(club_id)))
  with check ((private.has_role(club_id, '{manager,coach}'::text[]) OR private.is_demo_writable(club_id)));
alter policy rtp_steps_write on public.rtp_steps
  using ((private.has_role(club_id, '{manager,medical}'::text[]) OR private.is_demo_writable(club_id)))
  with check ((private.has_role(club_id, '{manager,medical}'::text[]) OR private.is_demo_writable(club_id)));
alter policy session_loads_insert on public.session_loads
  with check ((private.is_demo_writable(club_id) OR private.is_club_member(club_id)));
alter policy session_loads_update on public.session_loads
  using ((private.is_demo_writable(club_id) OR private.is_club_member(club_id)))
  with check ((private.is_demo_writable(club_id) OR private.is_club_member(club_id)));
alter policy sessions_insert on public.sessions
  with check ((private.is_demo_writable(club_id) OR private.is_club_member(club_id)));
alter policy sessions_update on public.sessions
  using ((private.is_demo_writable(club_id) OR private.is_club_member(club_id)))
  with check ((private.is_demo_writable(club_id) OR private.is_club_member(club_id)));
