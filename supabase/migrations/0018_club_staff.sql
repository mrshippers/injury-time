-- 0018: staff records.
--
-- club_members holds who can sign in and what they may do. It has no name,
-- title or dates. club_staff is the record of the person: name, title, role,
-- when they joined and left, and the login they use, if any. The season
-- review reads tenure from it.

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

alter table public.club_staff enable row level security;

-- demo clubs and members read; the manager writes
create policy club_staff_select on public.club_staff
  for select to anon, authenticated
  using (private.is_demo_club(club_id) or private.is_club_member(club_id));
create policy club_staff_write on public.club_staff
  for all to anon, authenticated
  using (private.is_demo_writable(club_id) or private.has_role(club_id, '{manager}'))
  with check (private.is_demo_writable(club_id) or private.has_role(club_id, '{manager}'));

grant select, insert, update, delete on public.club_staff to anon, authenticated;
