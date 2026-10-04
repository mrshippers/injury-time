-- 0014: health data, lawful before live.
--
-- Injury and load data about named players looks like special category data
-- under UK GDPR. Before any real club goes live:
--
--   1. explicit consent, per player, recorded (when, which wording, by which
--      route), and refused at the database for anything that describes the
--      body: an injury, an injury-linked or doubt/injured availability, a
--      return-to-play step, a medical note. A demo club is exempt (Kilburn is
--      invented; Belstone is read-only public data).
--   2. reads narrowed by role. Until now every club member, a player included,
--      could read every teammate's injuries and loads through the API; only the
--      UI hid them. Now: staff (manager, coach, medical) and the player themself.
--   3. medical notes: short, medical staff and the player themself only. The
--      manager sees the status and the return date, never the note.
--   4. erasure on request: one call removes a player's health rows from every
--      table that holds them, and logs THAT it happened, never what was there.
--   5. adults only: consent needs a date of birth 18 or more years ago. The
--      date lives on the consent row (staff and the player read it), not on
--      players, which every teammate can read.
--
-- Not decided here, and not decidable by code: whether this is enough. A DPIA
-- and a solicitor's sign-off come before a real club goes live.

-- ── consent ────────────────────────────────────────────────────────────────
create table public.health_consents (
  player_id       uuid primary key,
  club_id         uuid not null references public.clubs (id) on delete cascade,
  wording_version text not null check (wording_version ~ '^v[0-9]{1,3}$'),
  date_of_birth   date,
  via             text not null check (via in ('account', 'link')),
  given_by        uuid references auth.users (id) on delete set null,
  given_at        timestamptz not null default now(),
  withdrawn_at    timestamptz,
  foreign key (player_id, club_id) references public.players (id, club_id) on delete cascade,
  -- a live consent always carries an adult date of birth; erasure clears both
  check (withdrawn_at is not null or date_of_birth is not null)
);
create index health_consents_club_idx on public.health_consents (club_id);
alter table public.health_consents enable row level security;

create policy health_consents_select on public.health_consents
  for select to authenticated
  using (private.has_role(club_id, '{manager,coach,medical}') or private.is_own_player(player_id));
-- written only through the functions below
revoke all on public.health_consents from anon, authenticated;
grant select on public.health_consents to authenticated;

