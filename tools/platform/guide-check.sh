#!/bin/bash
# Runs the commands of the owner's guide (deploy/supabase/README.md) that are marked [tried], as written, against
# a test copy of the owner's setup: the local stack (tools/platform/stack.js) standing for Supabase's gateway on
# port 8000, and a real nginx in front of it with the guide's own nginx lines, standing for the public name
# supabase.avunjian.com (on plain http: there is no certificate here). The command texts are read out of the guide
# itself (each sits under a marker comment, <!-- guide-check: name -->), so what is tried is what the owner reads.
# Only the address and the key are put in, where the guide says "supabase.avunjian.com" and "PASTE_THE_ANON_KEY".
#
#   bash tools/platform/guide-check.sh [path/to/nginx]
#
# nginx: the argument, or $HS_NGINX, or nginx on the PATH. Without one the nginx parts are reported as not tried
# and the checks go straight to the stack. (On a machine without nginx installed, its Ubuntu package can be
# unpacked without installing it: apt-get download nginx nginx-common, then dpkg -x each into a folder.)
# Exit 0 only when every command gave the answer the guide says.
set -u
HERE=$(cd "$(dirname "$0")" && pwd)
ROOT=$(cd "$HERE/../.." && pwd)
GUIDE=$ROOT/deploy/supabase/README.md
NGINX=${1:-${HS_NGINX:-$(command -v nginx || true)}}
T=$(mktemp -d)
cleanup() { [ -f "$T/nginx.pid" ] && kill "$(cat "$T/nginx.pid")" 2>/dev/null; kill "$SPID" 2>/dev/null; wait "$SPID" 2>/dev/null; rm -rf "$T"; }
trap cleanup EXIT
fails=0; oks=0
ok() { oks=$((oks + 1)); echo "ok   $*"; }
bad() { fails=$((fails + 1)); echo "FAIL $*"; }
# the code block under a marker of the guide
block() { awk -v m="<!-- guide-check: $1 -->" 'found && /^ *```/ { if (inside) exit; inside = 1; next } inside { sub(/^   /, ""); print } $0 ~ m { found = 1 }' "$GUIDE"; }
for b in step0-greps nginx-zone nginx-site step1-check step1-auth-closed step3-settings step3-preflight step3-authorize step4-config step4-audit step5-smoke step6-admin step9-names step9-cloud-off step9-cloud-on; do
  [ -n "$(block $b)" ] || bad "the guide has no block marked $b"
done

# ------------------------------------------------------------------ the stack, standing for the gateway on port 8000
node "$HERE/stack.js" --wide > "$T/stack.log" 2>&1 &
SPID=$!
for i in $(seq 1 60); do grep -q 'STACK READY' "$T/stack.log" 2>/dev/null && break; sleep 0.5; done
grep -q 'STACK READY' "$T/stack.log" || { echo "FAIL the stack did not start"; cat "$T/stack.log"; exit 1; }
API=$(sed -n 's/.*HS_SUPABASE_URL): *//p' "$T/stack.log")
KEY=$(sed -n 's/.*HS_SUPABASE_ANON_KEY): *//p' "$T/stack.log")
PSQL=$(sed -n 's/.*as the SQL editor: *//p' "$T/stack.log")
sql() { $PSQL -X -v ON_ERROR_STOP=1 "$@" 2>&1; }
echo "the stack (the gateway) at $API"

