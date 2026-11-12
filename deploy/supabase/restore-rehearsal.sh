#!/bin/bash
# Highland Stand: a rehearsal of restoring the game's backup, run on THIS machine against a throwaway PostgreSQL
# (tools/platform/rehearsal-cluster.js), never against the shared server.
#
#   bash deploy/supabase/restore-rehearsal.sh               a populated local database is backed up, then restored
#   bash deploy/supabase/restore-rehearsal.sh FILE.dump     a backup made on the shared server (README, "Backups")
#                                                           is restored instead (pg_dump -n highland -Fc)
#
# What it does, in the order a real restore must do it (each trap is in deploy/supabase/README.md, "Restoring"):
#  1. pg_dump -n highland -Fc of the populated database, as postgres (the migrating role): the schema, its data, its
#     policies and its grants. Not the extensions, not auth.users, not the roles or their settings.
#  2. A fresh scratch database that has Supabase's stand-ins (roles, auth schema, the global default privileges that
#     grant everything postgres makes to anon, authenticated and service_role).
#  3. The extensions the schema needs, made first (a dump of one schema carries none). The game needs none; the list
#     is HS_EXTENSIONS (space separated) should that ever change.
#  4. pg_restore as postgres, NOT a superuser, with --no-owner, in its three sections: the schema; the data; then,
#     before the foreign keys come, a stand-in account in the scratch auth.users for every account the data names
#     (the dump does not carry auth.users, and on the shared server it must never be dumped: it is every app's);
#     then the keys, indexes, policies and grants.
#  5. What the restore granted is measured (the default privileges of the database it lands in can widen it), then
#     the lockdown and 003's grants are applied again (node tools/platform/migrate.js regrant).
#  6. The checks: the bookkeeping matches the migrations on disk; search_path pinned on every function; row level
#     security on, with a policy, on every table; exactly the grants of 003; nothing relied on in role settings, in
#     a database setting or in pg_cron; nothing of the game outside highland.
#  7. The isolation tests (tools/platform/isolation.js) against the restored copy, through the stand-in for
#     PostgREST.
# Exit 0 only when every step and check passed. Synthetic data only; no secret is read or printed.
set -uo pipefail
HERE=$(cd "$(dirname "$0")" && pwd)
ROOT=$(cd "$HERE/../.." && pwd)
BIN=${HS_PG_BIN:-/usr/lib/postgresql/16/bin}
DUMP_IN=${1:-}
T=$(mktemp -d)
fails=0; oks=0
ok() { oks=$((oks + 1)); echo "ok   $*"; }
bad() { fails=$((fails + 1)); echo "FAIL $*"; }
CPID=
cleanup() { exec 3>&- 2>/dev/null; [ -n "$CPID" ] && { kill "$CPID" 2>/dev/null; wait "$CPID" 2>/dev/null; }; rm -rf "$T"; }
trap cleanup EXIT

# ---------------------------------------------------------------- the throwaway cluster
mkfifo "$T/hold"
if [ -n "$DUMP_IN" ]; then
  [ -f "$DUMP_IN" ] || { echo "no such backup: $DUMP_IN"; exit 2; }
  node "$ROOT/tools/platform/rehearsal-cluster.js" --no-source < "$T/hold" > "$T/cluster.log" 2>&1 &
else
  node "$ROOT/tools/platform/rehearsal-cluster.js" < "$T/hold" > "$T/cluster.log" 2>&1 &
fi
CPID=$!
exec 3> "$T/hold"
for i in $(seq 1 120); do grep -q '^READY' "$T/cluster.log" 2>/dev/null && break; kill -0 "$CPID" 2>/dev/null || break; sleep 0.5; done
grep -q '^READY' "$T/cluster.log" || { echo "FAIL the throwaway cluster did not start:"; cat "$T/cluster.log"; exit 1; }
read -r _ H P SU < <(grep '^READY' "$T/cluster.log")
echo "a throwaway PostgreSQL on the socket $H, port $P$([ -n "${SU:-}" ] && echo ', pg-safeupdate (its test stand-in) loaded for the API')"
PSQL="psql -X -q -v ON_ERROR_STOP=1 -h $H -p $P"
as_pg() { $PSQL -U postgres -d hs_scratch "$@"; }
val() { $PSQL -U postgres -d hs_scratch -tA -c "$1"; }
DSN="postgres://postgres@localhost:$P/hs_scratch?host=$H"

