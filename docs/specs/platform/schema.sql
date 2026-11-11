-- Highland Stand: accounts, cloud saves, leaderboards, the daily challenge and first-party analytics.
-- DRAFT of deploy/supabase/schema.sql (docs/specs/platform.md, section 2). Tested on PostgreSQL 16 with
-- docs/specs/platform/standins.sql standing in for Supabase (see schema-test.sql beside this file).
--
-- For the owner: paste this whole file into the Supabase Studio SQL editor and press Run. It is safe to run
-- again: it only adds what is missing and replaces the functions. Everything it makes is named hs_...,
-- so it does not touch other projects that share this database. It holds no secret.
--
-- How access works: every table has row level security on and gives the public API roles (anon,
-- authenticated) nothing but, on a few tables, a read of the caller's own rows. Everything else goes
-- through the functions below, which run as their owner (security definer), check who is calling with
-- auth.uid(), and are the only doors the game's page uses (POST /rest/v1/rpc/<name>).

-- Run as the postgres role, so that no function below is owned by a superuser (the SQL editor of an older
-- install runs as supabase_admin, which is one). A role that may not become postgres stops here with an error.
set role postgres;

create schema if not exists hs_private;
revoke all on schema hs_private from public;

-- ---------------------------------------------------------------- tables
create table if not exists public.hs_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text not null,                       -- the display name the player chose
  name_key text not null,                   -- its folded form: unique, and what the name filter reads
  name_changed_at timestamptz not null default now(),
  hidden boolean not null default false,    -- an admin took this player off the boards
  first_aid uuid,                           -- the anonymous id of the device that first signed in (funnel)
  created_at timestamptz not null default now()
);
create unique index if not exists hs_profiles_name_key on public.hs_profiles (name_key);

create table if not exists public.hs_saves (
  user_id uuid not null references auth.users(id) on delete cascade,
  channel text not null default 'live' check (channel in ('live', 'next')),   -- the staging page keeps a save of its own
  version integer not null default 1,       -- grows by one with every accepted write
  data jsonb not null,                      -- the save document (opaque to the server)
  bytes integer not null,
  device text,
  updated_at timestamptz not null default now(),
  primary key (user_id, channel)
);

create table if not exists public.hs_rulesets (
  id text primary key,                      -- the page's RULESET
  data jsonb not null,                      -- bounds and pars per battlefield, the score weights, the daily pool
  active boolean not null default true,
  published_at timestamptz not null default now(),
  published_by uuid
);

create table if not exists public.hs_runs (  -- a ranked battle begun: its token
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mode text not null check (mode in ('campaign', 'daily')),
  level_id text not null,
  diff smallint not null check (diff between 0 and 2),
  ruleset text not null,
  day date,                                 -- a daily's UTC day
  twist text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);
create index if not exists hs_runs_user on public.hs_runs (user_id, started_at desc);
create index if not exists hs_runs_daily on public.hs_runs (user_id, day) where mode = 'daily';

create table if not exists public.hs_scores (  -- every accepted result, one per run
  id bigint generated always as identity primary key,
  run_id uuid not null unique references public.hs_runs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  mode text not null,
  level_id text not null,
  diff smallint not null,
  ruleset text not null,
  loadout text not null check (loadout in ('std', 'open')),
  day date,
  twist text,
  won boolean not null,
  score integer not null,
  stars smallint not null,
  lives smallint not null,
  lives_max smallint not null,
  waves smallint not null,
  waves_total smallint not null,
  sim_sec integer not null,
  spent integer not null,
  earned integer not null,
  build text,
  flags text[] not null default '{}',       -- what looked unusual, for the admin's review
  created_at timestamptz not null default now()
);
create index if not exists hs_scores_user on public.hs_scores (user_id, created_at desc);

create table if not exists public.hs_score_best (  -- the boards: a player's best per board and period
  board text not null,                      -- 'c:<level>:<diff>:<loadout>:<ruleset>' or 'd:<yyyy-mm-dd>'
  period text not null,                     -- 'all' or 'w:<the week's Monday, yyyy-mm-dd>'
  user_id uuid not null references auth.users(id) on delete cascade,
  score integer not null,
  score_id bigint not null references public.hs_scores(id) on delete cascade,
  lives smallint not null,
  sim_sec integer not null,
  achieved_at timestamptz not null default now(),
  primary key (board, period, user_id)
);
create index if not exists hs_score_best_rank on public.hs_score_best (board, period, score desc, achieved_at);

create table if not exists public.hs_sessions (  -- one visit of the page (analytics)
  sid text primary key,
  aid uuid not null,                        -- the device's anonymous id
  uid uuid,                                 -- the account, once signed in
  started_at timestamptz not null default now(),
  day date not null default ((now() at time zone 'utc')::date),
  build text, ruleset text, channel text,
  dev_class text, os text, browser text, standalone boolean,
  vw integer, vh integer, lang text, ref text
);
create index if not exists hs_sessions_aid on public.hs_sessions (aid);
create index if not exists hs_sessions_uid on public.hs_sessions (uid);
create index if not exists hs_sessions_day on public.hs_sessions (day);

create table if not exists public.hs_events (
  id bigint generated always as identity primary key,
  sid text not null references public.hs_sessions(sid) on delete cascade,
  seq integer not null,
  name text not null,
  props jsonb not null default '{}',
  cts timestamptz,                          -- the device's clock
  ts timestamptz not null default now()     -- the server's
);
create index if not exists hs_events_name_ts on public.hs_events (name, ts);
create index if not exists hs_events_sid on public.hs_events (sid, seq);

create table if not exists public.hs_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  note text,
  added_at timestamptz not null default now()
);