# ------------------------------------------------------------------ nginx with the guide's lines, standing for the public name
PUB=$API
if [ -n "$NGINX" ] && [ -x "$NGINX" ]; then
  NPORT=$((30000 + RANDOM % 20000))
  mkdir -p "$T/ng"
  {
    echo "user root; worker_processes 1; pid $T/nginx.pid; error_log $T/ng/error.log;"
    echo "events { worker_connections 256; }"
    echo "http {"
    echo "  access_log off; client_body_temp_path $T/ng/body; proxy_temp_path $T/ng/proxy; fastcgi_temp_path $T/ng/fcgi; uwsgi_temp_path $T/ng/uwsgi; scgi_temp_path $T/ng/scgi;"
    block nginx-zone
    block nginx-site | sed -e "s#listen 80;#listen 127.0.0.1:$NPORT;#" -e "s#http://127.0.0.1:8000#$API#"
    echo "}"
  } > "$T/nginx.conf"
  if "$NGINX" -p "$T/ng" -c "$T/nginx.conf" -e "$T/ng/error.log" -t > "$T/nginx-t.log" 2>&1; then ok "nginx -t: the guide's zone line and site block are valid ($("$NGINX" -v 2>&1))"; else bad "nginx -t: $(cat "$T/nginx-t.log")"; fi
  "$NGINX" -p "$T/ng" -c "$T/nginx.conf" -e "$T/ng/error.log" > "$T/nginx.log" 2>&1 || bad "nginx did not start: $(cat "$T/nginx.log")"
  for i in $(seq 1 20); do curl -s -o /dev/null "http://127.0.0.1:$NPORT/" && break; sleep 0.2; done
  PUB=http://127.0.0.1:$NPORT
  echo "nginx with the guide's block (the public name) at $PUB"
else
  echo "NOT TRIED: no nginx here, so the guide's nginx lines were not run; the checks below go straight to the stack, served narrow"
  curl -s -X POST "$API/__test/narrow" --data '{"on":true}' > /dev/null
fi
pub() { sed -e "s#https://supabase.avunjian.com#$PUB#g" -e "s#PASTE_THE_ANON_KEY#$KEY#g"; }

# ------------------------------------------------------------------ step 0: the greps of the .env
mkdir -p "$T/supa-good" "$T/supa-example"
printf 'JWT_SECRET=%s\nPOSTGRES_PASSWORD=%s\nDASHBOARD_PASSWORD=%s\nANON_KEY=%s\n' "$(openssl rand -hex 24)" "$(openssl rand -hex 16)" "$(openssl rand -hex 16)" "$KEY" > "$T/supa-good/.env"
DEMO=$(node -e 'const b=o=>Buffer.from(JSON.stringify(o)).toString("base64url");console.log(b({alg:"HS256",typ:"JWT"})+"."+b({iss:"supabase-demo",role:"anon",exp:1983812996})+".x")')
printf 'JWT_SECRET=your-super-secret-jwt-token-with-at-least-32-characters-long\nPOSTGRES_PASSWORD=your-super-secret-and-long-postgres-password\nDASHBOARD_PASSWORD=this_password_is_insecure_and_should_be_updated\nANON_KEY=%s\n' "$DEMO" > "$T/supa-example/.env"
g=$(cd "$T/supa-good" && bash -c "$(block step0-greps)" | tr '\n' ' ')
[ "$g" = "0 0 0 0 " ] && ok "step 0: the four greps print 0 0 0 0 on an install with keys of its own" || bad "step 0 on good keys: $g"
g=$(cd "$T/supa-example" && bash -c "$(block step0-greps)" | tr '\n' ' ')
[ "$g" = "1 1 1 1 " ] && ok "step 0: and 1 1 1 1 on the example's values and a demo key" || bad "step 0 on the example: $g"