# ---------------------------------------------------------------- 1. the backup
if [ -n "$DUMP_IN" ]; then
  cp "$DUMP_IN" "$T/highland.dump"; ok "1. the backup to restore: $DUMP_IN ($(stat -c %s "$T/highland.dump") bytes)"
else
  if "$BIN/pg_dump" -h "$H" -p "$P" -U postgres -d hs_src -n highland -Fc -f "$T/highland.dump" 2> "$T/dump.err"; then
    ok "1. pg_dump -n highland -Fc of the populated database, as postgres ($(stat -c %s "$T/highland.dump") bytes)"
  else bad "1. pg_dump: $(cat "$T/dump.err")"; exit 1; fi
fi
"$BIN/pg_restore" -l "$T/highland.dump" > "$T/toc.txt"
if grep -qE ' (EXTENSION|DATABASE|ROLE) ' "$T/toc.txt"; then bad "1. the backup carries extensions, a database or roles: $(grep -E ' (EXTENSION|DATABASE|ROLE) ' "$T/toc.txt" | head -3)"
else ok "1. it holds the schema highland alone: $(grep -c ' TABLE DATA ' "$T/toc.txt") tables' data, $(grep -c ' POLICY ' "$T/toc.txt") policies, $(grep -c ' FUNCTION ' "$T/toc.txt") functions, $(grep -c ' ACL ' "$T/toc.txt") grants; no extension, database or role"; fi
if grep -qE ' (auth|public|reqstream|reqstream_meta) ' "$T/toc.txt"; then bad "1. the backup names another schema: $(grep -E ' (auth|public|reqstream) ' "$T/toc.txt" | head -3)"; else ok "1. and nothing of auth, public or the other apps' schemas"; fi

# ---------------------------------------------------------------- 2. the scratch database
if [ "$(val "select count(*) from pg_namespace where nspname = 'highland'")" = 0 ] && [ "$(val "select to_regclass('auth.users') is not null")" = t ]; then
  ok "2. the scratch database hs_scratch: Supabase's stand-ins, no schema highland yet"
else bad "2. the scratch database is not fresh"; fi
if [ "$(val "select count(*) from pg_default_acl where defaclnamespace = 0 and pg_get_userbyid(defaclrole) = 'postgres'")" -ge 3 ]; then
  ok "2. with the global default privileges Supabase sets (what postgres makes is granted to the API roles)"
else bad "2. the scratch database lacks Supabase's global default privileges: the rehearsal would prove nothing"; fi

# ---------------------------------------------------------------- 3. extensions first
for e in ${HS_EXTENSIONS:-}; do
  if as_pg -c "create extension if not exists \"$e\"" > /dev/null 2>&1; then ok "3. extension $e made before the restore"; else bad "3. extension $e could not be made"; fi
done
if grep -qiE 'extensions\.|pgcrypto|uuid_generate|gen_salt|crypt\(' <("$BIN/pg_restore" -f - -s "$T/highland.dump" 2>/dev/null); then bad "3. the schema calls an extension's function: add it to HS_EXTENSIONS"
else ok "3. the schema calls no extension (gen_random_uuid, normalize and the rest are PostgreSQL's own): none to make first"; fi

# ---------------------------------------------------------------- 4. the restore, as postgres, in three sections
if [ "$(val "select rolsuper from pg_roles where rolname = current_user")" = f ]; then ok "4. restoring as $(val 'select current_user'), not a superuser"; else bad "4. postgres is a superuser here"; fi
# restore_into DB: the three sections, with the stand-in accounts between the data and the keys
restore_into() {
  local db=$1 R="$BIN/pg_restore -h $H -p $P -U postgres -d $1 --no-owner --exit-on-error --single-transaction"
  $R --section=pre-data "$T/highland.dump" 2> "$T/r1.err" || { echo "pre-data: $(head -5 "$T/r1.err")"; return 1; }
  $R --section=data "$T/highland.dump" 2> "$T/r2.err" || { echo "data: $(head -5 "$T/r2.err")"; return 1; }
  # the accounts the data names, as stand-in rows of the scratch auth.users (the real auth.users is never dumped)
  $PSQL -U supabase_admin -d "$db" -tA -c "with ids as (
    select user_id as id from highland.hs_profiles union select user_id from highland.hs_saves union select user_id from highland.hs_runs
    union select user_id from highland.hs_scores union select user_id from highland.hs_score_best union select user_id from highland.hs_admins
    union select uid from highland.hs_sessions where uid is not null)
    insert into auth.users (id) select id from ids on conflict (id) do nothing returning 1" > "$T/stubs.txt" || { echo "the stand-in accounts"; return 1; }
  $R --section=post-data "$T/highland.dump" 2> "$T/r3.err" || { echo "post-data: $(head -5 "$T/r3.err")"; return 1; }
}
if msg=$(restore_into hs_scratch); then
  ok "4. pg_restore --no-owner in three sections: the schema; the data ($(val "select count(*) from highland.hs_profiles") profiles, $(val "select count(*) from highland.hs_scores") scores, $(val "select count(*) from highland.hs_events") events); $(wc -l < "$T/stubs.txt") stand-in accounts in the scratch auth.users (ids only) for the foreign keys; then keys, indexes, policies and grants"
