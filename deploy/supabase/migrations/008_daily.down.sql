-- Highland Stand, migration 008 (down): hs_daily_status as 002 made it, hs_score_submit and hs_run_begin as 007 made
-- them (the same signatures, so 003's grants stand), and the two helpers of 008 removed. No table or row is changed.
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

create or replace function highland.hs_score_submit(p_run uuid, p_stats jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := highland._member(); run highland.hs_runs; rs highland.hs_rulesets; b record; w jsonb;
  v_won boolean; v_lives integer; v_waves integer; v_sec integer; v_spent integer; v_earned integer; v_loadout text;
  v_score integer; v_stars integer; v_flags text[] := '{}'; v_elapsed numeric; v_board text; v_week text;
  v_sid bigint; v_better_all boolean := false; v_better_week boolean := false; ra record; rw record; fL numeric; fS numeric; fT numeric;
  v_now timestamptz := highland._now(); v_prev_all integer; v_prev_week integer;
begin
  if not highland._rate_ok('score', v_uid::text, 3600, 40) then perform highland._limit_hit(); end if;
  select * into run from highland.hs_runs where id = p_run and user_id = v_uid for update;
  if not found then raise exception 'run_unknown' using errcode = 'P0001'; end if;
  if run.finished_at is not null then raise exception 'run_finished' using errcode = 'P0001'; end if;
  select * into rs from highland.hs_rulesets where id = run.ruleset and active;
  if not found then raise exception 'ruleset_unknown' using errcode = 'P0001'; end if;
  select * into b from highland._bounds(rs.data, run.level_id, run.diff, run.twist, run.mode = 'daily');
  w := rs.data -> 'score';
  begin
    if jsonb_typeof(p_stats) <> 'object' then raise exception 'not an object'; end if;
    v_won := (p_stats ->> 'won')::boolean; v_lives := (p_stats ->> 'lives')::integer; v_waves := (p_stats ->> 'waves')::integer;
    v_sec := (p_stats ->> 'sim_sec')::numeric::integer; v_spent := (p_stats ->> 'spent')::integer; v_earned := (p_stats ->> 'earned')::integer;
    v_loadout := case when run.mode = 'daily' then 'std' else coalesce(p_stats ->> 'loadout', 'std') end;
  exception when others then
    raise exception 'stats_invalid' using errcode = 'P0001';
  end;
  if v_won is null or v_lives is null or v_waves is null or v_sec is null or v_spent is null or v_earned is null
     or v_loadout not in ('std', 'open') then
    raise exception 'stats_invalid' using errcode = 'P0001';
  end if;
  -- what cannot be: the checks a made-up score has to pass. A win may count 0 defenders: a resumed battle's
  -- worse attempts are taken off the boards' count (lives_board, RULINGS S2), and nothing is left to take.
  if v_won and (v_waves <> b.waves or v_lives < 0 or v_lives > b.lives) then raise exception 'score_implausible' using errcode = 'P0001', detail = 'lives or waves'; end if;
  if not v_won and (run.mode <> 'daily' or v_waves < 0 or v_waves >= b.waves or v_lives <> 0) then raise exception 'score_implausible' using errcode = 'P0001', detail = 'a defeat'; end if;
  if v_sec > 6 * 3600 or v_sec < floor(b.min_sec * 0.9 * v_waves / b.waves) then raise exception 'score_implausible' using errcode = 'P0001', detail = 'time'; end if;
  if v_earned < 0 or v_earned > b.earn_max or v_spent < 0 or v_spent > v_earned or (v_won and v_spent < 1) then raise exception 'score_implausible' using errcode = 'P0001', detail = 'gold'; end if;
  -- the battle clock is game time and the top speed is 4x: a result cannot come sooner than a quarter of it
  v_elapsed := extract(epoch from v_now - run.started_at);
  if v_elapsed < v_sec / 4.2 - 5 then raise exception 'score_implausible' using errcode = 'P0001', detail = 'clock'; end if;
  if v_elapsed > 30 * 86400 then raise exception 'run_expired' using errcode = 'P0001'; end if;
  -- the score (the same arithmetic as the page's scoreOf, docs/specs/platform.final.md 5.1)
  fL := v_lives::numeric / b.lives;
  fS := greatest(0, least(1, (b.slow - v_sec)::numeric / greatest(1, b.slow - b.fast)));
  fT := greatest(0, least(1, 1 - v_spent::numeric / greatest(1, v_earned)));
  if v_won then
    v_score := (w ->> 'win')::integer + round((w ->> 'lives')::numeric * fL + (w ->> 'speed')::numeric * fS + (w ->> 'thrift')::numeric * fT);
    v_stars := case when v_lives >= b.lives * 0.85 then 3 when v_lives >= b.lives * 0.5 then 2 else 1 end;
  else
    -- a lost daily: by the waves cleared out of the daily's length (RULINGS S3), under any win
    v_score := least(floor(4000 * v_waves::numeric / b.waves), coalesce((w ->> 'lostMax')::integer, 3999), 3999);
    v_stars := 0;
  end if;
  if v_sec < b.fast then v_flags := array_append(v_flags, 'fast'); end if;
  if v_won and fL = 1 and fS > 0.95 and fT > 0.9 then v_flags := array_append(v_flags, 'perfect'); end if;
  -- the boards: the player's best per board, all time and this week (a daily has its day's board alone)
  if run.mode = 'daily' then
    v_board := highland._daily_board(run.day, run.channel); v_week := null;
  else
    v_board := highland._campaign_board(run.level_id, run.diff, v_loadout, run.rev, run.channel);
    v_week := highland._week_key(v_now);
  end if;
  insert into highland.hs_scores (run_id, user_id, mode, level_id, diff, ruleset, loadout, day, twist, won, score, stars,
      lives, lives_max, waves, waves_total, sim_sec, spent, earned, build, board, flags, created_at)
    values (run.id, v_uid, run.mode, run.level_id, run.diff, run.ruleset, v_loadout, run.day, run.twist, v_won, v_score, v_stars,
      v_lives, b.lives, v_waves, b.waves, v_sec, v_spent, v_earned, left(p_stats ->> 'build', 20), v_board, v_flags, v_now)
    returning id into v_sid;
  update highland.hs_runs set finished_at = v_now where id = run.id;
  -- the player's best before this result: the victory page says "your best" only when one was beaten
  select score into v_prev_all from highland.hs_score_best where board = v_board and period = 'all' and user_id = v_uid;
  if v_week is not null then
    select score into v_prev_week from highland.hs_score_best where board = v_board and period = v_week and user_id = v_uid;
  end if;
  insert into highland.hs_score_best as s (board, period, user_id, score, score_id, lives, sim_sec, achieved_at)
    values (v_board, 'all', v_uid, v_score, v_sid, v_lives, v_sec, v_now)
    on conflict (board, period, user_id) do update
      set score = excluded.score, score_id = excluded.score_id, lives = excluded.lives, sim_sec = excluded.sim_sec, achieved_at = excluded.achieved_at
      where excluded.score > s.score
    returning true into v_better_all;
  if v_week is not null then
    insert into highland.hs_score_best as s (board, period, user_id, score, score_id, lives, sim_sec, achieved_at)
      values (v_board, v_week, v_uid, v_score, v_sid, v_lives, v_sec, v_now)
      on conflict (board, period, user_id) do update
        set score = excluded.score, score_id = excluded.score_id, lives = excluded.lives, sim_sec = excluded.sim_sec, achieved_at = excluded.achieved_at
        where excluded.score > s.score
      returning true into v_better_week;
  end if;
  select * into ra from highland._rank_of(v_board, 'all', v_uid);
  if v_week is not null then select * into rw from highland._rank_of(v_board, v_week, v_uid); end if;
  return jsonb_build_object('accepted', true, 'score', v_score, 'stars', v_stars, 'board', v_board,
    'best_all', coalesce(v_better_all, false), 'rank_all', ra.rank, 'total_all', ra.total,
    'best_week', coalesce(v_better_week, false), 'rank_week', case when v_week is not null then rw.rank end,
    'total_week', case when v_week is not null then rw.total end,
    'beat_all', v_prev_all is not null and v_score > v_prev_all, 'beat_week', v_prev_week is not null and v_score > v_prev_week,
    'mode', run.mode, 'level', run.level_id, 'diff', run.diff, 'loadout', v_loadout, 'day', run.day, 'now', v_now);
end $$;

create or replace function highland.hs_run_begin(p_mode text, p_level text, p_diff integer, p_ruleset text, p_twist text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := highland._member(); rs highland.hs_rulesets; v_day date; v_level text; v_twist text;
  v_used integer; v_max integer; v_id uuid; b record; v_now timestamptz := highland._now(); v_new jsonb; v_nl text; v_nt text;
  v_chan text := highland._channel_of(p_ruleset);
begin
  if p_mode is null or p_mode not in ('campaign', 'daily') then raise exception 'mode_unknown' using errcode = 'P0001'; end if;
  -- the owner's switches (7.5): with the boards off no battle is ranked, with the daily off no daily. The page reads
  -- the same switches from hs_config and does not ask; an older page that asks is told no, and spends no attempt
  if p_mode = 'campaign' and exists (select 1 from highland.hs_config where key = 'boards' and value = 'false'::jsonb) then
    return jsonb_build_object('ok', false, 'reason', 'boards_off', 'now', v_now);
  end if;
  if p_mode = 'daily' and exists (select 1 from highland.hs_config where key = 'daily' and value = 'false'::jsonb) then
    return jsonb_build_object('ok', false, 'reason', 'daily_off', 'now', v_now);
  end if;
  select * into rs from highland.hs_rulesets where id = p_ruleset and active;
  if not found then raise exception 'ruleset_unknown' using errcode = 'P0001'; end if;
  if not highland._rate_ok('run', v_uid::text, 3600, 60) then perform highland._limit_hit(); end if;
  if p_mode = 'daily' then
    v_day := (v_now at time zone 'utc')::date;
    select d.level_id, d.twist into v_level, v_twist from highland._daily_pick(rs.data, v_day) d;
    if v_level is distinct from p_level or v_twist is distinct from p_twist or p_diff is distinct from (rs.data -> 'daily' ->> 'diff')::integer then
      raise exception 'daily_mismatch' using errcode = 'P0001';
    end if;
    -- the day's board is one for the whole channel: an older page whose ruleset would make it a different battle
    -- (another battlefield, twist, difficulty or table) than the newest ruleset's is turned away, not let in
    select r.data into v_new from highland.hs_rulesets r where r.active and highland._channel_of(r.id) = v_chan
      order by r.published_at desc, r.id desc limit 1;
    select d.level_id, d.twist into v_nl, v_nt from highland._daily_pick(v_new, v_day) d;
    if v_nl is distinct from v_level or v_nt is distinct from v_twist
       or (v_new -> 'daily' -> 'diff') is distinct from (rs.data -> 'daily' -> 'diff')
       or (v_new -> 'daily' -> 'waves') is distinct from (rs.data -> 'daily' -> 'waves')
       or (v_new -> 'daily' -> 'levels' -> v_level) is distinct from (rs.data -> 'daily' -> 'levels' -> v_level)
       or (v_new -> 'daily' -> 't' -> v_twist) is distinct from (rs.data -> 'daily' -> 't' -> v_twist)
       or (v_new -> 'levels' -> v_level -> 'd' -> p_diff -> 'lives') is distinct from (rs.data -> 'levels' -> v_level -> 'd' -> p_diff -> 'lives') then
      raise exception 'daily_mismatch' using errcode = 'P0001', detail = 'an older ruleset';
    end if;
    v_max := (rs.data -> 'daily' ->> 'attempts')::integer;
    -- attempts are counted per day and per channel: a try on the staging page spends none of the live game's
    select count(*) into v_used from highland.hs_runs where user_id = v_uid and mode = 'daily' and day = v_day and channel = v_chan;
    if v_used >= v_max then
      return jsonb_build_object('ok', false, 'reason', 'no_attempts', 'day', v_day, 'attempts_left', 0, 'now', v_now);
    end if;
  else
    v_twist := null;
  end if;
  select * into b from highland._bounds(rs.data, p_level, p_diff, v_twist, p_mode = 'daily');   -- raises when the ruleset has no such battle
  if p_mode = 'campaign' and b.rev is null then raise exception 'level_unknown' using errcode = 'P0001'; end if;
  insert into highland.hs_runs (user_id, mode, level_id, diff, ruleset, rev, channel, day, twist, started_at)
    values (v_uid, p_mode, p_level, p_diff, p_ruleset, b.rev, v_chan, v_day, v_twist, v_now) returning id into v_id;
  return jsonb_build_object('ok', true, 'run_id', v_id, 'day', v_day, 'now', v_now,
    'attempts_left', case when p_mode = 'daily' then v_max - v_used - 1 end);
end $$;

drop function highland._daily_top(text, integer);
drop function highland._daily_same(jsonb, jsonb, date);

notify pgrst, 'reload schema';
