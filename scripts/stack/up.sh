#!/usr/bin/env bash
# A local Supabase-shaped stack for end-to-end tests, without Docker:
# Postgres 16, Supabase Auth (GoTrue) and PostgREST release binaries, a proxy
# that gives them one project URL, and an SMTP catcher for magic links.
#
#   eval "$(scripts/stack/up.sh)"   # exports the app's env; then npm run dev
#
# STACK_BIN must hold the `auth` and `postgrest` binaries and auth's
# migrations/ (from github.com/supabase/auth and PostgREST/postgrest releases).
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="${APP_ROOT:-$(cd "$(dirname "$0")/../.." && pwd)}"
BIN="${STACK_BIN:-/tmp/it-stack/bin}"
PGBIN="${PG_BIN:-/usr/lib/postgresql/16/bin}"
DIR="${STACK_DIR:-/tmp/it-stack/run}"
PG=54339 REST=54330 AUTH=54331 EDGE=54321 SMTP=2500
SECRET="local-stack-jwt-secret-not-for-anything-real-0000"
RUNAS=(); [ "$(id -u)" = "0" ] && RUNAS=(runuser -u postgres --)

# stop anything from a previous run
[ -f "$DIR/pids" ] && xargs -r kill <"$DIR/pids" 2>/dev/null || true
pkill -f "[a]uth serve" 2>/dev/null || true; pkill -f "[p]ostgrest $DIR" 2>/dev/null || true; pkill -f "[s]cripts/stack/edge.mjs" 2>/dev/null || true
sleep 0.3
[ -f "$DIR/pg/postmaster.pid" ] && "${RUNAS[@]}" "$PGBIN/pg_ctl" -D "$DIR/pg" -m immediate stop >/dev/null 2>&1 || true
rm -rf "$DIR"; mkdir -p "$DIR/pg"; [ "$(id -u)" = "0" ] && chown -R postgres "$DIR/pg"

"${RUNAS[@]}" "$PGBIN/initdb" -D "$DIR/pg" -U postgres -A trust >/dev/null
"${RUNAS[@]}" "$PGBIN/pg_ctl" -D "$DIR/pg" -o "-p $PG -k /tmp -c listen_addresses=127.0.0.1 -c wal_level=logical" -l "$DIR/pg/server.log" -w start >/dev/null
URL="postgresql://postgres@127.0.0.1:$PG/postgres"
psql -Xq -v ON_ERROR_STOP=1 "$URL" >/dev/null 2>&1 <<SQL
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create role authenticator login noinherit;
grant anon, authenticated, service_role to authenticator;
create schema auth;
create publication supabase_realtime;
SQL

# Supabase Auth makes its own schema
( cd "$BIN" && GOTRUE_DB_DRIVER=postgres DATABASE_URL="$URL?sslmode=disable&search_path=auth" GOTRUE_DB_NAMESPACE=auth \
  GOTRUE_DB_MIGRATIONS_PATH="$BIN/migrations" API_EXTERNAL_URL="http://localhost:$EDGE/auth/v1" GOTRUE_SITE_URL=http://localhost:3100 \
  GOTRUE_JWT_SECRET="$SECRET" ./auth migrate >"$DIR/auth-migrate.log" 2>&1 )
