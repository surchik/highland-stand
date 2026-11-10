-- A first test of schema.sql on a plain PostgreSQL with standins.sql loaded first. It plays three callers the
-- way PostgREST does (a role and the JWT claims set for the transaction) and fails loudly on the first thing
-- that is not as the spec says. The build's full SQL tests (tools/platform/sql-tests.js, spec section 10.2)
-- grow from this file. Run:
--   psql -v ON_ERROR_STOP=1 -f standins.sql -f schema.sql -f schema-test.sql
\set ON_ERROR_STOP 1
\set QUIET 1
set client_min_messages = warning;

-- helpers of the test only
create schema if not exists t;
grant usage on schema t to anon, authenticated;
create or replace function t.as_user(p uuid) returns void language plpgsql as $$
begin
  if p is null then
    perform set_config('request.jwt.claims', '{"role":"anon"}', true);
    set local role anon;
  else
    perform set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true);
    set local role authenticated;
  end if;
end $$;
create or replace function t.ok(p boolean, p_what text) returns void language plpgsql as $$
begin
  if p is not true then raise exception 'TEST FAILED: %', p_what; end if;
end $$;
-- the error message a statement raises ('' when it raises none)
create or replace function t.err(p_sql text) returns text language plpgsql as $$
begin
  execute p_sql;
  return '';
exception when others then
  return sqlerrm;
end $$;
grant execute on all functions in schema t to anon, authenticated;

truncate public.hs_events, public.hs_sessions, public.hs_score_best, public.hs_scores, public.hs_runs, public.hs_saves,
  public.hs_profiles, public.hs_admins, public.hs_rulesets, public.hs_rate, public.hs_handoff cascade;
delete from auth.users;
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'b@example.com'),
  ('00000000-0000-0000-0000-0000000000ad', 'owner@example.com');
insert into public.hs_admins (user_id) values ('00000000-0000-0000-0000-0000000000ad');

\set A '''00000000-0000-0000-0000-00000000000a'''
\set B '''00000000-0000-0000-0000-00000000000b'''
\set AD '''00000000-0000-0000-0000-0000000000ad'''

-- ---- 1. anon: no table is readable or writable, only the open functions run
begin;
select t.as_user(null);
select t.ok(t.err('select * from public.hs_profiles') like '%permission denied%', 'anon reads hs_profiles');
select t.ok(t.err('select * from public.hs_events') like '%permission denied%', 'anon reads hs_events');
select t.ok(t.err('insert into public.hs_admins values (gen_random_uuid())') like '%permission denied%', 'anon writes hs_admins');
select t.ok(t.err('select * from public.hs_rulesets') like '%permission denied%', 'anon reads hs_rulesets');
select t.ok(t.err('select hs_private.is_admin()') like '%permission denied%', 'anon calls a private helper');
select t.ok(t.err('select public.hs_save_get()') like '%permission denied%', 'anon calls hs_save_get');
select t.ok(t.err('select public.hs_stats(7)') like '%permission denied%', 'anon calls hs_stats');
select t.ok(public.hs_config() ? 'now', 'hs_config answers anon');
rollback;

-- ---- 2. names
begin;
select t.as_user(:A::uuid);
select t.ok((public.hs_profile_get() ->> 'name') is null, 'no profile yet');
select t.ok(t.err($$select public.hs_profile_set_name('ab')$$) = 'name_length', 'a name of two letters');
select t.ok(t.err($$select public.hs_profile_set_name('<b>Aram</b>')$$) = 'name_chars', 'markup in a name');
select t.ok(t.err($$select public.hs_profile_set_name('The Adm1n')$$) = 'name_blocked', 'a reserved word, digits swapped');
select t.ok(t.err($$select public.hs_profile_set_name(E'Ar‮am')$$) = 'name_chars', 'a direction override in a name');
select t.ok((public.hs_profile_set_name('  Արամ   Aram ') ->> 'name') = 'Արամ Aram', 'Armenian letters, spaces trimmed');
select t.ok((select count(*) from public.hs_profiles) = 1, 'a player reads only their own profile row');
commit;
begin;
select t.as_user(:B::uuid);
select t.ok(t.err($$select public.hs_profile_set_name('արամ_aram')$$) = 'name_taken', 'the same name folded');
select t.ok((public.hs_profile_set_name('Bagrat') ->> 'ok')::boolean, 'B takes a name');
select t.ok((select count(*) from public.hs_profiles) = 1, 'B does not see A''s profile row');
select t.ok(t.err($$update public.hs_profiles set name = 'x'$$) like '%permission denied%', 'no direct update of a profile');
commit;

