-- Highland Stand, migration 001 (up): the schema highland, the bookkeeping table and the game's twelve tables.
-- The spec is docs/specs/platform.final.md, section 2, with docs/specs/RULINGS.md over it (S1 to S5, S8, and S9:
-- one schema on a shared Supabase). Run by tools/platform/migrate.js, as the migrating role (postgres, not a
-- superuser), in one transaction. Never creates anything outside the schema highland.
--
-- Row level security is switched on for every table the moment it is made; the policies come with 003. No API role
-- is granted anything here: the closing block takes back what Supabase's default privileges grant on creation.

create schema highland;
comment on schema highland is 'Highland Stand (the game at highland.avunjian.com). Owned by its migrations: deploy/supabase/migrations.';

-- which migrations are applied (tools/platform/migrate.js writes it; the checksum is the up file's sha256)
create table highland.schema_migrations (
  version integer primary key,
  name text not null,
  checksum text not null,
  applied_at timestamptz not null default now()
);

create table highland.hs_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text not null,                       -- the display name the player chose
  name_key text not null,                   -- its folded form: unique, and what the name filter reads
  name_changed_at timestamptz not null default now(),
  hidden boolean not null default false,    -- an admin took this player off the boards
  first_aid uuid,                           -- the anonymous id of the device that first signed in (funnel)
  created_at timestamptz not null default now()
);
create unique index hs_profiles_name_key on highland.hs_profiles (name_key);

create table highland.hs_saves (
  user_id uuid not null references auth.users(id) on delete cascade,
  channel text not null default 'live' check (channel in ('live', 'next')),   -- the staging page keeps a save of its own
  version integer not null default 1,       -- grows by one with every accepted write
  data jsonb not null,                      -- the save document (opaque to the server)
  bytes integer not null,
  device text,
  updated_at timestamptz not null default now(),
  primary key (user_id, channel)
);

create table highland.hs_rulesets (
  id text primary key,                      -- the page's RULESET
  data jsonb not null,                      -- bounds and pars per battlefield, the score weights, the daily pool
  active boolean not null default true,
  published_at timestamptz not null default now(),
  published_by uuid
);

create table highland.hs_runs (  -- a ranked battle begun: its token
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mode text not null check (mode in ('campaign', 'daily')),
  level_id text not null,
  diff smallint not null check (diff between 0 and 2),
  ruleset text not null,
  rev integer,                              -- the battlefield's rev in that ruleset (a campaign board's key, S4)
  channel text not null default 'live',     -- 'next' for a ruleset published by the staging page (its id ends "-next")
  day date,                                 -- a daily's UTC day
  twist text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);
create index hs_runs_user on highland.hs_runs (user_id, started_at desc);
create index hs_runs_daily on highland.hs_runs (user_id, day, channel) where mode = 'daily';

create table highland.hs_scores (  -- every accepted result, one per run
  id bigint generated always as identity primary key,
  run_id uuid not null unique references highland.hs_runs(id) on delete cascade,
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
  board text,                               -- the board it was put on (all time; a campaign result also on its week)
  flags text[] not null default '{}',       -- what looked unusual, for the admin's review
  created_at timestamptz not null default now()
);
create index hs_scores_user on highland.hs_scores (user_id, created_at desc);

create table highland.hs_score_best (  -- the boards: a player's best per board and period
  board text not null,                      -- 'c:<level>:<diff>:<loadout>:<rev>' or 'd:<yyyy-mm-dd>' (":next" after either on staging)
  period text not null,                     -- 'all' or 'w:<the week's Monday, yyyy-mm-dd>'
  user_id uuid not null references auth.users(id) on delete cascade,
  score integer not null,
  score_id bigint not null references highland.hs_scores(id) on delete cascade,
  lives smallint not null,
  sim_sec integer not null,
  achieved_at timestamptz not null default now(),
  primary key (board, period, user_id)
);
create index hs_score_best_rank on highland.hs_score_best (board, period, score desc, achieved_at);

create table highland.hs_sessions (  -- one visit of the page (analytics)
  sid text primary key,
  aid uuid not null,                        -- the device's anonymous id
  uid uuid,                                 -- the account, once signed in
  started_at timestamptz not null default now(),
  day date not null default ((now() at time zone 'utc')::date),
  build text, ruleset text, channel text,
  dev_class text, os text, browser text, standalone boolean,
  vw integer, vh integer, lang text, ref text
);
create index hs_sessions_aid on highland.hs_sessions (aid);
create index hs_sessions_uid on highland.hs_sessions (uid);
create index hs_sessions_day on highland.hs_sessions (day);

create table highland.hs_events (
  id bigint generated always as identity primary key,
  sid text not null references highland.hs_sessions(sid) on delete cascade,
  seq integer not null,
  name text not null,
  props jsonb not null default '{}',
  cts timestamptz,                          -- the device's clock
  ts timestamptz not null default now()     -- the server's
);
create index hs_events_name_ts on highland.hs_events (name, ts);
create index hs_events_sid on highland.hs_events (sid, seq);
-- each event of a visit is kept once: a batch the page sent as it closed is sent again on the next load when no
-- answer came back, and two tabs may each send what an earlier visit left. The page numbers its events from 1; an
-- event with no number (seq 0) is not held to it.
create unique index hs_events_once on highland.hs_events (sid, seq) where seq > 0;

create table highland.hs_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  note text,
  added_at timestamptz not null default now()
);

create table highland.hs_config (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create table highland.hs_name_blocklist (
  pattern text primary key,                 -- in folded form (highland._name_fold)
  kind text not null default 'contains' check (kind in ('contains', 'exact'))
);

create table highland.hs_rate (  -- counters for the rate limits
  bucket text not null,
  key text not null,
  n integer not null default 0,
  at timestamptz not null default now(),
  primary key (bucket, key)
);


do $$
declare t text;
begin
  foreach t in array array['schema_migrations', 'hs_profiles', 'hs_saves', 'hs_rulesets', 'hs_runs', 'hs_scores', 'hs_score_best',
      'hs_sessions', 'hs_events', 'hs_admins', 'hs_config', 'hs_name_blocklist', 'hs_rate'] loop
    execute format('alter table highland.%I enable row level security', t);
  end loop;
end $$;

-- nothing of this migration is left to the API roles (the same block as lockdown.sql, for this migration's objects)
revoke all on schema highland from public, anon, authenticated, service_role;
revoke all on all tables in schema highland from public, anon, authenticated, service_role;
revoke all on all sequences in schema highland from public, anon, authenticated, service_role;