# ------------------------------------------------------------------ step 1: the four curls
g=$(bash -c "$(block step1-check | pub)" | tr '\n' ' ')
[ "$g" = "401 404 404 404 " ] && ok "step 1 check: $g" || bad "step 1 check: $g (wanted 401 404 404 404)"
# Auth's routes that make accounts, sign in by password or send mail: refused on the public name, while the gateway
# behind it (the stack, --wide, answering as an open Supabase Auth would) serves them: so it is the block that refuses
g=$(bash -c "$(block step1-auth-closed | pub)" | tr '\n' ' ')
[ "$g" = "404 404 404 403 " ] && ok "step 1 check: signup, otp, a password sign-in and a write to the user are refused: $g" || bad "step 1 auth closed: $g (wanted 404 404 404 403)"
if [ "$PUB" != "$API" ]; then
  # (with the key, which an open gateway asks for on these routes and a visitor can read off the page)
  g=$(bash -c "$(block step1-auth-closed | sed -e "s#https://supabase.avunjian.com#$API#g" -e "s#^curl -s #curl -s -H 'apikey: $KEY' #")" | tr '\n' ' ')
  [ "$g" = "200 200 200 200 " ] && ok "step 1 check: and the gateway behind the block does serve them ($g), so the block is what refuses" || bad "step 1 auth through the gateway itself: $g"
  for q in "/auth/v1/recover" "/auth/v1/magiclink" "/auth/v1/token?grant_type=id_token" "/auth/v1/admin/users" "/auth/v1/verify" "/auth/v1/settings/" "/auth/v1/userx"; do
    st=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$PUB$q" -H "apikey: $KEY")
    [ "$st" = 404 ] || bad "step 1 block: POST $q -> $st (wanted 404)"
  done
  ok "step 1 block: recover, magiclink, an id_token sign-in, the admin's routes, verify and near misses of the six names: 404"
  st=$(curl -s -o /dev/null -w '%{http_code}' -X OPTIONS "$PUB/auth/v1/user" -H "Origin: https://highland.avunjian.com" -H "Access-Control-Request-Method: GET")
  st2=$(curl -s -o /dev/null -w '%{http_code}' -X OPTIONS "$PUB/auth/v1/token?grant_type=pkce" -H "Origin: https://highland.avunjian.com" -H "Access-Control-Request-Method: POST")
  [ "$st$st2" = 200200 ] && ok "step 1 block: the page's preflights for user and token still pass ($st $st2)" || bad "step 1 block: preflights $st $st2"
fi
if [ "$PUB" != "$API" ]; then
  # what the guide's block refuses beyond the four: other paths, paths that try to slip past it, floods, big bodies
  st=$(curl -s -o /dev/null -w '%{http_code}' --path-as-is "$PUB/rest/v1/rpc/hs_config/../../hs_saves" -H "apikey: $KEY")
  st2=$(curl -s -o /dev/null -w '%{http_code}' "$PUB/rest/v1/rpc/hs_x%2F..%2F..%2Fhs_saves" -H "apikey: $KEY")
  st3=$(curl -s -o /dev/null -w '%{http_code}' "$PUB/rest/v1/hs_saves" -H "apikey: $KEY")
  st4=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$PUB/rest/v1/rpc/pg_sleep" -H "apikey: $KEY" -H 'content-type: application/json' --data '{"seconds":1}')
  [ "$st$st2$st3$st4" = 404404404404 ] && ok "step 1 block: a table, another function, and paths written to slip past it (.. and %2F) are 404" || bad "step 1 block: $st $st2 $st3 $st4"
  st=$(curl -s -o /dev/null -w '%{http_code}' "$PUB/auth/v1/authorize?provider=google&redirect_to=https%3A%2F%2Fhighland.avunjian.com%2Fnext%2F%3Fhsh%3Dabc")
  [ "$st" = 302 ] && ok "step 1 block: an encoded return address in the query still passes (302)" || bad "step 1 block: authorize with an encoded redirect_to -> $st"
  head -c 600000 /dev/zero | tr '\0' 'x' > "$T/big"
  st=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$PUB/rest/v1/rpc/hs_track" -H "apikey: $KEY" -H 'content-type: application/json' --data-binary @"$T/big")
  [ "$st" = 413 ] && ok "step 1 block: a body over 512 KB is refused (413)" || bad "step 1 block: a 600 KB body -> $st"
  seq 1 120 | xargs -P 24 -I@@ curl -s -o /dev/null -w "%{http_code}\n" -X POST "$PUB/rest/v1/rpc/hs_config" -H "apikey: $KEY" -H 'content-type: application/json' --data '{}' > "$T/flood"
  n429=$(grep -c 429 "$T/flood"); n200=$(grep -c 200 "$T/flood")
  [ "$n429" -gt 0 ] && [ "$n200" -ge 40 ] && ok "step 1 block: 120 calls at once from one address: $n200 answered, $n429 refused with 429 (10 a second, bursts of 40)" || bad "step 1 block: the flood gave $(sort "$T/flood" | uniq -c | tr '\n' ' ')"
  sleep 5   # let the counter of this address empty again before the next checks
fi

# ------------------------------------------------------------------ step 3: settings, the preflight, authorize
r=$(bash -c "$(block step3-settings | pub)" 2>/dev/null)
echo "$r" | grep -q '"google":true' && echo "$r" | grep -q '"facebook":true' && echo "$r" | grep -q '"discord":true' && echo "$r" | grep -q '"mailer_autoconfirm":false' \
  && ok "step 3 check: /auth/v1/settings lists the three providers and \"mailer_autoconfirm\":false" || bad "step 3 settings: $r"
r=$(bash -c "$(block step3-preflight | pub)" 2>/dev/null | tr -d '\r')
echo "$r" | head -1 | grep -Eq ' (200|204)' && echo "$r" | grep -qi '^access-control-allow-origin' && ok "step 3 check: the preflight answers $(echo "$r" | head -1 | cut -d' ' -f2) with access-control-allow-origin" || bad "step 3 preflight: $(echo "$r" | head -3)"
r=$(bash -c "$(block step3-authorize | pub)")
case "$r" in "302 "*) ok "step 3 check: authorize answers 302 (here to the stack's test provider; on the real server to accounts.google.com)";; *) bad "step 3 authorize: $r";; esac

