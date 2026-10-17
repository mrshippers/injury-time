-- What the club's No.2 has written: the opponent brief, a match report draft, a nudge to the quiet ones.
-- Keyed so the same match never pays for the same words twice. Written and read only by the server
-- (service role); the words are built from data the page already shows.
create table if not exists public.ai_notes (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete cascade,
  kind text not null check (kind in ('brief', 'report', 'nudge', 'answer')),
  key text not null,
  body jsonb not null,
  model text,
  created_at timestamptz not null default now(),
  unique (club_id, kind, key)
);
alter table public.ai_notes enable row level security;
-- no policies: only the service role reads and writes
