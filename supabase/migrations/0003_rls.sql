-- Row level security.
--
-- Two predicates decide everything:
--   private.is_club_member(cid)  - the caller is signed in and on this club's staff
--   private.is_demo_club(cid)    - this club is the public demo squad
--
-- They live in a private schema (not exposed over PostgREST), are SECURITY
-- DEFINER so they can read club_members without recursing into its own RLS, and
-- pin search_path to '' so nothing can be shadowed by a caller-set path.

create schema if not exists private;

create or replace function private.is_club_member(cid uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.club_members cm
    where cm.club_id = cid
      and cm.user_id = (select auth.uid())
  );
$$;

create or replace function private.is_demo_club(cid uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.clubs c
    where c.id = cid
      and c.is_demo
  );
$$;

-- Only the API roles that actually evaluate policies get to call these.
revoke all on schema private from public;
revoke all on function private.is_club_member(uuid) from public;
revoke all on function private.is_demo_club(uuid) from public;
grant usage on schema private to anon, authenticated, service_role;
grant execute on function private.is_club_member(uuid) to anon, authenticated, service_role;
grant execute on function private.is_demo_club(uuid) to anon, authenticated, service_role;

alter table public.clubs               enable row level security;
alter table public.club_members        enable row level security;
alter table public.players             enable row level security;
alter table public.injuries            enable row level security;
alter table public.availability_events enable row level security;
alter table public.sessions            enable row level security;
alter table public.session_loads       enable row level security;

-- Clubs are readable if they are the demo squad or yours. Nobody creates,
-- renames or deletes a club over the API; that is an admin / service-role job.
create policy clubs_select on public.clubs
  for select to anon, authenticated
  using (is_demo or private.is_club_member(id));

-- You can see your own memberships and nothing else. Deliberately not
-- "everyone on my club": staff lists are not a squad-availability concern.
create policy club_members_select on public.club_members
  for select to anon, authenticated
  using (user_id = (select auth.uid()));

-- Squad data. Same predicate on every table and every verb. No delete policy
-- anywhere: availability is event-sourced, so nothing in this app hard-deletes.
create policy players_select on public.players
  for select to anon, authenticated
  using (private.is_demo_club(club_id) or private.is_club_member(club_id));
create policy players_insert on public.players
  for insert to anon, authenticated
  with check (private.is_demo_club(club_id) or private.is_club_member(club_id));
create policy players_update on public.players
  for update to anon, authenticated
  using (private.is_demo_club(club_id) or private.is_club_member(club_id))
  with check (private.is_demo_club(club_id) or private.is_club_member(club_id));

create policy injuries_select on public.injuries
  for select to anon, authenticated
  using (private.is_demo_club(club_id) or private.is_club_member(club_id));
create policy injuries_insert on public.injuries
  for insert to anon, authenticated
  with check (private.is_demo_club(club_id) or private.is_club_member(club_id));
create policy injuries_update on public.injuries
  for update to anon, authenticated
  using (private.is_demo_club(club_id) or private.is_club_member(club_id))
  with check (private.is_demo_club(club_id) or private.is_club_member(club_id));

create policy availability_events_select on public.availability_events
  for select to anon, authenticated
  using (private.is_demo_club(club_id) or private.is_club_member(club_id));
create policy availability_events_insert on public.availability_events
  for insert to anon, authenticated
  with check (private.is_demo_club(club_id) or private.is_club_member(club_id));
create policy availability_events_update on public.availability_events
  for update to anon, authenticated
  using (private.is_demo_club(club_id) or private.is_club_member(club_id))
  with check (private.is_demo_club(club_id) or private.is_club_member(club_id));

create policy sessions_select on public.sessions
  for select to anon, authenticated
  using (private.is_demo_club(club_id) or private.is_club_member(club_id));
create policy sessions_insert on public.sessions
  for insert to anon, authenticated
  with check (private.is_demo_club(club_id) or private.is_club_member(club_id));
create policy sessions_update on public.sessions
  for update to anon, authenticated
  using (private.is_demo_club(club_id) or private.is_club_member(club_id))
  with check (private.is_demo_club(club_id) or private.is_club_member(club_id));

create policy session_loads_select on public.session_loads
  for select to anon, authenticated
  using (private.is_demo_club(club_id) or private.is_club_member(club_id));
create policy session_loads_insert on public.session_loads
  for insert to anon, authenticated
  with check (private.is_demo_club(club_id) or private.is_club_member(club_id));
create policy session_loads_update on public.session_loads
  for update to anon, authenticated
  using (private.is_demo_club(club_id) or private.is_club_member(club_id))
  with check (private.is_demo_club(club_id) or private.is_club_member(club_id));

-- Table privileges. RLS narrows what a role may touch; it does not grant. No
-- DELETE is granted to anyone, so the "no delete policy" rule cannot be worked
-- around by a future policy being added carelessly.
grant select on public.clubs to anon, authenticated;
grant select on public.club_members to anon, authenticated;
grant select, insert, update on public.players to anon, authenticated;
grant select, insert, update on public.injuries to anon, authenticated;
grant select, insert, update on public.availability_events to anon, authenticated;
grant select, insert, update on public.sessions to anon, authenticated;
grant select, insert, update on public.session_loads to anon, authenticated;
grant select on public.current_availability to anon, authenticated;

revoke insert, update, delete on public.clubs from anon, authenticated;
revoke insert, update, delete on public.club_members from anon, authenticated;
revoke delete on public.players from anon, authenticated;
revoke delete on public.injuries from anon, authenticated;
revoke delete on public.availability_events from anon, authenticated;
revoke delete on public.sessions from anon, authenticated;
revoke delete on public.session_loads from anon, authenticated;
revoke insert, update, delete on public.current_availability from anon, authenticated;
