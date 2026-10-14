#!/usr/bin/env bash
# The two release binaries the local stack runs (scripts/stack/up.sh), pinned.
# Supabase Auth (GoTrue) and PostgREST, linux x64. Postgres 16 and psql come
# from the system (apt install postgresql-16).
set -euo pipefail
BIN="${STACK_BIN:-/tmp/it-stack/bin}"
mkdir -p "$BIN"
curl -fsSL https://github.com/PostgREST/postgrest/releases/download/v12.2.3/postgrest-v12.2.3-linux-static-x64.tar.xz | tar -xJ -C "$BIN"
curl -fsSL https://github.com/supabase/auth/releases/download/v2.169.0/auth-v2.169.0-x86.tar.gz | tar -xz -C "$BIN"
echo "auth, postgrest and auth's migrations in $BIN"
