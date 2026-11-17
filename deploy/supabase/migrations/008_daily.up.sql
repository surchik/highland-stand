-- Highland Stand, migration 008 (up): the daily challenge's tab (work package P6; docs/specs/platform.final.md 5.6).
--
-- 002 already picks the day's battlefield and twist from the day alone (_daily_pick), counts the attempts, keeps the
-- day's board and answers hs_daily_status. The Daily tab says more than that answer held, and would have needed two
-- more calls for it. So hs_daily_status keeps its signature (003's grant to anon and authenticated stands: migrate.js
-- runs the lockdown and 003's grants again after this migration, and nothing new is granted to anyone) and answers,
-- besides what it answered before:
-- - attempts_left: the player's attempts left today (null for a visitor or an account that is no player);
-- - stale: true when the newest ruleset published on the page's channel would make today's daily another battle than
--   the page's ruleset makes it (another battlefield, twist, difficulty, length, table or defenders). hs_run_begin
--   turns such a page away ("daily_mismatch", "an older ruleset", 007), so the tab says to reload the page instead
--   of offering an attempt that would be refused. _daily_same holds the comparison, the same as hs_run_begin's;
-- - yesterday: yesterday's battlefield and twist under the same ruleset and its board's first three rows (rank,
--   name, score) and how many were on it: the tab's last line, "Yesterday: 1. Bagrat 9,105 ...".
-- Two helpers, granted to nobody (the lockdown takes back what Supabase's default privileges grant): _daily_same and
-- _daily_top. A hidden player is on no board here either.
-- And hs_score_submit (007's, the same signature, so its grant stands too) keeps a week's rank in two numbers instead
-- of a record: a daily has no week, the record stayed unassigned, and PostgreSQL refuses to read an unassigned record
-- even inside a CASE branch not taken. A connection whose first call of the function was a daily's result failed
-- with it ("record rw is not assigned yet"); a connection that had posted a campaign battle first did not, which is
-- why the tests, on one connection each, never saw it. Everything else of the function is 007's.

-- whether two rulesets make the same daily on a day (what hs_run_begin compares for "an older ruleset", 007)
create function highland._daily_same(p_a jsonb, p_b jsonb, p_day date) returns boolean
language plpgsql immutable set search_path = '' as $$
declare a record; b record; v_diff text := p_a -> 'daily' ->> 'diff';
begin
  if p_a is null or p_b is null then return p_a is null and p_b is null; end if;
  select * into a from highland._daily_pick(p_a, p_day);
  select * into b from highland._daily_pick(p_b, p_day);
  return a.level_id is not distinct from b.level_id and a.twist is not distinct from b.twist
    and (p_a -> 'daily' -> 'diff') is not distinct from (p_b -> 'daily' -> 'diff')
    and (p_a -> 'daily' -> 'waves') is not distinct from (p_b -> 'daily' -> 'waves')
    and (p_a -> 'daily' -> 'levels' -> a.level_id) is not distinct from (p_b -> 'daily' -> 'levels' -> a.level_id)
    and (p_a -> 'daily' -> 't' -> a.twist) is not distinct from (p_b -> 'daily' -> 't' -> a.twist)
    and (p_a -> 'levels' -> a.level_id -> 'd' -> v_diff::integer -> 'lives') is not distinct from (p_b -> 'levels' -> a.level_id -> 'd' -> v_diff::integer -> 'lives');
end $$;

-- the first p_n rows of a board (all time), hidden players left out: [{ rank, name, score }]
create function highland._daily_top(p_board text, p_n integer) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('rank', q.rn, 'name', q.name, 'score', q.score) order by q.rn, q.achieved_at), '[]'::jsonb)
  from (select s.score, s.achieved_at, p.name, rank() over (order by s.score desc, s.achieved_at) as rn
        from highland.hs_score_best s join highland.hs_profiles p on p.user_id = s.user_id
        where s.board = p_board and s.period = 'all' and not p.hidden
        order by s.score desc, s.achieved_at limit greatest(1, least(p_n, 10))) q;
$$;

create or replace function highland.hs_daily_status(p_ruleset text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_uid uuid := highland._member_or_null(); rs highland.hs_rulesets; v_now timestamptz := highland._now();
  v_day date := (v_now at time zone 'utc')::date; d record; y record; v_chan text := highland._channel_of(coalesce(p_ruleset, ''));
  v_used integer := 0; v_best integer; me record; v_board text; v_ybd text; v_new jsonb; v_max integer; ytot integer;
begin
  select * into rs from highland.hs_rulesets where id = p_ruleset and active;
  if not found then raise exception 'ruleset_unknown' using errcode = 'P0001'; end if;
  select * into d from highland._daily_pick(rs.data, v_day);
  v_board := highland._daily_board(v_day, v_chan);
  v_max := (rs.data -> 'daily' ->> 'attempts')::integer;
  if v_uid is not null then
    select count(*) into v_used from highland.hs_runs where user_id = v_uid and mode = 'daily' and day = v_day and channel = v_chan;
    select score into v_best from highland.hs_score_best where board = v_board and period = 'all' and user_id = v_uid;
  end if;
  select * into me from highland._rank_of(v_board, 'all', v_uid);
  -- the newest ruleset of the channel, as hs_run_begin reads it
  select r.data into v_new from highland.hs_rulesets r where r.active and highland._channel_of(r.id) = v_chan
    order by r.published_at desc, r.id desc limit 1;
  select * into y from highland._daily_pick(rs.data, v_day - 1);
  v_ybd := highland._daily_board(v_day - 1, v_chan);
  select count(*) into ytot from highland.hs_score_best s join highland.hs_profiles p on p.user_id = s.user_id
    where s.board = v_ybd and s.period = 'all' and not p.hidden;
  return jsonb_build_object('day', v_day, 'level', d.level_id, 'twist', d.twist, 'diff', (rs.data -> 'daily' ->> 'diff')::integer,
    'waves', (rs.data -> 'daily' ->> 'waves')::integer,
    'attempts', v_max, 'used', v_used, 'attempts_left', case when v_uid is not null then greatest(0, v_max - v_used) end,
    'best', v_best, 'rank', me.rank, 'total', me.total,
    'stale', not highland._daily_same(rs.data, v_new, v_day),
    'yesterday', jsonb_build_object('day', v_day - 1, 'level', y.level_id, 'twist', y.twist, 'rows', highland._daily_top(v_ybd, 3), 'total', ytot),
    'ends_in', extract(epoch from (v_day + 1)::timestamp - (v_now at time zone 'utc'))::integer, 'now', v_now);
end $$;

create or replace function highland.hs_score_submit(p_run uuid, p_stats jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := highland._member(); run highland.hs_runs; rs highland.hs_rulesets; b record; w jsonb;
  v_won boolean; v_lives integer; v_waves integer; v_sec integer; v_spent integer; v_earned integer; v_loadout text;
  v_score integer; v_stars integer; v_flags text[] := '{}'; v_elapsed numeric; v_board text; v_week text;
  v_sid bigint; v_better_all boolean := false; v_better_week boolean := false; ra record; v_rank_week integer; v_total_week integer; fL numeric; fS numeric; fT numeric;
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
  -- (into two numbers, not a record: a record left unassigned for a daily, which has no week, cannot be read even in
  -- a branch that is not taken, and a pooled connection's first call of the function would fail on it)
  if v_week is not null then select x.rank, x.total into v_rank_week, v_total_week from highland._rank_of(v_board, v_week, v_uid) x; end if;
  return jsonb_build_object('accepted', true, 'score', v_score, 'stars', v_stars, 'board', v_board,
    'best_all', coalesce(v_better_all, false), 'rank_all', ra.rank, 'total_all', ra.total,
    'best_week', coalesce(v_better_week, false), 'rank_week', v_rank_week,
    'total_week', v_total_week,
    'beat_all', v_prev_all is not null and v_score > v_prev_all, 'beat_week', v_prev_week is not null and v_score > v_prev_week,
    'mode', run.mode, 'level', run.level_id, 'diff', run.diff, 'loadout', v_loadout, 'day', run.day, 'now', v_now);
end $$;

notify pgrst, 'reload schema';
