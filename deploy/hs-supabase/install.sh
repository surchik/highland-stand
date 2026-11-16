#!/usr/bin/env bash
# Installs Highland Stand's own Supabase beside the existing one: a slim stack (db, auth, rest, gateway) in
# ~/highland-supabase, compose project "highland", containers hs-db hs-auth hs-rest hs-gw, the gateway on
# 127.0.0.1:8200 and Postgres on 127.0.0.1:55632. Run on the server as the user deploy:
#
#   ./install.sh                           a first install, or bring a stopped stack back up
#   ./install.sh --force-recreate-config   also when the stack is running: rewrite its files (see below)
#   ./install.sh --prepare-only            make the folder and its files, start nothing (needs no Docker daemon)
#
# It never touches ~/supabase-project, the existing containers, their networks or volumes, Caddy, sshd or the
# firewall. It prints no secret: the .env it writes (mode 600) is the only place they are.
#
# Running it again:
#   - no stack running: the files are refreshed from this folder, the .env is kept (a missing key is added, an
#     existing one is never changed), and the stack is started.
#   - a stack running: it stops there and changes nothing, unless --force-recreate-config is given. With it, the
#     .env and docker-compose.yml are backed up with a timestamp, the compose file and the gateway's and
#     database's files are written again from this folder, missing .env keys are added, and "docker compose up -d"
#     recreates only the containers whose configuration changed (a few seconds without sign-in or API).
#   - in no case is a secret made again or a volume removed: the database was created with the password in
#     the .env, and the page holds the anon key. To start from nothing, run uninstall.sh first.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
. "$HERE/lib.sh"

# ---- the official files this stack uses, pinned: supabase/supabase at this commit, folder docker/ --------------
PIN_SHA="d17e66f202f95c2cb7d99b4effdba5d5d83e0131"
PIN_BASE="https://raw.githubusercontent.com/supabase/supabase/$PIN_SHA/docker"
# sha256 of each file as it was read when this installer was written; a file that differs is refused
PIN_FILES=(
  "91d706ea68ae8bc194aa278680a91c486f642f1e7ee89a1ebc096d4f72c9c157  docker-compose.yml"
  "3697f23b0be9ec5b829f937c600eb9b878f1f778ab510b42ad5e4f14742447e9  volumes/api/envoy/envoy.yaml"
  "9f2df9e1355cbeda3ecca809bffca9ed439bb18a66b82ca07caf97e27c34c291  volumes/api/envoy/cds.yaml"
  "51496623f48fe6178634fdd71efa72ec88ee46692a963cf8ec137ff667d9c52a  volumes/api/envoy/lds.template.yaml"
  "8a0c9503764de32ba39e0d81e73629457b13ec42ef19897e30e4918c996d0508  volumes/api/envoy/docker-entrypoint.sh"
  "9dce462adc04137d6afabcf28efa60a6c355270a4b32d7af58891ac4eb964c5f  volumes/db/_supabase.sql"
  "c1d3f5c01e44646c2e533c5a1c111821cc49cb5a4c2534e08cddad61d8fb0339  volumes/db/jwt.sql"
  "f0463ce5030907acef49326d2bffd36002df0718035071be7c99bd7fc897c63d  volumes/db/logs.sql"
  "df97ebe148d94cfb92a5e37ebf972dfd496be195f0915ecf14396b2cf50efecb  volumes/db/pooler.sql"
  "7e9e442e7fc4dae05544c07b67bede37a00d84644304dfce4d937134cb4c8f88  volumes/db/realtime.sql"
  "3ad717b225daa38aa982da26750f35641eb404e1eb5e69a763c22236ab96c1b2  volumes/db/roles.sql"
  "05a61316b899374253891cbba66ce073d9273f33983c3f47961eda3aa26c2823  volumes/db/webhooks.sql"
)
# The one change made to an official file: the gateway's CORS answer names the headers the page sends beside the
# wildcard. Upstream answers "access-control-allow-headers: *" alone, and by the Fetch standard the wildcard does
# not cover Authorization, which the page sends on every call. This is the sha256 of the file after the change.
LDS_ALLOW_HEADERS='authorization,apikey,content-type,accept,accept-profile,content-profile,prefer,range,x-client-info,x-supabase-api-version,*'
LDS_PATCHED_SHA="60a7155cc857d8b0808a15d0306f2cea2d590a1f33f84c6cde3c3d574a668bfa"

FORCE=0; PREPARE_ONLY=0
for a in "$@"; do
  case "$a" in
    --force-recreate-config) FORCE=1;;
    --prepare-only) PREPARE_ONLY=1;;
    -h|--help) sed -n '2,21p' "$0" | sed 's/^# \{0,1\}//'; exit 0;;
    *) die "unknown option $a (see --help)";;
  esac
