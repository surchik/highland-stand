#!/usr/bin/env bash
# Removes Highland Stand's own Supabase: the containers, the network and the volumes of the compose project
# "highland", and nothing else. THE DATABASE GOES WITH ITS VOLUME: every account, save, score and count.
#
#   ./uninstall.sh
#
# It asks you to type a sentence first. It leaves the folder ~/highland-supabase with its files, the .env and a
# timestamped copy of the .env (.env.removed-<time>, mode 600), and any dumps in backups/. A later install.sh in
# the same folder reuses that .env, so the page's anon key stays valid; delete the .env by hand for new secrets.
# It does not touch the existing stack (project "supabase"), Caddy (./caddy.sh --remove does that) or any image.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
. "$HERE/lib.sh"
guard_home
need docker
docker ps >/dev/null 2>&1 || die "this user cannot talk to Docker"

label="label=com.docker.compose.project=$HS_PROJECT"
cs="$(docker ps -aq --filter "$label")"
vs="$(docker volume ls -q --filter "$label")"
ns="$(docker network ls -q --filter "$label")"
if [ -z "$cs$vs$ns" ]; then say "Nothing of the project $HS_PROJECT exists in Docker. Nothing to remove."; exit 0; fi

say "This will remove, for the compose project \"$HS_PROJECT\" only:"
say "  containers:"; docker ps -a --filter "$label" --format '    {{.Names}}  ({{.State}})'
say "  volumes (THE DATABASE: all accounts and all of the game's data):"; docker volume ls --filter "$label" --format '    {{.Name}}'
say "  network:"; docker network ls --filter "$label" --format '    {{.Name}}'
say "A copy of the game's schema first, if you want one:"
say "  docker exec hs-db pg_dump -U postgres -h 127.0.0.1 -d postgres -n highland -Fc > ~/highland-$(stamp).dump"
[ -t 0 ] || die "this must be run at a terminal, to type the confirmation"
printf 'Type exactly  remove highland  to go on: '
IFS= read -r answer
[ "$answer" = "remove highland" ] || die "not confirmed. Nothing was removed."

if [ -f "$HS_ENV" ]; then
  keep="$HS_ENV.removed-$(stamp)"
  (umask 077 && cp -p "$HS_ENV" "$keep") && chmod 600 "$keep"
  say "  the .env is copied to $(basename "$keep")"
fi

if [ -f "$HS_COMPOSE" ] && [ -f "$HS_ENV" ]; then
  dc down --volumes --remove-orphans || warn "docker compose down did not finish: removing what is left by its label"
fi
# whatever is left of the project, by its label (also when the compose file is gone)
cs="$(docker ps -aq --filter "$label")"
# shellcheck disable=SC2086
[ -z "$cs" ] || docker rm -f $cs >/dev/null
vs="$(docker volume ls -q --filter "$label")"
# shellcheck disable=SC2086
[ -z "$vs" ] || docker volume rm $vs >/dev/null
ns="$(docker network ls -q --filter "$label")"
# shellcheck disable=SC2086
[ -z "$ns" ] || docker network rm $ns >/dev/null

left="$(docker ps -aq --filter "$label"; docker volume ls -q --filter "$label"; docker network ls -q --filter "$label")"
[ -z "$left" ] || die "something of the project is still there: $left"
say "Removed. The folder $HS_HOME is left as it is (its .env and the copy of it, the files, backups/)."
say "The public name: ./caddy.sh --remove takes the block for $HS_PUBLIC_HOST out of the Caddyfile."
