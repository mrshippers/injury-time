-- Two example clips for the Kilburn Athletic demo club. Player ids are looked
-- up by name so this survives a re-seed of the squad. Re-run after any
-- `gen-seed-sql` run; then press "analyse" on the tagged clip (or leave it,
-- the analysis is a real call and costs money).
do $$
declare cid uuid;
declare p_gk uuid; declare p_fw uuid; declare p_mf8 uuid; declare p_mf7 uuid;
begin
  select id into cid from public.clubs where name = 'Kilburn Athletic' limit 1;
  if cid is null then raise exception 'no Kilburn Athletic club'; end if;
  update public.clubs set slug = 'kilburn-athletic' where id = cid and slug is null;
  select id into p_gk  from public.players where club_id = cid and name = 'Marcus Oyelaran' limit 1;
  select id into p_fw  from public.players where club_id = cid and name = 'Bobby Ashworth' limit 1;
  select id into p_mf8 from public.players where club_id = cid and name = 'Danny Szymanski' limit 1;
  select id into p_mf7 from public.players where club_id = cid and name = 'Kofi Asante' limit 1;
  delete from public.clips where club_id = cid and title like 'example:%';
  insert into public.clips (club_id, source, url, title, match_date, opponent, events, status) values
  (cid, 'youtube', 'https://www.youtube.com/watch?v=7JXl3C_8YVQ', 'example: first half v New Salamis', '2026-08-29', 'New Salamis',
    jsonb_build_array(
      jsonb_build_object('t', 95,   'kind', 'save',      'player_id', p_gk,  'note', 'one on one, stood up, big hands'),
      jsonb_build_object('t', 312,  'kind', 'goal',      'player_id', p_fw,  'note', 'far post from a corner, unmarked'),
      jsonb_build_object('t', 1410, 'kind', 'turnover',  'player_id', p_mf8, 'note', 'lost it in our half, they broke three on two'),
      jsonb_build_object('t', 2005, 'kind', 'set_piece', 'player_id', p_mf7, 'note', 'short corner routine, cut back to the edge')
    ), 'tagged'),
  (cid, 'youtube', 'https://www.youtube.com/watch?v=JWdZhr4dfdA', 'example: untagged film, second half', '2026-08-29', 'New Salamis', '[]'::jsonb, 'new');
end $$;
select id, title, status, jsonb_array_length(events) as events from public.clips where title like 'example:%' order by created_at;
