-- Highland Stand, migration 005 (down): "Delete my account" as 002 made it (any signed-in account, the visits and
-- the account's own rate counters). The same signature, so 003's grant stands. It changes nothing outside the
-- schema highland and no row.
create or replace function highland.hs_delete_account() returns jsonb
language plpgsql security definer set search_path = '' set statement_timeout = '30s' as $$
declare v_uid uuid := highland._uid();
begin
  delete from highland.hs_sessions where uid is null and aid in (select s.aid from highland.hs_sessions s where s.uid = v_uid);
  delete from highland.hs_sessions where uid = v_uid;
  delete from highland.hs_rate where key = v_uid::text;
  delete from highland.hs_score_best where user_id = v_uid;
  delete from highland.hs_scores where user_id = v_uid;
  delete from highland.hs_runs where user_id = v_uid;
  delete from highland.hs_saves where user_id = v_uid;
  delete from highland.hs_admins where user_id = v_uid;
  update highland.hs_rulesets set published_by = null where published_by = v_uid;
  delete from highland.hs_profiles where user_id = v_uid;
  return jsonb_build_object('ok', true);
end $$;
