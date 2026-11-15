-- 0019: recurring training nights and notification preferences.
--
-- A club sets the nights it trains. A night is "due" when it has passed and no
-- session is linked to it; nothing is created until a person confirms it, so
-- an empty night never reaches the workload model. A skipped night is
-- recorded so it stops being asked about.

create table public.training_schedule (
  id          uuid primary key default gen_random_uuid(),
  club_id     uuid not null references public.clubs (id) on delete cascade,
  weekday     int  not null check (weekday between 1 and 7), -- ISO: 1 Monday to 7 Sunday
  start_time  time not null default '19:30',
  minutes     int  not null default 90 check (minutes between 20 and 150),
  default_rpe int  not null default 6 check (default_rpe between 1 and 10),
  active_from date not null default current_date,
  active_to   date check (active_to is null or active_to >= active_from),
  created_at  timestamptz not null default now(),
  unique (id, club_id)
);
create index training_schedule_club_idx on public.training_schedule (club_id, weekday);

-- which schedule row a session confirmed; one session per scheduled night
alter table public.sessions add column schedule_id uuid;
alter table public.sessions
  add constraint sessions_schedule_fk
  foreign key (schedule_id, club_id) references public.training_schedule (id, club_id) on delete set null (schedule_id);
create unique index sessions_schedule_night_uidx on public.sessions (schedule_id, session_date) where schedule_id is not null;

create table public.training_skips (
  id          uuid primary key default gen_random_uuid(),
  club_id     uuid not null references public.clubs (id) on delete cascade,
  schedule_id uuid not null,
  skipped_on  date not null,
  created_at  timestamptz not null default now(),
  foreign key (schedule_id, club_id) references public.training_schedule (id, club_id) on delete cascade,
  unique (schedule_id, skipped_on)
);
create index training_skips_club_idx on public.training_skips (club_id, skipped_on desc);

create table public.notification_prefs (
  user_id           uuid not null references auth.users (id) on delete cascade,
  club_id           uuid not null references public.clubs (id) on delete cascade,
  training_reminder boolean not null default false,
  training_confirm  boolean not null default true,
  match_calls       boolean not null default true,
  notices           boolean not null default true,
  updated_at        timestamptz not null default now(),
  primary key (user_id, club_id)
);

alter table public.training_schedule enable row level security;
alter table public.training_skips    enable row level security;
alter table public.notification_prefs enable row level security;

-- demo clubs and members read the schedule; the manager writes it
create policy training_schedule_select on public.training_schedule
  for select to anon, authenticated
  using (private.is_demo_club(club_id) or private.is_club_member(club_id));
create policy training_schedule_write on public.training_schedule
  for all to anon, authenticated
  using (private.is_demo_writable(club_id) or private.has_role(club_id, '{manager}'))
  with check (private.is_demo_writable(club_id) or private.has_role(club_id, '{manager}'));

-- staff who log sessions also skip a night
create policy training_skips_select on public.training_skips
  for select to anon, authenticated
  using (private.is_demo_club(club_id) or private.is_club_member(club_id));
create policy training_skips_write on public.training_skips
  for all to anon, authenticated
  using (private.is_demo_writable(club_id) or private.has_role(club_id, '{manager,coach,medical}'))
  with check (private.is_demo_writable(club_id) or private.has_role(club_id, '{manager,coach,medical}'));

-- preferences belong to the person; the server reads the lot with the service role to send
create policy notification_prefs_own on public.notification_prefs
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and private.is_club_member(club_id));

grant select, insert, update, delete on public.training_schedule to anon, authenticated;
grant select, insert, update, delete on public.training_skips to anon, authenticated;
revoke all on public.notification_prefs from anon;
grant select, insert, update on public.notification_prefs to authenticated;