done

sha_of() { sha256sum "$1" | cut -d' ' -f1; }

# fetch_pinned: every pinned file into $HS_HOME/upstream, checked against its sha256. A file already there with
# the right sum is not fetched again.
fetch_pinned() {
  local row want rel dst tmp
  for row in "${PIN_FILES[@]}"; do
    want="${row%%  *}"; rel="${row#*  }"; dst="$HS_HOME/upstream/$rel"
    if [ -f "$dst" ] && [ "$(sha_of "$dst")" = "$want" ]; then continue; fi
    mkdir -p "$(dirname "$dst")"
    tmp="$dst.part"
    curl -fsSL --retry 3 --max-time 60 -o "$tmp" "$PIN_BASE/$rel" || { rm -f "$tmp"; die "could not fetch $rel from GitHub at the pinned commit"; }
    if [ "$(sha_of "$tmp")" != "$want" ]; then rm -f "$tmp"; die "$rel is not the file this installer was written against (sha256 differs). Nothing was started."; fi
    mv -f "$tmp" "$dst"
  done
  say "  the official files of commit ${PIN_SHA:0:12}: ${#PIN_FILES[@]} fetched or already here, every sha256 matches"
}

# place_files: the gateway's and the database's files into ./volumes, readable by the containers' own users
# (they hold no secret: the keys are put in by the gateway's entrypoint, inside the container, from its environment)
place_files() {
  local f lds n
  mkdir -p "$HS_HOME/volumes/api/envoy" "$HS_HOME/volumes/db"
  for f in envoy.yaml cds.yaml docker-entrypoint.sh; do
    install -m 644 "$HS_HOME/upstream/volumes/api/envoy/$f" "$HS_HOME/volumes/api/envoy/$f"
  done
  for f in _supabase.sql jwt.sql logs.sql pooler.sql realtime.sql roles.sql webhooks.sql; do
    install -m 644 "$HS_HOME/upstream/volumes/db/$f" "$HS_HOME/volumes/db/$f"
  done
  lds="$HS_HOME/volumes/api/envoy/lds.template.yaml"
  n="$(grep -cE '^ {22}allow_headers: "\*"$' "$HS_HOME/upstream/volumes/api/envoy/lds.template.yaml" || true)"
  [ "$n" = 1 ] || die "the gateway's template does not have the one CORS line this installer changes (found $n)"
  sed -E "s/^( {22})allow_headers: \"\\*\"\$/\\1allow_headers: \"$LDS_ALLOW_HEADERS\"/" \
    "$HS_HOME/upstream/volumes/api/envoy/lds.template.yaml" > "$lds.new"
  [ "$(sha_of "$lds.new")" = "$LDS_PATCHED_SHA" ] || { rm -f "$lds.new"; die "the gateway's template after the CORS change is not what was reviewed (sha256 differs)"; }
  chmod 644 "$lds.new"; mv -f "$lds.new" "$lds"
  chmod 755 "$HS_HOME/volumes" "$HS_HOME/volumes/api" "$HS_HOME/volumes/api/envoy" "$HS_HOME/volumes/db"
  say "  the gateway's files (one reviewed CORS line changed) and the database's seven init scripts are in place"
}

# place_compose: this folder's slim compose as docker-compose.yml; its images must be the pinned compose's
place_compose() {
  local img
  while IFS= read -r img; do
    grep -qF "image: $img" "$HS_HOME/upstream/docker-compose.yml" || die "the slim compose uses the image $img, which the pinned official compose does not"
  done < <(sed -n 's/^ *image: *//p' "$HERE/docker-compose.slim.yml")
  if [ -f "$HS_COMPOSE" ] && ! cmp -s "$HERE/docker-compose.slim.yml" "$HS_COMPOSE"; then
    cp -p "$HS_COMPOSE" "$HS_COMPOSE.bak-$(stamp)"
    say "  docker-compose.yml differed from this installer's: the old one is kept as a .bak-<time> file"
  fi
  install -m 644 "$HERE/docker-compose.slim.yml" "$HS_COMPOSE"
}

port_free() {  # port_free PORT OUR_CONTAINER: free, or held by our own running container
  local port="$1" ours="$2"
  if ss -Hltn "sport = :$port" 2>/dev/null | grep -q .; then
    [ "$(hs_health "$ours")" != missing ] && docker port "$ours" 2>/dev/null | grep -q ":$port\$" && return 0
    return 1
  fi
  return 0
}

# ------------------------------------------------------------------------------------------------ start
guard_home
need curl node sha256sum sed grep install cmp
say "Highland Stand's own Supabase: $HS_HOME (project $HS_PROJECT)"

