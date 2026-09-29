-- 0009: the club's own data, return-to-play steps, and player check-ins.
--
-- Three rules carried from 0001: no free text about a player's body (structured
-- facts only, not a medical record); every table pinned to its club; a demo club
-- stays readable by anyone, but real-club health data never is.

-- ── 1. the league feed belongs to the club ──────────────────────────────────
-- Football Web Pages issues API keys free to non-league clubs, one per club. The
-- club brings its own key; Injury Time holds none of its own. The key is a
-- secret: RLS is on with NO policies, so no browser can read or write it; only
-- the server (service role) touches this table.
create table public.club_feed_keys (
  club_id        uuid primary key references public.clubs (id) on delete cascade,
  provider       text not null default 'fwp' check (provider in ('fwp')),
  api_key        text not null check (length(api_key) between 8 and 200),
  last_sync_at   timestamptz,
  last_sync_note text,
  updated_at     timestamptz not null default now()
);
alter table public.club_feed_keys enable row level security;
revoke all on public.club_feed_keys from anon, authenticated;

-- where the season on screen came from, so the hub never calls a snapshot "live"
alter table public.clubs
  add column if not exists season_source    text not null default 'manual'
    check (season_source in ('feed', 'snapshot', 'manual')),
  add column if not exists season_synced_at timestamptz;

-- ── 2. return to play: the physio's staged plan, dated ──────────────────────
-- Stages are a fixed ladder, not free text. The manager sees the stage and the
-- date; nothing here describes the injury beyond what 0001 already records.
create table public.rtp_steps (
  id          uuid primary key default gen_random_uuid(),
  club_id     uuid not null references public.clubs (id) on delete cascade,
  injury_id   uuid not null,
  stage       text not null check (stage in (
                'rest', 'walking', 'jogging', 'running', 'sprinting',
                'ball_work', 'full_training', 'match_fit')),
  target_date date not null,
  done_on     date,
  created_at  timestamptz not null default now(),
  foreign key (injury_id, club_id) references public.injuries (id, club_id) on delete cascade,
  unique (injury_id, stage)
);
create index rtp_steps_injury_idx on public.rtp_steps (injury_id);
alter table public.rtp_steps enable row level security;

create policy rtp_steps_select on public.rtp_steps
  for select using (private.is_club_member(club_id) or private.is_demo_club(club_id));
create policy rtp_steps_write on public.rtp_steps
  for all using (private.has_role(club_id, '{manager,medical}') or private.is_demo_club(club_id))
  with check (private.has_role(club_id, '{manager,medical}') or private.is_demo_club(club_id));
grant select, insert, update, delete on public.rtp_steps to anon, authenticated;

-- ── 3. player check-ins: a private link, consent first ──────────────────────
-- A player reports soreness and how hard the last session felt from a link the
-- staff send them. It is health data about a named person, so: explicit consent
-- is recorded before the first check-in is accepted; the player can withdraw and
-- delete everything from the same link; no free text; demo clubs never take one.
-- The token is a credential, so it does not live on players (every member can
-- read players, and a teammate must not be able to check in as someone else).
-- RLS on, no policies: only the server hands a link to staff, after a role check.
create table public.player_checkin_links (
  player_id  uuid primary key references public.players (id) on delete cascade,
  token      uuid not null unique default gen_random_uuid(),
  consent_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.player_checkin_links enable row level security;
revoke all on public.player_checkin_links from anon, authenticated;

create table public.player_checkins (
  id          uuid primary key default gen_random_uuid(),
  club_id     uuid not null references public.clubs (id) on delete cascade,
  player_id   uuid not null,
  checkin_on  date not null default current_date,
  soreness    int  not null check (soreness between 0 and 10),
  last_rpe    int  check (last_rpe between 1 and 10),
  available   text not null check (available in ('yes', 'no', 'unsure')),
  created_at  timestamptz not null default now(),
  foreign key (player_id, club_id) references public.players (id, club_id) on delete cascade,
  unique (player_id, checkin_on)
);
alter table public.player_checkins enable row level security;

-- staff who can see squad health read check-ins; nobody writes them directly
create policy player_checkins_select on public.player_checkins
  for select using (
    private.has_role(club_id, '{manager,coach,medical}') or private.is_own_player(player_id)
  );
grant select on public.player_checkins to authenticated;

-- the link is the credential: a player needs no account
create or replace function public.checkin_status(token uuid)
returns table (first_name text, club_name text, consented boolean, today_done boolean)
language sql
security definer
stable
set search_path = ''
as $$
  select split_part(p.name, ' ', 1), c.name, l.consent_at is not null,
         exists (select 1 from public.player_checkins pc
                 where pc.player_id = p.id and pc.checkin_on = current_date)
  from public.player_checkin_links l
  join public.players p on p.id = l.player_id
  join public.clubs c on c.id = p.club_id
  where l.token = checkin_status.token and p.retired_on is null and not c.is_demo;
$$;

create or replace function public.submit_checkin(
  token uuid, consent boolean, soreness int, last_rpe int, available text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  pid uuid; cid uuid; consented timestamptz;
begin
  select p.id, p.club_id, l.consent_at into pid, cid, consented
  from public.player_checkin_links l
  join public.players p on p.id = l.player_id
  join public.clubs c on c.id = p.club_id
  where l.token = submit_checkin.token and p.retired_on is null and not c.is_demo;
  if pid is null then return 'unknown_link'; end if;
  if consented is null then
    if not coalesce(consent, false) then return 'consent_required'; end if;
    update public.player_checkin_links set consent_at = now() where player_id = pid;
  end if;
  insert into public.player_checkins (club_id, player_id, soreness, last_rpe, available)
  values (cid, pid, submit_checkin.soreness, submit_checkin.last_rpe, submit_checkin.available)
  on conflict (player_id, checkin_on)
  do update set soreness = excluded.soreness, last_rpe = excluded.last_rpe,
                available = excluded.available, created_at = now();
  return 'ok';
end;
$$;

-- withdraw: delete every check-in and the consent; the link keeps working if
-- the player later chooses to consent again
create or replace function public.withdraw_checkins(token uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  pid uuid;
begin
  select player_id into pid from public.player_checkin_links where player_checkin_links.token = withdraw_checkins.token;
  if pid is null then return 'unknown_link'; end if;
  delete from public.player_checkins where player_id = pid;
  update public.player_checkin_links set consent_at = null where player_id = pid;
  return 'withdrawn';
end;
$$;

revoke all on function public.checkin_status(uuid) from public;
revoke all on function public.submit_checkin(uuid, boolean, int, int, text) from public;
revoke all on function public.withdraw_checkins(uuid) from public;
grant execute on function public.checkin_status(uuid) to anon, authenticated;
grant execute on function public.submit_checkin(uuid, boolean, int, int, text) to anon, authenticated;
grant execute on function public.withdraw_checkins(uuid) to anon, authenticated;

-- the demo clubs: Belstone is a real club's public data, Kilburn is invented
update public.clubs set season_source = 'snapshot', season_synced_at = '2026-09-02'
  where slug = 'belstone';
update public.clubs set season_source = 'manual' where slug = 'kilburn-athletic';
