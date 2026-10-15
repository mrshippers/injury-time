-- The captain belongs to a side, not to the club: picked in the squad room, saved with the eleven.
alter table public.lineups add column if not exists captain uuid references public.players (id) on delete set null;

-- When answers close for a match. Null means no deadline. The existing fixtures write policies cover it.
alter table public.fixtures add column if not exists calls_close_at timestamptz;
