#!/usr/bin/env bash
# Rebuilds the stack's .env from its own containers, when the folder ~/highland-supabase lost its files but Docker
# kept the containers (stopped or failing) and the database's volume. Run on the server as the user deploy:
#
#   ./recover-env.sh            writes ~/highland-supabase/.env (mode 600) from hs-db, hs-auth, hs-rest and hs-gw
#
# Why: the .env holds the database's password and the JWT secret that signed the anon key in the page. The
# volume highland-db-data was created with that password, and every player's session and the page's anon key were
# signed with that secret. A new .env (install.sh on an empty folder) would make new ones: the database would
# refuse the stack, and the page's key and every sign-in would stop working. The containers still carry the old
# values in their settings (docker inspect), so they are copied from there.
#
# It never prints a value of a secret: only the names of the keys it wrote, whether the copies agree with each
# other, the public claims of the two API keys (gen-env.js --verify), and the first characters of the anon key,
# which is public (it is in the page). It changes nothing in Docker. It refuses to overwrite an existing .env.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
. "$HERE/lib.sh"

command -v docker >/dev/null || die "docker is not installed or not on the PATH"
command -v node >/dev/null || die "node is not installed (gen-env.js --verify needs it)"
[ -d "$HS_HOME" ] || die "no $HS_HOME"
[ -w "$HS_HOME" ] || die "$HS_HOME is not writable by $(id -un): sudo chown -R $(id -un):$(id -un) $HS_HOME first"
[ ! -e "$HS_ENV" ] || die "$HS_ENV exists already; nothing was changed (move it aside first if it is the broken one)"
for c in hs-db hs-auth hs-rest hs-gw; do
  docker inspect "$c" >/dev/null 2>&1 || die "no container $c: there is nothing to recover the settings from"
  p="$(docker inspect "$c" --format '{{ index .Config.Labels "com.docker.compose.project" }}')"
  [ "$p" = "$HS_PROJECT" ] || die "the container $c is not this project's (its project: '${p:-none}'); nothing was changed"
done

# the value of KEY in container C's settings (empty when it has none); never printed
get() { docker inspect "$1" --format '{{range .Config.Env}}{{println .}}{{end}}' | sed -n "s/^$2=//p" | head -1; }

# NAME  CONTAINER  ITS VARIABLE (as docker-compose.slim.yml maps them)
MAP="
POSTGRES_PASSWORD hs-db POSTGRES_PASSWORD
JWT_SECRET hs-auth GOTRUE_JWT_SECRET
ANON_KEY hs-gw ANON_KEY
SERVICE_ROLE_KEY hs-gw SERVICE_ROLE_KEY
DASHBOARD_USERNAME hs-gw DASHBOARD_USERNAME
DASHBOARD_PASSWORD hs-gw DASHBOARD_PASSWORD
SUPABASE_PUBLIC_URL hs-gw SUPABASE_PUBLIC_URL
API_EXTERNAL_URL hs-auth API_EXTERNAL_URL
SITE_URL hs-auth GOTRUE_SITE_URL
ADDITIONAL_REDIRECT_URLS hs-auth GOTRUE_URI_ALLOW_LIST
JWT_EXPIRY hs-auth GOTRUE_JWT_EXP
DISABLE_SIGNUP hs-auth GOTRUE_DISABLE_SIGNUP
ENABLE_EMAIL_SIGNUP hs-auth GOTRUE_EXTERNAL_EMAIL_ENABLED
ENABLE_EMAIL_AUTOCONFIRM hs-auth GOTRUE_MAILER_AUTOCONFIRM
ENABLE_ANONYMOUS_USERS hs-auth GOTRUE_EXTERNAL_ANONYMOUS_USERS_ENABLED
ENABLE_PHONE_SIGNUP hs-auth GOTRUE_EXTERNAL_PHONE_ENABLED
ENABLE_PHONE_AUTOCONFIRM hs-auth GOTRUE_SMS_AUTOCONFIRM
PGRST_DB_SCHEMAS hs-rest PGRST_DB_SCHEMAS
PGRST_DB_MAX_ROWS hs-rest PGRST_DB_MAX_ROWS
PGRST_DB_EXTRA_SEARCH_PATH hs-rest PGRST_DB_EXTRA_SEARCH_PATH
GOOGLE_ENABLED hs-auth GOTRUE_EXTERNAL_GOOGLE_ENABLED
GOOGLE_CLIENT_ID hs-auth GOTRUE_EXTERNAL_GOOGLE_CLIENT_ID
GOOGLE_SECRET hs-auth GOTRUE_EXTERNAL_GOOGLE_SECRET
FACEBOOK_ENABLED hs-auth GOTRUE_EXTERNAL_FACEBOOK_ENABLED
FACEBOOK_CLIENT_ID hs-auth GOTRUE_EXTERNAL_FACEBOOK_CLIENT_ID
FACEBOOK_SECRET hs-auth GOTRUE_EXTERNAL_FACEBOOK_SECRET
DISCORD_ENABLED hs-auth GOTRUE_EXTERNAL_DISCORD_ENABLED
DISCORD_CLIENT_ID hs-auth GOTRUE_EXTERNAL_DISCORD_CLIENT_ID
DISCORD_SECRET hs-auth GOTRUE_EXTERNAL_DISCORD_SECRET
"
# without these the stack cannot keep its data or its keys: refuse rather than let install.sh make new ones
MUST="POSTGRES_PASSWORD JWT_SECRET ANON_KEY SERVICE_ROLE_KEY"

