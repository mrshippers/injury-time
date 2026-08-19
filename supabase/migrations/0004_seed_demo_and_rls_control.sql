-- Two clubs that earn their keep permanently.
--
-- Kilburn Athletic is the demo squad: is_demo = true, so it is the one club a
-- signed-out visitor can read. RLS Control FC is the negative fixture: a real
-- non-demo club with a real player, so any future RLS check has something that
-- MUST stay invisible to an anonymous caller. A test that only ever queries
-- data it is allowed to see proves nothing.
insert into public.clubs (name, league, is_demo)
values
  ('Kilburn Athletic', 'Spartan South Midlands Premier', true),
  ('RLS Control FC',   'Combined Counties Premier North', false)
on conflict do nothing;

insert into public.players (club_id, name, position, squad_number)
select c.id, 'Demo Striker', 'FW', 9
from public.clubs c
where c.name = 'Kilburn Athletic'
on conflict (club_id, squad_number) do nothing;

insert into public.players (club_id, name, position, squad_number)
select c.id, 'Control Keeper', 'GK', 1
from public.clubs c
where c.name = 'RLS Control FC'
on conflict (club_id, squad_number) do nothing;
