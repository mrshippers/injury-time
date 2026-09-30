-- 0011: the player's own page. What a player says about themselves as a
-- footballer: the name on the shirt, the foot, the position they'd pick, the
-- walk-out song, the clubs before this one. Football only: nothing about the
-- body lives here, that stays on the staff side under its own rules.
--
-- Written by the player (their linked account), the manager or coach, or a
-- guest on a demo club that is open to try. A real club shown from public
-- data (Belstone) is read-only: its players fill this in once they're linked.

create table public.player_profiles (
  player_id      uuid primary key references public.players (id) on delete cascade,
  club_id        uuid not null references public.clubs (id) on delete cascade,
  nickname       text check (char_length(nickname) between 1 and 24),
  shirt_name     text check (char_length(shirt_name) between 1 and 14),
  preferred_foot text check (preferred_foot in ('left', 'right', 'both')),
  best_position  text check (best_position in ('GK', 'RB', 'CB', 'LB', 'RWB', 'LWB', 'DM', 'CM', 'AM', 'RW', 'LW', 'ST')),
  walkout_song   text check (char_length(walkout_song) between 1 and 60),
  boots          text check (char_length(boots) between 1 and 40),
  hero           text check (char_length(hero) between 1 and 40),
  previous_clubs text[] not null default '{}' check (cardinality(previous_clubs) <= 8),
  bio            text check (char_length(bio) between 1 and 200),
  -- a clip moment they want at the top: {"clip_id": uuid, "t": seconds}
  pinned         jsonb,
  updated_at     timestamptz not null default now()
);

alter table public.player_profiles enable row level security;

create policy player_profiles_select on public.player_profiles
  for select to anon, authenticated
  using (private.is_demo_club(club_id) or private.is_club_member(club_id));

-- the club on the row must be the player's club, or a write could hang a
-- profile off another club's player
create policy player_profiles_write on public.player_profiles
  for all to anon, authenticated
  using (
    private.is_demo_writable(club_id)
    or private.has_role(club_id, '{manager,coach}')
    or private.is_own_player(player_id)
  )
  with check (
    exists (select 1 from public.players p where p.id = player_id and p.club_id = player_profiles.club_id)
    and (
      private.is_demo_writable(club_id)
      or private.has_role(club_id, '{manager,coach}')
      or private.is_own_player(player_id)
    )
  );

grant select, insert, update on public.player_profiles to anon, authenticated;
revoke delete on public.player_profiles from anon, authenticated;