if [ "$PREPARE_ONLY" = 0 ]; then
  need docker ss
  docker compose version >/dev/null 2>&1 || die "docker compose (v2) is needed"
  docker ps >/dev/null 2>&1 || die "this user cannot talk to Docker (is it in the group docker?)"
  guard_names
  if [ -n "$(hs_running)" ] && [ "$FORCE" = 0 ]; then
    say "This stack is already running. Nothing was changed:"
    hs_states
    say "To rewrite its files and recreate what changed, run:  ./install.sh --force-recreate-config"
    exit 3
  fi
  port_free "$HS_GW_PORT" hs-gw || die "127.0.0.1:$HS_GW_PORT is already taken by something else. Nothing was changed."
  port_free "$HS_DB_PORT" hs-db || die "127.0.0.1:$HS_DB_PORT is already taken by something else. Nothing was changed."
fi

umask 077
mkdir -p "$HS_HOME"
chmod 700 "$HS_HOME"

if [ -f "$HS_ENV" ] && [ "$FORCE" = 1 ]; then
  say "  the .env is backed up as $(basename "$(env_backup)") (mode 600)"
fi

say "1. The official files, pinned"
fetch_pinned
place_files
place_compose

say "2. The .env (names only are shown, never a value)"
node "$HERE/gen-env.js" "$HS_ENV"
chmod 600 "$HS_ENV"
node "$HERE/gen-env.js" --verify "$HS_ENV" || die "the API keys in $HS_ENV do not match its JWT secret. Nothing was started."
# what the game needs, said out loud when the file was edited to something else (these values are not secrets)
for pair in "SITE_URL=https://highland.avunjian.com" "API_EXTERNAL_URL=$HS_PUBLIC_URL/auth/v1" "SUPABASE_PUBLIC_URL=$HS_PUBLIC_URL" \
            "PGRST_DB_SCHEMAS=public,graphql_public,highland" "DISABLE_SIGNUP=false" "ENABLE_EMAIL_SIGNUP=false" \
            "ENABLE_PHONE_SIGNUP=false" "ENABLE_ANONYMOUS_USERS=false" "ENABLE_EMAIL_AUTOCONFIRM=false" \
            "ADDITIONAL_REDIRECT_URLS=https://highland.avunjian.com/**,https://highland.avunjian.com/next/**"; do
  k="${pair%%=*}"; want="${pair#*=}"; have="$(env_get "$k" || true)"
  [ "$have" = "$want" ] || warn "$k in the .env is '$have'; this installer would have set '$want' (left as it is)"
done

say "3. The compose file"
if docker compose version >/dev/null 2>&1; then
  dc config --quiet || die "docker compose does not accept $HS_COMPOSE. Nothing was started."
  say "  docker compose accepts it"
else
  [ "$PREPARE_ONLY" = 1 ] || die "docker compose is needed"
  say "  (docker compose is not here: the file was not checked)"
fi

if [ "$PREPARE_ONLY" = 1 ]; then
  say "Prepared only: nothing was started. The folder is $HS_HOME"
  exit 0
fi

say "4. Starting (the first start pulls four images and creates the database: a few minutes)"
dc up -d --remove-orphans

say "5. Waiting for the four containers to be healthy (up to 5 minutes)"
if ! wait_healthy "${HS_WAIT_SECONDS:-300}" "${HS_CONTAINERS[@]}"; then
  hs_states
  for c in "${HS_CONTAINERS[@]}"; do
    h="$(hs_health "$c")"
    if [ "$h" != healthy ]; then
      say "--- $c is $h; the end of its log (secrets replaced by ***):"
      docker logs --tail 25 "$c" 2>&1 | redact || true
    fi
  done
  die "not every container became healthy. The stack is left as it is for you to look at; uninstall.sh removes it."
fi

say "6. What is running"
hs_states
# every published port must be on 127.0.0.1
bad="$(for c in "${HS_CONTAINERS[@]}"; do docker port "$c" 2>/dev/null; done | grep -v -- '-> 127\.0\.0\.1:' || true)"
[ -z "$bad" ] || die "a port is published beyond 127.0.0.1: $bad"
say "  published ports: only 127.0.0.1:$HS_GW_PORT (gateway) and 127.0.0.1:$HS_DB_PORT (Postgres)"

say "7. The Auth service's public settings, through the gateway (GET /auth/v1/settings):"
gw_curl /auth/v1/settings || warn "the gateway did not answer /auth/v1/settings yet; try again in a minute: ./status.sh"
printf '\n'
code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "http://127.0.0.1:$HS_GW_PORT/auth/v1/settings" || true)"
say "  the same without a key answers $code (401 is right: the gateway asks for the key)"
say "Done. Next: ./migrate.sh, then ./caddy.sh, then ./providers.sh google, then ./show-public.sh (README.md)."