-- ---- 3. cloud saves: versions
begin;
select t.as_user(:A::uuid);
select t.ok((public.hs_save_get() ->> 'version')::int = 0, 'no save yet');
select t.ok((public.hs_save_put(0, '{"v":1,"keys":{"hs_records":"{}"}}') ->> 'version')::int = 1, 'first write');
select t.ok((public.hs_save_put(1, '{"v":1,"keys":{"hs_records":"{\"erebuni\":1}"}}') ->> 'version')::int = 2, 'second write');
select t.ok((public.hs_save_put(1, '{"v":1,"keys":{}}') ->> 'ok')::boolean = false, 'a stale write is turned away');
select t.ok((public.hs_save_put(1, '{"v":1,"keys":{}}') -> 'data' -> 'keys' ->> 'hs_records') like '%erebuni%', 'and gets the stored save back');
select t.ok(t.err($$select public.hs_save_put(2, ('{"k":"' || repeat('x', 270000) || '"}')::jsonb)$$) = 'save_too_large', 'a save over 256 KB');
select t.ok(t.err($$select public.hs_save_put(2, '[1]')$$) = 'save_invalid', 'a save that is not an object');
select t.ok((public.hs_save_get('next') ->> 'version')::int = 0, 'the staging channel has a save of its own');
select t.ok((public.hs_save_put(0, '{"v":1,"keys":{"hs_records":"{\"staging\":1}"}}', 'next:test', 'next') ->> 'version')::int = 1, 'and writes it');
select t.ok((public.hs_save_get() -> 'data' -> 'keys' ->> 'hs_records') like '%erebuni%', 'the live save is untouched by it');
select t.ok(t.err($$select public.hs_save_put(0, '{}', null, 'beta')$$) = 'channel_unknown', 'a channel that does not exist');
commit;
begin;
select t.as_user(:B::uuid);
select t.ok((public.hs_save_get() ->> 'version')::int = 0, 'B has no save and cannot see A''s');
select t.ok((select count(*) from public.hs_saves) = 0, 'B reads no row of hs_saves');
rollback;

-- ---- 4. a ruleset: only an admin publishes
begin;
select t.as_user(:A::uuid);
select t.ok(t.err($$select public.hs_admin_publish_ruleset('2', '{}')$$) = 'not_admin', 'a player publishes a ruleset');
select t.ok(t.err($$select public.hs_admin_set_config('gate', '"off"')$$) = 'not_admin', 'a player sets the gate');
select t.ok(t.err($$select public.hs_stats(7)$$) = 'not_admin', 'a player reads the stats');
rollback;
begin;
select t.as_user(:AD::uuid);
select public.hs_admin_publish_ruleset('2', $${
  "v": 1,
  "score": { "win": 4000, "lives": 3000, "speed": 1500, "thrift": 1500, "lostMax": 3999 },
  "levels": {
    "erebuni": { "waves": 10, "d": [ { "lives": 30, "fast": 300, "slow": 900, "earnMax": 6000 },
                                    { "lives": 20, "fast": 300, "slow": 900, "earnMax": 5500 },
                                    { "lives": 14, "fast": 300, "slow": 900, "earnMax": 5200 } ] },
    "tushpa":  { "waves": 12, "d": [ { "lives": 30, "fast": 400, "slow": 1100, "earnMax": 7000 },
                                    { "lives": 20, "fast": 400, "slow": 1100, "earnMax": 6500 },
                                    { "lives": 14, "fast": 400, "slow": 1100, "earnMax": 6200 } ] }
  },
  "daily": { "pool": ["erebuni", "tushpa"], "twists": ["noarchers", "halfpurse", "swift"], "k": 5, "j": 4, "diff": 1, "attempts": 3,
             "t": { "halfpurse": { "earn": 0.9 } } }
}$$::jsonb);
select t.ok((public.hs_admin_set_config('gate', '"optional"') ->> 'gate') = 'optional', 'the admin sets the gate');
select t.ok(t.err($$select public.hs_admin_set_config('gate', '"sometimes"')$$) = 'value_invalid', 'a gate value that does not exist');
commit;

