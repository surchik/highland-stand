#!/bin/bash
# A scripted session against the local stack, with curl alone, as the page will make it (docs/specs/platform.final.md
# 1.1, 1.2, 2.2; work package P1's "a curl session against the stack signs in through the fake provider and calls
# hs_profile_get"):
#   1. sign in with PKCE through the stack's test provider and call hs_profile_get (and choose a name);
#   2. the sign-in's refusals: a code used twice, a wrong verifier, a refresh token used again too late;
#   3. as a visitor and as a signed-in player, try to read every hs_ table and to run every function outside the
#      ones granted to that caller, and show each refusal;
#   4. the same address as the owner's narrow public name serves it: the tables are not served at all.
# Every attempt is printed with the answer's status and message. Exit 0 only when every answer is the expected one.
#
#   bash tools/platform/curl-session.sh            (needs node, curl, jq and openssl; the stack needs PostgreSQL 16)
set -u
HERE=$(cd "$(dirname "$0")" && pwd)
OUT=$(mktemp -d); trap 'kill "$SPID" 2>/dev/null; wait "$SPID" 2>/dev/null; rm -rf "$OUT"' EXIT
node "$HERE/stack.js" --wide > "$OUT/stack.log" 2>&1 &
SPID=$!
for i in $(seq 1 60); do grep -q 'STACK READY' "$OUT/stack.log" 2>/dev/null && break; sleep 0.5; done
grep -q 'STACK READY' "$OUT/stack.log" || { echo "FAIL the stack did not start"; cat "$OUT/stack.log"; exit 1; }
B=$(sed -n 's/.*HS_SUPABASE_URL): *//p' "$OUT/stack.log")
K=$(sed -n 's/.*HS_SUPABASE_ANON_KEY): *//p' "$OUT/stack.log")
SITE=$(sed -n 's/.*the game: *\([^ ]*\)\/ .*/\1/p' "$OUT/stack.log")
echo "stack: $B (the game at $SITE)"
fails=0; refusals=0
bad() { echo "FAIL $*"; fails=$((fails + 1)); }
# call METHOD PATH [BODY] [TOKEN]: prints "status body" into $S and $R
call() {
  local auth=()
  [ -n "${4:-}" ] && auth=(-H "Authorization: Bearer $4")
  if [ -n "${3:-}" ]; then
    R=$(curl -s -o "$OUT/body" -w '%{http_code}' -X "$1" "$B$2" -H "apikey: $K" "${auth[@]}" -H 'Content-Type: application/json' --data "$3")
  else
    R=$(curl -s -o "$OUT/body" -w '%{http_code}' -X "$1" "$B$2" -H "apikey: $K" "${auth[@]}")
  fi
  S=$R; R=$(cat "$OUT/body")
}

echo "== 1. sign in with PKCE through the test provider"
call GET /auth/v1/settings
echo "GET /auth/v1/settings -> $S $(echo "$R" | jq -c '{google: .external.google, facebook: .external.facebook, discord: .external.discord, mailer_autoconfirm}')"
[ "$S" = 200 ] || bad "settings"
# the verifier: 64 random bytes as hex (128 characters); the challenge: base64url(sha256(verifier)), as the page makes them
V=$(openssl rand -hex 64)
C=$(printf '%s' "$V" | openssl dgst -sha256 -binary | openssl base64 -A | tr '+/' '-_' | tr -d '=')
H=$(openssl rand -base64 32 | tr '+/' '-_' | tr -d '=')
curl -s -X POST "$B/__test/provider" --data '{"who":"aram"}' > /dev/null
RET="$SITE/?hsh=$H"
A1=$(curl -s -o /dev/null -w '%{redirect_url}' "$B/auth/v1/authorize?provider=google&redirect_to=$(jq -rn --arg u "$RET" '$u|@uri')&code_challenge=$C&code_challenge_method=s256")
echo "GET /auth/v1/authorize (no apikey) -> 302 to the provider: ${A1%%\?*}"
A2=$(curl -s -o /dev/null -w '%{redirect_url}' "$A1")
echo "the provider -> 302 to ${A2%%\?*}"
A3=$(curl -s -o /dev/null -w '%{redirect_url}' "$A2")
echo "the callback -> 302 back to the game: $(echo "$A3" | sed 's/code=[^&]*/code=<the code>/')"
CODE=$(echo "$A3" | sed -n 's/.*[?&]code=\([^&#]*\).*/\1/p')
case "$A3" in "$SITE/?hsh=$H&code="*) ;; *) bad "the return address keeps ?hsh= and adds code=";; esac
call POST "/auth/v1/token?grant_type=pkce" "{\"auth_code\":\"$CODE\",\"code_verifier\":\"$V\"}"
AT=$(echo "$R" | jq -r .access_token); RT=$(echo "$R" | jq -r .refresh_token)
echo "POST /auth/v1/token?grant_type=pkce -> $S, user $(echo "$R" | jq -r .user.email), provider $(echo "$R" | jq -r .user.app_metadata.provider), expires_in $(echo "$R" | jq -r .expires_in)"
[ "$S" = 200 ] && [ "$AT" != null ] || bad "the exchange"
call POST /rest/v1/rpc/hs_profile_get '{}' "$AT"
echo "POST /rest/v1/rpc/hs_profile_get -> $S $(echo "$R" | jq -c '{name, hidden, admin}')"
[ "$S" = 200 ] && [ "$(echo "$R" | jq -r .name)" = null ] || bad "hs_profile_get"
call POST /rest/v1/rpc/hs_profile_set_name '{"p_name":"Aram"}' "$AT"
echo "POST /rest/v1/rpc/hs_profile_set_name {p_name: Aram} -> $S $R"
call POST /rest/v1/rpc/hs_profile_get '{}' "$AT"
echo "POST /rest/v1/rpc/hs_profile_get -> $S $(echo "$R" | jq -c '{name, hidden, admin}')"
[ "$(echo "$R" | jq -r .name)" = Aram ] || bad "the name did not stick"
call GET /auth/v1/user "" "$AT"
echo "GET /auth/v1/user -> $S $(echo "$R" | jq -r .email)"