create or replace function private.has_health_consent(pid uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (select 1 from public.health_consents hc where hc.player_id = pid and hc.withdrawn_at is null);
$$;
revoke all on function private.has_health_consent(uuid) from public;
grant execute on function private.has_health_consent(uuid) to anon, authenticated, service_role;

-- ── the gate: no health row about a real club's player without consent ──────
-- One trigger function for every table. rtp_steps has no player_id, so the
-- player comes through its injury; jsonb keeps the function table-agnostic.
create or replace function private.require_health_consent()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  row_json jsonb := to_jsonb(new);
  pid uuid := (row_json ->> 'player_id')::uuid;
  demo boolean;
begin
  select c.is_demo into demo from public.clubs c where c.id = (row_json ->> 'club_id')::uuid;
  if coalesce(demo, false) then return new; end if;
  -- fit and suspended say nothing about the body; injured, doubt, or a linked injury do
  if tg_table_name = 'availability_events'
     and (row_json ->> 'status') in ('fit', 'suspended')
     and (row_json ->> 'injury_id') is null then
    return new;
  end if;
  if pid is null and tg_table_name = 'rtp_steps' then
    select i.player_id into pid from public.injuries i where i.id = (row_json ->> 'injury_id')::uuid;
  end if;
  if pid is null or not private.has_health_consent(pid) then
    raise exception 'health_consent_required: this player has not given consent for health data'
      using errcode = '23514', constraint = 'health_consent_required';
  end if;
  return new;
end;
$$;
revoke all on function private.require_health_consent() from public;

create trigger injuries_require_consent before insert or update on public.injuries
  for each row execute function private.require_health_consent();
create trigger availability_events_require_consent before insert or update on public.availability_events
  for each row execute function private.require_health_consent();
create trigger rtp_steps_require_consent before insert or update on public.rtp_steps
  for each row execute function private.require_health_consent();

-- ── medical notes: short, structured to a player and maybe an injury ────────
create table public.medical_notes (
  id         uuid primary key default gen_random_uuid(),
  club_id    uuid not null references public.clubs (id) on delete cascade,
  player_id  uuid not null,
  injury_id  uuid,
  body       text not null check (char_length(body) between 1 and 280),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (player_id, club_id) references public.players (id, club_id) on delete cascade,
  foreign key (injury_id, club_id) references public.injuries (id, club_id) on delete cascade
);
create index medical_notes_player_idx on public.medical_notes (player_id);
alter table public.medical_notes enable row level security;

create policy medical_notes_select on public.medical_notes
  for select to authenticated
  using (private.has_role(club_id, '{medical}') or private.is_own_player(player_id));
create policy medical_notes_write on public.medical_notes
  for all to authenticated
  using (private.has_role(club_id, '{medical}'))
  with check (private.has_role(club_id, '{medical}'));
revoke all on public.medical_notes from anon;
grant select, insert, update, delete on public.medical_notes to authenticated;

create trigger medical_notes_require_consent before insert or update on public.medical_notes
  for each row execute function private.require_health_consent();

-- ── reads narrowed to staff and the player themself ─────────────────────────
alter policy injuries_select on public.injuries
  using (private.is_demo_club(club_id) or private.has_role(club_id, '{manager,coach,medical}') or private.is_own_player(player_id));
alter policy availability_events_select on public.availability_events
  using (private.is_demo_club(club_id) or private.has_role(club_id, '{manager,coach,medical}') or private.is_own_player(player_id));
alter policy session_loads_select on public.session_loads
  using (private.is_demo_club(club_id) or private.has_role(club_id, '{manager,coach,medical}') or private.is_own_player(player_id));
alter policy rtp_steps_select on public.rtp_steps
  using (
    private.is_demo_club(club_id)
    or private.has_role(club_id, '{manager,coach,medical}')
    or exists (select 1 from public.injuries i where i.id = injury_id and private.is_own_player(i.player_id))
  );

-- ...and writes to the staff who hold the capability in lib/config.ts. Before
-- this, any member (a player too) could write an injury for anyone at the club.
alter policy injuries_insert on public.injuries
  with check (private.is_demo_writable(club_id) or private.has_role(club_id, '{manager,medical}'));
alter policy injuries_update on public.injuries
  using (private.is_demo_writable(club_id) or private.has_role(club_id, '{manager,medical}'))
  with check (private.is_demo_writable(club_id) or private.has_role(club_id, '{manager,medical}'));
alter policy availability_events_insert on public.availability_events
  with check (private.is_demo_writable(club_id) or private.has_role(club_id, '{manager,coach,medical}'));
alter policy availability_events_update on public.availability_events
  using (private.is_demo_writable(club_id) or private.has_role(club_id, '{manager,coach,medical}'))
  with check (private.is_demo_writable(club_id) or private.has_role(club_id, '{manager,coach,medical}'));
alter policy session_loads_insert on public.session_loads
  with check (private.is_demo_writable(club_id) or private.has_role(club_id, '{manager,coach,medical}'));
alter policy session_loads_update on public.session_loads
  using (private.is_demo_writable(club_id) or private.has_role(club_id, '{manager,coach,medical}'))
  with check (private.is_demo_writable(club_id) or private.has_role(club_id, '{manager,coach,medical}'));

-- ── giving and withdrawing consent ──────────────────────────────────────────
-- Only the player gives it: through their own account, or through the private
-- link the staff sent them (the check-in link, 0009). Staff cannot consent for
-- a player; that is the point.
create or replace function private.record_consent(pid uuid, cid uuid, dob date, wording text, route text, uid uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if dob is null or dob > (current_date - interval '18 years')::date then
    raise exception 'under_18: this club cannot hold health data for under-18s yet' using errcode = '22023';
  end if;
  if dob < date '1900-01-01' then raise exception 'that date of birth is not right' using errcode = '22023'; end if;
  insert into public.health_consents (player_id, club_id, wording_version, date_of_birth, via, given_by, given_at, withdrawn_at)
  values (pid, cid, wording, dob, route, uid, now(), null)
  on conflict (player_id) do update
    set wording_version = excluded.wording_version, date_of_birth = excluded.date_of_birth, via = excluded.via,
        given_by = excluded.given_by, given_at = now(), withdrawn_at = null;
end;
$$;
revoke all on function private.record_consent(uuid, uuid, date, text, text, uuid) from public;

create or replace function public.give_health_consent(pid uuid, dob date, wording text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare uid uuid := (select auth.uid()); cid uuid; demo boolean;
begin
  if uid is null then raise exception 'sign in first' using errcode = '42501'; end if;
  select p.club_id, c.is_demo into cid, demo from public.players p join public.clubs c on c.id = p.club_id
  where p.id = pid and p.user_id = uid and p.retired_on is null;
  if cid is null then raise exception 'only the player can give their own consent' using errcode = '42501'; end if;
  if demo then raise exception 'demo clubs take no consent' using errcode = '42501'; end if;
  perform private.record_consent(pid, cid, dob, wording, 'account', uid);
  return 'given';
end;
$$;

create or replace function public.give_health_consent_by_link(token uuid, dob date, wording text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare pid uuid; cid uuid;
begin
  select p.id, p.club_id into pid, cid
  from public.player_checkin_links l
  join public.players p on p.id = l.player_id
  join public.clubs c on c.id = p.club_id
  where l.token = give_health_consent_by_link.token and p.retired_on is null and not c.is_demo;
  if pid is null then return 'unknown_link'; end if;
  perform private.record_consent(pid, cid, dob, wording, 'link', null);
  return 'given';
end;
$$;

create or replace function public.health_consent_status(token uuid)
returns table (first_name text, club_name text, consented boolean, wording_version text)
language sql
security definer
stable
set search_path = ''
as $$
  select split_part(p.name, ' ', 1), c.name, (hc.player_id is not null and hc.withdrawn_at is null), hc.wording_version
  from public.player_checkin_links l
  join public.players p on p.id = l.player_id
  join public.clubs c on c.id = p.club_id
  left join public.health_consents hc on hc.player_id = p.id
  where l.token = health_consent_status.token and p.retired_on is null and not c.is_demo;
$$;

-- withdrawal stops anything new being written; erasure (below) removes what is there
create or replace function public.withdraw_health_consent(pid uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_own_player(pid) then raise exception 'only the player withdraws their own consent' using errcode = '42501'; end if;
  update public.health_consents set withdrawn_at = now() where player_id = pid and withdrawn_at is null;
  return 'withdrawn';
end;
$$;

-- ── erasure on request ──────────────────────────────────────────────────────
-- The one place this app hard-deletes. The event-sourced rule (0003) yields to
-- a person's right to have their health data gone.
create table public.health_erasures (
  id           uuid primary key default gen_random_uuid(),
  club_id      uuid not null references public.clubs (id) on delete cascade,
  player_id    uuid references public.players (id) on delete set null,
  requested_by uuid references auth.users (id) on delete set null,
  erased_at    timestamptz not null default now(),
  -- how many rows went from each table: the fact of the erasure, not its content
  counts       jsonb not null
);
alter table public.health_erasures enable row level security;
create policy health_erasures_select on public.health_erasures
  for select to authenticated
  using (private.has_role(club_id, '{manager,medical}'));
revoke all on public.health_erasures from anon, authenticated;
grant select on public.health_erasures to authenticated;

create or replace function private.erase_health(pid uuid, cid uuid, uid uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare n_notes int; n_rtp int; n_avail int; n_inj int; n_loads int; n_checkins int; n_body int; counts jsonb;
begin
  delete from public.medical_notes where player_id = pid;                                    get diagnostics n_notes = row_count;
  delete from public.rtp_steps where injury_id in (select id from public.injuries where player_id = pid); get diagnostics n_rtp = row_count;
  delete from public.availability_events where player_id = pid;                              get diagnostics n_avail = row_count;
  delete from public.injuries where player_id = pid;                                         get diagnostics n_inj = row_count;
  delete from public.session_loads where player_id = pid;                                    get diagnostics n_loads = row_count;
  delete from public.player_checkins where player_id = pid;                                  get diagnostics n_checkins = row_count;
  update public.player_checkin_links set consent_at = null where player_id = pid;
  update public.players set body_params = null where id = pid and body_params is not null;   get diagnostics n_body = row_count;
  update public.health_consents set withdrawn_at = coalesce(withdrawn_at, now()), date_of_birth = null where player_id = pid;
  counts := jsonb_build_object(
    'medical_notes', n_notes, 'rtp_steps', n_rtp, 'availability_events', n_avail, 'injuries', n_inj,
    'session_loads', n_loads, 'player_checkins', n_checkins, 'body_params', n_body);
  insert into public.health_erasures (club_id, player_id, requested_by, counts) values (cid, pid, uid, counts);
  return counts;
end;
$$;
revoke all on function private.erase_health(uuid, uuid, uuid) from public;

-- the player themself, or the manager or medical staff acting on their request
create or replace function public.erase_player_health(pid uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare uid uuid := (select auth.uid()); cid uuid; demo boolean;
begin
  if uid is null then raise exception 'sign in first' using errcode = '42501'; end if;
  select p.club_id, c.is_demo into cid, demo from public.players p join public.clubs c on c.id = p.club_id where p.id = pid;
  if cid is null then raise exception 'no such player' using errcode = '22023'; end if;
  if demo then raise exception 'demo clubs are reseeded, not erased' using errcode = '42501'; end if;
  if not (private.has_role(cid, '{manager,medical}') or private.is_own_player(pid)) then
    raise exception 'only the player, the manager or medical staff can erase health data' using errcode = '42501';
  end if;
  return private.erase_health(pid, cid, uid);
end;
$$;

-- the same from the player's private link, no account needed
create or replace function public.erase_player_health_by_link(token uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare pid uuid; cid uuid;
begin
  select p.id, p.club_id into pid, cid
  from public.player_checkin_links l join public.players p on p.id = l.player_id join public.clubs c on c.id = p.club_id
  where l.token = erase_player_health_by_link.token and not c.is_demo;
  if pid is null then raise exception 'this link is not recognised' using errcode = '22023'; end if;
  return private.erase_health(pid, cid, null);
end;
$$;

-- supabase grants execute on new public functions to anon directly (see 0012)
revoke all on function public.give_health_consent(uuid, date, text) from public, anon;
revoke all on function public.give_health_consent_by_link(uuid, date, text) from public;
revoke all on function public.health_consent_status(uuid) from public;
revoke all on function public.withdraw_health_consent(uuid) from public, anon;
revoke all on function public.erase_player_health(uuid) from public, anon;
revoke all on function public.erase_player_health_by_link(uuid) from public;
grant execute on function public.give_health_consent(uuid, date, text) to authenticated;
grant execute on function public.give_health_consent_by_link(uuid, date, text) to anon, authenticated;
grant execute on function public.health_consent_status(uuid) to anon, authenticated;
grant execute on function public.withdraw_health_consent(uuid) to authenticated;
grant execute on function public.erase_player_health(uuid) to authenticated;
grant execute on function public.erase_player_health_by_link(uuid) to anon, authenticated;
