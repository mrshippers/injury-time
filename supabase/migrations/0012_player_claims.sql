-- 0012: a real player takes over their own page. The manager or coach mints a
-- link; the player opens it, signs in, and claims: their account is linked to
-- their player row and they join the club as a player. From then the hub is
-- theirs to edit (0011's is_own_player path).
--
-- The token is the credential, like the check-in link: no table access for
-- anon or authenticated, everything through the three functions below. Demo
-- clubs cannot mint: Kilburn's players are fictional, and Belstone has no
-- staff until the club itself signs up.

create table public.player_claims (
  player_id  uuid primary key references public.players (id) on delete cascade,
  club_id    uuid not null references public.clubs (id) on delete cascade,
  token      uuid not null unique default gen_random_uuid(),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  claimed_by uuid references auth.users (id) on delete set null,
  claimed_at timestamptz
);
alter table public.player_claims enable row level security;
revoke all on public.player_claims from anon, authenticated;

-- staff mint (or re-mint, which kills the old link) for an unlinked player
create or replace function public.mint_player_claim(pid uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare cid uuid; linked uuid; demo boolean; tok uuid;
begin
  select p.club_id, p.user_id, c.is_demo into cid, linked, demo
  from public.players p join public.clubs c on c.id = p.club_id
  where p.id = pid and p.retired_on is null;
  if cid is null then raise exception 'no such player' using errcode = '22023'; end if;
  if demo then raise exception 'demo clubs cannot hand out claims' using errcode = '42501'; end if;
  if not private.has_role(cid, '{manager,coach}') then raise exception 'only the manager or coach' using errcode = '42501'; end if;
  if linked is not null then raise exception 'already claimed' using errcode = '23505'; end if;
  insert into public.player_claims (player_id, club_id, created_by)
  values (pid, cid, (select auth.uid()))
  on conflict (player_id) do update
    set token = gen_random_uuid(), created_by = excluded.created_by, created_at = now(), claimed_by = null, claimed_at = null
  returning token into tok;
  return tok;
end;
$$;

-- what the claim page may show before sign-in: a first name and a club, nothing else
create or replace function public.claim_status(token uuid)
returns table (first_name text, club_name text, claimed boolean)
language sql
security definer
stable
set search_path = ''
as $$
  select split_part(p.name, ' ', 1), c.name, (l.claimed_at is not null or p.user_id is not null)
  from public.player_claims l
  join public.players p on p.id = l.player_id
  join public.clubs c on c.id = p.club_id
  where l.token = claim_status.token and p.retired_on is null and not c.is_demo;
$$;

-- the signed-in player claims: one account per player, one player per account per club
create or replace function public.claim_player(token uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare uid uuid := (select auth.uid()); pid uuid; cid uuid;
begin
  if uid is null then raise exception 'sign in first' using errcode = '42501'; end if;
  select l.player_id, l.club_id into pid, cid
  from public.player_claims l join public.clubs c on c.id = l.club_id
  where l.token = claim_player.token and l.claimed_at is null and not c.is_demo
  for update of l;
  if pid is null then raise exception 'this link has been used or replaced' using errcode = '22023'; end if;
  if exists (select 1 from public.players where club_id = cid and user_id = uid) then
    raise exception 'this account already has a player at this club' using errcode = '23505';
  end if;
  update public.players set user_id = uid where id = pid and user_id is null;
  if not found then raise exception 'already claimed' using errcode = '23505'; end if;
  insert into public.club_members (club_id, user_id, role) values (cid, uid, 'player')
  on conflict (club_id, user_id) do nothing;
  update public.player_claims set claimed_by = uid, claimed_at = now() where player_id = pid;
  return pid;
end;
$$;

-- supabase grants execute on new public functions to anon directly, not via
-- public: revoking from public alone left anon able to call these (found by the probe)
revoke execute on function public.mint_player_claim(uuid) from anon;
revoke execute on function public.claim_player(uuid) from anon;
revoke all on function public.mint_player_claim(uuid) from public;
revoke all on function public.claim_status(uuid) from public;
revoke all on function public.claim_player(uuid) from public;
grant execute on function public.mint_player_claim(uuid) to authenticated;
grant execute on function public.claim_status(uuid) to anon, authenticated;
grant execute on function public.claim_player(uuid) to authenticated;
