-- Injury Time: core schema.
--
-- Tenancy: every row below the club carries club_id, so every RLS policy is a
-- single predicate on that column and never has to join back through players.
-- The denormalised club_id is kept honest by composite foreign keys
-- (child.player_id, child.club_id) -> players (id, club_id), which make it
-- impossible to attach a row from one club to a parent in another.
--
-- Availability is event-sourced: availability_events is append-only and the
-- current state of a player is the latest row (see public.current_availability).

create extension if not exists pgcrypto;

create table public.clubs (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  league     text not null,
  is_demo    boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.club_members (
  club_id    uuid not null references public.clubs (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  role       text not null check (role in ('manager', 'physio')),
  created_at timestamptz not null default now(),
  primary key (club_id, user_id)
);

create table public.players (
  id           uuid primary key default gen_random_uuid(),
  club_id      uuid not null references public.clubs (id) on delete cascade,
  name         text not null,
  position     text not null check (position in ('GK', 'DF', 'MF', 'FW')),
  squad_number int,
  created_at   timestamptz not null default now(),
  unique (club_id, squad_number),
  -- composite target for the club-pinning foreign keys below
  unique (id, club_id)
);

-- No free-text notes column, deliberately. Injury Time records structured
-- clinical facts a manager can act on; it is not a medical record and must not
-- become one by the back door.
create table public.injuries (
  id              uuid primary key default gen_random_uuid(),
  club_id         uuid not null references public.clubs (id) on delete cascade,
  player_id       uuid not null,
  body_region     text not null check (body_region in (
                    'head', 'neck', 'shoulder', 'arm', 'wrist_hand', 'chest',
                    'back_upper', 'back_lower', 'hip', 'groin', 'quad',
                    'hamstring', 'knee', 'calf', 'shin', 'achilles', 'ankle',
                    'foot')),
  side            text not null check (side in ('left', 'right', 'central')),
  severity        text not null check (severity in ('knock', 'minor', 'moderate', 'severe')),
  occurred_on     date not null,
  expected_return date,
  resolved_on     date,
  created_at      timestamptz not null default now(),
  foreign key (player_id, club_id) references public.players (id, club_id) on delete cascade,
  unique (id, club_id)
);

create table public.availability_events (
  id          uuid primary key default gen_random_uuid(),
  club_id     uuid not null references public.clubs (id) on delete cascade,
  player_id   uuid not null,
  status      text not null check (status in ('fit', 'doubt', 'injured', 'suspended')),
  return_date date,
  injury_id   uuid,
  noted_on    date not null default current_date,
  created_at  timestamptz not null default now(),
  foreign key (player_id, club_id) references public.players (id, club_id) on delete cascade,
  foreign key (injury_id, club_id) references public.injuries (id, club_id) on delete set null (injury_id)
);

create table public.sessions (
  id              uuid primary key default gen_random_uuid(),
  club_id         uuid not null references public.clubs (id) on delete cascade,
  session_date    date not null,
  kind            text not null check (kind in ('training', 'match')),
  opponent        text,
  minutes_planned int,
  created_at      timestamptz not null default now(),
  unique (id, club_id)
);

create table public.session_loads (
  id         uuid primary key default gen_random_uuid(),
  club_id    uuid not null references public.clubs (id) on delete cascade,
  session_id uuid not null,
  player_id  uuid not null,
  rpe        int not null check (rpe between 1 and 10),
  minutes    int not null check (minutes between 1 and 180),
  load       int generated always as (rpe * minutes) stored,
  created_at timestamptz not null default now(),
  foreign key (session_id, club_id) references public.sessions (id, club_id) on delete cascade,
  foreign key (player_id, club_id) references public.players (id, club_id) on delete cascade,
  unique (session_id, player_id)
);

-- Indexes. Every FK gets one: RLS turns club_id into the hottest column in the
-- database, and the load engine reads by (player_id, date).
create index players_club_id_idx              on public.players (club_id);
create index club_members_user_id_idx         on public.club_members (user_id);
create index injuries_club_id_idx             on public.injuries (club_id);
create index injuries_player_id_idx           on public.injuries (player_id);
create index injuries_unresolved_idx          on public.injuries (club_id) where resolved_on is null;
create index availability_events_club_id_idx  on public.availability_events (club_id);
create index availability_events_latest_idx   on public.availability_events (player_id, created_at desc);
create index availability_events_injury_id_idx on public.availability_events (injury_id);
create index sessions_club_date_idx           on public.sessions (club_id, session_date desc);
create index session_loads_club_id_idx        on public.session_loads (club_id);
create index session_loads_player_id_idx      on public.session_loads (player_id);
create index session_loads_session_id_idx     on public.session_loads (session_id);
