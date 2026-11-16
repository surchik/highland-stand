#!/usr/bin/env bash
# Runs the game's migrations (deploy/supabase/migrations, by tools/platform/migrate.js) into the new database.
#
#   ./migrate.sh              status, a dry run, then up, then status again
#   ./migrate.sh --status     status only (changes nothing)
#
# The game's repository (branch next) is cloned into ~/highland-supabase/game, or updated there when it already
# is. To use a checkout you already have on the server instead, name it:  HS_GAME_DIR=/path/to/highland-stand
# ./migrate.sh  (it is then used as it is: not fetched, not changed).
#
# The database password is read from ~/highland-supabase/.env into the variable PGPASSWORD of the migration tool
# alone. It is never printed and never on a command line (the tool refuses a password in its address).
# Before a change to a schema that already exists, the schema highland is dumped to ~/highland-supabase/backups.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
. "$HERE/lib.sh"

REPO="${HS_GAME_REPO:-https://github.com/surchik/highland-stand}"
BRANCH="next"
DSN="postgres://postgres@127.0.0.1:$HS_DB_PORT/postgres"
STATUS_ONLY=0
case "${1:-}" in
  "") ;;
  --status) STATUS_ONLY=1;;
  *) die "usage: ./migrate.sh [--status]";;
esac

guard_home
need docker node npm git curl
[ -f "$HS_ENV" ] || die "no $HS_ENV: the stack is not installed (install.sh)"
env_get POSTGRES_PASSWORD >/dev/null || die "no POSTGRES_PASSWORD in $HS_ENV"
guard_names
# hs-auth healthy means the Auth service has made its tables (auth.users, auth.identities), which the game's
# tables and functions point at
[ "$(hs_health hs-db)" = healthy ] || die "hs-db is not healthy: start the stack first (install.sh)"
[ "$(hs_health hs-auth)" = healthy ] || die "hs-auth is not healthy: the Auth service must have made its tables first (./status.sh)"

# ---- the game's repository ------------------------------------------------------------------------------------
if [ -n "${HS_GAME_DIR:-}" ]; then
  GAME="$HS_GAME_DIR"
  [ -f "$GAME/tools/platform/migrate.js" ] || die "$GAME is not a checkout of the game (no tools/platform/migrate.js)"
  say "Using the checkout $GAME as it is"
else
  GAME="$HS_HOME/game"
  export GIT_TERMINAL_PROMPT=0     # a private repository fails at once instead of asking for a name and a token
  if [ ! -d "$GAME/.git" ]; then
    [ ! -e "$GAME" ] || die "$GAME exists and is not a git checkout: move it away first"
    say "Cloning $REPO (branch $BRANCH) into $GAME"
    if ! git clone --quiet --branch "$BRANCH" --single-branch "$REPO" "$GAME"; then
      rm -rf "$GAME"
      cat >&2 <<EOF
STOPPED: the clone failed. If the repository is private, this server needs a way in. Any one of:
  - GitHub's CLI, signed in as you:   gh auth login   then
        gh repo clone surchik/highland-stand "$GAME" -- --branch $BRANCH --single-branch
  - a read-only deploy key: add this server's public key under the repository's Settings, Deploy keys, then
        HS_GAME_REPO=git@github.com:surchik/highland-stand.git ./migrate.sh
  - copy your own checkout of the branch $BRANCH to the server (scp or rsync) and name it:
        HS_GAME_DIR=/path/to/highland-stand ./migrate.sh
Do not type a token into a command or paste one anywhere. Nothing was changed in the database.
EOF
      exit 1
    fi
  else
    say "Updating $GAME (branch $BRANCH)"
    [ -z "$(git -C "$GAME" status --porcelain --untracked-files=no)" ] || die "$GAME has local changes: this script never overwrites them. Look with: git -C $GAME status"
    git -C "$GAME" fetch --quiet origin "$BRANCH" || die "could not fetch from the repository (see the ways in above: gh, a deploy key, or HS_GAME_DIR)"
    git -C "$GAME" checkout --quiet "$BRANCH"
    git -C "$GAME" merge --quiet --ff-only "origin/$BRANCH" || die "$GAME cannot be fast-forwarded to origin/$BRANCH"
  fi