create table if not exists public.hs_config (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.hs_name_blocklist (
  pattern text primary key,                 -- in folded form (hs_private.name_fold)
  kind text not null default 'contains' check (kind in ('contains', 'exact'))
);

create table if not exists public.hs_rate (  -- counters for the rate limits
  bucket text not null,
  key text not null,
  n integer not null default 0,
  at timestamptz not null default now(),
  primary key (bucket, key)
);

-- ---------------------------------------------------------------- row level security and grants
do $$
declare t text;
begin
  foreach t in array array['hs_profiles', 'hs_saves', 'hs_rulesets', 'hs_runs', 'hs_scores', 'hs_score_best',
      'hs_sessions', 'hs_events', 'hs_admins', 'hs_config', 'hs_name_blocklist', 'hs_rate'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from public, anon, authenticated', t);
  end loop;
end $$;

-- No policy and no grant: row level security with no policy lets the API roles read and write nothing. The page
-- reads no table (it calls the functions below), and a player's own hs_scores rows would show him which of his
-- results were flagged. (The drops clear what an earlier draft of this file created.)
drop policy if exists hs_profiles_own on public.hs_profiles;
drop policy if exists hs_saves_own on public.hs_saves;
drop policy if exists hs_runs_own on public.hs_runs;
drop policy if exists hs_scores_own on public.hs_scores;
drop policy if exists hs_score_best_own on public.hs_score_best;
-- Supabase also grants the API roles every new sequence in public
do $$
declare q text;
begin
  for q in select c.oid::regclass::text from pg_class c join pg_namespace n on n.oid = c.relnamespace
           where n.nspname = 'public' and c.relkind = 'S' and c.relname like 'hs\_%' loop
    execute 'revoke all on sequence ' || q || ' from public, anon, authenticated';
  end loop;
end $$;

-- ---------------------------------------------------------------- private helpers
create or replace function hs_private.uid() returns uuid
language plpgsql stable set search_path = '' as $$
declare v uuid := auth.uid();
begin
  if v is null then raise exception 'not_signed_in' using errcode = '42501'; end if;
  return v;
end $$;

create or replace function hs_private.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.hs_admins a where a.user_id = auth.uid());
$$;

create or replace function hs_private.need_admin() returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if not hs_private.is_admin() then raise exception 'not_admin' using errcode = '42501'; end if;
end $$;

-- at most p_max per p_seconds for one key (p_add at a time: one call, or a batch's events); false once over
drop function if exists hs_private.rate_ok(text, text, integer, integer);
create or replace function hs_private.rate_ok(p_kind text, p_key text, p_seconds integer, p_max integer, p_add integer default 1) returns boolean
language plpgsql security definer set search_path = '' as $$
declare b text; c integer;
begin
  b := p_kind || ':' || (floor(extract(epoch from now()) / p_seconds))::bigint;
  insert into public.hs_rate as r (bucket, key, n) values (b, p_key, greatest(p_add, 1))
    on conflict (bucket, key) do update set n = r.n + greatest(p_add, 1)
    returning n into c;
  if random() < 0.002 then delete from public.hs_rate where at < now() - interval '2 days'; end if;
  return c <= p_max;
end $$;

create or replace function hs_private.limit_hit() returns void
language plpgsql set search_path = '' as $$
begin
  raise exception 'rate_limited' using errcode = 'PT429';   -- PostgREST answers 429
end $$;

-- a name folded for comparison: compatibility forms, lower case, no spaces or . _ -, common digit swaps undone
create or replace function hs_private.name_fold(p text) returns text
language sql immutable set search_path = '' as $$
  select translate(lower(regexp_replace(normalize(p, NFKC), '[\s._\-]+', '', 'g')), '013457@$', 'oieastas');
$$;

-- letters and digits of any alphabet, spaces, and . _ - : nothing else (no symbols, pictures or stacked marks).
-- The classes are read under an ICU collation where the server has one, so the rule does not hang on the
-- database's locale (under the plain "C" locale only A to Z would count as letters).
create or replace function hs_private.name_letters(p text) returns boolean
language plpgsql stable set search_path = '' as $$
begin
  if exists (select 1 from pg_catalog.pg_collation where collname = 'und-x-icu') then
    return p ~ ('^[[:alpha:][:digit:] ._-]+$' collate "und-x-icu");
  end if;
  return p ~ '^[[:alpha:][:digit:] ._-]+$';
end $$;

-- a text of an event that may be shown on the stats page: a short tag, or the word "other"
create or replace function hs_private.tag(p text) returns text
language sql immutable set search_path = '' as $$
  select case when p is null then null when p ~ '^[A-Za-z0-9_.:-]{1,40}$' then p else 'other' end;
$$;
-- a number of an event, or null when it is not one (a stranger's event must never make the stats fail)
create or replace function hs_private.int_or_null(p text) returns integer
language sql immutable set search_path = '' as $$
  select case when p ~ '^-?[0-9]{1,9}$' then p::integer end;
$$;

-- the name as it will be stored (trimmed, single spaces), or an exception naming what is wrong with it
create or replace function hs_private.name_clean(p text) returns text
language plpgsql stable security definer set search_path = '' as $$
declare n text; f text;
begin
  n := btrim(regexp_replace(normalize(coalesce(p, ''), NFKC), '\s+', ' ', 'g'));
  if char_length(n) < 3 or char_length(n) > 16 then raise exception 'name_length' using errcode = 'P0001'; end if;
  -- no control or invisible direction characters, no ASCII punctuation but . _ -
  if n ~ '[[:cntrl:]]' or n ~ '[​-‏‪-‮⁦-⁩﻿]' or n ~ '[!-,/:-@\[-\^`{-~]' or not hs_private.name_letters(n) then
    raise exception 'name_chars' using errcode = 'P0001';
  end if;
  f := hs_private.name_fold(n);
  if char_length(f) < 3 then raise exception 'name_length' using errcode = 'P0001'; end if;
  if exists (select 1 from public.hs_name_blocklist b
             where (b.kind = 'contains' and position(b.pattern in f) > 0) or (b.kind = 'exact' and b.pattern = f)) then
    raise exception 'name_blocked' using errcode = 'P0001';
  end if;
  return n;
end $$;

create or replace function hs_private.week_key(p timestamptz) returns text
language sql immutable set search_path = '' as $$
  select 'w:' || to_char(date_trunc('week', p at time zone 'utc'), 'YYYY-MM-DD');   -- ISO weeks: Monday 00:00 UTC
$$;

-- the daily challenge of a UTC day, from the day alone (docs/specs/platform.md, section 5.6)
create or replace function hs_private.daily_pick(p_rules jsonb, p_day date, out level_id text, out twist text)
language plpgsql immutable set search_path = '' as $$
declare d bigint := p_day - date '1970-01-01';
  pool jsonb := p_rules -> 'daily' -> 'pool'; tw jsonb := p_rules -> 'daily' -> 'twists';
  n integer := jsonb_array_length(pool); m integer := jsonb_array_length(tw);
  k bigint := (p_rules -> 'daily' ->> 'k')::bigint; j bigint := (p_rules -> 'daily' ->> 'j')::bigint;
  skip jsonb; idx integer; i integer;
begin
  level_id := pool ->> ((d * k) % n)::integer;
  -- the place in the cycle of n days steps the twists by j; each new cycle shifts them all by one, so over
  -- n * m days every battlefield meets every twist once
  idx := (((d % n) * j + d / n) % m)::integer;
  -- daily.skip[battlefield] lists the twists that battlefield never gets: the pick walks on to the next one
  skip := coalesce(p_rules -> 'daily' -> 'skip' -> level_id, '[]'::jsonb);
  for i in 0 .. m - 1 loop
    twist := tw ->> ((idx + i) % m);
    exit when not (skip ? twist);
  end loop;
end $$;

-- the bounds of one battle under a ruleset (a daily's twist may scale them): lives, fast, slow, earn_max, waves,
-- and the battlefield's script table (the script wave each of its waves stands for, 20 at the last)
drop function if exists hs_private.bounds(jsonb, text, integer, text);
create or replace function hs_private.bounds(p_rules jsonb, p_level text, p_diff integer, p_twist text,
  out lives integer, out fast integer, out slow integer, out earn_max integer, out waves integer, out script jsonb)
language plpgsql immutable set search_path = '' as $$
declare lv jsonb := p_rules -> 'levels' -> p_level; d jsonb; t jsonb;
begin
  if lv is null then raise exception 'level_unknown' using errcode = 'P0001'; end if;
  d := lv -> 'd' -> p_diff;
  if d is null then raise exception 'diff_unknown' using errcode = 'P0001'; end if;
  t := coalesce(p_rules -> 'daily' -> 't' -> p_twist, '{}'::jsonb);
  waves := (lv ->> 'waves')::integer;
  script := lv -> 'script';
  lives := coalesce((t ->> 'livesSet')::integer, round((d ->> 'lives')::numeric * coalesce((t ->> 'lives')::numeric, 1)));
  fast := round((d ->> 'fast')::numeric * coalesce((t ->> 'fast')::numeric, 1));
  slow := round((d ->> 'slow')::numeric * coalesce((t ->> 'slow')::numeric, 1));
  earn_max := round((d ->> 'earnMax')::numeric * coalesce((t ->> 'earn')::numeric, 1));
end $$;

-- ---------------------------------------------------------------- public: configuration
create or replace function public.hs_config() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_object_agg(c.key, c.value), '{}'::jsonb) || jsonb_build_object('now', now())
  from public.hs_config c where c.key in ('gate', 'cloud', 'notice', 'ev_sample', 'boards', 'daily');
$$;

-- ---------------------------------------------------------------- public: profile
create or replace function public.hs_profile_get() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_uid uuid := hs_private.uid(); r public.hs_profiles;
begin
  select * into r from public.hs_profiles where user_id = v_uid;
  return jsonb_build_object('user_id', v_uid, 'name', r.name, 'hidden', coalesce(r.hidden, false),
    'name_changed_at', r.name_changed_at, 'admin', hs_private.is_admin(), 'now', now());
end $$;

-- choose or change the display name; a change is allowed once in 7 days
create or replace function public.hs_profile_set_name(p_name text, p_aid uuid default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := hs_private.uid(); n text; f text; r public.hs_profiles;
begin
  if not hs_private.rate_ok('name', v_uid::text, 3600, 20) then perform hs_private.limit_hit(); end if;
  n := hs_private.name_clean(p_name);
  f := hs_private.name_fold(n);
  select * into r from public.hs_profiles where user_id = v_uid for update;
  if found and r.name = n then return jsonb_build_object('ok', true, 'name', n); end if;
  if found and r.name_key <> f and r.name_changed_at > now() - interval '7 days' and r.created_at < now() - interval '10 minutes' then
    raise exception 'name_wait' using errcode = 'P0001';
  end if;
  begin
    if found then
      update public.hs_profiles set name = n, name_key = f, name_changed_at = now() where user_id = v_uid;
    else
      insert into public.hs_profiles (user_id, name, name_key, first_aid) values (v_uid, n, f, p_aid);
    end if;
  exception when unique_violation then
    raise exception 'name_taken' using errcode = 'P0001';
  end;
  return jsonb_build_object('ok', true, 'name', n);
end $$;

-- ---------------------------------------------------------------- public: cloud saves
create or replace function public.hs_save_get(p_channel text default 'live') returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_uid uuid := hs_private.uid(); r public.hs_saves;
begin
  if p_channel not in ('live', 'next') then raise exception 'channel_unknown' using errcode = 'P0001'; end if;
  select * into r from public.hs_saves where user_id = v_uid and channel = p_channel;
  if not found then return jsonb_build_object('version', 0, 'data', null, 'now', now()); end if;
  return jsonb_build_object('version', r.version, 'data', r.data, 'updated_at', r.updated_at, 'device', r.device, 'now', now());
end $$;

-- write the save if the caller saw the version that is stored (0: none yet); else the stored one comes back
create or replace function public.hs_save_put(p_expected integer, p_data jsonb, p_device text default null, p_channel text default 'live') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := hs_private.uid(); r public.hs_saves; sz integer;
begin
  if p_channel not in ('live', 'next') then raise exception 'channel_unknown' using errcode = 'P0001'; end if;
  if p_data is null or jsonb_typeof(p_data) <> 'object' then raise exception 'save_invalid' using errcode = 'P0001'; end if;
  sz := octet_length(p_data::text);
  if sz > 262144 then raise exception 'save_too_large' using errcode = 'P0001'; end if;
  if not hs_private.rate_ok('save', v_uid::text, 3600, 240) then perform hs_private.limit_hit(); end if;
  select * into r from public.hs_saves where user_id = v_uid and channel = p_channel for update;
  if not found then
    if coalesce(p_expected, 0) <> 0 then
      return jsonb_build_object('ok', false, 'version', 0, 'data', null, 'now', now());
    end if;
    begin
      insert into public.hs_saves (user_id, channel, version, data, bytes, device) values (v_uid, p_channel, 1, p_data, sz, left(p_device, 60));
    exception when unique_violation then   -- another device wrote first
      select * into r from public.hs_saves where user_id = v_uid and channel = p_channel;
      return jsonb_build_object('ok', false, 'version', r.version, 'data', r.data, 'now', now());
    end;
    return jsonb_build_object('ok', true, 'version', 1, 'now', now());
  end if;
  if r.version <> coalesce(p_expected, 0) then
    return jsonb_build_object('ok', false, 'version', r.version, 'data', r.data, 'device', r.device, 'now', now());
  end if;
  update public.hs_saves set version = r.version + 1, data = p_data, bytes = sz, device = left(p_device, 60), updated_at = now()
    where user_id = v_uid and channel = p_channel;
  return jsonb_build_object('ok', true, 'version', r.version + 1, 'now', now());
end $$;

-- ---------------------------------------------------------------- public: runs, scores, boards
-- a ranked battle begins: the token its score will be posted with
create or replace function public.hs_run_begin(p_mode text, p_level text, p_diff integer, p_ruleset text, p_twist text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := hs_private.uid(); rs public.hs_rulesets; v_day date; v_level text; v_twist text;
  v_used integer; v_max integer; v_id uuid; b record;
begin
  if p_mode not in ('campaign', 'daily') then raise exception 'mode_unknown' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.hs_profiles where user_id = v_uid) then raise exception 'no_profile' using errcode = 'P0001'; end if;
  select * into rs from public.hs_rulesets where id = p_ruleset and active;
  if not found then raise exception 'ruleset_unknown' using errcode = 'P0001'; end if;
  if not hs_private.rate_ok('run', v_uid::text, 3600, 60) then perform hs_private.limit_hit(); end if;
  if p_mode = 'daily' then
    v_day := (now() at time zone 'utc')::date;
    select d.level_id, d.twist into v_level, v_twist from hs_private.daily_pick(rs.data, v_day) d;
    if v_level is distinct from p_level or v_twist is distinct from p_twist or p_diff <> (rs.data -> 'daily' ->> 'diff')::integer then
      raise exception 'daily_mismatch' using errcode = 'P0001';
    end if;
    v_max := (rs.data -> 'daily' ->> 'attempts')::integer;
    select count(*) into v_used from public.hs_runs where user_id = v_uid and mode = 'daily' and day = v_day;
    if v_used >= v_max then
      return jsonb_build_object('ok', false, 'reason', 'no_attempts', 'day', v_day, 'attempts_left', 0, 'now', now());
    end if;
  else
    v_twist := null;
  end if;
  select * into b from hs_private.bounds(rs.data, p_level, p_diff, v_twist);   -- raises when the ruleset has no such battle
  insert into public.hs_runs (user_id, mode, level_id, diff, ruleset, day, twist)
    values (v_uid, p_mode, p_level, p_diff, p_ruleset, v_day, v_twist) returning id into v_id;
  return jsonb_build_object('ok', true, 'run_id', v_id, 'day', v_day, 'now', now(),
    'attempts_left', case when p_mode = 'daily' then v_max - v_used - 1 end);
end $$;

-- the place of a score on a board: how many stand above it, plus one
create or replace function hs_private.rank_of(p_board text, p_period text, p_user uuid, out rank integer, out total integer)
language plpgsql stable security definer set search_path = '' as $$
declare me public.hs_score_best;
begin
  select count(*) into total from public.hs_score_best s join public.hs_profiles p on p.user_id = s.user_id
    where s.board = p_board and s.period = p_period and not p.hidden;
  select * into me from public.hs_score_best where board = p_board and period = p_period and user_id = p_user;
  if not found then rank := null; return; end if;
  select 1 + count(*) into rank from public.hs_score_best s join public.hs_profiles p on p.user_id = s.user_id
    where s.board = p_board and s.period = p_period and not p.hidden and s.user_id <> p_user
      and (s.score > me.score or (s.score = me.score and s.achieved_at < me.achieved_at));
end $$;

-- a battle's result: checked against the ruleset's bounds, scored here, and put on its boards
-- p_stats: { won, lives, waves, sim_sec, spent, earned, loadout, build }
create or replace function public.hs_score_submit(p_run uuid, p_stats jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := hs_private.uid(); run public.hs_runs; rs public.hs_rulesets; b record; w jsonb;
  v_won boolean; v_lives integer; v_waves integer; v_sec integer; v_spent integer; v_earned integer; v_loadout text;
  v_score integer; v_stars integer; v_flags text[] := '{}'; v_elapsed numeric; v_board text; v_week text;
  v_sid bigint; v_better_all boolean := false; v_better_week boolean := false; ra record; rw record; fL numeric; fS numeric; fT numeric;
  v_prog numeric;
begin
  if not hs_private.rate_ok('score', v_uid::text, 3600, 40) then perform hs_private.limit_hit(); end if;
  select * into run from public.hs_runs where id = p_run and user_id = v_uid for update;
  if not found then raise exception 'run_unknown' using errcode = 'P0001'; end if;
  if run.finished_at is not null then raise exception 'run_finished' using errcode = 'P0001'; end if;
  select * into rs from public.hs_rulesets where id = run.ruleset and active;
  if not found then raise exception 'ruleset_unknown' using errcode = 'P0001'; end if;
  select * into b from hs_private.bounds(rs.data, run.level_id, run.diff, run.twist);
  w := rs.data -> 'score';
  begin
    v_won := (p_stats ->> 'won')::boolean; v_lives := (p_stats ->> 'lives')::integer; v_waves := (p_stats ->> 'waves')::integer;
    v_sec := (p_stats ->> 'sim_sec')::integer; v_spent := (p_stats ->> 'spent')::integer; v_earned := (p_stats ->> 'earned')::integer;
    v_loadout := case when run.mode = 'daily' then 'std' else coalesce(p_stats ->> 'loadout', 'std') end;
  exception when others then
    raise exception 'stats_invalid' using errcode = 'P0001';
  end;
  if v_won is null or v_lives is null or v_waves is null or v_sec is null or v_spent is null or v_earned is null
     or v_loadout not in ('std', 'open') then
    raise exception 'stats_invalid' using errcode = 'P0001';
  end if;
  -- what cannot be: the checks a made-up score has to pass
  if v_won and (v_waves <> b.waves or v_lives < 1 or v_lives > b.lives) then raise exception 'score_implausible' using errcode = 'P0001', detail = 'lives or waves'; end if;
  if not v_won and (run.mode <> 'daily' or v_waves < 0 or v_waves >= b.waves or v_lives <> 0) then raise exception 'score_implausible' using errcode = 'P0001', detail = 'a defeat'; end if;
  if v_sec > 6 * 3600 or v_sec < floor(b.fast * 0.9 * v_waves / b.waves) then raise exception 'score_implausible' using errcode = 'P0001', detail = 'time'; end if;
  if v_earned < 0 or v_earned > b.earn_max or v_spent < 0 or v_spent > v_earned or (v_won and v_spent < 1) then raise exception 'score_implausible' using errcode = 'P0001', detail = 'gold'; end if;
  v_elapsed := extract(epoch from now() - run.started_at);
  if v_elapsed < v_sec / 4.2 - 5 then raise exception 'score_implausible' using errcode = 'P0001', detail = 'clock'; end if;
  if v_elapsed > 30 * 86400 then raise exception 'run_expired' using errcode = 'P0001'; end if;
  -- the score (the same arithmetic as the page's scoreOf)
  fL := v_lives::numeric / b.lives;
  fS := greatest(0, least(1, (b.slow - v_sec)::numeric / greatest(1, b.slow - b.fast)));
  fT := greatest(0, least(1, 1 - v_spent::numeric / greatest(1, v_earned)));
  if v_won then
    v_score := (w ->> 'win')::integer + round((w ->> 'lives')::numeric * fL + (w ->> 'speed')::numeric * fS + (w ->> 'thrift')::numeric * fT);
    v_stars := case when v_lives >= b.lives * 0.85 then 3 when v_lives >= b.lives * 0.5 then 2 else 1 end;
  else
    -- by the script wave the last cleared wave stands for, out of 20, so a loss on a short battlefield and one on
    -- a long one compare honestly; a ruleset without the table falls back to waves cleared out of the length
    if v_waves >= 1 and jsonb_typeof(b.script) = 'array' and jsonb_array_length(b.script) = b.waves then
      v_prog := least(1, greatest(0, (b.script ->> (v_waves - 1))::numeric / 20));
    else
      v_prog := v_waves::numeric / b.waves;
    end if;
    v_score := floor((w ->> 'lostMax')::numeric * v_prog);
    v_stars := 0;
  end if;
  if v_sec < b.fast then v_flags := v_flags || 'fast'; end if;
  if v_won and fL = 1 and fS > 0.95 and fT > 0.9 then v_flags := v_flags || 'perfect'; end if;
  insert into public.hs_scores (run_id, user_id, mode, level_id, diff, ruleset, loadout, day, twist, won, score, stars,
      lives, lives_max, waves, waves_total, sim_sec, spent, earned, build, flags)
    values (run.id, v_uid, run.mode, run.level_id, run.diff, run.ruleset, v_loadout, run.day, run.twist, v_won, v_score, v_stars,
      v_lives, b.lives, v_waves, b.waves, v_sec, v_spent, v_earned, left(p_stats ->> 'build', 20), v_flags)
    returning id into v_sid;
  update public.hs_runs set finished_at = now() where id = run.id;
  -- the boards: the player's best per board, all time and this week (a daily has its day's board alone)
  if run.mode = 'daily' then
    v_board := 'd:' || to_char(run.day, 'YYYY-MM-DD'); v_week := null;
  else
    v_board := 'c:' || run.level_id || ':' || run.diff || ':' || v_loadout || ':' || run.ruleset;
    v_week := hs_private.week_key(now());
  end if;
  insert into public.hs_score_best as s (board, period, user_id, score, score_id, lives, sim_sec)
    values (v_board, 'all', v_uid, v_score, v_sid, v_lives, v_sec)
    on conflict (board, period, user_id) do update
      set score = excluded.score, score_id = excluded.score_id, lives = excluded.lives, sim_sec = excluded.sim_sec, achieved_at = now()
      where excluded.score > s.score
    returning true into v_better_all;
  if v_week is not null then
    insert into public.hs_score_best as s (board, period, user_id, score, score_id, lives, sim_sec)
      values (v_board, v_week, v_uid, v_score, v_sid, v_lives, v_sec)
      on conflict (board, period, user_id) do update
        set score = excluded.score, score_id = excluded.score_id, lives = excluded.lives, sim_sec = excluded.sim_sec, achieved_at = now()
        where excluded.score > s.score
      returning true into v_better_week;
  end if;
  select * into ra from hs_private.rank_of(v_board, 'all', v_uid);
  if v_week is not null then select * into rw from hs_private.rank_of(v_board, v_week, v_uid); end if;
  return jsonb_build_object('accepted', true, 'score', v_score, 'stars', v_stars, 'board', v_board,
    'best_all', coalesce(v_better_all, false), 'rank_all', ra.rank, 'total_all', ra.total,
    'best_week', coalesce(v_better_week, false), 'rank_week', case when v_week is not null then rw.rank end,
    'total_week', case when v_week is not null then rw.total end, 'now', now());
end $$;

-- a board with its ranks, the caller's own place, and how many players are on it
-- p_period: 'all' or 'week'. Campaign: p_level, p_diff, p_loadout, p_ruleset. Daily: p_day (default today, UTC).
create or replace function public.hs_board(p_mode text, p_level text default null, p_diff integer default null,
  p_loadout text default 'std', p_ruleset text default null, p_period text default 'all', p_day date default null,
  p_limit integer default 50) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_board text; v_period text; v_rows jsonb; me record; v_me jsonb;
  v_admin boolean := hs_private.is_admin();
begin
  if p_mode = 'daily' then
    v_board := 'd:' || to_char(coalesce(p_day, (now() at time zone 'utc')::date), 'YYYY-MM-DD'); v_period := 'all';
  elsif p_mode = 'campaign' then
    v_board := 'c:' || p_level || ':' || p_diff || ':' || p_loadout || ':' || p_ruleset;
    v_period := case when p_period = 'week' then hs_private.week_key(now()) else 'all' end;
  else
    raise exception 'mode_unknown' using errcode = 'P0001';
  end if;
  if v_board is null then raise exception 'board_unknown' using errcode = 'P0001'; end if;
  -- (an admin's rows also carry the score's id and the player's, for hs_admin_remove_score and hs_admin_moderate)
  select coalesce(jsonb_agg(jsonb_build_object('rank', q.rn, 'name', q.name, 'score', q.score, 'lives', q.lives,
      'sec', q.sim_sec, 'at', q.achieved_at, 'me', coalesce(q.user_id = v_uid, false))
      || case when v_admin then jsonb_build_object('id', q.score_id, 'uid', q.user_id) else '{}'::jsonb end order by q.rn), '[]'::jsonb)
    into v_rows
    from (select s.*, p.name, row_number() over (order by s.score desc, s.achieved_at) as rn
          from public.hs_score_best s join public.hs_profiles p on p.user_id = s.user_id
          where s.board = v_board and s.period = v_period and not p.hidden
          order by s.score desc, s.achieved_at limit least(greatest(coalesce(p_limit, 50), 1), 100)) q;
  select * into me from hs_private.rank_of(v_board, v_period, v_uid);
  if v_uid is not null and me.rank is not null then
    select jsonb_build_object('rank', me.rank, 'score', s.score, 'lives', s.lives, 'sec', s.sim_sec, 'at', s.achieved_at)
      into v_me from public.hs_score_best s where s.board = v_board and s.period = v_period and s.user_id = v_uid;
  end if;
  return jsonb_build_object('board', v_board, 'period', v_period, 'rows', v_rows, 'me', v_me, 'total', me.total, 'now', now());
end $$;

-- today's challenge as the server counts it: its day, battlefield and twist, and the caller's attempts and best
create or replace function public.hs_daily_status(p_ruleset text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); rs public.hs_rulesets; v_day date := (now() at time zone 'utc')::date; d record;
  v_used integer := 0; v_best integer; me record;
begin
  select * into rs from public.hs_rulesets where id = p_ruleset and active;
  if not found then raise exception 'ruleset_unknown' using errcode = 'P0001'; end if;
  select * into d from hs_private.daily_pick(rs.data, v_day);
  if v_uid is not null then
    select count(*) into v_used from public.hs_runs where user_id = v_uid and mode = 'daily' and day = v_day;
    select score into v_best from public.hs_score_best where board = 'd:' || to_char(v_day, 'YYYY-MM-DD') and period = 'all' and user_id = v_uid;
  end if;
  select * into me from hs_private.rank_of('d:' || to_char(v_day, 'YYYY-MM-DD'), 'all', v_uid);
  return jsonb_build_object('day', v_day, 'level', d.level_id, 'twist', d.twist, 'diff', (rs.data -> 'daily' ->> 'diff')::integer,
    'attempts', (rs.data -> 'daily' ->> 'attempts')::integer, 'used', v_used, 'best', v_best, 'rank', me.rank, 'total', me.total,
    'ends_in', extract(epoch from (v_day + 1)::timestamp - (now() at time zone 'utc'))::integer, 'now', now());
end $$;

-- ---------------------------------------------------------------- public: analytics
-- p_ctx: { aid, sid, build, ruleset, channel, dev, os, browser, standalone, vw, vh, lang, ref }
-- p_events: [ { n: name, q: sequence number, t: device clock in ms, p: { ... } }, ... ] (50 at most, 60 KB at most)
-- Limits count events, not calls. A visitor's events draw on one pool for all visitors (ev_cap_hour, default
-- 20000 an hour) and 900 an hour per device id; a signed-in player's draw on his own 1500 an hour and on no pool,
-- so a flood of made-up visitors cannot starve the players' counts. Over ev_max_mb megabytes of events (default
-- 1024) visitors' events are dropped; over one and a half times that, everyone's. Over a limit: dropped, no error.
create or replace function public.hs_track(p_ctx jsonb, p_events jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_aid uuid; v_sid text; n integer; e jsonb; v_ok integer := 0;
  v_cap integer; v_max_mb integer; v_keep integer; v_mb numeric; v_drop boolean := false;
begin
  begin
    v_aid := (p_ctx ->> 'aid')::uuid; v_sid := p_ctx ->> 'sid';
  exception when others then
    raise exception 'ctx_invalid' using errcode = 'P0001';
  end;
  if v_aid is null or v_sid is null or v_sid !~ '^[A-Za-z0-9_-]{8,40}$' or jsonb_typeof(p_events) <> 'array' then
    raise exception 'ctx_invalid' using errcode = 'P0001';
  end if;
  n := jsonb_array_length(p_events);
  if n > 50 or octet_length(p_events::text) > 61440 then raise exception 'batch_too_large' using errcode = 'P0001'; end if;
  if n = 0 then return jsonb_build_object('accepted', 0, 'dropped', 0); end if;
  select coalesce((select hs_private.int_or_null(value #>> '{}') from public.hs_config where key = 'ev_cap_hour'), 20000),
         coalesce((select hs_private.int_or_null(value #>> '{}') from public.hs_config where key = 'ev_max_mb'), 1024),
         coalesce((select hs_private.int_or_null(value #>> '{}') from public.hs_config where key = 'ev_keep_days'), 180)
    into v_cap, v_max_mb, v_keep;
  v_mb := pg_total_relation_size('public.hs_events') / 1048576.0;
  if v_uid is null then
    -- the pool first (one row), so a flood of made-up device ids adds no rows of its own once the pool is dry
    if v_mb > v_max_mb then v_drop := true;
    elsif not hs_private.rate_ok('evanon', 'all', 3600, v_cap, n) then v_drop := true;
    elsif not hs_private.rate_ok('ev', v_aid::text, 3600, 900, n) then v_drop := true;
    end if;
  else
    if v_mb > v_max_mb * 1.5 then v_drop := true;
    elsif not hs_private.rate_ok('evu', v_uid::text, 3600, 1500, n) then v_drop := true;
    end if;
  end if;
  if v_drop then return jsonb_build_object('accepted', 0, 'dropped', n); end if;
  insert into public.hs_sessions as s (sid, aid, uid, build, ruleset, channel, dev_class, os, browser, standalone, vw, vh, lang, ref)
    values (v_sid, v_aid, v_uid, left(p_ctx ->> 'build', 20), left(p_ctx ->> 'ruleset', 40), left(p_ctx ->> 'channel', 12),
      left(p_ctx ->> 'dev', 12), left(p_ctx ->> 'os', 16), left(p_ctx ->> 'browser', 16), (p_ctx ->> 'standalone') = 'true',
      hs_private.int_or_null(p_ctx ->> 'vw'), hs_private.int_or_null(p_ctx ->> 'vh'), left(p_ctx ->> 'lang', 12), left(p_ctx ->> 'ref', 60))
    on conflict (sid) do update set uid = coalesce(s.uid, excluded.uid)
    where s.aid = excluded.aid;
  if not exists (select 1 from public.hs_sessions where sid = v_sid and aid = v_aid) then
    raise exception 'ctx_invalid' using errcode = 'P0001';   -- the session id belongs to another device
  end if;
  for e in select * from jsonb_array_elements(p_events) loop
    -- a name of small letters, digits and underscores; props an object of at most 4 KB (a battle's facts are about 1.2 KB)
    continue when coalesce(e ->> 'n', '') !~ '^[a-z][a-z0-9_]{1,39}$'
      or (e ? 'p' and jsonb_typeof(e -> 'p') not in ('object', 'null'))
      or octet_length(coalesce(e -> 'p', '{}'::jsonb)::text) > 4096;
    insert into public.hs_events (sid, seq, name, props, cts)
      values (v_sid, coalesce(hs_private.int_or_null(e ->> 'q'), 0), e ->> 'n',
        case when jsonb_typeof(e -> 'p') = 'object' then e -> 'p' else '{}'::jsonb end,
        to_timestamp(least(greatest(coalesce(case when (e ->> 't') ~ '^[0-9]{1,15}$' then (e ->> 't')::numeric end, 0), 0), 4102444800000) / 1000.0));
    v_ok := v_ok + 1;
  end loop;
  -- old visits leave by themselves (no scheduler needed): now and then a call removes a few that are past keeping
  if random() < 0.005 then
    delete from public.hs_sessions where sid in (select s2.sid from public.hs_sessions s2
      where s2.started_at < now() - make_interval(days => greatest(v_keep, 7)) limit 300);
  end if;
  return jsonb_build_object('accepted', v_ok, 'dropped', n - v_ok);
end $$;

-- ---------------------------------------------------------------- public: delete my account
create or replace function public.hs_delete_account() returns jsonb
language plpgsql security definer set search_path = '' set statement_timeout = '30s' as $$
declare v_uid uuid := hs_private.uid();
begin
  -- the visits that carried the account, and the visits of the same devices from before any sign-in (and their events)
  delete from public.hs_sessions where uid is null and aid in (select s.aid from public.hs_sessions s where s.uid = v_uid);
  delete from public.hs_sessions where uid = v_uid;
  delete from public.hs_rate where key = v_uid::text;
  delete from auth.users where id = v_uid;               -- and, through the foreign keys, every hs_ row of this player
  return jsonb_build_object('ok', true);
end $$;

-- ---------------------------------------------------------------- admins only
create or replace function public.hs_admin_publish_ruleset(p_id text, p_data jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare k text; lv jsonb;
begin
  perform hs_private.need_admin();
  if p_id !~ '^[A-Za-z0-9._-]{1,40}$' or jsonb_typeof(p_data -> 'levels') <> 'object' or jsonb_typeof(p_data -> 'score') <> 'object'
     or jsonb_typeof(p_data -> 'daily' -> 'pool') <> 'array' or jsonb_array_length(p_data -> 'daily' -> 'pool') < 1
     or jsonb_typeof(p_data -> 'daily' -> 'twists') <> 'array' or jsonb_array_length(p_data -> 'daily' -> 'twists') < 1 then
    raise exception 'ruleset_invalid' using errcode = 'P0001';
  end if;
  for k, lv in select * from jsonb_each(p_data -> 'levels') loop
    if (lv ->> 'waves')::integer not between 1 and 60 or jsonb_array_length(lv -> 'd') <> 3 then
      raise exception 'ruleset_invalid' using errcode = 'P0001', detail = k;
    end if;
    -- a script table, when given: one entry a wave, ending on script wave 20
    if lv ? 'script' and (jsonb_typeof(lv -> 'script') <> 'array' or jsonb_array_length(lv -> 'script') <> (lv ->> 'waves')::integer
        or (lv -> 'script' ->> -1)::integer <> 20) then
      raise exception 'ruleset_invalid' using errcode = 'P0001', detail = k || ': script';
    end if;
  end loop;
  -- no battlefield of the daily's pool may leave out every twist
  for k in select jsonb_array_elements_text(p_data -> 'daily' -> 'pool') loop
    if p_data -> 'levels' -> k is null then raise exception 'ruleset_invalid' using errcode = 'P0001', detail = k || ': not a battlefield'; end if;
    if not exists (select 1 from jsonb_array_elements_text(p_data -> 'daily' -> 'twists') tw
                   where not (coalesce(p_data -> 'daily' -> 'skip' -> k, '[]'::jsonb) ? tw)) then
      raise exception 'ruleset_invalid' using errcode = 'P0001', detail = k || ': no twist left';
    end if;
  end loop;
  insert into public.hs_rulesets (id, data, published_by) values (p_id, p_data, auth.uid())
    on conflict (id) do update set data = excluded.data, active = true, published_at = now(), published_by = excluded.published_by;
  return jsonb_build_object('ok', true, 'id', p_id);
end $$;

create or replace function public.hs_admin_set_config(p_key text, p_value jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  perform hs_private.need_admin();
  if p_key not in ('gate', 'cloud', 'notice', 'ev_sample', 'ev_cap_hour', 'ev_max_mb', 'ev_keep_days', 'boards', 'daily') then raise exception 'key_unknown' using errcode = 'P0001'; end if;
  if p_key in ('ev_cap_hour', 'ev_max_mb', 'ev_keep_days') and p_value is not null and p_value <> 'null'::jsonb
     and hs_private.int_or_null(p_value #>> '{}') is null then raise exception 'value_invalid' using errcode = 'P0001'; end if;
  if p_key = 'notice' and char_length(coalesce(p_value #>> '{}', '')) > 140 then raise exception 'value_invalid' using errcode = 'P0001'; end if;
  if p_key = 'gate' and (p_value #>> '{}') not in ('required', 'optional', 'off') then raise exception 'value_invalid' using errcode = 'P0001'; end if;
  if p_value is null or p_value = 'null'::jsonb then
    delete from public.hs_config where key = p_key;
  else
    insert into public.hs_config (key, value) values (p_key, p_value)
      on conflict (key) do update set value = excluded.value, updated_at = now();
  end if;
  return public.hs_config();
end $$;

-- hide a player from the boards (or show them again); optionally give them a new name
create or replace function public.hs_admin_moderate(p_user uuid, p_hidden boolean, p_name text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare n text;
begin
  perform hs_private.need_admin();
  update public.hs_profiles set hidden = coalesce(p_hidden, hidden) where user_id = p_user;
  if not found then raise exception 'user_unknown' using errcode = 'P0001'; end if;
  if p_name is not null then
    n := hs_private.name_clean(p_name);
    update public.hs_profiles set name = n, name_key = hs_private.name_fold(n), name_changed_at = now() where user_id = p_user;
  end if;
  return jsonb_build_object('ok', true);
end $$;

-- take one result off the boards; the player's next best takes its place
create or replace function public.hs_admin_remove_score(p_score bigint) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare sc public.hs_scores; v_board text; v_per text; nx public.hs_scores;
begin
  perform hs_private.need_admin();
  select * into sc from public.hs_scores where id = p_score;
  if not found then raise exception 'score_unknown' using errcode = 'P0001'; end if;
  v_board := case when sc.mode = 'daily' then 'd:' || to_char(sc.day, 'YYYY-MM-DD')
                  else 'c:' || sc.level_id || ':' || sc.diff || ':' || sc.loadout || ':' || sc.ruleset end;
  delete from public.hs_scores where id = p_score;   -- its board rows go with it
  foreach v_per in array array['all', hs_private.week_key(sc.created_at)] loop
    continue when sc.mode = 'daily' and v_per <> 'all';
    select * into nx from public.hs_scores s
      where s.user_id = sc.user_id and s.mode = sc.mode and s.level_id = sc.level_id and s.diff = sc.diff and s.ruleset = sc.ruleset
        and s.loadout = sc.loadout and s.day is not distinct from sc.day
        and (v_per = 'all' or hs_private.week_key(s.created_at) = v_per)
      order by s.score desc, s.created_at limit 1;
    if found then
      insert into public.hs_score_best (board, period, user_id, score, score_id, lives, sim_sec, achieved_at)
        values (v_board, v_per, nx.user_id, nx.score, nx.id, nx.lives, nx.sim_sec, nx.created_at)
        on conflict (board, period, user_id) do nothing;
    end if;
  end loop;
  return jsonb_build_object('ok', true);
end $$;

-- removes visits older than p_days, 5000 at a call (their events go with them); "more" says to call again.
-- Battles begun and never finished leave after 30 days.
create or replace function public.hs_admin_purge_events(p_days integer default 180) returns jsonb
language plpgsql security definer set search_path = '' set statement_timeout = '60s' as $$
declare n bigint;
begin
  perform hs_private.need_admin();
  delete from public.hs_sessions where sid in (select s.sid from public.hs_sessions s
    where s.started_at < now() - make_interval(days => greatest(p_days, 7)) order by s.started_at limit 5000);
  get diagnostics n = row_count;
  delete from public.hs_runs where id in (select r.id from public.hs_runs r
    where r.finished_at is null and r.started_at < now() - interval '30 days' limit 5000);
  return jsonb_build_object('ok', true, 'sessions_removed', n, 'more', n >= 5000);
end $$;

-- ---------------------------------------------------------------- the owner's stats (admins only)
-- Views in hs_private (the API does not serve that schema), read through public.hs_stats.
-- A "person" is the account when the session had one, else the device.
create or replace view hs_private.v_sessions as
  select s.*, coalesce(s.uid::text, s.aid::text) as person from public.hs_sessions s where coalesce(s.channel, 'live') = 'live';

create or replace view hs_private.v_first_seen as
  select aid, min(day) as first_day from hs_private.v_sessions group by aid;

drop view if exists hs_private.v_battles;
create or replace view hs_private.v_battles as   -- one row per battle ended
  select e.ts, s.day, s.aid, s.person, s.dev_class, e.name,
    hs_private.tag(e.props ->> 'lv') as level_id, hs_private.int_or_null(e.props ->> 'diff') as diff, hs_private.tag(e.props ->> 'mode') as mode,
    hs_private.int_or_null(e.props ->> 'lives') as lives, hs_private.int_or_null(e.props ->> 'lives_max') as lives_max,
    hs_private.int_or_null(e.props ->> 'wave') as wave, hs_private.int_or_null(e.props ->> 'waves') as waves
  from public.hs_events e join hs_private.v_sessions s on s.sid = e.sid
  where e.name in ('victory', 'defeat')
     -- a battle left (abandoned, or the page hidden in the middle of it) and not come back to in that visit
     or (e.name = 'battle_quit' and not exists (select 1 from public.hs_events b
           where b.sid = e.sid and b.name = 'battle_back' and b.seq > e.seq));

-- p_cards: null for every card, or the cards wanted (the page asks card by card when the whole answer is too slow)
drop function if exists public.hs_stats(integer);
create or replace function public.hs_stats(p_days integer default 30, p_cards text[] default null) returns jsonb
language plpgsql stable security definer set search_path = '' set statement_timeout = '30s' as $$
declare v_from date := (now() at time zone 'utc')::date - greatest(least(coalesce(p_days, 30), 365), 1);
  v_funnel jsonb; v_ret jsonb; v_quit jsonb; v_fields jsonb; v_dev jsonb; v_daily jsonb; v_gate jsonb; v_rules jsonb; v_tot jsonb; v_flag jsonb;
  v_cfg jsonb; v_mb numeric;
begin
  perform hs_private.need_admin();
  if p_cards is null or 'funnel' = any(p_cards) then
  -- the first-run funnel: of the devices first seen in the window, how many reached each step. Each device is of
  -- one kind: "new" (no battlefield held at its first load), "returning" (it had progress: a player from before
  -- the accounts), or "inapp" (its first gate was in another app's browser). Two steps are not taken from the
  -- page's word: signed_in is a visit that carried an account, name_set is that account having a profile.
  with first_load as (
      select distinct on (s.aid) s.aid, hs_private.int_or_null(e.props ->> 'progress') as progress
      from public.hs_events e join hs_private.v_sessions s on s.sid = e.sid where e.name = 'page_load' order by s.aid, e.ts),
    newcomers as (
      select fs.aid, case
          when exists (select 1 from public.hs_events e join hs_private.v_sessions s on s.sid = e.sid
                       where s.aid = fs.aid and e.name = 'gate_shown' and e.props ->> 'state' = 'inapp') then 'inapp'
          when coalesce(fl.progress, 0) > 0 then 'returning' else 'new' end as kind
      from hs_private.v_first_seen fs left join first_load fl on fl.aid = fs.aid where fs.first_day >= v_from),
    steps (ord, name) as (values (1, 'page_load'), (2, 'gate_shown'), (3, 'provider_tapped'), (4, 'signed_in'), (5, 'name_set'),
      (6, 'battle_start'), (7, 'tutorial_done'), (8, 'wave_end'), (9, 'victory')),
    kinds (kind) as (values ('new'), ('returning'), ('inapp')),
    did as (
      select distinct nc.aid, nc.kind, e.name from newcomers nc join hs_private.v_sessions s on s.aid = nc.aid
        join public.hs_events e on e.sid = s.sid
        where e.name in ('page_load', 'gate_shown', 'provider_tapped', 'battle_start', 'tutorial_done', 'wave_end', 'victory')
      union
      select distinct nc.aid, nc.kind, 'signed_in' from newcomers nc join hs_private.v_sessions s on s.aid = nc.aid where s.uid is not null
      union
      select distinct nc.aid, nc.kind, 'name_set' from newcomers nc join hs_private.v_sessions s on s.aid = nc.aid
        join public.hs_profiles p on p.user_id = s.uid)
  select jsonb_agg(jsonb_build_object('step', st.name, 'n', (select count(*) from did d where d.name = st.name),
      'new', (select count(*) from did d where d.name = st.name and d.kind = 'new'),
      'returning', (select count(*) from did d where d.name = st.name and d.kind = 'returning'),
      'inapp', (select count(*) from did d where d.name = st.name and d.kind = 'inapp')) order by st.ord)
    into v_funnel from steps st;
  end if;
  if p_cards is null or 'retention' = any(p_cards) then
  -- return on the next day and a week on, by the day a device was first seen
  with fs as (select aid, first_day from hs_private.v_first_seen where first_day >= v_from),
    seen as (select distinct aid, day from hs_private.v_sessions)
  select jsonb_agg(jsonb_build_object('day', first_day, 'new', n, 'd1', d1, 'd7', d7) order by first_day) into v_ret
  from (select fs.first_day, count(*) as n,
      count(*) filter (where exists (select 1 from seen x where x.aid = fs.aid and x.day = fs.first_day + 1)) as d1,
      count(*) filter (where exists (select 1 from seen x where x.aid = fs.aid and x.day = fs.first_day + 7)) as d7
    from fs group by fs.first_day) q;
  end if;
  if p_cards is null or 'quits' = any(p_cards) then
  -- where players quit: battles left unfinished, by battlefield and the wave they were on
  select jsonb_agg(jsonb_build_object('lv', level_id, 'diff', diff, 'wave', wave, 'n', n) order by n desc) into v_quit
  from (select level_id, diff, wave, count(*) as n from hs_private.v_battles
        where name = 'battle_quit' and day >= v_from group by 1, 2, 3 order by n desc limit 60) q;
  end if;
  if p_cards is null or 'fields' = any(p_cards) then
  -- each battlefield and difficulty: battles ended, win rate, defenders kept in the wins, and where the defeats came
  select jsonb_agg(jsonb_build_object('lv', level_id, 'diff', diff, 'ended', ended, 'wins', wins, 'quits', quits,
      'lives_avg', lives_avg, 'lives_share', lives_share, 'defeat_wave_avg', defeat_wave) order by level_id, diff) into v_fields
  from (select level_id, diff, count(*) filter (where name <> 'battle_quit') as ended, count(*) filter (where name = 'victory') as wins,
      count(*) filter (where name = 'battle_quit') as quits,
      round(avg(lives) filter (where name = 'victory'), 1) as lives_avg,
      round(avg(lives::numeric / nullif(lives_max, 0)) filter (where name = 'victory'), 3) as lives_share,
      round(avg(wave) filter (where name = 'defeat'), 1) as defeat_wave
    from hs_private.v_battles where day >= v_from and coalesce(mode, 'campaign') = 'campaign' group by 1, 2) q;
  end if;
  if p_cards is null or 'devices' = any(p_cards) then
  select jsonb_agg(jsonb_build_object('dev', dev_class, 'os', os, 'standalone', standalone, 'people', people, 'sessions', sessions) order by people desc) into v_dev
  from (select hs_private.tag(dev_class) as dev_class, hs_private.tag(os) as os, standalone, count(distinct person) as people, count(*) as sessions
        from hs_private.v_sessions where day >= v_from group by 1, 2, 3) q;
  end if;
  if p_cards is null or 'totals' = any(p_cards) then
  select jsonb_agg(jsonb_build_object('day', day, 'people', people, 'sessions', sessions, 'signed_in', signed_in) order by day) into v_daily
  from (select day, count(distinct person) as people, count(*) as sessions, count(distinct uid) as signed_in
        from hs_private.v_sessions where day >= v_from group by day) q;
  select jsonb_build_object('accounts', (select count(*) from public.hs_profiles), 'saves', (select count(*) from public.hs_saves),
    'scores', (select count(*) from public.hs_scores where created_at >= v_from), 'events', (select count(*) from public.hs_events where ts >= v_from)) into v_tot;
  end if;
  if p_cards is null or 'gate' = any(p_cards) then
  -- the gate: what was tapped, what came back, who went round it
  select jsonb_agg(jsonb_build_object('event', name, 'provider', provider, 'why', why, 'n', n) order by name, n desc) into v_gate
  from (select e.name, hs_private.tag(e.props ->> 'provider') as provider,
          hs_private.tag(coalesce(e.props ->> 'why', e.props ->> 'error', e.props ->> 'state')) as why, count(distinct s.aid) as n
        from public.hs_events e join hs_private.v_sessions s on s.sid = e.sid
        where s.day >= v_from and e.name in ('gate_shown', 'provider_tapped', 'signed_in', 'signin_error', 'gate_bypass', 'gate_down')
        group by 1, 2, 3) q;
  end if;
  if p_cards is null or 'rulesets' = any(p_cards) then
  select jsonb_agg(jsonb_build_object('ruleset', ruleset, 'sessions', n, 'published', pub) order by n desc) into v_rules
  from (select q0.ruleset, count(*) as n, exists (select 1 from public.hs_rulesets r where r.id = q0.ruleset and r.active) as pub
        from (select hs_private.tag(s.ruleset) as ruleset from hs_private.v_sessions s where s.day >= v_from and s.ruleset is not null) q0
        group by q0.ruleset) q;
  end if;
  if p_cards is null or 'flagged' = any(p_cards) then
  select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'user', user_id, 'lv', level_id, 'diff', diff, 'mode', mode, 'score', score,
      'flags', flags, 'at', created_at) order by created_at desc) into v_flag
  from (select sc.id, p.name, sc.user_id, sc.level_id, sc.diff, sc.mode, sc.score, sc.flags, sc.created_at
        from public.hs_scores sc join public.hs_profiles p on p.user_id = sc.user_id
        where sc.created_at >= v_from and cardinality(sc.flags) > 0 order by sc.created_at desc limit 50) q;
  end if;
  -- every switch (the public ones and the admin's own), and how full the events are
  select coalesce(jsonb_object_agg(c.key, c.value), '{}'::jsonb) into v_cfg from public.hs_config c;
  v_mb := round(pg_total_relation_size('public.hs_events') / 1048576.0, 1);
  return jsonb_build_object('from', v_from, 'days', p_days, 'funnel', coalesce(v_funnel, '[]'::jsonb), 'retention', coalesce(v_ret, '[]'::jsonb),
    'quits', coalesce(v_quit, '[]'::jsonb), 'fields', coalesce(v_fields, '[]'::jsonb), 'devices', coalesce(v_dev, '[]'::jsonb),
    'daily', coalesce(v_daily, '[]'::jsonb), 'gate', coalesce(v_gate, '[]'::jsonb), 'rulesets', coalesce(v_rules, '[]'::jsonb),
    'totals', v_tot, 'flagged', coalesce(v_flag, '[]'::jsonb), 'config', v_cfg, 'events_mb', v_mb, 'now', now());
end $$;

-- ---------------------------------------------------------------- who may call what
revoke all on all functions in schema hs_private from public;
do $$
declare f text;
begin
  for f in select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname like 'hs\_%' loop
    execute 'revoke all on function ' || f || ' from public, anon, authenticated';
  end loop;
end $$;
grant execute on function public.hs_config(), public.hs_track(jsonb, jsonb),
  public.hs_board(text, text, integer, text, text, text, date, integer), public.hs_daily_status(text) to anon, authenticated;
grant execute on function public.hs_profile_get(), public.hs_profile_set_name(text, uuid), public.hs_save_get(text),
  public.hs_save_put(integer, jsonb, text, text), public.hs_run_begin(text, text, integer, text, text), public.hs_score_submit(uuid, jsonb),
  public.hs_delete_account(), public.hs_stats(integer, text[]), public.hs_admin_publish_ruleset(text, jsonb), public.hs_admin_set_config(text, jsonb),
  public.hs_admin_moderate(uuid, boolean, text), public.hs_admin_remove_score(bigint), public.hs_admin_purge_events(integer) to authenticated;

-- ---------------------------------------------------------------- starting values
insert into public.hs_config (key, value) values ('ev_cap_hour', '20000'), ('ev_max_mb', '1024'), ('ev_keep_days', '180')
  on conflict (key) do nothing;
-- names nobody may take: the game's own and the words of authority (the owner adds the words to refuse, in folded
-- form, to this table; none are listed here)
insert into public.hs_name_blocklist (pattern, kind) values
  ('admin', 'contains'), ('moderator', 'contains'), ('highlandstand', 'contains'), ('support', 'exact'), ('owner', 'exact'),
  ('official', 'contains'), ('system', 'exact'), ('null', 'exact'), ('undefined', 'exact'),
  ('卐', 'contains'), ('卍', 'contains')
on conflict (pattern) do nothing;

-- PostgREST reads its list of functions when told to
notify pgrst, 'reload schema';

-- last checks for the owner
do $$ begin
  -- account deletion needs this
  if not has_table_privilege(current_user, 'auth.users', 'DELETE') then
    raise warning 'This role may not delete from auth.users: "Delete my account" will fail. See deploy/supabase/README.md.';
  end if;
  -- the name rule on this server: letters of any alphabet pass, pictures and symbols do not
  if not hs_private.name_letters('Արամ Aram 7') or hs_private.name_letters('★★★') or hs_private.name_letters('a😀b') then
    raise warning 'The name rule does not read letters as expected on this server (its locale has no letter classes). Tell the game''s builder before going live.';
  end if;
  -- on a real Supabase the functions should belong to a role that is not a superuser (the test stand-in has only one role)
  if exists (select 1 from pg_roles where rolname = 'supabase_admin') and exists (
      select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace join pg_roles r on r.oid = p.proowner
      where n.nspname = 'public' and p.proname like 'hs\_%' and r.rolsuper) then
    raise warning 'Some hs_ functions are owned by a superuser. Run this file again from its first line (it begins with: set role postgres).';
  end if;
end $$;

reset role;
