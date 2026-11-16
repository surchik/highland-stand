#!/usr/bin/env bash
# Turns one sign-in provider on (or off) for Highland Stand's own Supabase.
#
#   ./providers.sh google        asks for Google's client ID and client secret, then turns Google on
#   ./providers.sh facebook      the same for Facebook (the "App ID" and "App secret")
#   ./providers.sh discord       the same for Discord
#   ./providers.sh google --off  turns the provider off (its ID and secret stay in the .env)
#
# The two values are typed at hidden prompts on the server (nothing shows as you type or paste) and go into
# ~/highland-supabase/.env only: never on a command line, never in the shell history, never printed. The .env is
# backed up first (.env.bak-<time>, mode 600), and only the Auth container is recreated to read the new values:
# the database, the API and the gateway keep running. Sign-in is away for a few seconds.
#
# In the provider's console, the callback (redirect) address is:  https://hs-db.avunjian.com/auth/v1/callback
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
. "$HERE/lib.sh"

name="${1:-}"; off=0
[ "${2:-}" = "--off" ] && off=1
case "$name" in
  google|facebook|discord) ;;
  *) die "usage: ./providers.sh google|facebook|discord [--off]";;
esac
NAME="$(printf '%s' "$name" | tr '[:lower:]' '[:upper:]')"

guard_home
need docker curl
[ -f "$HS_ENV" ] || die "no $HS_ENV: the stack is not installed (install.sh)"
[ -f "$HS_COMPOSE" ] || die "no $HS_COMPOSE: the stack is not installed (install.sh)"
grep -q "GOTRUE_EXTERNAL_${NAME}_ENABLED" "$HS_COMPOSE" || die "$HS_COMPOSE does not carry $name: run ./install.sh --force-recreate-config"
guard_names
[ "$(hs_health hs-db)" = healthy ] || die "hs-db is not healthy: start the stack first (install.sh)"

callback="$(env_get API_EXTERNAL_URL)/callback"

# ask LABEL: one value from a hidden prompt, into the variable REPLY_VALUE. Never echoed.
ask() {
  local v=""
  if [ -t 0 ]; then printf '%s (hidden): ' "$1" >&2; fi
  IFS= read -rs v || true
  if [ -t 0 ]; then printf '\n' >&2; fi
  # a pasted value often carries spaces or a line end: take them off
  v="${v#"${v%%[![:space:]]*}"}"; v="${v%"${v##*[![:space:]]}"}"
  REPLY_VALUE="$v"
}

if [ "$off" = 1 ]; then
  say "Turning $name off."
  bak="$(env_backup)"; say "  the .env is backed up as $(basename "$bak")"
  env_set "${NAME}_ENABLED" false
else
  say "Turning $name on. In $name's console the callback address must be exactly:"
  say "  $callback"
  ask "$name client ID"; id="$REPLY_VALUE"
  ask "$name client secret"; secret="$REPLY_VALUE"
  REPLY_VALUE=""
  [ -n "$id" ] || die "the client ID is empty. Nothing was changed."
  [ -n "$secret" ] || die "the client secret is empty. Nothing was changed."
  # shellcheck disable=SC1003
  case "$id$secret" in
    *[[:space:]]*|*"'"*|*'"'*|*'$'*|*'\'*|*'`'*) die "a value holds a space, a quote, a dollar sign or a backslash: that is not what $name gives. Nothing was changed.";;
  esac
  [ "$id" != "$secret" ] || die "the ID and the secret are the same text: one was pasted twice. Nothing was changed."
  bak="$(env_backup)"; say "  the .env is backed up as $(basename "$bak")"
  env_set "${NAME}_ENABLED" true "${NAME}_CLIENT_ID" "$id" "${NAME}_SECRET" "$secret"
  say "  written to the .env: ${NAME}_ENABLED, ${NAME}_CLIENT_ID (${#id} characters), ${NAME}_SECRET (${#secret} characters)"
  id=""; secret=""
fi

undo() {
  warn "putting the .env back from $(basename "$bak") and recreating the Auth container"
  cp -p "$bak" "$HS_ENV"; chmod 600 "$HS_ENV"
  dc up -d --no-deps auth || true
}

dc config --quiet || { cp -p "$bak" "$HS_ENV"; chmod 600 "$HS_ENV"; die "docker compose does not accept the new .env; it was put back. Nothing was restarted."; }

say "Recreating the Auth container only (hs-auth)"
dc up -d --no-deps auth
if ! wait_healthy "${HS_WAIT_SECONDS:-90}" hs-auth; then
  say "--- hs-auth did not become healthy; the end of its log (secrets replaced by ***):"
  docker logs --tail 25 hs-auth 2>&1 | redact || true
  undo
  die "the Auth service did not start with the new values; the previous .env is back"
fi

# what the Auth service now says (public information), and where it sends a browser for this provider
on="$(gw_curl /auth/v1/settings | tr -d ' \n' | grep -o "\"$name\":[a-z]*" | head -1 || true)"
say "  /auth/v1/settings says: ${on:-(no answer yet)}"
if [ "$off" = 0 ]; then
  to="$(curl -s -o /dev/null -w '%{http_code} %{redirect_url}' --max-time 10 "http://127.0.0.1:$HS_GW_PORT/auth/v1/authorize?provider=$name" || true)"
  host="$(printf '%s' "${to#* }" | sed -E 's#^(https?://[^/?]+).*#\1#')"
  say "  /auth/v1/authorize?provider=$name answers ${to%% *} and sends the browser to: ${host:-(nowhere)}"
  say "Done. Try a sign-in on https://highland.avunjian.com/next/ once the page has the two public values."
else
  say "Done. $name is off."
fi
