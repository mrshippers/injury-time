-- 0018: the staff as people, not just logins.
--
-- club_members is who can sign in and what they may do. It carries no name,
-- no title and no dates, so the season review had nothing to say about the
-- manager, the coaches or the physio. club_staff is the human record: a name,
-- a title the club uses ("assistant manager", "physio", "kit"), when they
-- came and went, and optionally the login they are. staff_attendance records
-- who was at which session (a matchday or training), so the review can say
-- how many matchdays each of them made.
--
-- Nothing medical, nothing about pay. The review judges presence and tenure,
-- the committee judges the rest.

create table public.club_staff (
  id         uuid primary key default gen_random_uuid(),
  club_id    uuid not null references public.clubs (id) on delete cascade,
  user_id    uuid references auth.users (id) on delete set null,
  name       text not null check (char_length(btrim(name)) between 2 and 80),
  title      text not null check (char_length(btrim(title)) between 2 and 40),
  role       text not null check (role in ('manager', 'coach', 'medical', 'other')),
  joined_on  date not null default current_date,
  left_on    date check (left_on is null or left_on >= joined_on),
  created_at timestamptz not null default now(),
  unique (club_id, user_id)
);
create index club_staff_club_idx on public.club_staff (club_id, left_on, joined_on);

create table public.staff_attendance (
  staff_id   uuid not null references public.club_staff (id) on delete cascade,
  session_id uuid not null references public.sessions (id) on delete cascade,
  club_id    uuid not null references public.clubs (id) on delete cascade,
  present    boolean not null default true,
  primary key (staff_id, session_id)
);
create index staff_attendance_club_idx on public.staff_attendance (club_id, session_id);

alter table public.club_staff enable row level security;
alter table public.staff_attendance enable row level security;

-- the demo clubs and your own club read the staff; the manager writes them, a coach can mark attendance
create policy club_staff_select on public.club_staff
  for select to anon, authenticated
  using (private.is_demo_club(club_id) or private.is_club_member(club_id));
create policy club_staff_write on public.club_staff
  for all to anon, authenticated
  using (private.is_demo_writable(club_id) or private.has_role(club_id, '{manager}'))
  with check (private.is_demo_writable(club_id) or private.has_role(club_id, '{manager}'));

create policy staff_attendance_select on public.staff_attendance
  for select to anon, authenticated
  using (private.is_demo_club(club_id) or private.is_club_member(club_id));
create policy staff_attendance_write on public.staff_attendance
  for all to anon, authenticated
  using (private.is_demo_writable(club_id) or private.has_role(club_id, '{manager,coach}'))
  with check (private.is_demo_writable(club_id) or private.has_role(club_id, '{manager,coach}'));

grant select, insert, update, delete on public.club_staff, public.staff_attendance to anon, authenticated;
