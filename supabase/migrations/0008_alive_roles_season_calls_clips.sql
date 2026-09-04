-- 0008: the club as a whole club.
--
-- Roles become the four people who actually touch the app (manager, coach,
-- medical, player); the club carries its own config; the season comes in from
-- the league feed (results, standings, points progress); players can call
-- themselves in or out of the next match in real time; staff can post to the
-- squad; film clips get a home; a lineup can be saved per fixture; and a
-- player's body measurements (cm) drive the figure.

-- ── roles ────────────────────────────────────────────────────────────────
alter table public.club_members drop constraint if exists club_members_role_check;
update public.club_members set role = 'medical' where role = 'physio';
alter table public.club_members
  add constraint club_members_role_check
  check (role in ('manager', 'coach', 'medical', 'player'));

-- ── club config ──────────────────────────────────────────────────────────
alter table public.clubs
  add column if not exists slug        text unique,
  add column if not exists ground      text,
  add column if not exists division    text,
  add column if not exists season      text,
  add column if not exists founded     int,
  add column if not exists fwp_team_id int,
  add column if not exists colours     jsonb not null default '{}'::jsonb,
  -- health_language: 'plain' (a word and a sentence) or 'detailed' (the numbers too)
  add column if not exists settings    jsonb not null default '{"health_language":"plain"}'::jsonb;

-- ── players: who they are to the app, and what shape they are ────────────
alter table public.players
  add column if not exists user_id        uuid references auth.users (id) on delete set null,
  -- measurements in cm: height, chest, neck, shoulders, waist, hips, arm_length,
  -- upper_arm, wrist, thigh, lower_leg, calf. Null = the default athlete.
  add column if not exists body_params    jsonb,
  -- season numbers from the league feed, e.g. {"apps": 9, "goals": 3, "as_of": "2026-09-02", "source": "fwp"}
  add column if not exists external_stats jsonb,
  add column if not exists retired_on     date;

-- ── results: played matches from the league feed ────────────────────────
create table public.results (
  id            uuid primary key default gen_random_uuid(),
  club_id       uuid not null references public.clubs (id) on delete cascade,
  match_date    date not null,
  competition   text not null,
  opponent      text not null,
  venue         text not null check (venue in ('H', 'A')),
  goals_for     int  not null check (goals_for >= 0),
  goals_against int  not null check (goals_against >= 0),
  ht_for        int,
  ht_against    int,
  attendance    int,
  scorers       text[] not null default '{}',
  source        text not null default 'manual',
  created_at    timestamptz not null default now(),
  unique (club_id, match_date, opponent)
);
create index results_club_date_idx on public.results (club_id, match_date);

-- ── league standings: a snapshot of the whole division on a date ─────────
create table public.league_standings (
  id        uuid primary key default gen_random_uuid(),
  club_id   uuid not null references public.clubs (id) on delete cascade,
  as_of     date not null,
  position  int  not null,
  team      text not null,
  played    int  not null,
  won       int  not null,
  drawn     int  not null,
  lost      int  not null,
  gf        int  not null,
  ga        int  not null,
  gd        int  not null,
  points    int  not null,
  home      jsonb not null default '{}'::jsonb,
  away      jsonb not null default '{}'::jsonb,
  is_us     boolean not null default false,
  unique (club_id, as_of, team)
);
create index league_standings_club_asof_idx on public.league_standings (club_id, as_of desc);

-- ── league progress: our points after each league match ──────────────────
create table public.league_progress (
  id         uuid primary key default gen_random_uuid(),
  club_id    uuid not null references public.clubs (id) on delete cascade,
  match_no   int  not null,
  match_date date not null,
  points     int  not null,
  position   int,
  unique (club_id, match_no)
);

-- ── match calls: a player says in / out / unsure for a fixture ───────────
create table public.match_calls (
  id         uuid primary key default gen_random_uuid(),
  club_id    uuid not null references public.clubs (id) on delete cascade,
  fixture_id uuid not null references public.fixtures (id) on delete cascade,
  player_id  uuid not null references public.players (id) on delete cascade,
  status     text not null check (status in ('in', 'out', 'unsure')),
  note       text,
  updated_at timestamptz not null default now(),
  unique (fixture_id, player_id)
);
create index match_calls_fixture_idx on public.match_calls (fixture_id);

-- ── notifications: staff to squad, in real time ─────────────────────────
create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  club_id    uuid not null references public.clubs (id) on delete cascade,
  kind       text not null check (kind in ('call', 'training', 'match', 'notice', 'medical')),
  title      text not null,
  body       text,
  fixture_id uuid references public.fixtures (id) on delete set null,
  audience   text[] not null default '{manager,coach,medical,player}',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index notifications_club_created_idx on public.notifications (club_id, created_at desc);

