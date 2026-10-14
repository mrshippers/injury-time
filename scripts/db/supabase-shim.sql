-- The parts of a Supabase project the migrations lean on, for a bare Postgres:
-- the three API roles, auth.users and auth.uid(), the realtime publication.
-- auth.uid() reads the same setting PostgREST sets from the JWT, so a probe can
-- act as any user with: set local role authenticated; set local request.jwt.claim.sub = '<uuid>'.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
grant usage on schema public to anon, authenticated, service_role;
create schema auth;
grant usage on schema auth to anon, authenticated, service_role;
create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant execute on function auth.uid() to anon, authenticated, service_role;
create publication supabase_realtime;