-- ---- 5. a campaign score: bounds, the clock, the boards
begin;
select t.as_user(:A::uuid);
select t.ok(t.err($$select public.hs_run_begin('campaign', 'erebuni', 1, '99')$$) = 'ruleset_unknown', 'a run under an unpublished ruleset');
select t.ok(t.err($$select public.hs_run_begin('campaign', 'nowhere', 1, '2')$$) = 'level_unknown', 'a run on a battlefield the ruleset lacks');
create temp table tr on commit drop as select (public.hs_run_begin('campaign', 'erebuni', 1, '2') ->> 'run_id')::uuid as id;
grant select on tr to authenticated;
-- sent at once, a ten-minute battle cannot have been played
select t.ok(t.err(format($$select public.hs_score_submit(%L, '{"won":true,"lives":20,"waves":10,"sim_sec":600,"spent":900,"earned":3000}')$$, (select id from tr))) = 'score_implausible', 'a score sent sooner than its battle could be fought');
reset role;
update public.hs_runs set started_at = now() - interval '20 minutes';   -- the test's clock: the battle began 20 minutes ago
select t.as_user(:A::uuid);
select t.ok(t.err(format($$select public.hs_score_submit(%L, '{"won":true,"lives":21,"waves":10,"sim_sec":600,"spent":900,"earned":3000}')$$, (select id from tr))) = 'score_implausible', 'more defenders than the difficulty has');
select t.ok(t.err(format($$select public.hs_score_submit(%L, '{"won":true,"lives":20,"waves":10,"sim_sec":100,"spent":900,"earned":3000}')$$, (select id from tr))) = 'score_implausible', 'faster than the fastest battle');
select t.ok(t.err(format($$select public.hs_score_submit(%L, '{"won":true,"lives":20,"waves":10,"sim_sec":600,"spent":900,"earned":99999}')$$, (select id from tr))) = 'score_implausible', 'more gold than the battle pays');
select t.ok(t.err(format($$select public.hs_score_submit(%L, '{"won":false,"lives":0,"waves":4,"sim_sec":600,"spent":900,"earned":3000}')$$, (select id from tr))) = 'score_implausible', 'a campaign defeat is not a score');
-- 20 of 20 defenders, 600 s between fast 300 and slow 900 (half the speed points), 900 of 3000 spent (70% of the thrift points)
select t.ok((public.hs_score_submit((select id from tr), '{"won":true,"lives":20,"waves":10,"sim_sec":600,"spent":900,"earned":3000,"loadout":"std","build":"2026-11-20"}') ->> 'score')::int = 4000 + 3000 + 750 + 1050, 'the score is 4000 + 3000 + 750 + 1050');
select t.ok(t.err(format($$select public.hs_score_submit(%L, '{"won":true,"lives":20,"waves":10,"sim_sec":600,"spent":900,"earned":3000}')$$, (select id from tr))) = 'run_finished', 'a run posts once');
select t.ok((select count(*) from public.hs_score_best) = 2, 'A reads their own two board rows (all time, this week)');
commit;

begin;
select t.as_user(:B::uuid);
create temp table tr on commit drop as select (public.hs_run_begin('campaign', 'erebuni', 1, '2') ->> 'run_id')::uuid as id;
grant select on tr to authenticated;
reset role;
update public.hs_runs set started_at = now() - interval '20 minutes' where user_id = :B::uuid;
select t.as_user(:B::uuid);
select t.ok((public.hs_score_submit((select id from tr), '{"won":true,"lives":10,"waves":10,"sim_sec":900,"spent":3000,"earned":3000}') ->> 'rank_all')::int = 2, 'B ranks second');
select t.ok((select count(*) from public.hs_score_best) = 2, 'B reads only B''s board rows');
select t.ok(jsonb_array_length(public.hs_board('campaign', 'erebuni', 1, 'std', '2', 'all') -> 'rows') = 2, 'the board has both players');
select t.ok((public.hs_board('campaign', 'erebuni', 1, 'std', '2', 'week') -> 'rows' -> 0 ->> 'name') = 'Արամ Aram', 'A leads this week''s board');
select t.ok((public.hs_board('campaign', 'erebuni', 1, 'std', '2', 'all') -> 'me' ->> 'rank')::int = 2, 'B''s own rank comes with the board');
select t.ok(not ((public.hs_board('campaign', 'erebuni', 1, 'std', '2', 'all') -> 'rows' -> 0) ? 'uid'), 'a player''s board rows carry no account ids');
select t.ok(jsonb_array_length(public.hs_board('campaign', 'erebuni', 1, 'open', '2', 'all') -> 'rows') = 0, 'the open board is another board');
select t.ok(t.err(format($$select public.hs_score_submit(%L, '{}')$$, (select id from public.hs_runs limit 1))) in ('run_finished', 'stats_invalid'), 'B sees only B''s runs');
commit;
begin;
select t.as_user(null);
select t.ok(jsonb_array_length(public.hs_board('campaign', 'erebuni', 1, 'std', '2', 'all') -> 'rows') = 2, 'a visitor reads the board');
select t.ok((public.hs_board('campaign', 'erebuni', 1, 'std', '2', 'all') -> 'me') = 'null'::jsonb, 'a visitor has no rank');
rollback;