-- ── clips: film in, analysis out ─────────────────────────────────────────
create table public.clips (
  id         uuid primary key default gen_random_uuid(),
  club_id    uuid not null references public.clubs (id) on delete cascade,
  source     text not null check (source in ('veo', 'youtube', 'upload', 'other')),
  url        text not null,
  title      text not null,
  match_date date,
  fixture_id uuid references public.fixtures (id) on delete set null,
  opponent   text,
  -- tagged events: [{"t": 312, "kind": "goal", "player_id": "...", "note": "..."}]
  events     jsonb not null default '[]'::jsonb,
  -- what the analysis produced: summary, gameday, training, per-player notes
  analysis   jsonb,
  status     text not null default 'new' check (status in ('new', 'tagged', 'analysed')),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index clips_club_created_idx on public.clips (club_id, created_at desc);

-- ── lineups: one saved side per fixture ─────────────────────────────────
create table public.lineups (
  id         uuid primary key default gen_random_uuid(),
  club_id    uuid not null references public.clubs (id) on delete cascade,
  fixture_id uuid not null references public.fixtures (id) on delete cascade,
  formation  text not null,
  -- eleven player ids in slot order, null for an empty slot
  xi         jsonb not null,
  bench      jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  unique (club_id, fixture_id)
);

-- ── role helpers ─────────────────────────────────────────────────────────
create or replace function private.club_role(cid uuid)
returns text
language sql
security definer
stable
set search_path = ''
as $$
  select cm.role
  from public.club_members cm
  where cm.club_id = cid
    and cm.user_id = (select auth.uid())
  limit 1;
$$;

create or replace function private.has_role(cid uuid, roles text[])
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select coalesce(private.club_role(cid) = any (roles), false);
$$;

-- the player row that belongs to the signed-in user, if any
create or replace function private.is_own_player(pid uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.players p
    where p.id = pid and p.user_id = (select auth.uid())
  );
$$;

revoke all on function private.club_role(uuid) from public;
revoke all on function private.has_role(uuid, text[]) from public;
revoke all on function private.is_own_player(uuid) from public;
grant execute on function private.club_role(uuid) to anon, authenticated, service_role;
grant execute on function private.has_role(uuid, text[]) to anon, authenticated, service_role;
grant execute on function private.is_own_player(uuid) to anon, authenticated, service_role;

-- ── row level security ──────────────────────────────────────────────────
alter table public.results          enable row level security;
alter table public.league_standings enable row level security;
alter table public.league_progress  enable row level security;
alter table public.match_calls      enable row level security;
alter table public.notifications    enable row level security;
alter table public.clips            enable row level security;
alter table public.lineups          enable row level security;

-- everyone on the club (and anyone, on a demo club) can read the season
create policy results_select on public.results
  for select using (private.is_club_member(club_id) or private.is_demo_club(club_id));
create policy league_standings_select on public.league_standings
  for select using (private.is_club_member(club_id) or private.is_demo_club(club_id));
create policy league_progress_select on public.league_progress
  for select using (private.is_club_member(club_id) or private.is_demo_club(club_id));
create policy match_calls_select on public.match_calls
  for select using (private.is_club_member(club_id) or private.is_demo_club(club_id));
create policy notifications_select on public.notifications
  for select using (private.is_club_member(club_id) or private.is_demo_club(club_id));
create policy clips_select on public.clips
  for select using (private.is_club_member(club_id) or private.is_demo_club(club_id));
create policy lineups_select on public.lineups
  for select using (private.is_club_member(club_id) or private.is_demo_club(club_id));

-- staff write the season, the side, the film and the notices
create policy results_write on public.results
  for all using (private.has_role(club_id, '{manager,coach}') or private.is_demo_club(club_id))
  with check (private.has_role(club_id, '{manager,coach}') or private.is_demo_club(club_id));
create policy league_standings_write on public.league_standings
  for all using (private.has_role(club_id, '{manager,coach}') or private.is_demo_club(club_id))
  with check (private.has_role(club_id, '{manager,coach}') or private.is_demo_club(club_id));
create policy league_progress_write on public.league_progress
  for all using (private.has_role(club_id, '{manager,coach}') or private.is_demo_club(club_id))
  with check (private.has_role(club_id, '{manager,coach}') or private.is_demo_club(club_id));
create policy lineups_write on public.lineups
  for all using (private.has_role(club_id, '{manager,coach}') or private.is_demo_club(club_id))
  with check (private.has_role(club_id, '{manager,coach}') or private.is_demo_club(club_id));
create policy notifications_write on public.notifications
  for all using (private.has_role(club_id, '{manager,coach,medical}') or private.is_demo_club(club_id))
  with check (private.has_role(club_id, '{manager,coach,medical}') or private.is_demo_club(club_id));
create policy clips_write on public.clips
  for all using (private.has_role(club_id, '{manager,coach,medical}') or private.is_demo_club(club_id))
  with check (private.has_role(club_id, '{manager,coach,medical}') or private.is_demo_club(club_id));

-- a player calls only for themselves; staff can call for anyone
create policy match_calls_write on public.match_calls
  for all using (
    private.has_role(club_id, '{manager,coach,medical}')
    or private.is_own_player(player_id)
    or private.is_demo_club(club_id)
  )
  with check (
    private.has_role(club_id, '{manager,coach,medical}')
    or private.is_own_player(player_id)
    or private.is_demo_club(club_id)
  );

-- the API roles need table grants as well as policies
grant select, insert, update on public.results, public.league_standings, public.league_progress, public.lineups to anon, authenticated;
grant select, insert, update, delete on public.match_calls, public.notifications, public.clips to anon, authenticated;

-- ── realtime ─────────────────────────────────────────────────────────────
alter publication supabase_realtime add table public.match_calls;
alter publication supabase_realtime add table public.notifications;
