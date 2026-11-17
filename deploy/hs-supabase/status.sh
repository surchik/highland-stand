#!/usr/bin/env bash
# Shows the state of Highland Stand's own Supabase. Reads only; prints no secret.
#   ./status.sh
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
. "$HERE/lib.sh"
guard_home
need docker curl
[ -f "$HS_ENV" ] || die "no $HS_ENV: the stack is not installed (install.sh)"
say "Containers of the project $HS_PROJECT:"
hs_states
say "Published ports:"
for c in "${HS_CONTAINERS[@]}"; do docker port "$c" 2>/dev/null | sed "s/^/  $c  /" || true; done
say "GET /auth/v1/settings through the gateway on 127.0.0.1:$HS_GW_PORT (public information):"
gw_curl /auth/v1/settings || warn "the gateway did not answer"
printf '\n'
say "POST /rest/v1/rpc/hs_config (the game's schema; 200 once migrate.sh has run):"
gw_curl /rest/v1/rpc/hs_config -o /dev/null -w '  %{http_code}\n' -X POST -H 'Content-Type: application/json' -H 'Content-Profile: highland' --data '{}' || true