-- ---- 6. the daily: one battlefield and twist a day, three attempts
begin;
select t.as_user(:A::uuid);
create temp table td on commit drop as select public.hs_daily_status('2') as s;
grant select on td to authenticated;
select t.ok((select s ->> 'level' from td) in ('erebuni', 'tushpa') and (select (s ->> 'attempts')::int from td) = 3, 'today''s challenge is told');
select t.ok(t.err(format($$select public.hs_run_begin('daily', %L, 1, '2', 'no-such-twist')$$, (select s ->> 'level' from td))) = 'daily_mismatch', 'a daily with a twist of one''s own');
select t.ok((public.hs_run_begin('daily', (select s ->> 'level' from td), 1, '2', (select s ->> 'twist' from td)) ->> 'attempts_left')::int = 2, 'first attempt');
select public.hs_run_begin('daily', (select s ->> 'level' from td), 1, '2', (select s ->> 'twist' from td));
create temp table tr on commit drop as select (public.hs_run_begin('daily', (select s ->> 'level' from td), 1, '2', (select s ->> 'twist' from td)) ->> 'run_id')::uuid as id;
grant select on tr to authenticated;
select t.ok((public.hs_run_begin('daily', (select s ->> 'level' from td), 1, '2', (select s ->> 'twist' from td)) ->> 'reason') = 'no_attempts', 'a fourth attempt');
reset role;
update public.hs_runs set started_at = now() - interval '20 minutes' where mode = 'daily';
select t.as_user(:A::uuid);
select t.ok((select q.s between 1 and 3999 from (select (public.hs_score_submit((select id from tr), '{"won":false,"lives":0,"waves":5,"sim_sec":400,"spent":900,"earned":2000}') ->> 'score')::int as s offset 0) q), 'a lost daily scores under 4000');
select t.ok((public.hs_daily_status('2') ->> 'rank')::int = 1 and (public.hs_daily_status('2') ->> 'used')::int = 3, 'the daily''s status after it');
commit;
-- the pick is the spec's arithmetic: level = pool[(day * k) % n], twist = twists[(day * j + floor(day / n)) % m]
select t.ok((select d.level_id from hs_private.daily_pick('{"daily":{"pool":["a","b","c"],"twists":["x","y"],"k":5,"j":3}}', date '2026-11-10') d)
  = (array['a','b','c'])[1 + ((date '2026-11-10' - date '1970-01-01') * 5) % 3], 'the daily''s battlefield');
select t.ok((select d.twist from hs_private.daily_pick('{"daily":{"pool":["a","b","c"],"twists":["x","y"],"k":5,"j":3}}', date '2026-11-10') d)
  = (array['x','y'])[1 + ((date '2026-11-10' - date '1970-01-01') * 3 + (date '2026-11-10' - date '1970-01-01') / 3) % 2], 'the daily''s twist');

-- ---- 7. analytics: anyone may send, nobody but an admin may read
begin;
select t.as_user(null);
select t.ok((public.hs_track('{"aid":"11111111-1111-1111-1111-111111111111","sid":"sess-0001-abcd","build":"2026-11-20","dev":"phone","os":"ios","standalone":false,"vw":667,"vh":320}',
  '[{"n":"page_load","q":1,"t":1794000000000,"p":{}},{"n":"gate_shown","q":2,"t":1794000001000,"p":{"mode":"required"}},{"n":"Bad Name","q":3}]') ->> 'accepted')::int = 2, 'two good events of three');
