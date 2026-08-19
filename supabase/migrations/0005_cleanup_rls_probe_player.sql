-- Removes the row an anonymous PostgREST call inserted into the demo club while
-- proving the write path works. Kept as a migration so the repo and the live
-- database tell the same story; a no-op on a fresh database.
delete from public.players where name = 'RLS Probe Player';