echo "== 2. the sign-in's refusals"
call POST "/auth/v1/token?grant_type=pkce" "{\"auth_code\":\"$CODE\",\"code_verifier\":\"$V\"}"
echo "the same code again -> $S $(echo "$R" | jq -r .error_code)"; [ "$S" = 404 ] || bad "a code worked twice"
curl -s -X POST "$B/__test/provider" --data '{"who":"aram"}' > /dev/null
A3=$(curl -s -o /dev/null -w '%{redirect_url}' "$(curl -s -o /dev/null -w '%{redirect_url}' "$(curl -s -o /dev/null -w '%{redirect_url}' "$B/auth/v1/authorize?provider=google&redirect_to=$SITE/&code_challenge=$C&code_challenge_method=s256")")")
CODE2=$(echo "$A3" | sed -n 's/.*[?&]code=\([^&#]*\).*/\1/p')
call POST "/auth/v1/token?grant_type=pkce" "{\"auth_code\":\"$CODE2\",\"code_verifier\":\"$(openssl rand -hex 64)\"}"
echo "a code with another verifier -> $S $(echo "$R" | jq -r .error_code)"; [ "$S" = 403 ] || bad "a wrong verifier was taken"
call POST "/auth/v1/token?grant_type=refresh_token" "{\"refresh_token\":\"$RT\"}"
RT2=$(echo "$R" | jq -r .refresh_token); AT2=$(echo "$R" | jq -r .access_token)
echo "refresh -> $S, a new pair (rotation: $( [ "$RT2" != "$RT" ] && echo yes || echo no))"; [ "$S" = 200 ] && [ "$RT2" != "$RT" ] || bad "refresh"
call POST "/auth/v1/token?grant_type=refresh_token" "{\"refresh_token\":\"$RT\"}"
echo "the old refresh token again within 10 s -> $S (the current pair: $( [ "$(echo "$R" | jq -r .refresh_token)" = "$RT2" ] && echo yes || echo no))"
curl -s -X POST "$B/__test/authclock" --data '{"seconds":30}' > /dev/null
call POST "/auth/v1/token?grant_type=refresh_token" "{\"refresh_token\":\"$RT\"}"
echo "the old refresh token again 30 s later -> $S $(echo "$R" | jq -r .error_code)"; [ "$S" = 400 ] || bad "a used refresh token worked late"
call POST "/auth/v1/token?grant_type=refresh_token" "{\"refresh_token\":\"$RT2\"}"
echo "and with it the whole session is over -> $S $(echo "$R" | jq -r .error_code)"; [ "$S" = 400 ] || bad "the session outlived the reuse"
curl -s -X POST "$B/__test/authclock" --data '{"seconds":0}' > /dev/null
call POST /rest/v1/rpc/hs_profile_get '{}' "${AT%?}x"
echo "a forged token -> $S $(echo "$R" | jq -r .code) $(echo "$R" | jq -r .message)"; [ "$S" = 401 ] || bad "a forged token was taken"
R0=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$B/rest/v1/rpc/hs_config" -H 'Content-Type: application/json' --data '{}')
echo "no apikey -> $R0"; [ "$R0" = 401 ] || bad "a call without the key"