# ------------------------------------------------------------------ step 4: schema.sql in the editor's role, the check, the audit
out=$(sql -f "$ROOT/deploy/supabase/schema.sql")
if echo "$out" | grep -q 'ERROR'; then bad "step 4: schema.sql as the SQL editor's role: $(echo "$out" | grep ERROR | head -3)"
elif echo "$out" | grep -q 'WARNING'; then bad "step 4: schema.sql warned: $(echo "$out" | grep WARNING)"
else ok "step 4: schema.sql run again, as postgres (the SQL editor's role): no error, no warning"; fi
r=$(sql -At -c "$(block step4-config)")
echo "$r" | grep -q '"now"' && ok "step 4 check: select public.hs_config(); answers $r" || bad "step 4 check: $r"
r=$(sql -At -c "$(block step4-audit)")
[ -z "$r" ] && ok "step 4 audit: no rows on an install with nothing else in it" || bad "step 4 audit on a clean install: $r"
# another project's objects: a table without row level security that visitors may only change (no read, no insert),
# a table with it on and a policy that lets visitors read it, a function visitors may run
sql -q -c "create table public.other_app_notes (id int); revoke all on public.other_app_notes from anon, authenticated; grant update on public.other_app_notes to anon;
  create table public.other_app_open (id int); alter table public.other_app_open enable row level security; create policy everyone_reads on public.other_app_open for select to anon using (true);
  create function public.other_app_fn() returns int language sql as 'select 1';" > /dev/null
r=$(sql -At -c "$(block step4-audit)" | tr '\n' ' ')
[ "$r" = "function a visitor may run|public.other_app_fn policy to read (SELECT for anon)|public.other_app_open: everyone_reads table without row level security|public.other_app_notes " ] \
  && ok "step 4 audit: another project's table open to change, its policy for visitors and its function are listed: $r" || bad "step 4 audit with another project's objects: $r"
sql -q -c "drop table public.other_app_notes; drop table public.other_app_open; drop function public.other_app_fn();" > /dev/null

# ------------------------------------------------------------------ step 5: the smoke test
r=$(cd "$ROOT" && bash -c "$(block step5-smoke | pub)" 2>&1); st=$?
echo "$r" | sed 's/^/        /'
[ $st = 0 ] && echo "$r" | grep -q 'RESULT smoke: 11 passed, 0 failed, 2 only on the real Supabase' && ok "step 5: the smoke test, as the guide gives it, passes against the public name" || bad "step 5: the smoke test"

