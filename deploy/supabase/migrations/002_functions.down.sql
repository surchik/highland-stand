-- Highland Stand, migration 002 (down): drops every view and function 002 made, by its full signature, newest
-- first; nothing cascades, so anything outside the schema that had come to depend on one stops the rollback with an
-- error instead of being removed. It drops nothing outside the schema highland. (Take away the optional handoff,
-- deploy/supabase/optional/handoff.down.sql, first if it was loaded.)
drop view highland._v_battles;
drop view highland._v_game_first_seen;
drop view highland._v_game_sessions;
drop view highland._v_first_seen;
drop view highland._v_sessions;
drop function highland.hs_stats(integer,text[]);
drop function highland.hs_admin_purge_events(integer);
drop function highland.hs_admin_remove_score(bigint);
drop function highland.hs_admin_moderate(uuid,boolean,text);
drop function highland.hs_admin_set_config(text,jsonb);
drop function highland.hs_admin_publish_ruleset(text,jsonb);
drop function highland.hs_delete_account();
drop function highland.hs_track(jsonb,jsonb);
drop function highland.hs_daily_status(text);
drop function highland.hs_board(text,text,integer,text,text,text,date,integer);
drop function highland.hs_score_submit(uuid,jsonb);
drop function highland.hs_run_begin(text,text,integer,text,text);
drop function highland.hs_save_put(integer,jsonb,text,text);
drop function highland.hs_save_get(text);
drop function highland.hs_profile_set_name(text,uuid);
drop function highland.hs_profile_get();
drop function highland.hs_config();
drop function highland._ruleset_problem(jsonb);
drop function highland._flat_enough(jsonb);
drop function highland._rank_of(text,text,uuid);
drop function highland._bounds(jsonb,text,integer,text,boolean);
drop function highland._daily_board(date,text);
drop function highland._campaign_board(text,integer,text,integer,text);
drop function highland._board_tail(text);
drop function highland._channel_of(text);
drop function highland._daily_pick(jsonb,date);
drop function highland._week_key(timestamp with time zone);
drop function highland._name_clean(text);
drop function highland._int_or_null(text);
drop function highland._tag(text);
drop function highland._name_letters(text);
drop function highland._name_fold(text);
drop function highland._limit_hit();
drop function highland._rate_ok(text,text,integer,integer,integer);
drop function highland._need_admin();
drop function highland._is_admin();
drop function highland._rate_peek(text,text,integer);
drop function highland._game_account(uuid);
drop function highland._member_or_null();
drop function highland._member();
drop function highland._game_session();
drop function highland._uid_or_null();
drop function highland._uid();
drop function highland._now();

notify pgrst, 'reload schema';