echo "== 3. every table and every function outside the grants, as a visitor and as a player"
TABLES="hs_profiles hs_saves hs_rulesets hs_runs hs_scores hs_score_best hs_sessions hs_events hs_admins hs_config hs_name_blocklist hs_rate"
for who in visitor player; do
  tok=""; [ $who = player ] && tok=$AT2
  for t in $TABLES; do
    call GET "/rest/v1/$t?select=*" "" "$tok"
    msg=$(echo "$R" | jq -r '.message // "rows!"' 2>/dev/null)
    if [ "$S" = 401 ] || [ "$S" = 403 ]; then refusals=$((refusals + 1)); echo "REFUSED $who GET /rest/v1/$t -> $S $msg"; else bad "$who GET /rest/v1/$t -> $S $R"; fi
  done
done
PLAYER_FNS="hs_profile_get hs_profile_set_name hs_save_get hs_save_put hs_run_begin hs_score_submit hs_delete_account"
ADMIN_FNS="hs_stats hs_admin_publish_ruleset hs_admin_set_config hs_admin_moderate hs_admin_remove_score hs_admin_purge_events"
args() {
  case $1 in
    hs_profile_set_name) echo '{"p_name":"Somebody"}';; hs_save_put) echo '{"p_expected":0,"p_data":{"v":1}}';;
    hs_run_begin) echo '{"p_mode":"campaign","p_level":"erebuni","p_diff":1,"p_ruleset":"2"}';;
    hs_score_submit) echo '{"p_run":"00000000-0000-4000-8000-000000000999","p_stats":{"won":true}}';;
    hs_admin_publish_ruleset) echo '{"p_id":"9","p_data":{}}';; hs_admin_set_config) echo '{"p_key":"gate","p_value":"off"}';;
    hs_admin_moderate) echo '{"p_user":"00000000-0000-4000-8000-000000000999","p_hidden":true}';;
    hs_admin_remove_score) echo '{"p_score":1}';; *) echo '{}';;
  esac
}
for f in $PLAYER_FNS $ADMIN_FNS; do
  call POST "/rest/v1/rpc/$f" "$(args $f)"
  if [ "$S" = 401 ]; then refusals=$((refusals + 1)); echo "REFUSED visitor POST /rest/v1/rpc/$f -> $S $(echo "$R" | jq -r .message)"; else bad "visitor $f -> $S $R"; fi
done
for f in $ADMIN_FNS; do
  call POST "/rest/v1/rpc/$f" "$(args $f)" "$AT2"
  if [ "$S" = 403 ] && [ "$(echo "$R" | jq -r .message)" = not_admin ]; then refusals=$((refusals + 1)); echo "REFUSED player POST /rest/v1/rpc/$f -> $S not_admin"; else bad "player $f -> $S $R"; fi
done
for who in visitor player; do
  tok=""; [ $who = player ] && tok=$AT2
  for f in rate_ok is_admin name_clean; do
    call POST "/rest/v1/rpc/$f" '{}' "$tok"
    if [ "$S" = 404 ]; then refusals=$((refusals + 1)); echo "REFUSED $who POST /rest/v1/rpc/$f (a private helper) -> $S $(echo "$R" | jq -r .code)"; else bad "$who $f -> $S $R"; fi
  done
done
for f in hs_config hs_board hs_daily_status hs_track; do
  case $f in hs_board) a='{"p_mode":"daily"}';; hs_daily_status) a='{"p_ruleset":"2"}';; hs_track) a='{"p_ctx":{"aid":"11111111-1111-4111-8111-111111111111","sid":"curl-0001-aaaa","channel":"smoke"},"p_events":[{"n":"page_load"}]}';; *) a='{}';; esac
  call POST "/rest/v1/rpc/$f" "$a"
  echo "allowed visitor POST /rest/v1/rpc/$f -> $S $(echo "$R" | jq -c . | cut -c1-90)"
done

echo "== 4. the narrow public name (the guide's proxy): nothing but the two prefixes is served"
curl -s -X POST "$B/__test/narrow" --data '{"on":true}' > /dev/null
for p in / /rest/v1/ /rest/v1/hs_saves /rest/v1/hs_events /rest/v1/rpc/pg_sleep /pg/meta /storage/v1/bucket /realtime/v1/ /graphql/v1; do
  st=$(curl -s -o /dev/null -w '%{http_code}' "$B$p" -H "apikey: $K" -H "Authorization: Bearer $AT2")
  if [ "$st" = 404 ]; then refusals=$((refusals + 1)); echo "NOT SERVED $p -> 404"; else bad "$p -> $st"; fi