fi
if [ -d "$GAME/.git" ] || [ -f "$GAME/.git" ]; then
  say "  the game is at commit $(git -C "$GAME" rev-parse --short HEAD 2>/dev/null || echo '?') ($(git -C "$GAME" log -1 --format=%cd --date=short 2>/dev/null || echo '?'))"
fi
[ -f "$GAME/tools/platform/migrate.js" ] || die "no tools/platform/migrate.js in $GAME"

say "Installing the tool's one dependency (pg)"
npm install --prefix "$GAME/tools/platform" --no-audit --no-fund --no-update-notifier --loglevel=error

# the tool, with the password in its environment only
mig() { PGPASSWORD="$(env_get POSTGRES_PASSWORD)" node "$GAME/tools/platform/migrate.js" "$@" --dsn="$DSN"; }

say "--- status"
out="$(mig status)" || { printf '%s\n' "$out"; die "the migration tool could not read the database"; }
printf '%s\n' "$out"
[ "$STATUS_ONLY" = 0 ] || exit 0
at="$(printf '%s\n' "$out" | sed -n 's/.*highland at \([0-9][0-9]*\) of \([0-9][0-9]*\).*/\1/p' | head -1)"
of="$(printf '%s\n' "$out" | sed -n 's/.*highland at \([0-9][0-9]*\) of \([0-9][0-9]*\).*/\2/p' | head -1)"
[ -n "$at" ] && [ -n "$of" ] || die "could not read where the database stands from the tool's answer"

say "--- what would run (dry run, changes nothing)"
mig up --dry-run

if [ "$at" -gt 0 ] && [ "$at" -lt "$of" ]; then
  # a schema with data in it is about to change: its copy first (pg_dump runs inside the database's container,
  # which already holds the password in its own environment)
  mkdir -p "$HS_HOME/backups"; chmod 700 "$HS_HOME/backups"
  dump="$HS_HOME/backups/highland-$(stamp).dump"
  say "--- a backup of the schema highland first: $dump"
  if ! (umask 077 && docker exec hs-db pg_dump -U postgres -h 127.0.0.1 -d postgres -n highland -Fc > "$dump") || [ ! -s "$dump" ]; then
    rm -f "$dump"
    die "the backup failed, so nothing was applied"
  fi
fi

say "--- up"
mig up
say "--- status"
mig status

say "--- the API (through the gateway on 127.0.0.1:$HS_GW_PORT)"
check() { gw_curl /rest/v1/rpc/hs_config -o /dev/null -w '%{http_code}' -X POST -H 'Content-Type: application/json' -H 'Content-Profile: highland' --data '{}' || true; }
code="$(check)"
if [ "$code" != 200 ]; then
  # migration 003 tells PostgREST to read the schema again; if it did not hear, restarting it does the same
  say "  hs_config answered $code: restarting the API container (hs-rest) so it reads the new schema"
  dc restart rest
  wait_healthy 60 hs-rest || true
  sleep 2
  code="$(check)"
fi
[ "$code" = 200 ] || die "POST /rest/v1/rpc/hs_config answers $code, not 200: the migrations are in, but the API does not serve the schema highland (./status.sh; PGRST_DB_SCHEMAS must hold highland)"
say "  POST /rest/v1/rpc/hs_config answers 200"
t="$(gw_curl '/rest/v1/hs_saves?select=*&limit=1' -o /dev/null -w '%{http_code}' -H 'Accept-Profile: highland' || true)"
say "  GET /rest/v1/hs_saves answers $t (401, 403 or 404 is right: no table is readable)"
say "Done."
