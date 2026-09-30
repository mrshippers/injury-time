-- 0013: web push. One row per device a signed-in member turned notifications on
-- for. The browser's push endpoint and keys are the address; they are useless
-- without the server's VAPID private key, but still private: a member sees and
-- removes only their own devices, and only the service role reads the lot to send.

create table public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  club_id    uuid not null references public.clubs (id) on delete cascade,
  endpoint   text not null unique check (endpoint like 'https://%'),
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now()
);
create index push_subscriptions_club_idx on public.push_subscriptions (club_id);

alter table public.push_subscriptions enable row level security;

create policy push_subscriptions_own on public.push_subscriptions
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and private.is_club_member(club_id));

revoke all on public.push_subscriptions from anon;
grant select, insert, delete on public.push_subscriptions to authenticated;
