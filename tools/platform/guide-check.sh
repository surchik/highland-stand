#!/bin/bash
# Runs the commands of the owner's guide (deploy/supabase/README.md) that are marked [tried], as written, against a
# local stand-in of the shared server: the stack (tools/platform/stack.js: a throwaway PostgreSQL with Supabase's
# roles and default privileges, the migrations applied, and stand-ins for PostgREST and GoTrue serving the whole
# API) in place of https://db.avunjian.com, and its database's socket in place of the SSH tunnel. The command texts
# are read out of the guide itself (each sits under a marker comment, <!-- guide-check: name -->), so what is tried
# is what the owner reads. Only the address, the key and the database's address are put in, where the guide says
# "https://db.avunjian.com", "THE_ANON_KEY" and "$HS_DB_URL".
#
#   bash tools/platform/guide-check.sh
#
# Exit 0 only when every command gave the answer the guide says.
set -u
HERE=$(cd "$(dirname "$0")" && pwd)
ROOT=$(cd "$HERE/../.." && pwd)
GUIDE=$ROOT/deploy/supabase/README.md
T=$(mktemp -d)
cleanup() { kill "$SPID" 2>/dev/null; wait "$SPID" 2>/dev/null; rm -rf "$T"; }
trap cleanup EXIT
fails=0; oks=0
ok() { oks=$((oks + 1)); echo "ok   $*"; }
bad() { fails=$((fails + 1)); echo "FAIL $*"; }
# the code block under a marker of the guide
block() { awk -v m="<!-- guide-check: $1 -->" 'found && /^ *```/ { if (inside) exit; inside = 1; next } inside { sub(/^   /, ""); print } $0 ~ m { found = 1 }' "$GUIDE"; }
BLOCKS="survey-sql backup migrate-status migrate-up check-config migrate-down regrant check-rest smoke admin names cloud-off cloud-on rehearsal"
for b in $BLOCKS; do [ -n "$(block $b)" ] || bad "the guide has no block marked $b"; done
# the guide never names the old layout's files or schemas
if grep -nE 'schema\.sql|schema-handoff\.sql|hs_private|public\.hs_' "$GUIDE"; then bad "the guide still names schema.sql, hs_private or public.hs_"; else ok "the guide names no file or schema of the old layout"; fi
if grep -n '—' "$GUIDE" > /dev/null; then bad "the guide has a long dash"; fi

# ---------------------------------------------------------------- the stand-in of the shared server
# (without the test clock: the backup below is restored by the rehearsal, which refuses a function reading a setting)
node "$HERE/stack.js" --no-clock > "$T/stack.log" 2>&1 &
SPID=$!
for i in $(seq 1 60); do grep -q 'STACK READY' "$T/stack.log" 2>/dev/null && break; sleep 0.5; done
grep -q 'STACK READY' "$T/stack.log" || { echo "FAIL the stack did not start"; cat "$T/stack.log"; exit 1; }
API=$(sed -n 's/.*HS_SUPABASE_URL): *//p' "$T/stack.log")
KEY=$(sed -n 's/.*HS_SUPABASE_ANON_KEY): *//p' "$T/stack.log")
DIR=$(sed -n 's/.*as the migrating role: psql -h \([^ ]*\) -p.*/\1/p' "$T/stack.log")
PORT=$(sed -n 's/.*as the migrating role: psql -h [^ ]* -p \([0-9]*\) .*/\1/p' "$T/stack.log")
export HS_DB_URL="postgres://postgres@localhost:$PORT/hs?host=$DIR"
echo "the stand-in at $API, its database at $DIR port $PORT (as the tunnel's address)"
# a block, with the stand-in's address and key put in, run by bash from the repository (as the guide says), or
# from a folder of its own (cwd), where it leaves files
run() { local b=$1 cwd=${2:-$ROOT}; block "$b" | sed -e "s#https://db.avunjian.com#$API#g" -e "s#THE_ANON_KEY#$KEY#g" > "$T/$b.sh"; (cd "$cwd" && bash "$T/$b.sh") > "$T/$b.out" 2>&1; }
runsql() { local b=$1; block "$b" > "$T/$b.sql"; psql "$HS_DB_URL" -X -v ON_ERROR_STOP=1 -f "$T/$b.sql" > "$T/$b.out" 2>&1; }

# ---------------------------------------------------------------- step 0, step 2, step 3
if runsql survey-sql && grep -qE '^ postgres +\| f +\| t' "$T/survey-sql.out" && grep -qE '^ t +\| t' "$T/survey-sql.out"; then
  ok "step 0: the survey runs read-only (postgres not a superuser; it may read auth.users and auth.identities)"
