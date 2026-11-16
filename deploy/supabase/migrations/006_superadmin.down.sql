-- Highland Stand, migration 006 (down): the superadmin and the Players view taken away. hs_profile_get goes back to
-- 002's and "Delete my account" to 005's (the same signatures, so 003's grants stand). The superadmins' rows and the
-- audit rows go with their tables. It changes nothing outside the schema highland.
drop function highland.hs_super_players(text, boolean, text, integer, integer, text);
drop function highland.hs_super_player(uuid, text);
drop function highland.hs_grant_superadmin_by_email(text);
drop function highland.hs_revoke_superadmin_by_email(text);
drop function highland._super_rows(text);
drop function highland._sum_map(jsonb, integer);
drop function highland._sum_int(jsonb, integer);
drop function highland._account_by_email(text);
drop function highland._owner_only();
drop function highland._need_super();

-- hs_profile_get as 002 made it
create or replace function highland.hs_profile_get() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_uid uuid := highland._uid(); r highland.hs_profiles;
begin
  select * into r from highland.hs_profiles where user_id = v_uid;
  return jsonb_build_object('user_id', v_uid, 'name', r.name, 'hidden', coalesce(r.hidden, false),
    'name_changed_at', r.name_changed_at, 'admin', highland._is_admin(), 'now', highland._now());
end $$;

-- "Delete my account" as 005 made it
create or replace function highland.hs_delete_account() returns jsonb
language plpgsql security definer set search_path = '' set statement_timeout = '30s' as $$
declare v_uid uuid := highland._uid(); v_aids uuid[];
begin
  if not highland._game_session() then raise exception 'not_game_session' using errcode = '42501'; end if;
  -- the devices this account played on: their visits from before any sign-in go too, and their rate counters
  select coalesce(array_agg(distinct s.aid), '{}') into v_aids from highland.hs_sessions s where s.uid = v_uid;
  delete from highland.hs_sessions where uid is null and aid = any (v_aids);
  delete from highland.hs_sessions where uid = v_uid;
  delete from highland.hs_rate where key = v_uid::text;
  delete from highland.hs_rate where key = any (select a::text from unnest(v_aids) a);
  delete from highland.hs_score_best where user_id = v_uid;
  delete from highland.hs_scores where user_id = v_uid;
  delete from highland.hs_runs where user_id = v_uid;
  delete from highland.hs_saves where user_id = v_uid;
  delete from highland.hs_admins where user_id = v_uid;
  update highland.hs_rulesets set published_by = null where published_by = v_uid;
  delete from highland.hs_profiles where user_id = v_uid;
  return jsonb_build_object('ok', true);
end $$;

drop function highland._is_super();
drop table highland.hs_super_audit;
drop table highland.hs_superadmins;

notify pgrst, 'reload schema';