# ------------------------------------------------------------------ step 6: sign in, then the admin's line of SQL
V=$(openssl rand -hex 64); C=$(printf '%s' "$V" | openssl dgst -sha256 -binary | openssl base64 -A | tr '+/' '-_' | tr -d '=')
curl -s -X POST "$API/__test/provider" --data '{"who":"aram"}' > /dev/null
loc1=$(curl -s -o /dev/null -w '%{http_code} %{redirect_url}' "$PUB/auth/v1/authorize?provider=google&code_challenge=$C&code_challenge_method=s256&redirect_to=http%3A%2F%2F127.0.0.1%2Fnext%2F")
# (nginx rewrites a redirect to its own upstream into its own address; here the test provider lives on that
# upstream, so the next hop goes to the stack itself. On the real server the provider is Google, not rewritten.)
p1=${loc1#* }; p1=${p1/#$PUB/$API}
loc2=$(curl -s -o /dev/null -w '%{redirect_url}' "$p1"); loc=$(curl -s -o /dev/null -w '%{redirect_url}' "$loc2")
code=$(echo "$loc" | sed -n 's/.*[?&]code=\([^&#]*\).*/\1/p')
AT=$(curl -s -X POST "$PUB/auth/v1/token?grant_type=pkce" -H "apikey: $KEY" -H 'content-type: application/json' --data "{\"auth_code\":\"$code\",\"code_verifier\":\"$V\"}" | jq -r .access_token)
[ -n "$AT" ] && [ "$AT" != null ] && ok "step 6: signed in as aram@example.com through the public name (PKCE)" || bad "step 6: the sign-in ($loc1 / $loc2 / $loc)"
r=$(sql -c "$(block step6-admin | sed "s/you@example.com/aram@example.com/")")
echo "$r" | grep -q 'INSERT 0 1' && ok "step 6: the admin's line says one row was added (INSERT 0 1)" || bad "step 6 admin: $r"
r=$(curl -s -X POST "$PUB/rest/v1/rpc/hs_profile_get" -H "apikey: $KEY" -H "Authorization: Bearer $AT" -H 'content-type: application/json' --data '{}' | jq -r .admin)
[ "$r" = true ] && ok "step 6: and hs_profile_get says admin: true" || bad "step 6: admin is $r"
r=$(sql -c "$(block step6-admin)")
echo "$r" | grep -q 'INSERT 0 0' && ok "step 6: an address nobody signed in with adds zero rows, as the guide warns" || bad "step 6 zero rows: $r"

# ------------------------------------------------------------------ step 9: words to refuse, the switch for everything
r=$(sql -c "$(block step9-names)")
echo "$r" | grep -q 'INSERT 0 2' && ok "step 9: two words added to the names' blocklist" || bad "step 9 names: $r"
r=$(curl -s -X POST "$PUB/rest/v1/rpc/hs_profile_set_name" -H "apikey: $KEY" -H "Authorization: Bearer $AT" -H 'content-type: application/json' --data '{"p_name":"Someword Fan"}' | jq -r .message)
[ "$r" = name_blocked ] && ok "step 9: and a name holding one is refused (name_blocked)" || bad "step 9: the name was $r"
sql -q -c "$(block step9-cloud-off)" > /dev/null
r=$(curl -s -X POST "$PUB/rest/v1/rpc/hs_config" -H "apikey: $KEY" -H 'content-type: application/json' --data '{}' | jq -c .cloud)
[ "$r" = false ] && ok "step 9: the switch for everything: hs_config now says cloud: false" || bad "step 9 cloud off: $r"
sql -q -c "$(block step9-cloud-on)" > /dev/null
r=$(curl -s -X POST "$PUB/rest/v1/rpc/hs_config" -H "apikey: $KEY" -H 'content-type: application/json' --data '{}' | jq -c .cloud)
[ "$r" = null ] && ok "step 9: and deleting the row switches it on again" || bad "step 9 cloud on: $r"

echo "RESULT guide-check: $oks commands gave the guide's answer, $fails did not"
[ "$fails" = 0 ]
