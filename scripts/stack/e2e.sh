#!/usr/bin/env bash
# End-to-end against the local stack: stack up, the app up on :3100, Playwright,
# everything down. Extra arguments go to Playwright.
#   scripts/stack/e2e.sh                       # the whole suite
#   scripts/stack/e2e.sh tests/e2e/signup.spec.ts
# APP_ROOT runs another checkout (a worktree of main, to compare) against the same stack.
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
APP="${APP_ROOT:-$(cd "$HERE/../.." && pwd)}"
ENVF="$(mktemp)"
"$HERE/up.sh" >"$ENVF" || exit 1
# shellcheck disable=SC1090
source "$ENVF"
export CALL_TOKEN_SECRET="${CALL_TOKEN_SECRET:-$(head -c 32 /dev/urandom | base64)}"
( cd "$APP" && exec npx next dev -p 3100 >/tmp/it-stack/run/next.log 2>&1 ) &
NEXT=$!
trap 'kill $NEXT 2>/dev/null; pkill -P $NEXT 2>/dev/null; xargs -r kill </tmp/it-stack/run/pids 2>/dev/null' EXIT
for _ in $(seq 1 90); do curl -sf -o /dev/null http://localhost:3100/login && break; sleep 1; done
cd "$APP" && BASE_URL=http://localhost:3100 npx playwright test --reporter=line "$@"