select t.ok(t.err($$select public.hs_track('{"aid":"22222222-2222-2222-2222-222222222222","sid":"sess-0001-abcd"}', '[{"n":"page_load"}]')$$) = 'ctx_invalid', 'another device borrows a session id');
select t.ok(t.err('select count(*) from public.hs_events') like '%permission denied%', 'anon cannot read events');
commit;
begin;
select t.as_user(:A::uuid);
select public.hs_track('{"aid":"11111111-1111-1111-1111-111111111111","sid":"sess-0001-abcd"}', '[{"n":"signed_in","q":4,"p":{"provider":"google"}},{"n":"victory","q":9,"p":{"lv":"erebuni","diff":1,"lives":17,"lives_max":20}}]');
select t.ok(t.err('select count(*) from public.hs_events') like '%permission denied%', 'a player cannot read events');
commit;
select t.ok((select uid from public.hs_sessions where sid = 'sess-0001-abcd') = :A::uuid, 'the session took the account once signed in');
begin;
select t.as_user(:AD::uuid);
select t.ok((public.hs_stats(30) -> 'funnel' -> 0 ->> 'n')::int = 1 and (public.hs_stats(30) -> 'funnel' -> 3 ->> 'step') = 'signed_in', 'the admin reads the funnel');
select t.ok((public.hs_stats(30) -> 'fields' -> 0 ->> 'wins')::int = 1, 'and the battlefields');
rollback;

-- ---- 8. the sign-in handoff
begin;
select t.as_user(null);
select public.hs_handoff_put('hhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhh', '009e5066-fc11-4eca-8c8c-6fd82aa263f2');
select t.ok((public.hs_handoff_take('hhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhh') ->> 'code') = '009e5066-fc11-4eca-8c8c-6fd82aa263f2', 'the code is handed over');
select t.ok((public.hs_handoff_take('hhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhh') ->> 'code') is null, 'once');
commit;

-- ---- 9. moderation and removal
begin;
select t.as_user(:AD::uuid);
select public.hs_admin_moderate(:A::uuid, true);
select t.ok(jsonb_array_length(public.hs_board('campaign', 'erebuni', 1, 'std', '2', 'all') -> 'rows') = 1, 'a hidden player is off the board');
select public.hs_admin_moderate(:A::uuid, false);
select t.ok((public.hs_board('campaign', 'erebuni', 1, 'std', '2', 'all') -> 'rows' -> 0) ? 'id', 'an admin''s board rows carry the score ids');
select public.hs_admin_remove_score((select (r ->> 'id')::bigint from jsonb_array_elements(public.hs_board('campaign', 'erebuni', 1, 'std', '2', 'all') -> 'rows') r where r ->> 'name' = 'Bagrat'));
select t.ok(jsonb_array_length(public.hs_board('campaign', 'erebuni', 1, 'std', '2', 'all') -> 'rows') = 1, 'a removed score is off the board');
commit;

-- ---- 10. delete my account: every row of the player goes
begin;
select t.as_user(:A::uuid);
select public.hs_delete_account();
commit;
select t.ok(not exists (select 1 from auth.users where id = :A::uuid), 'the account is gone');
select t.ok(not exists (select 1 from public.hs_profiles where user_id = :A::uuid) and not exists (select 1 from public.hs_saves where user_id = :A::uuid)
  and not exists (select 1 from public.hs_scores where user_id = :A::uuid) and not exists (select 1 from public.hs_score_best where user_id = :A::uuid)
  and not exists (select 1 from public.hs_runs where user_id = :A::uuid) and not exists (select 1 from public.hs_sessions where uid = :A::uuid), 'and every row that was theirs');
select t.ok(exists (select 1 from public.hs_profiles where user_id = :B::uuid), 'B is untouched');

-- ---- 11. every hs_ table has row level security on, and no hs_ function is open to PUBLIC
select t.ok(not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname like 'hs\_%' and c.relkind = 'r' and not c.relrowsecurity), 'row level security on every hs_ table');
select t.ok(not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('public', 'hs_private') and (p.proname like 'hs\_%' or n.nspname = 'hs_private')
    and has_function_privilege('public', p.oid, 'execute')), 'no hs_ function is open to PUBLIC');
select t.ok(not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname like 'hs\_%' and p.prosecdef and (p.proconfig is null or not p.proconfig @> array['search_path=""'])), 'every definer function pins its search_path');

\echo SCHEMA TESTS PASSED
