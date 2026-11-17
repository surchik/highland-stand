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

notify pgrst, 'reload schema';