# the copies must agree with each other: the same password and the same secret wherever the containers hold them
pw="$(get hs-db POSTGRES_PASSWORD)"; js="$(get hs-auth GOTRUE_JWT_SECRET)"
[ -n "$pw" ] && [ -n "$js" ] || die "hs-db has no POSTGRES_PASSWORD or hs-auth no GOTRUE_JWT_SECRET; nothing was written"
[ "$(get hs-auth GOTRUE_DB_DATABASE_URL)" = "postgres://supabase_auth_admin:$pw@db:5432/postgres" ] ||
  die "hs-auth's database address does not carry hs-db's password; nothing was written"
[ "$(get hs-rest PGRST_DB_URI)" = "postgres://authenticator:$pw@db:5432/postgres" ] ||
  die "hs-rest's database address does not carry hs-db's password; nothing was written"
[ "$(get hs-rest PGRST_JWT_SECRET)" = "$js" ] || die "hs-rest and hs-auth hold different JWT secrets; nothing was written"
unset pw js
say "  the containers agree: one database password, one JWT secret"

tmp="$HS_HOME/.env.recover.$$"
trap 'rm -f "$tmp"' EXIT
umask 077
{
  printf '# SECRETS: never print, paste or commit this file. Only ANON_KEY and the address are public.\n'
  printf '# recovered by recover-env.sh on %s from the containers hs-db, hs-auth, hs-rest and hs-gw\n' "$(date -u +%FT%TZ)"
} > "$tmp"
wrote=""; empty=""
while read -r name c var; do
  [ -n "$name" ] || continue
  v="$(get "$c" "$var")"
  case " $MUST " in *" $name "*) [ -n "$v" ] || die "$c has no $var: $name cannot be recovered; nothing was written";; esac
  printf '%s=%s\n' "$name" "$v" >> "$tmp"
  if [ -n "$v" ]; then wrote="$wrote $name"; else empty="$empty $name"; fi
done <<< "$MAP"
unset v

say "  the API keys against the JWT secret:"
node "$HERE/gen-env.js" --verify "$tmp" || die "the recovered keys do not check out; nothing was written"
mv "$tmp" "$HS_ENV"; chmod 600 "$HS_ENV"; trap - EXIT
say "Wrote $HS_ENV (mode 600) with:$wrote"
[ -z "$empty" ] || say "Left empty (the containers had no value):$empty"
anon="$(sed -n 's/^ANON_KEY=//p' "$HS_ENV")"
say "The anon key (public, in the page) starts ${anon:0:24}... and ends ...${anon: -12}"
unset anon
say "Next: ./install.sh (it keeps this .env, writes the stack's other files again, and starts it), then ./status.sh"
