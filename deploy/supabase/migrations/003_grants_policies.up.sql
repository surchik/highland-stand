-- Highland Stand, migration 003 (up): who may call what, and the row level security policies.
-- Idempotent: tools/platform/migrate.js runs it again after every later migration, and the restore rehearsal runs
-- it after a restore (a restore can bring back wider grants). It touches nothing outside the schema highland.
--
-- 1. The lockdown (the same block as lockdown.sql): everything in highland taken away from PUBLIC, anon,
--    authenticated and service_role.
-- 2. The only grants: USAGE on the schema to anon and authenticated, and EXECUTE on exactly the functions the page
--    calls. service_role gets nothing: the game never uses the service key. No table, view or sequence is granted
--    to anyone, and no helper (_...).
-- 3. Row level security policies, as defence in depth. The functions run as the tables' owner and are not held to
--    them; they matter only if a grant is ever given by mistake: then a player still reads only his own rows of the
--    per-player tables, and nothing of the others, and writes nothing. (service_role bypasses row level security on
--    Supabase: for it, the missing grants are the only wall.)
-- 4. Default privileges in the schema, revoked for the migrating role. This cannot undo Supabase's global default
--    privileges (PostgreSQL only adds per-schema defaults to the global ones), which is why step 1 runs after every
--    migration.

do $lockdown$
begin
  if to_regnamespace('highland') is null then return; end if;
  revoke all on schema highland from public, anon, authenticated, service_role;
  revoke all on all tables in schema highland from public, anon, authenticated, service_role;
  revoke all on all sequences in schema highland from public, anon, authenticated, service_role;
  revoke all on all routines in schema highland from public, anon, authenticated, service_role;
end $lockdown$;

grant usage on schema highland to anon, authenticated;

-- open to everyone: the switches, the analytics, the boards, the daily
grant execute on function highland.hs_config(), highland.hs_track(jsonb, jsonb),
  highland.hs_board(text, text, integer, text, text, text, date, integer), highland.hs_daily_status(text) to anon, authenticated;
-- a signed-in account (each function then asks for a player, or for an admin, itself)
grant execute on function highland.hs_profile_get(), highland.hs_profile_set_name(text, uuid), highland.hs_save_get(text),
  highland.hs_save_put(integer, jsonb, text, text), highland.hs_run_begin(text, text, integer, text, text), highland.hs_score_submit(uuid, jsonb),
  highland.hs_delete_account(), highland.hs_stats(integer, text[]), highland.hs_admin_publish_ruleset(text, jsonb), highland.hs_admin_set_config(text, jsonb),
  highland.hs_admin_moderate(uuid, boolean, text), highland.hs_admin_remove_score(bigint), highland.hs_admin_purge_events(integer) to authenticated;
-- the optional sign-in handoff (deploy/supabase/optional/handoff.up.sql), only where it was loaded
do $$ begin
  if to_regprocedure('highland.hs_handoff_put(text, text)') is not null then
    grant execute on function highland.hs_handoff_put(text, text), highland.hs_handoff_take(text) to anon, authenticated;
  end if;
end $$;

-- the policies (dropped first, so the file can run again)
do $$
declare t text; own text; pair text;
begin
  -- the per-player tables: a player may read his own rows, and nothing else of them; nobody may write through a grant
  foreach pair in array array['hs_profiles:user_id', 'hs_saves:user_id', 'hs_runs:user_id', 'hs_sessions:uid', 'hs_admins:user_id'] loop
    t := split_part(pair, ':', 1); own := split_part(pair, ':', 2);
    execute format('drop policy if exists %I on highland.%I', t || '_own_rows', t);
    execute format('create policy %I on highland.%I as permissive for select to authenticated using (%I = (select auth.uid()))',
      t || '_own_rows', t, own);
  end loop;
  -- the shared tables: the boards and scores (read only through hs_board), the events, the switches, the name filter,
  -- the rulesets, the rate counters and the bookkeeping: no row for any API role, by any command
  foreach t in array array['hs_scores', 'hs_score_best', 'hs_events', 'hs_config', 'hs_name_blocklist', 'hs_rulesets', 'hs_rate',
      'schema_migrations'] loop
    execute format('drop policy if exists %I on highland.%I', t || '_no_rows', t);
    execute format('create policy %I on highland.%I as permissive for all to anon, authenticated, service_role using (false) with check (false)',
      t || '_no_rows', t);
  end loop;
end $$;

-- new objects in highland made by the migrating role: nothing for the API roles by default (see 4. above)
alter default privileges in schema highland revoke all on tables from public, anon, authenticated, service_role;
alter default privileges in schema highland revoke all on sequences from public, anon, authenticated, service_role;
alter default privileges in schema highland revoke all on functions from public, anon, authenticated, service_role;
alter default privileges in schema highland revoke all on types from public, anon, authenticated, service_role;

notify pgrst, 'reload schema';