else bad "step 0: the survey: $(head -20 "$T/survey-sql.out")"; fi
mkdir -p "$T/work"
if run backup "$T/work" && ls "$T"/work/highland-*.dump > /dev/null 2>&1; then ok "step 2: the backup: $(ls "$T"/work/highland-*.dump | xargs -n1 basename) ($(stat -c %s "$T"/work/highland-*.dump) bytes)"
else bad "step 2: the backup: $(cat "$T/backup.out")"; fi
if run migrate-status && grep -q 'highland at 5 of 5' "$T/migrate-status.out"; then ok "step 3: status says $(grep -o 'highland at 5 of 5' "$T/migrate-status.out")"; else bad "step 3: status: $(cat "$T/migrate-status.out")"; fi
if run migrate-up && grep -q 'done: highland at 5' "$T/migrate-up.out"; then ok "step 3: up on a database that has them all changes nothing ($(tail -1 "$T/migrate-up.out"))"; else bad "step 3: up: $(cat "$T/migrate-up.out")"; fi
if runsql check-config && grep -q '"now"' "$T/check-config.out"; then ok "step 3's check: hs_config answers with now"; else bad "step 3's check: $(cat "$T/check-config.out")"; fi
if run migrate-down && grep -q 'reverted 005_delete_game_session  (now at 4)' "$T/migrate-down.out" && grep -q 'applied  005_delete_game_session  (now at 5)' "$T/migrate-down.out" && grep -q 'done: highland at 5' "$T/migrate-down.out"; then
  ok "step 3: down 4 then up: 005 reverted and applied again, back at 5"
else bad "step 3: down and up: $(cat "$T/migrate-down.out")"; fi
psql "$HS_DB_URL" -X -q -c "grant select on highland.hs_saves to authenticated" > /dev/null 2>&1
if run regrant && grep -q 'regranted' "$T/regrant.out" && [ "$(psql "$HS_DB_URL" -X -tA -c "select has_table_privilege('authenticated', 'highland.hs_saves', 'select')")" = f ]; then
  ok "step 3: regrant takes back a grant given by hand"
else bad "step 3: regrant: $(cat "$T/regrant.out")"; fi
# down 4 without --yes changes nothing
if node "$ROOT/tools/platform/migrate.js" down 4 --dsn="$HS_DB_URL" > "$T/noyes.out" 2>&1; then bad "down without --yes ran"; else
  grep -q 'with --yes' "$T/noyes.out" && ok "step 3: down without --yes refuses and changes nothing" || bad "down without --yes: $(cat "$T/noyes.out")"; fi
if node "$ROOT/tools/platform/migrate.js" status --dsn="postgres://postgres:secret@localhost:$PORT/hs?host=$DIR" > "$T/pw.out" 2>&1; then bad "a DSN with a password was taken"; else
  grep -q 'PGPASSWORD' "$T/pw.out" && ! grep -q secret "$T/pw.out" && ok "a DSN with a password in it is refused, and the password is not printed" || bad "a DSN with a password: $(cat "$T/pw.out")"; fi

# ---------------------------------------------------------------- step 4a's check, step 5, step 6
if run check-rest && grep -q '"now"' "$T/check-rest.out" && grep -q '401$' "$T/check-rest.out"; then ok "step 4a's check: hs_config answers through Content-Profile, and hs_saves is 401"
else bad "step 4a's check: $(cat "$T/check-rest.out")"; fi
run smoke
fl=$(grep -oE '^FAIL +[0-9]+' "$T/smoke.out" | awk '{print $2}' | tr '\n' ' ')
if [ "$fl" = "11 " ]; then ok "step 5: the smoke test against the stand-in of the shared server fails check 11 only, as the guide says ($(grep '^RESULT' "$T/smoke.out"))"
else bad "step 5: the smoke test failed checks [$fl] (wanted 11 alone): $(grep -E '^FAIL' "$T/smoke.out" | head -5)"; fi
psql "postgres://supabase_admin@localhost:$PORT/hs?host=$DIR" -X -q -c "insert into auth.users (id, email) values ('0d000000-0000-4000-8000-0000000000ad', 'you@example.com') on conflict do nothing" > /dev/null
if runsql admin && grep -q 'INSERT 0 1' "$T/admin.out"; then ok "step 6: the admin's line adds one row"; else bad "step 6: $(cat "$T/admin.out")"; fi
if runsql names && grep -q 'INSERT 0 2' "$T/names.out"; then ok "step 6: two words added to the name filter"; else bad "names: $(cat "$T/names.out")"; fi
if runsql cloud-off && [ "$(psql "$HS_DB_URL" -X -tA -c "select highland.hs_config() ->> 'cloud'")" = false ]; then ok "the cloud switched off: hs_config says cloud false"; else bad "cloud off: $(cat "$T/cloud-off.out")"; fi
if runsql cloud-on && [ -z "$(psql "$HS_DB_URL" -X -tA -c "select highland.hs_config() ->> 'cloud'")" ]; then ok "and on again"; else bad "cloud on: $(cat "$T/cloud-on.out")"; fi

# ---------------------------------------------------------------- restoring
block rehearsal | sed -e "s#highland-THE_TIME.dump#$(ls "$T"/work/highland-*.dump | head -1)#" > "$T/rehearsal.sh"
if (cd "$ROOT" && bash "$T/rehearsal.sh") > "$T/rehearsal.out" 2>&1; then ok "restoring: the rehearsal with step 2's backup: $(grep '^RESULT' "$T/rehearsal.out")"
else bad "restoring: $(grep -E '^(FAIL|RESULT)' "$T/rehearsal.out" | head -8)"; fi

echo "RESULT guide-check: $oks passed, $fails failed"
[ "$fails" = 0 ]