done
call POST /rest/v1/rpc/hs_profile_get '{}' "$AT2"
echo "and the game's own call still answers: hs_profile_get -> $S $(echo "$R" | jq -r .name)"; [ "$S" = 200 ] || bad "narrow broke the game's call"

echo "== 5. the stack's controls, which the later flows lean on"
ctl() { curl -s -X POST "$B/__test/$1" --data "$2" > /dev/null; }
ctl auth '{"mode":"down"}'; call GET /auth/v1/settings; echo "Auth down -> $S"; [ "$S" = 503 ] || bad "Auth down"
ctl auth '{"mode":"hang"}'; st=$(curl -s -m 2 -o /dev/null -w '%{http_code}' "$B/auth/v1/settings" -H "apikey: $K"); echo "Auth hanging -> $st (no answer in 2 s)"; [ "$st" = 000 ] || bad "Auth hang"
ctl auth '{"mode":"up"}'
ctl rest '{"mode":"down"}'; call POST /rest/v1/rpc/hs_config '{}'; echo "PostgREST down -> $S"; [ "$S" = 503 ] || bad "PostgREST down"
ctl rest '{"mode":"up"}'
call POST /rest/v1/rpc/hs_config '{}'; d0=$(echo "$R" | jq -r .now | cut -c1-10)
ctl clock '{"offset":"1 day"}'; call POST /rest/v1/rpc/hs_config '{}'; d1=$(echo "$R" | jq -r .now | cut -c1-10)
echo "the database's clock moved a day: $d0 -> $d1"; [ "$d0" != "$d1" ] || bad "the clock did not move"
ctl clock '{"offset":""}'
ctl expire '{}'; call POST /rest/v1/rpc/hs_profile_get '{}' "$AT2"; echo "tokens expired -> $S $(echo "$R" | jq -r .message)"; [ "$S" = 401 ] || bad "expire"
ctl settings '{"mailer_autoconfirm":true}'; call GET /auth/v1/settings; echo "settings say mailer_autoconfirm: $(echo "$R" | jq -r .mailer_autoconfirm)"; [ "$(echo "$R" | jq -r .mailer_autoconfirm)" = true ] || bad "settings control"
ctl settings '{"mailer_autoconfirm":false}'
n=$(curl -s -X POST "$B/__test/query" --data '{"sql":"select count(*)::int as n from public.hs_profiles"}' | jq -r '.rows[0].n')
ctl reset '{}'
n2=$(curl -s -X POST "$B/__test/query" --data '{"sql":"select (select count(*) from public.hs_profiles) + (select count(*) from auth.users) as n"}' | jq -r '.rows[0].n')
echo "the database emptied: $n profile(s) before, $n2 rows of players after"; [ "$n2" = 0 ] || bad "reset"
curl -s -X POST "$B/__test/provider" --data '{"who":"cancel"}' > /dev/null
A3=$(curl -s -o /dev/null -w '%{redirect_url}' "$(curl -s -o /dev/null -w '%{redirect_url}' "$(curl -s -o /dev/null -w '%{redirect_url}' "$B/auth/v1/authorize?provider=google&redirect_to=$SITE/%3Fhsh%3D$H&code_challenge=$C&code_challenge_method=s256")")")
echo "the provider cancels -> back to the game with $(echo "$A3" | sed -n 's/.*[?]\(.*\)#.*/\1/p' | tr '&' ' ' | cut -c1-80)"; case "$A3" in *error=access_denied*) ;; *) bad "cancel";; esac
curl -s -X POST "$B/__test/provider" --data '{"who":"discord-unverified"}' > /dev/null
A3=$(curl -s -o /dev/null -w '%{redirect_url}' "$(curl -s -o /dev/null -w '%{redirect_url}' "$(curl -s -o /dev/null -w '%{redirect_url}' "$B/auth/v1/authorize?provider=discord&redirect_to=$SITE/&code_challenge=$C&code_challenge_method=s256")")")
case "$A3" in *error_code=provider_email_needs_verification*) echo "an unverified Discord email -> error_code=provider_email_needs_verification";; *) bad "unverified email: $A3";; esac
st=$(curl -s -o /dev/null -w '%{http_code}' "$SITE/next/"); st2=$(curl -s -o /dev/null -w '%{http_code}' "$SITE/")
echo "the game at / -> $st2 and at /next/ -> $st"; [ "$st$st2" = 200200 ] || bad "the page"

echo "RESULT curl-session: $refusals refusals shown, $fails unexpected answers"
[ "$fails" = 0 ]
