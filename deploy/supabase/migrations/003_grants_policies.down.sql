-- Highland Stand, migration 003 (down): takes back every grant and drops every policy 003 made, leaving the schema
-- as 002 left it: locked down, granted to nobody, row level security still on (001 switched it on). It drops
-- nothing outside the schema highland.
do $$
declare t text;
begin
  foreach t in array array['hs_profiles', 'hs_saves', 'hs_runs', 'hs_sessions', 'hs_admins'] loop
    execute format('drop policy if exists %I on highland.%I', t || '_own_rows', t);
  end loop;
  foreach t in array array['hs_scores', 'hs_score_best', 'hs_events', 'hs_config', 'hs_name_blocklist', 'hs_rulesets', 'hs_rate',
      'schema_migrations'] loop
    execute format('drop policy if exists %I on highland.%I', t || '_no_rows', t);
  end loop;
end $$;

do $lockdown$
begin
  if to_regnamespace('highland') is null then return; end if;
  revoke all on schema highland from public, anon, authenticated, service_role;
  revoke all on all tables in schema highland from public, anon, authenticated, service_role;
  revoke all on all sequences in schema highland from public, anon, authenticated, service_role;
  revoke all on all routines in schema highland from public, anon, authenticated, service_role;
end $lockdown$;

-- (the per-schema default privileges 003 revoked never held anything: there is nothing to give back)
notify pgrst, 'reload schema';