else bad "4. the restore: $msg"; fi

# ---------------------------------------------------------------- 5. what the restore granted, then the regrant
wide=$(val "select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace, (values ('anon'), ('authenticated'), ('service_role')) r(role)
  where n.nspname = 'highland' and c.relkind in ('r', 'v', 'S') and (has_table_privilege(r.role, c.oid, 'select') or has_table_privilege(r.role, c.oid, 'insert'))")
wfn=$(val "select count(*) from pg_proc p, (values ('anon'), ('authenticated'), ('service_role')) r(role) where p.pronamespace = 'highland'::regnamespace and p.proname like '\_%' and has_function_privilege(r.role, p.oid, 'execute')")
if [ "$wide" != 0 ] || [ "$wfn" != 0 ]; then
  echo "note 5. as restored, the API roles hold $wide privileges on tables, views or sequences and $wfn on helpers (the default privileges of the database restored into)"
else echo "note 5. as restored, no table and no helper is granted to an API role"; fi
if out=$(node "$ROOT/tools/platform/migrate.js" regrant --dsn="$DSN" 2>&1); then ok "5. node tools/platform/migrate.js regrant: $(echo "$out" | tail -1)"; else bad "5. regrant: $out"; fi

# ---------------------------------------------------------------- 6. the checks
st=$(node "$ROOT/tools/platform/migrate.js" status --dsn="$DSN" 2>&1)
if echo "$st" | grep -q "highland at $(ls "$ROOT"/deploy/supabase/migrations/*.up.sql | wc -l) of" && ! echo "$st" | grep -q 'CHANGED'; then ok "6. the bookkeeping: $(echo "$st" | head -1 | sed 's/.*: //'), every checksum matching the files"; else bad "6. the bookkeeping: $st"; fi
n=$(val "select count(*) from pg_proc where pronamespace = 'highland'::regnamespace and (proconfig is null or not proconfig @> array['search_path=\"\"'])")
[ "$n" = 0 ] && ok "6. search_path pinned to '' on every one of $(val "select count(*) from pg_proc where pronamespace = 'highland'::regnamespace") functions" || bad "6. $n functions without a pinned search_path"
n=$(val "select count(*) from pg_class c where c.relnamespace = 'highland'::regnamespace and c.relkind = 'r' and (not c.relrowsecurity or not exists (select 1 from pg_policy p where p.polrelid = c.oid))")
[ "$n" = 0 ] && ok "6. row level security on, with a policy, on every one of $(val "select count(*) from pg_class where relnamespace = 'highland'::regnamespace and relkind = 'r'") tables" || bad "6. $n tables without row level security or a policy"
n=$(val "select count(*) from pg_class c where c.relnamespace = 'highland'::regnamespace and c.relkind = 'v' and not coalesce(c.reloptions @> array['security_invoker=true'], false)")
[ "$n" = 0 ] && ok "6. every view still reads with its caller's rights" || bad "6. $n views lost security_invoker"
g=$(val "select string_agg(x, ' ' order by x) from (select p.proname || ':' || r.role as x from pg_proc p, (values ('anon'), ('authenticated'), ('service_role')) r(role)
  where p.pronamespace = 'highland'::regnamespace and has_function_privilege(r.role, p.oid, 'execute')) q")
want="hs_admin_moderate:authenticated hs_admin_publish_ruleset:authenticated hs_admin_purge_events:authenticated hs_admin_remove_score:authenticated hs_admin_set_config:authenticated hs_board:anon hs_board:authenticated hs_config:anon hs_config:authenticated hs_daily_status:anon hs_daily_status:authenticated hs_delete_account:authenticated hs_profile_get:authenticated hs_profile_set_name:authenticated hs_run_begin:authenticated hs_save_get:authenticated hs_save_put:authenticated hs_score_submit:authenticated hs_stats:authenticated hs_track:anon hs_track:authenticated"
[ "$g" = "$want" ] && ok "6. exactly 003's grants on functions (21: 4 open to anon and authenticated, 13 to authenticated, none to service_role, no helper)" || bad "6. the function grants differ: $g"
n=$(val "select count(*) from pg_class c, (values ('anon'), ('authenticated'), ('service_role')) r(role) where c.relnamespace = 'highland'::regnamespace and c.relkind in ('r', 'v', 'S')
  and (has_table_privilege(r.role, c.oid, 'select') or has_table_privilege(r.role, c.oid, 'insert') or has_table_privilege(r.role, c.oid, 'update') or has_table_privilege(r.role, c.oid, 'delete'))")
[ "$n" = 0 ] && ok "6. no table, view or sequence granted to an API role" || bad "6. $n table privileges held by API roles"
[ "$(val "select has_schema_privilege('service_role', 'highland', 'usage')::text || has_schema_privilege('anon', 'highland', 'usage')::text")" = falsetrue ] && ok "6. the schema: usage for anon and authenticated, not service_role" || bad "6. the schema's usage grants differ"
n=$(val "select count(*) from pg_db_role_setting s where array_to_string(s.setconfig, ',') ~* '(highland|hs_)'")
[ "$n" = 0 ] && ok "6. no role or database setting names the game (the schema relies on none)" || bad "6. $n role or database settings name the game"
n=$(val "select count(*) from pg_proc where pronamespace = 'highland'::regnamespace and prosrc ~ 'current_setting\(' and prosrc !~ 'request\.jwt'")
[ "$n" = 0 ] && ok "6. no function reads a setting of its own (only auth.uid() reads the request's claims)" || bad "6. $n functions read a custom setting"
if [ "$(val "select to_regclass('cron.job') is null")" = t ]; then ok "6. no pg_cron here, and the game uses none (old visits leave by themselves, and through the stats page's purge)"
else n=$(val "select count(*) from cron.job where command ~* 'highland|hs_'"); [ "$n" = 0 ] && ok "6. no pg_cron job of the game's" || bad "6. $n cron jobs name the game"; fi
n=$(val "select count(*) from pg_class c join pg_namespace s on s.oid = c.relnamespace where s.nspname <> 'highland' and c.relname like 'hs\_%'")
[ "$n" = 0 ] && ok "6. nothing of the game outside highland" || bad "6. $n objects of the game outside highland"

# ---------------------------------------------------------------- 7. the isolation tests on the restored copy
# first on a second copy left as the restore leaves it (no regrant): the tests must catch what the restore widened
if msg=$(restore_into hs_raw); then
  if node "$ROOT/tools/platform/isolation.js" --attach="$H:$P/hs_raw" > "$T/raw.log" 2>&1; then
    if [ "$wide" = 0 ] && [ "$wfn" = 0 ]; then ok "7. (the restore widened nothing here, so the copy left without the regrant passes too)"
    else bad "7. the isolation tests passed a copy whose grants the restore had widened"; fi
  else ok "7. a second copy left without the regrant fails the isolation tests, as it must: $(grep -c '^FAIL' "$T/raw.log") failures, such as: $(grep '^FAIL' "$T/raw.log" | head -1 | cut -c6-120)"; fi
else bad "7. the second restore: $msg"; fi
if node "$ROOT/tools/platform/isolation.js" --attach="$H:$P/hs_scratch" > "$T/iso.log" 2>&1; then
  ok "7. $(grep '^RESULT' "$T/iso.log") on the restored copy"
else bad "7. the isolation tests on the restored copy:"; grep -E '^(FAIL|RESULT)' "$T/iso.log" | head -20; fi

echo "RESULT restore-rehearsal: $oks passed, $fails failed"
[ "$fails" = 0 ]
