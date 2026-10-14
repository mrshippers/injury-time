#!/usr/bin/env bash
# A throwaway Postgres 16 with every migration applied, for the RLS probe and
# the consent tests. No Docker, no Supabase CLI: initdb in a temp dir, the shim,
# then supabase/migrations in order. Prints the connection string on stdout.
#   eval "$(scripts/db/local.sh)"   # exports PGURL
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
BIN="${PG_BIN:-/usr/lib/postgresql/16/bin}"
DIR="${PG_DIR:-/tmp/injury-time-pg}"
PORT="${PG_PORT:-54329}"
RUNAS=()
[ "$(id -u)" = "0" ] && RUNAS=(runuser -u postgres --)
if [ -f "$DIR/postmaster.pid" ]; then "${RUNAS[@]}" "$BIN/pg_ctl" -D "$DIR" -m immediate stop >/dev/null 2>&1 || true; fi
rm -rf "$DIR"; mkdir -p "$DIR"; [ "$(id -u)" = "0" ] && chown postgres "$DIR"
"${RUNAS[@]}" "$BIN/initdb" -D "$DIR" -U postgres -A trust >/dev/null
"${RUNAS[@]}" "$BIN/pg_ctl" -D "$DIR" -o "-p $PORT -k /tmp -c listen_addresses='' -c wal_level=logical" -l "$DIR/log" -w start >/dev/null
URL="postgresql://postgres@/postgres?host=/tmp&port=$PORT"
psql -q -v ON_ERROR_STOP=1 "$URL" -f "$ROOT/scripts/db/supabase-shim.sql" >/dev/null
for f in "$ROOT"/supabase/migrations/*.sql; do
  [ -n "${UPTO:-}" ] && [[ "$(basename "$f")" > "$UPTO" ]] && continue
  psql -q -v ON_ERROR_STOP=1 "$URL" -f "$f" >/dev/null 2>"$DIR/migrate.err" || { echo "migration failed: $f" >&2; cat "$DIR/migrate.err" >&2; exit 1; }
done
echo "export PGURL='$URL'"