psql -Xq -v ON_ERROR_STOP=1 "$URL" >/dev/null <<SQL
grant usage on schema auth to anon, authenticated, service_role;
grant execute on all functions in schema auth to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
SQL
for f in "$ROOT"/supabase/migrations/*.sql; do
  psql -Xq -v ON_ERROR_STOP=1 "$URL" -f "$f" >/dev/null 2>"$DIR/migrate.err" || { echo "migration failed: $f" >&2; cat "$DIR/migrate.err" >&2; exit 1; }
done
psql -Xq "$URL" -c "grant all on all tables in schema public to service_role; grant all on all sequences in schema public to service_role;" >/dev/null
# the fictional demo club, anchored to today, as the nightly job does
# (prod set Kilburn's slug and opened it to try by hand; the migrations key on the slug, so do it first)
psql -Xq "$URL" -c "update public.clubs set slug = 'kilburn-athletic', demo_writable = true, season_source = 'manual' where is_demo and name = 'Kilburn Athletic'" >/dev/null
( cd "$ROOT" && npx tsx scripts/gen-seed-sql.ts ) | psql -Xq -v ON_ERROR_STOP=1 "$URL" >/dev/null 2>"$DIR/seed.err" || echo "seed: $(head -3 "$DIR/seed.err")" >&2
psql -Xq -v ON_ERROR_STOP=1 "$URL" -f "$ROOT/scripts/seed-film-examples.sql" >/dev/null 2>>"$DIR/seed.err" || echo "film seed: $(tail -3 "$DIR/seed.err")" >&2

cat >"$DIR/postgrest.conf" <<CONF
db-uri = "postgresql://authenticator@127.0.0.1:$PG/postgres"
db-schemas = "public"
db-anon-role = "anon"
jwt-secret = "$SECRET"
server-host = "127.0.0.1"
server-port = $REST
CONF
"$BIN/postgrest" "$DIR/postgrest.conf" >"$DIR/postgrest.log" 2>&1 & echo $! >>"$DIR/pids"

( cd "$BIN" && GOTRUE_DB_DRIVER=postgres DATABASE_URL="$URL?sslmode=disable&search_path=auth" GOTRUE_DB_NAMESPACE=auth \
  GOTRUE_DB_MIGRATIONS_PATH="$BIN/migrations" GOTRUE_API_HOST=127.0.0.1 PORT=$AUTH API_EXTERNAL_URL="http://localhost:$EDGE/auth/v1" \
  GOTRUE_SITE_URL=http://localhost:3100 GOTRUE_URI_ALLOW_LIST="http://localhost:3100/**" GOTRUE_JWT_SECRET="$SECRET" GOTRUE_JWT_EXP=3600 \
  GOTRUE_JWT_AUD=authenticated GOTRUE_JWT_DEFAULT_GROUP_NAME=authenticated GOTRUE_JWT_ADMIN_ROLES=service_role \
  GOTRUE_EXTERNAL_EMAIL_ENABLED=true GOTRUE_DISABLE_SIGNUP=false GOTRUE_MAILER_AUTOCONFIRM=false \
  GOTRUE_SMTP_HOST=127.0.0.1 GOTRUE_SMTP_PORT=$SMTP GOTRUE_SMTP_ADMIN_EMAIL=noreply@injury-time.local GOTRUE_SMTP_SENDER_NAME="injury time" \
  GOTRUE_MAILER_URLPATHS_CONFIRMATION=/auth/v1/verify GOTRUE_MAILER_URLPATHS_RECOVERY=/auth/v1/verify GOTRUE_MAILER_URLPATHS_INVITE=/auth/v1/verify GOTRUE_MAILER_URLPATHS_EMAIL_CHANGE=/auth/v1/verify \
  GOTRUE_RATE_LIMIT_EMAIL_SENT=10000 GOTRUE_SMTP_MAX_FREQUENCY=1s GOTRUE_LOG_LEVEL=warn \
  ./auth serve >"$DIR/auth.log" 2>&1 & echo $! >>"$DIR/pids" )

EDGE_PORT=$EDGE REST_PORT=$REST AUTH_PORT=$AUTH SMTP_PORT=$SMTP node "$HERE/edge.mjs" >"$DIR/edge.log" 2>&1 & echo $! >>"$DIR/pids"

for i in $(seq 1 150); do
  curl -sf "http://127.0.0.1:$EDGE/auth/v1/health" >/dev/null 2>&1 && curl -sf "http://127.0.0.1:$EDGE/rest/v1/" >/dev/null 2>&1 && break
  sleep 0.2
done
curl -sf "http://127.0.0.1:$EDGE/auth/v1/health" >/dev/null || { echo "auth did not come up:" >&2; tail -20 "$DIR/auth.log" >&2; exit 1; }

echo "export NEXT_PUBLIC_SUPABASE_URL='http://localhost:$EDGE'"
node "$HERE/keys.mjs" "$SECRET"
echo "export STACK_PGURL='$URL'"
