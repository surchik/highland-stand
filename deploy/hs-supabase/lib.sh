# shellcheck shell=bash
# Shared by the scripts of deploy/hs-supabase. Sourced, never run. Nothing here prints a secret.
# shellcheck disable=SC2034

HS_HOME="${HS_HOME:-$HOME/highland-supabase}"       # the new stack's folder (never ~/supabase-project)
HS_ENV="$HS_HOME/.env"
HS_COMPOSE="$HS_HOME/docker-compose.yml"
HS_PROJECT="highland"                               # the compose project; the existing stack's is "supabase"
HS_CONTAINERS=(hs-db hs-auth hs-rest hs-gw)
HS_GW_PORT=8200                                     # the gateway, on 127.0.0.1 only
HS_DB_PORT=55632                                    # Postgres, on 127.0.0.1 only (for the migrations)
HS_PUBLIC_URL="https://hs-db.avunjian.com"
HS_PUBLIC_HOST="hs-db.avunjian.com"

say()  { printf '%s\n' "$*"; }
warn() { printf 'WARNING: %s\n' "$*" >&2; }
die()  { printf 'STOPPED: %s\n' "$*" >&2; exit 1; }
stamp() { date +%Y%m%d-%H%M%S; }

need() { local c; for c in "$@"; do command -v "$c" >/dev/null 2>&1 || die "the command '$c' is needed and was not found"; done; }

# The existing stack lives in ~/supabase-project. No script of this folder may work there.
guard_home() {
  # (HS_ALLOW_ROOT=1 is for the tests of these scripts in a sandbox, never for the server)
  [ "$(id -u)" != 0 ] || [ "${HS_ALLOW_ROOT:-}" = 1 ] || die "run this as the user deploy, not as root"
  local other="$HOME/supabase-project" a b
  a="$(readlink -m -- "$HS_HOME")"; b="$(readlink -m -- "$other")"
  case "$a/" in "$b/"*) die "HS_HOME points into $other: that is the existing stack's folder and is never touched";; esac
}

# env_get KEY: the value of KEY in the .env (the last such line), without surrounding quotes. Bash only, so the
# value never appears on any command line.
env_get() {
  local key="$1" line v="" found=1
  [ -f "$HS_ENV" ] || return 1
  while IFS= read -r line || [ -n "$line" ]; do
    case "$line" in
      "$key="*) v="${line#*=}"; found=0;;
    esac
  done < "$HS_ENV"
  [ "$found" = 0 ] || return 1
  case "$v" in
    \'*\') v="${v#\'}"; v="${v%\'}";;
    \"*\") v="${v#\"}"; v="${v%\"}";;
  esac
  printf '%s' "$v"
}

# env_set KEY VALUE [KEY VALUE ...]: rewrites the .env with those keys set (replaced in place, or appended), in one
# atomic move, mode 600. Values are written in single quotes (docker compose reads them literally). Bash builtins
# only: no value is ever passed to another program.
env_set() {
  local tmp line k i hit
  local -a keys=() vals=() done_=()
  while [ "$#" -ge 2 ]; do
    case "$2" in *"'"*|*$'\n'*|*$'\r'*) die "the value for $1 holds a quote or a line break: not written";; esac
    keys+=("$1"); vals+=("$2"); done_+=(0); shift 2
  done
  [ -f "$HS_ENV" ] || die "no $HS_ENV: run install.sh first"
  tmp="$(umask 077 && mktemp "$HS_HOME/.env.new.XXXXXX")"
  while IFS= read -r line || [ -n "$line" ]; do
    hit=-1
    for i in "${!keys[@]}"; do
      k="${keys[$i]}"
      case "$line" in "$k="*) hit=$i;; esac
    done
    if [ "$hit" -ge 0 ]; then
      if [ "${done_[$hit]}" = 0 ]; then printf "%s='%s'\n" "${keys[$hit]}" "${vals[$hit]}" >> "$tmp"; done_[hit]=1; fi
    else
      printf '%s\n' "$line" >> "$tmp"
    fi
  done < "$HS_ENV"
  for i in "${!keys[@]}"; do
    [ "${done_[$i]}" = 1 ] || printf "%s='%s'\n" "${keys[$i]}" "${vals[$i]}" >> "$tmp"
  done
  chmod 600 "$tmp"
  mv -f "$tmp" "$HS_ENV"
}

# a timestamped copy of the .env beside it, mode 600; prints the copy's name
env_backup() {
  local b
  b="$HS_ENV.bak-$(stamp)"
  [ ! -e "$b" ] || b="$b-$$"     # never over an earlier copy
  (umask 077 && cp -p "$HS_ENV" "$b") && chmod 600 "$b"
  printf '%s' "$b"
}

# docker compose for this project and this folder only
dc() { docker compose --project-name "$HS_PROJECT" --project-directory "$HS_HOME" --env-file "$HS_ENV" -f "$HS_COMPOSE" "$@"; }

# the ids of this project's running containers
hs_running() { docker ps -q --filter "label=com.docker.compose.project=$HS_PROJECT"; }

# health of one container: healthy | unhealthy | starting | running | exited | missing
hs_health() {
  docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$1" 2>/dev/null || printf 'missing'
}

# wait_healthy SECONDS container...: 0 when all are healthy in time
wait_healthy() {
  local limit="$1" t=0 c ok; shift
  while :; do
    ok=1
    for c in "$@"; do [ "$(hs_health "$c")" = healthy ] || ok=0; done
    [ "$ok" = 1 ] && return 0
    [ "$t" -ge "$limit" ] && return 1
    sleep 3; t=$((t + 3))
  done
}

# The four containers must be this project's own. A container of that name belonging to anything else stops us.
guard_names() {
  local c p
  for c in "${HS_CONTAINERS[@]}"; do
    p="$(docker inspect -f '{{index .Config.Labels "com.docker.compose.project"}}' "$c" 2>/dev/null)" || continue
    [ "$p" = "$HS_PROJECT" ] || die "a container named $c exists and is not this project's (its project: '${p:-none}'). Nothing was changed."
  done
}

hs_states() {
  docker ps -a --filter "label=com.docker.compose.project=$HS_PROJECT" --format 'table {{.Names}}\t{{.State}}\t{{.Status}}\t{{.Ports}}'
}

# redact: stdin to stdout with every secret value of the .env replaced by ***. For log tails shown on failure.
redact() {
  local k v line
  local -a secrets=()
  for k in POSTGRES_PASSWORD JWT_SECRET SERVICE_ROLE_KEY DASHBOARD_PASSWORD GOOGLE_SECRET FACEBOOK_SECRET DISCORD_SECRET; do
    v="$(env_get "$k" 2>/dev/null)" || continue
    [ "${#v}" -ge 6 ] && secrets+=("$v")
  done
  while IFS= read -r line || [ -n "$line" ]; do
    for v in "${secrets[@]}"; do line="${line//"$v"/***}"; done
    printf '%s\n' "$line"
  done
}

# curl to the gateway on 127.0.0.1 with the anon key as apikey; the key goes in through stdin, not the command line
gw_curl() {
  local anon path="$1"; shift
  anon="$(env_get ANON_KEY)" || die "no ANON_KEY in $HS_ENV"
  curl -sS --max-time 10 -K - "$@" "http://127.0.0.1:$HS_GW_PORT$path" <<EOF
header = "apikey: $anon"
EOF
}
