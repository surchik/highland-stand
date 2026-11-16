-- Highland Stand, migration 005 (up): "Delete my account" asks for a session of the game's own sign-in (work
-- package P8; RULINGS S9 and S10).
--
-- Why: the shared sign-in service has an open email sign-up and links accounts that share an email. Someone who
-- made an account with a player's email before the player first came with Google can sign in to that same account
-- by password. Every other function of a player's already refuses such a session (not_game_session); deleting the
-- player's game data was the one thing it could still do. Now it cannot.
--
-- What goes is what went before (002), and the rate counters of the devices whose visits go with it (keyed by
-- their anonymous ids), so nothing of those visits is left behind. The sign-in account in auth.users, its
-- identities and the sign-in service's log are never touched: they are shared with the other apps on this server.
-- An account in a game session that is no player (it never chose a name, or deleted its data before) may still
-- call it: all it can do is remove the caller's own rows. The function keeps its signature, so 003's grant stands
-- (migrate.js runs the lockdown and 003's grants again after this migration).
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
