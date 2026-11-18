#!/usr/bin/env bash
# deploy/hs-supabase/providers.sh's email switch (stage 6) on a throwaway folder, against stand-ins for the Docker
# CLI and curl (no container is started): `email` writes ENABLE_EMAIL_SIGNUP and ENABLE_EMAIL_AUTOCONFIRM true into
# the .env after a backup and recreates the Auth container only; run again it changes nothing and recreates nothing;
# `email --off` (and --email-off) puts both back to false; --email-on is the same as email; an unknown name stops
# with the usage; a compose file without the two settings stops before anything is written; and shellcheck.
#   bash tools/platform/test-providers-email.sh
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
T="$(mktemp -d)"
trap 'rm -r -- "$T"' EXIT
pass=0; fail=0
ok() { pass=$((pass + 1)); echo "ok   $*"; }
bad() { fail=$((fail + 1)); echo "FAIL $*"; }
mkdir -p "$T/bin" "$T/home/highland-supabase"
cp "$ROOT/deploy/hs-supabase/docker-compose.slim.yml" "$T/home/highland-supabase/docker-compose.yml"
printf 'ANON_KEY=anonvalue\nAPI_EXTERNAL_URL=https://hs-db.example.com/auth/v1\nENABLE_EMAIL_SIGNUP=false\nENABLE_EMAIL_AUTOCONFIRM=false\nGOOGLE_ENABLED=true\n' > "$T/home/highland-supabase/.env"
cat > "$T/bin/docker" <<'EOF'
#!/bin/bash
echo "docker $*" >> "$STANDIN_LOG"
case "$1" in
  inspect) if [[ "$*" == *Labels* ]]; then echo highland; else echo healthy; fi;;
  compose) exit 0;;
esac
EOF
cat > "$T/bin/curl" <<'EOF'
#!/bin/bash
echo "curl $*" >> "$STANDIN_LOG"
on() { grep -Eq "^$1='?true'?$" "$HOME/highland-supabase/.env" && echo true || echo false; }
echo "{\"external\":{\"email\":$(on ENABLE_EMAIL_SIGNUP),\"google\":true},\"mailer_autoconfirm\":$(on ENABLE_EMAIL_AUTOCONFIRM)}"
EOF
chmod +x "$T/bin/docker" "$T/bin/curl"
run() { : > "$T/log"; HOME="$T/home" PATH="$T/bin:$PATH" STANDIN_LOG="$T/log" HS_ALLOW_ROOT=1 HS_WAIT_SECONDS=3 bash "$ROOT/deploy/hs-supabase/providers.sh" "$@" > "$T/out" 2>&1; }
val() { sed -n "s/^$1=//p" "$T/home/highland-supabase/.env" | tr -d "'"; }
ups() { grep -c "compose.* up -d --no-deps auth" "$T/log"; }
baks() { find "$T/home/highland-supabase" -name '.env.bak-*' | wc -l; }

run email
if [ $? = 0 ] && [ "$(val ENABLE_EMAIL_SIGNUP)" = true ] && [ "$(val ENABLE_EMAIL_AUTOCONFIRM)" = true ] && [ "$(ups)" = 1 ] && [ "$(baks)" = 1 ] && grep -q '"email":true' "$T/out" && grep -q '"mailer_autoconfirm":true' "$T/out"; then
  ok "email: both settings true, the .env backed up, the Auth container recreated, /settings says email and autoconfirm"
else bad "email: $(cat "$T/out")"; fi
run email
if [ $? = 0 ] && [ "$(ups)" = 0 ] && [ "$(baks)" = 1 ] && grep -q 'Nothing was changed' "$T/out"; then ok "email again: nothing changed, nothing recreated, no new backup"
else bad "email again: $(cat "$T/out")"; fi
run --email-on
if [ $? = 0 ] && [ "$(ups)" = 0 ]; then ok "--email-on is the same switch"; else bad "--email-on: $(cat "$T/out")"; fi
run email --off
if [ $? = 0 ] && [ "$(val ENABLE_EMAIL_SIGNUP)" = false ] && [ "$(val ENABLE_EMAIL_AUTOCONFIRM)" = false ] && [ "$(ups)" = 1 ] && [ "$(baks)" = 2 ]; then ok "email --off: both false again, backed up, recreated"
else bad "email --off: $(cat "$T/out")"; fi
run --email-off
if [ $? = 0 ] && [ "$(ups)" = 0 ]; then ok "--email-off when off: nothing changed"; else bad "--email-off: $(cat "$T/out")"; fi
run mail
if [ $? != 0 ] && grep -q 'usage: ./providers.sh google|facebook|discord|email' "$T/out"; then ok "an unknown name stops with the usage"; else bad "an unknown name: $(cat "$T/out")"; fi
sed -i '/ENABLE_EMAIL_AUTOCONFIRM/d' "$T/home/highland-supabase/docker-compose.yml"
before="$(cat "$T/home/highland-supabase/.env")"
run email
if [ $? != 0 ] && grep -q 'does not carry the email settings' "$T/out" && [ "$(cat "$T/home/highland-supabase/.env")" = "$before" ] && [ "$(ups)" = 0 ]; then ok "a compose file without the settings: stopped, nothing written"
else bad "a compose file without the settings: $(cat "$T/out")"; fi
if command -v shellcheck > /dev/null; then
  if (cd "$ROOT/deploy/hs-supabase" && shellcheck -x providers.sh lib.sh) > "$T/sc" 2>&1; then ok "shellcheck: providers.sh and lib.sh"; else bad "shellcheck: $(cat "$T/sc")"; fi
fi
bash -n "$ROOT/deploy/hs-supabase/providers.sh" && ok "bash -n providers.sh" || bad "bash -n providers.sh"
echo "RESULT test-providers-email: $pass passed, $fail failed"
[ "$fail" = 0 ]
