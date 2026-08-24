-- Match stats live on the load row, not in a separate stats table.
--
-- The manager already logs every match in /log, so goals, assists and cards
-- are captured on the same row as the minutes. Season totals are derived from
-- match sessions only; a training-night row must stay at zero. There is no
-- external feed for a Step 5 side (FA Full-Time has no API), so the log IS the
-- source of truth. A provider boundary in src/lib/stats leaves room for an
-- API-backed adapter for clubs at Steps 1-3.
alter table public.session_loads
  add column goals   int not null default 0 check (goals between 0 and 20),
  add column assists int not null default 0 check (assists between 0 and 20),
  add column yellow  int not null default 0 check (yellow between 0 and 2),
  add column red     int not null default 0 check (red between 0 and 1);

-- Upcoming matches. Sessions are the past; fixtures are the future. When a
-- fixture is played it is logged as a match session; the fixture row stays as
-- the schedule record.
create table public.fixtures (
  id          uuid primary key default gen_random_uuid(),
  club_id     uuid not null references public.clubs (id) on delete cascade,
  match_date  date not null,
  kickoff     text,
  opponent    text not null,
  venue       text not null check (venue in ('H', 'A')),
  competition text not null,
  created_at  timestamptz not null default now(),
  unique (id, club_id)
);

create index fixtures_club_date_idx on public.fixtures (club_id, match_date);

alter table public.fixtures enable row level security;

create policy fixtures_select on public.fixtures
  for select to anon, authenticated
  using (private.is_demo_club(club_id) or private.is_club_member(club_id));
create policy fixtures_insert on public.fixtures
  for insert to anon, authenticated
  with check (private.is_demo_club(club_id) or private.is_club_member(club_id));
create policy fixtures_update on public.fixtures
  for update to anon, authenticated
  using (private.is_demo_club(club_id) or private.is_club_member(club_id))
  with check (private.is_demo_club(club_id) or private.is_club_member(club_id));

grant select, insert, update on public.fixtures to anon, authenticated;
revoke delete on public.fixtures from anon, authenticated;
