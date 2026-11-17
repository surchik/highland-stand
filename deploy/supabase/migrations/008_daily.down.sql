-- Highland Stand, migration 008 (down): hs_daily_status as 002 made it (the same signature, so 003's grant stands),
-- and the two helpers of 008 removed. No table or row is changed.
create or replace function highland.hs_daily_status(p_ruleset text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_uid uuid := highland._member_or_null(); rs highland.hs_rulesets; v_now timestamptz := highland._now();
  v_day date := (v_now at time zone 'utc')::date; d record; v_chan text := highland._channel_of(coalesce(p_ruleset, ''));
  v_used integer := 0; v_best integer; me record; v_board text;
begin
  select * into rs from highland.hs_rulesets where id = p_ruleset and active;
  if not found then raise exception 'ruleset_unknown' using errcode = 'P0001'; end if;
  select * into d from highland._daily_pick(rs.data, v_day);
  v_board := highland._daily_board(v_day, v_chan);
  if v_uid is not null then
    select count(*) into v_used from highland.hs_runs where user_id = v_uid and mode = 'daily' and day = v_day and channel = v_chan;
    select score into v_best from highland.hs_score_best where board = v_board and period = 'all' and user_id = v_uid;
  end if;
  select * into me from highland._rank_of(v_board, 'all', v_uid);
  return jsonb_build_object('day', v_day, 'level', d.level_id, 'twist', d.twist, 'diff', (rs.data -> 'daily' ->> 'diff')::integer,
    'waves', (rs.data -> 'daily' ->> 'waves')::integer,
    'attempts', (rs.data -> 'daily' ->> 'attempts')::integer, 'used', v_used, 'best', v_best, 'rank', me.rank, 'total', me.total,
    'ends_in', extract(epoch from (v_day + 1)::timestamp - (v_now at time zone 'utc'))::integer, 'now', v_now);
end $$;

drop function highland._daily_top(text, integer);
drop function highland._daily_same(jsonb, jsonb, date);

notify pgrst, 'reload schema';
