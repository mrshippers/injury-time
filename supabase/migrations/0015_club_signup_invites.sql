-- 0015: a club signs itself up, and brings its staff in.
--
-- Until now every real club was made by hand. create_club() lets a signed-in
-- person make one in a single transaction (the club and their own membership),
-- adults only, at most three per account so a script cannot fill the table.
-- Staff come in through single-use links, one role each, seven days to live,
-- on the same pattern as the player claim (0012): the token is the credential,
-- no table access for anon, everything through the functions below.

alter table public.clubs
  add column if not exists created_by  uuid references auth.users (id) on delete set null,
  -- the person who signed up confirmed every player is 18 or over (0014 checks each one at consent)
  add column if not exists adult_side_confirmed_at timestamptz;

-- a call answered from the notification itself, not the app: the pilot's first-week check reads this
alter table public.match_calls
  add column if not exists via text not null default 'app' check (via in ('app', 'push'));

-- players come from the manager or a coach, not from any member (a player could add a player before this)
alter policy players_insert on public.players
  with check (private.is_demo_writable(club_id) or private.has_role(club_id, '{manager,coach}'));

-- ── sign-up ─────────────────────────────────────────────────────────────────
create or replace function public.create_club(club_name text, league text, my_role text, adult_side boolean)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  nm text := btrim(regexp_replace(coalesce(club_name, ''), '\s+', ' ', 'g'));
  lg text := btrim(regexp_replace(coalesce(league, ''), '\s+', ' ', 'g'));
  base text; candidate text; n int := 1; cid uuid;
begin
  if uid is null then raise exception 'sign in first' using errcode = '42501'; end if;
  if char_length(nm) not between 2 and 60 then raise exception 'a club name is 2 to 60 characters' using errcode = '22023'; end if;
  if char_length(lg) not between 2 and 80 then raise exception 'a league is 2 to 80 characters' using errcode = '22023'; end if;
  if my_role not in ('manager', 'coach', 'medical') then raise exception 'you sign up as the manager, a coach or medical' using errcode = '22023'; end if;
  if adult_side is not true then
    raise exception 'adults_only: Injury Time takes adult sides only for now (every player 18 or over)' using errcode = '22023';
  end if;
  if (select count(*) from public.clubs c where c.created_by = uid) >= 3 then
    raise exception 'one account can sign up three clubs' using errcode = '54000';
  end if;
  base := btrim(regexp_replace(lower(nm), '[^a-z0-9]+', '-', 'g'), '-');
  if base = '' then base := 'club'; end if;
  candidate := base;
  while exists (select 1 from public.clubs c where c.slug = candidate) loop
    n := n + 1;
    candidate := base || '-' || n;
  end loop;
  insert into public.clubs (name, league, is_demo, demo_writable, slug, season_source, created_by, adult_side_confirmed_at)
  values (nm, lg, false, false, candidate, 'manual', uid, now())
  returning id into cid;
  insert into public.club_members (club_id, user_id, role) values (cid, uid, my_role);
  return cid;
end;
$$;

-- ── staff invites ───────────────────────────────────────────────────────────
create table public.staff_invites (
  token      uuid primary key default gen_random_uuid(),
  club_id    uuid not null references public.clubs (id) on delete cascade,
  role       text not null check (role in ('coach', 'medical')),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  used_by    uuid references auth.users (id) on delete set null,
  used_at    timestamptz
);
create index staff_invites_club_idx on public.staff_invites (club_id, created_at desc);
alter table public.staff_invites enable row level security;
-- the manager sees the links they have out, so the club page can say who has joined
create policy staff_invites_select on public.staff_invites
  for select to authenticated
  using (private.has_role(club_id, '{manager}'));
revoke all on public.staff_invites from anon, authenticated;
grant select on public.staff_invites to authenticated;

create or replace function public.mint_staff_invite(cid uuid, invite_role text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare demo boolean; tok uuid;
begin
  select c.is_demo into demo from public.clubs c where c.id = cid;
  if demo is null then raise exception 'no such club' using errcode = '22023'; end if;
  if demo then raise exception 'demo clubs cannot invite staff' using errcode = '42501'; end if;
  if not private.has_role(cid, '{manager}') then raise exception 'only the manager invites staff' using errcode = '42501'; end if;
  if invite_role not in ('coach', 'medical') then raise exception 'an invite is for a coach or medical' using errcode = '22023'; end if;
  insert into public.staff_invites (club_id, role, created_by) values (cid, invite_role, (select auth.uid()))
  returning token into tok;
  return tok;
end;
$$;

-- what the invite page may show before sign-in
create or replace function public.staff_invite_status(token uuid)
returns table (club_name text, role text, usable boolean)
language sql
security definer
stable
set search_path = ''
as $$
  select c.name, i.role, (i.used_at is null and i.expires_at > now())
  from public.staff_invites i join public.clubs c on c.id = i.club_id
  where i.token = staff_invite_status.token and not c.is_demo;
$$;

-- the signed-in person takes the role on the invite, and nothing more
create or replace function public.accept_staff_invite(token uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare uid uuid := (select auth.uid()); cid uuid; r text;
begin
  if uid is null then raise exception 'sign in first' using errcode = '42501'; end if;
  select i.club_id, i.role into cid, r
  from public.staff_invites i join public.clubs c on c.id = i.club_id
  where i.token = accept_staff_invite.token and i.used_at is null and i.expires_at > now() and not c.is_demo
  for update of i;
  if cid is null then raise exception 'this invite has been used or has expired' using errcode = '22023'; end if;
  if exists (select 1 from public.club_members m where m.club_id = cid and m.user_id = uid) then
    raise exception 'you are already on this club' using errcode = '23505';
  end if;
  insert into public.club_members (club_id, user_id, role) values (cid, uid, r);
  update public.staff_invites set used_by = uid, used_at = now() where staff_invites.token = accept_staff_invite.token;
  return cid;
end;
$$;

-- ── the pilot's first week, read from the database ─────────────────────────
-- squad in (11 or more players), a staff invite used, a call answered from a push.
create or replace function public.first_week_check(cid uuid)
returns table (squad_in boolean, staff_joined boolean, push_answered boolean)
language sql
security definer
stable
set search_path = ''
as $$
  select
    (select count(*) from public.players p where p.club_id = cid and p.retired_on is null) >= 11,
    exists (select 1 from public.staff_invites i where i.club_id = cid and i.used_at is not null),
    exists (select 1 from public.match_calls m where m.club_id = cid and m.via = 'push')
  where private.has_role(cid, '{manager,coach,medical}');
$$;

revoke all on function public.create_club(text, text, text, boolean) from public, anon;
revoke all on function public.mint_staff_invite(uuid, text) from public, anon;
revoke all on function public.staff_invite_status(uuid) from public;
revoke all on function public.accept_staff_invite(uuid) from public, anon;
revoke all on function public.first_week_check(uuid) from public, anon;
grant execute on function public.create_club(text, text, text, boolean) to authenticated;
grant execute on function public.mint_staff_invite(uuid, text) to authenticated;
grant execute on function public.staff_invite_status(uuid) to anon, authenticated;
grant execute on function public.accept_staff_invite(uuid) to authenticated;
grant execute on function public.first_week_check(uuid) to authenticated;
