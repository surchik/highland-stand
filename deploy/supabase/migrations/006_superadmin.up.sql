-- Highland Stand, migration 006 (up): the superadmin and the Players view of ?stats (work package P10, the owner's
-- request in docs/specs/owner-requests-stage4.md; RULINGS S9 and S10).
--
-- What it adds:
-- - hs_superadmins: the accounts that may read the Players view. A row is made only by the owner's own command, run
--   as postgres through the SSH tunnel: select highland.hs_grant_superadmin_by_email('<the address>'). No API role
--   may run that command or its revoke (they are granted to nobody, and they refuse a session that came through the
--   API). The address is typed by the owner on his server; it is never written in the repo.
-- - hs_super_audit: one row for every read of the Players view (who, when, what, which player), and one for every
--   grant and revoke. It never keeps the words of a search (they may be an address): only that a search was made.
-- - hs_super_players and hs_super_player: the Players list (sorted, searched and paged here, on the server) and one
--   player's page. Each checks for a superadmin in a session of the game's own sign-in, reads only accounts that are
--   players (a row in hs_profiles; another app's accounts in the shared auth.users are never read), and writes its
--   audit row. The owner said yes on November 16 to showing each player's email and name there: the email is read
--   from auth.users only for an account with an hs_profiles row, inside these two functions, and nowhere else.
-- - hs_profile_get also says whether the caller is a superadmin (so the stats page knows to show the tab), and
--   "Delete my account" also removes a superadmin's row and the account from the audit rows (S10).
--
-- Every new table has row level security and policies; every function pins search_path; no API role is granted
-- anything here. The two read functions are granted to authenticated by 006_superadmin.grants.sql, which
-- tools/platform/migrate.js runs after the lockdown and 003's grants, after every step.

create table highland.hs_superadmins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  note text,
  added_at timestamptz not null default now()
);

create table highland.hs_super_audit (
  id bigint generated always as identity primary key,
  who uuid,                                 -- the superadmin who read (null for the owner's grant and revoke, or once deleted)
  at timestamptz not null default now(),
  what text not null check (what in ('players', 'player', 'grant', 'revoke')),
  player uuid,                              -- the player looked at, or granted and revoked (null for the list)
  args jsonb not null default '{}'          -- the sort, the page, the channel, whether a search was made (never its words)
);
create index hs_super_audit_at on highland.hs_super_audit (at desc);
create index hs_super_audit_who on highland.hs_super_audit (who);
create index hs_super_audit_player on highland.hs_super_audit (player);

alter table highland.hs_superadmins enable row level security;
alter table highland.hs_super_audit enable row level security;
-- as 003 does for the other tables (defence in depth: no API role is granted either table): a superadmin's own row,
-- and no row of the audit for any API role, by any command
create policy hs_superadmins_own_rows on highland.hs_superadmins as permissive for select to authenticated using (user_id = (select auth.uid()));
create policy hs_super_audit_no_rows on highland.hs_super_audit as permissive for all to anon, authenticated, service_role using (false) with check (false);

-- ---------------------------------------------------------------- helpers
create function highland._is_super() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from highland.hs_superadmins s where s.user_id = auth.uid());
$$;

-- the caller, when he is a superadmin in a session of the game's own sign-in; else not_signed_in (no account) or
-- not_superadmin (a player, an outsider, an admin who is not super, a superadmin's account signed in by password)
create function highland._need_super() returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare v uuid := highland._uid();
begin
  if not highland._is_super() or not highland._game_session() then raise exception 'not_superadmin' using errcode = '42501'; end if;
  return v;
end $$;

-- the owner's commands run only in a session of his own on the database (psql as postgres through the tunnel), never
-- in one that came through the API: there the login role is PostgREST's and the request's claims are set
create function highland._owner_only() returns void
language plpgsql stable set search_path = '' as $$
begin
  if session_user::text in ('authenticator', 'anon', 'authenticated', 'service_role', 'supabase_auth_admin')
     or coalesce(pg_catalog.current_setting('request.jwt.claims', true), '') not in ('', '{}')
     or auth.uid() is not null then
    raise exception 'owner_only' using errcode = '42501', hint = 'Run it as postgres through the SSH tunnel (docs/specs/owner/superadmin.md).';
  end if;
end $$;

-- the account an address names, for the owner's commands: exactly one, or an error that says why (never the address)
create function highland._account_by_email(p_email text) returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare v_ids uuid[];
begin
  if p_email is null or pg_catalog.btrim(p_email) !~ '^[^@[:space:]]+@[^@[:space:]]+$' then
    raise exception 'email_invalid' using errcode = 'P0001', hint = 'Give the whole address, in single quotes.';
  end if;
  select coalesce(array_agg(u.id), '{}') into v_ids from auth.users u where lower(u.email) = lower(pg_catalog.btrim(p_email));
  if cardinality(v_ids) = 0 then
    raise exception 'no_account' using errcode = 'P0001', hint = 'No account has that address yet: sign in to the game with it first (Google, Facebook or Discord), then run this again.';
  end if;
  if cardinality(v_ids) > 1 then raise exception 'two_accounts' using errcode = 'P0001', hint = 'More than one account has that address. Ask the game''s builder.'; end if;
  return v_ids[1];
end $$;

-- What the page says of a player's progress, in its save (the document's "sum", written by the page at each save):
-- each value read as a number in range, or a short tag, or nothing, so a forged save can neither break this view
-- nor carry markup into it
create function highland._sum_int(p jsonb, p_max integer) returns integer
language sql immutable set search_path = '' as $$
  select case when jsonb_typeof(p) = 'number' and (p #>> '{}') ~ '^[0-9]{1,9}$' and (p #>> '{}')::integer <= p_max then (p #>> '{}')::integer end;
$$;
create function highland._sum_map(p jsonb, p_max integer) returns jsonb
language sql immutable set search_path = '' as $$
  select case when jsonb_typeof(p) = 'object' then (
    select coalesce(jsonb_object_agg(k, highland._sum_int(v, p_max)), '{}'::jsonb)
    from (select k, v from jsonb_each(p) e(k, v) where k ~ '^[A-Za-z0-9_]{1,24}$' and highland._sum_int(v, p_max) is not null limit 24) q) end;
$$;

-- One row for each player (an account with a row in hs_profiles, and only those) on a channel ('live' or 'next'):
-- what the Players list shows. Times are in seconds.
-- - page_sec, the time on the page: for each signed-in visit, the visit's length as its page_hide events give it (the
--   seconds since the page loaded), or, when none came (the page was killed), the span between the visit's first and
--   last event as the server received them; each visit at most 12 hours.
-- - battle_sec, the battle clock (RULINGS S1: from the first wave's horn to the last foe's fall, waiting included):
--   the sum of the "sec" of the victory and defeat events of the player's signed-in visits. A battle left unfinished
--   adds nothing. hs_runs and hs_scores hold only ranked battles posted by a build with the boards, which is why the
--   events are read.
-- - won, stars, far, heroes, council: from the page's own summary in the player's save on that channel.
create function highland._super_rows(p_channel text)
returns table (user_id uuid, name text, email text, display_name text, providers text, hidden boolean, is_admin boolean, is_super boolean,
  first_seen timestamptz, last_seen timestamptz, visits integer, page_sec bigint, battles integer, battle_sec bigint,
  won_e integer, won_n integer, won_h integer, won integer, stars integer, far text, far_n integer, heroes jsonb, council jsonb,
  devices jsonb, device_n integer, saved_at timestamptz, ranked integer)
language sql stable security definer set search_path = '' as $$
  with players as (
      select p.user_id, p.name, p.hidden, p.created_at from highland.hs_profiles p),
    visits as (
      select s.uid, s.sid, s.aid, s.started_at, s.dev_class, s.os, s.browser, s.standalone
      from highland.hs_sessions s join players pl on pl.user_id = s.uid where coalesce(s.channel, 'live') = p_channel),
    per_visit as (
      select v.uid, v.sid, v.started_at,
        least(43200, greatest(0, coalesce(
          (select max(highland._int_or_null(e.props ->> 'sec')) from highland.hs_events e where e.sid = v.sid and e.name = 'page_hide'),
          (select extract(epoch from max(e.ts) - min(e.ts))::integer from highland.hs_events e where e.sid = v.sid), 0))) as sec,
        (select max(e.ts) from highland.hs_events e where e.sid = v.sid) as last_ts
      from visits v),
    battles as (
      select v.uid, count(*)::integer as n, sum(least(21600, greatest(0, coalesce(highland._int_or_null(e.props ->> 'sec'), 0))))::bigint as sec
      from visits v join highland.hs_events e on e.sid = v.sid where e.name in ('victory', 'defeat') group by v.uid),
    -- his devices: how many (anonymous ids), and the kinds of them (the kind, the system, the browser, a Home Screen app)
    devs as (
      select d.uid, (select count(distinct v2.aid)::integer from visits v2 where v2.uid = d.uid) as n,
        jsonb_agg(jsonb_build_object('dev', d.dev, 'os', d.os, 'browser', d.browser, 'standalone', d.standalone, 'visits', d.visits) order by d.visits desc) as list
      from (select v.uid, highland._tag(v.dev_class) as dev, highland._tag(v.os) as os, highland._tag(v.browser) as browser, coalesce(v.standalone, false) as standalone,
              count(*)::integer as visits
            from visits v group by 1, 2, 3, 4, 5) d group by d.uid)
  select pl.user_id, pl.name, u.email::text,
    -- the provider's display name: the first of the game's identities that carries one, else the account's own metadata
    coalesce((select left(coalesce(nullif(i.identity_data ->> 'full_name', ''), nullif(i.identity_data ->> 'name', ''),
          nullif(i.identity_data -> 'custom_claims' ->> 'global_name', ''), nullif(i.identity_data ->> 'global_name', ''),
          nullif(i.identity_data ->> 'user_name', ''), nullif(i.identity_data ->> 'preferred_username', '')), 80)
        from auth.identities i where i.user_id = pl.user_id and i.provider in ('google', 'facebook', 'discord')
          and coalesce(nullif(i.identity_data ->> 'full_name', ''), nullif(i.identity_data ->> 'name', ''), nullif(i.identity_data -> 'custom_claims' ->> 'global_name', ''),
            nullif(i.identity_data ->> 'global_name', ''), nullif(i.identity_data ->> 'user_name', ''), nullif(i.identity_data ->> 'preferred_username', '')) is not null
        order by i.created_at limit 1),
      left(coalesce(nullif(u.raw_user_meta_data ->> 'full_name', ''), nullif(u.raw_user_meta_data ->> 'name', '')), 80)),
    (select string_agg(distinct i.provider, ',' order by i.provider) from auth.identities i where i.user_id = pl.user_id and i.provider in ('google', 'facebook', 'discord')),
    pl.hidden,
    exists (select 1 from highland.hs_admins a where a.user_id = pl.user_id),
    exists (select 1 from highland.hs_superadmins x where x.user_id = pl.user_id),
    least(pl.created_at, (select min(v.started_at) from visits v where v.uid = pl.user_id)),
    greatest(pl.created_at, (select max(coalesce(pv.last_ts, pv.started_at)) from per_visit pv where pv.uid = pl.user_id), sv.updated_at),
    (select count(*)::integer from visits v where v.uid = pl.user_id),
    coalesce((select sum(pv.sec)::bigint from per_visit pv where pv.uid = pl.user_id), 0),
    coalesce(b.n, 0), coalesce(b.sec, 0),
    highland._sum_int(sv.data -> 'sum' -> 'won' -> 0, 99), highland._sum_int(sv.data -> 'sum' -> 'won' -> 1, 99), highland._sum_int(sv.data -> 'sum' -> 'won' -> 2, 99),
    coalesce(highland._sum_int(sv.data -> 'sum' -> 'won' -> 0, 99), 0) + coalesce(highland._sum_int(sv.data -> 'sum' -> 'won' -> 1, 99), 0) + coalesce(highland._sum_int(sv.data -> 'sum' -> 'won' -> 2, 99), 0),
    highland._sum_int(sv.data -> 'sum' -> 'stars', 999),
    highland._tag(sv.data -> 'sum' ->> 'far'), highland._sum_int(sv.data -> 'sum' -> 'farN', 99),
    highland._sum_map(sv.data -> 'sum' -> 'heroes', 9), highland._sum_map(sv.data -> 'sum' -> 'council', 9),
    coalesce(d.list, '[]'::jsonb), coalesce(d.n, 0), sv.updated_at,
    (select count(*)::integer from highland.hs_scores sc join highland.hs_runs r on r.id = sc.run_id where sc.user_id = pl.user_id and r.channel = p_channel)
  from players pl
    join auth.users u on u.id = pl.user_id
    left join highland.hs_saves sv on sv.user_id = pl.user_id and sv.channel = p_channel
    left join battles b on b.uid = pl.user_id
    left join devs d on d.uid = pl.user_id;
$$;

-- ---------------------------------------------------------------- the Players view (superadmins only)
-- p_sort: name, email, provider, first, last, visits, page, battle, won, stars, far, devices (else last); p_desc: the
-- order; p_q: a search in the game name, the provider's display name and the email (case does not matter); p_limit
-- 1 to 100 (25); p_offset from 0; p_channel 'live' (the default) or 'next' (the staging page's saves and visits)
create function highland.hs_super_players(p_sort text default 'last', p_desc boolean default true, p_q text default null,
  p_limit integer default 25, p_offset integer default 0, p_channel text default 'live') returns jsonb
language plpgsql security definer set search_path = '' set statement_timeout = '30s' as $$
declare v_me uuid := highland._need_super();
  v_sort text := case when p_sort in ('name', 'email', 'provider', 'first', 'last', 'visits', 'page', 'battle', 'won', 'stars', 'far', 'devices') then p_sort else 'last' end;
  v_desc boolean := coalesce(p_desc, true);
  v_q text := nullif(lower(left(pg_catalog.btrim(coalesce(p_q, '')), 80)), '');
  v_limit integer := greatest(1, least(coalesce(p_limit, 25), 100));
  v_offset integer := greatest(0, least(coalesce(p_offset, 0), 1000000));
  v_total integer; v_rows jsonb;
begin
  if p_channel is null or p_channel not in ('live', 'next') then raise exception 'channel_unknown' using errcode = 'P0001'; end if;
  with r as (select * from highland._super_rows(p_channel) x
      where v_q is null or strpos(lower(x.name), v_q) > 0 or strpos(lower(coalesce(x.email, '')), v_q) > 0 or strpos(lower(coalesce(x.display_name, '')), v_q) > 0),
    k as (select r.*, case v_sort when 'name' then lower(r.name) when 'email' then lower(r.email) when 'provider' then r.providers end as tkey,
        case v_sort when 'first' then extract(epoch from r.first_seen) when 'last' then extract(epoch from r.last_seen) when 'visits' then r.visits when 'page' then r.page_sec
          when 'battle' then r.battle_sec when 'won' then r.won when 'stars' then r.stars when 'far' then r.far_n when 'devices' then r.device_n end as nkey
      from r),
    total as (select count(*)::integer as n from k),
    page as (select * from k order by
        case when v_desc then k.tkey end desc nulls last, case when not v_desc then k.tkey end asc nulls last,
        case when v_desc then k.nkey end desc nulls last, case when not v_desc then k.nkey end asc nulls last,
        lower(k.name), k.user_id
      offset v_offset limit v_limit)
  select (select n from total), coalesce((select jsonb_agg(jsonb_build_object('id', p.user_id, 'name', p.name, 'email', p.email, 'display_name', p.display_name,
      'providers', p.providers, 'hidden', p.hidden, 'admin', p.is_admin, 'super', p.is_super, 'first', p.first_seen, 'last', p.last_seen, 'visits', p.visits,
      'page_sec', p.page_sec, 'battles', p.battles, 'battle_sec', p.battle_sec, 'won', jsonb_build_array(p.won_e, p.won_n, p.won_h), 'stars', p.stars,
      'far', p.far, 'far_n', p.far_n, 'heroes', p.heroes, 'council', p.council, 'devices', p.devices, 'device_n', p.device_n, 'saved_at', p.saved_at,
      'ranked', p.ranked) order by p.ord) from (select page.*, row_number() over () as ord from page) p), '[]'::jsonb)
    into v_total, v_rows;
  insert into highland.hs_super_audit (who, what, player, args)
    values (v_me, 'players', null, jsonb_build_object('sort', v_sort, 'desc', v_desc, 'searched', v_q is not null, 'limit', v_limit, 'offset', v_offset,
      'channel', p_channel, 'shown', jsonb_array_length(v_rows)));
  return jsonb_build_object('rows', v_rows, 'total', v_total, 'sort', v_sort, 'desc', v_desc, 'limit', v_limit, 'offset', v_offset,
    'channel', p_channel, 'now', highland._now());
end $$;

-- One player's page: the list's row, his save's place, his ranked runs, the battles of his visits (from the events)
-- and his recent visits. A user id that is not a player's (another app's account, or nobody) answers player: null,
-- and is audited like any other look.
create function highland.hs_super_player(p_user uuid, p_channel text default 'live') returns jsonb
language plpgsql security definer set search_path = '' set statement_timeout = '30s' as $$
declare v_me uuid := highland._need_super(); v_row jsonb; v_runs jsonb; v_battles jsonb; v_visits jsonb; v_save jsonb;
begin
  if p_channel is null or p_channel not in ('live', 'next') then raise exception 'channel_unknown' using errcode = 'P0001'; end if;
  insert into highland.hs_super_audit (who, what, player, args) values (v_me, 'player', p_user, jsonb_build_object('channel', p_channel));
  if p_user is null or not exists (select 1 from highland.hs_profiles p where p.user_id = p_user) then
    return jsonb_build_object('player', null, 'channel', p_channel, 'now', highland._now());
  end if;
  select jsonb_build_object('id', p.user_id, 'name', p.name, 'email', p.email, 'display_name', p.display_name,
      'providers', p.providers, 'hidden', p.hidden, 'admin', p.is_admin, 'super', p.is_super, 'first', p.first_seen, 'last', p.last_seen, 'visits', p.visits,
      'page_sec', p.page_sec, 'battles', p.battles, 'battle_sec', p.battle_sec, 'won', jsonb_build_array(p.won_e, p.won_n, p.won_h), 'stars', p.stars,
      'far', p.far, 'far_n', p.far_n, 'heroes', p.heroes, 'council', p.council, 'devices', p.devices, 'device_n', p.device_n, 'saved_at', p.saved_at,
      'ranked', p.ranked)
    into v_row from highland._super_rows(p_channel) p where p.user_id = p_user;
  select jsonb_build_object('version', s.version, 'bytes', s.bytes, 'device', left(s.device, 40), 'updated_at', s.updated_at) into v_save
    from highland.hs_saves s where s.user_id = p_user and s.channel = p_channel;
  -- his ranked battles, newest first (a build with the boards posts them; until then there are none)
  select jsonb_agg(jsonb_build_object('at', q.started_at, 'mode', q.mode, 'lv', q.level_id, 'diff', q.diff, 'ruleset', q.ruleset, 'day', q.day, 'twist', q.twist,
      'finished', q.finished_at, 'won', q.won, 'score', q.score, 'stars', q.stars, 'lives', q.lives, 'waves', q.waves, 'sim_sec', q.sim_sec, 'loadout', q.loadout,
      'flags', q.flags) order by q.started_at desc) into v_runs
  from (select r.started_at, r.mode, r.level_id, r.diff, r.ruleset, r.day, r.twist, r.finished_at, sc.won, sc.score, sc.stars, sc.lives, sc.waves, sc.sim_sec,
          sc.loadout, sc.flags
        from highland.hs_runs r left join highland.hs_scores sc on sc.run_id = r.id
        where r.user_id = p_user and r.channel = p_channel order by r.started_at desc limit 50) q;
  -- the battles his visits told of: won, lost, or left and not come back to in that visit
  select jsonb_agg(jsonb_build_object('at', q.ts, 'end', q.name, 'lv', q.lv, 'diff', q.diff, 'mode', q.mode, 'wave', q.wave, 'waves', q.waves,
      'lives', q.lives, 'lives_max', q.lives_max, 'stars', q.stars, 'sec', q.sec, 'loadout', q.loadout) order by q.ts desc) into v_battles
  from (select e.ts, e.name, highland._tag(e.props ->> 'lv') as lv, highland._int_or_null(e.props ->> 'diff') as diff, highland._tag(e.props ->> 'mode') as mode,
          highland._int_or_null(e.props ->> 'wave') as wave, highland._int_or_null(e.props ->> 'waves') as waves, highland._int_or_null(e.props ->> 'lives') as lives,
          highland._int_or_null(e.props ->> 'lives_max') as lives_max, highland._int_or_null(e.props ->> 'stars') as stars, highland._int_or_null(e.props ->> 'sec') as sec,
          highland._tag(e.props ->> 'loadout') as loadout
        from highland.hs_sessions s join highland.hs_events e on e.sid = s.sid
        where s.uid = p_user and coalesce(s.channel, 'live') = p_channel
          and (e.name in ('victory', 'defeat') or (e.name = 'battle_quit' and not exists (select 1 from highland.hs_events b
            where b.sid = e.sid and b.name = 'battle_back' and b.seq > e.seq)))
        order by e.ts desc limit 50) q;
  -- his recent visits
  select jsonb_agg(jsonb_build_object('at', q.started_at, 'dev', q.dev, 'os', q.os, 'browser', q.browser, 'standalone', q.standalone, 'build', q.build,
      'vw', q.vw, 'vh', q.vh, 'lang', q.lang, 'events', q.n, 'sec', q.sec, 'last', q.last_ts) order by q.started_at desc) into v_visits
  from (select s.started_at, highland._tag(s.dev_class) as dev, highland._tag(s.os) as os, highland._tag(s.browser) as browser, s.standalone,
          highland._tag(s.build) as build, s.vw, s.vh, highland._tag(s.lang) as lang,
          (select count(*)::integer from highland.hs_events e where e.sid = s.sid) as n,
          least(43200, greatest(0, coalesce((select max(highland._int_or_null(e.props ->> 'sec')) from highland.hs_events e where e.sid = s.sid and e.name = 'page_hide'),
            (select extract(epoch from max(e.ts) - min(e.ts))::integer from highland.hs_events e where e.sid = s.sid), 0))) as sec,
          (select max(e.ts) from highland.hs_events e where e.sid = s.sid) as last_ts
        from highland.hs_sessions s where s.uid = p_user and coalesce(s.channel, 'live') = p_channel order by s.started_at desc limit 30) q;
  return jsonb_build_object('player', v_row, 'save', v_save, 'runs', coalesce(v_runs, '[]'::jsonb), 'battles', coalesce(v_battles, '[]'::jsonb),
    'visits', coalesce(v_visits, '[]'::jsonb), 'channel', p_channel, 'now', highland._now());
end $$;

-- ---------------------------------------------------------------- the owner's two commands (granted to nobody)
-- select highland.hs_grant_superadmin_by_email('<the address>');   as postgres, through the SSH tunnel
-- The account must have signed in to the game with Google, Facebook or Discord under that address. It is made an
-- admin too (the stats page's other cards), unless it was one already. The answer names the account by its id,
-- never by its address.
create function highland.hs_grant_superadmin_by_email(p_email text) returns text
language plpgsql security definer set search_path = '' as $$
declare v uuid; v_name text;
begin
  perform highland._owner_only();
  v := highland._account_by_email(p_email);
  if not highland._game_account(v) then
    raise exception 'not_game_account' using errcode = 'P0001', hint = 'That account never signed in with Google, Facebook or Discord. Sign in to the game with one of them under that address first.';
  end if;
  insert into highland.hs_superadmins (user_id, note) values (v, 'the owner''s command') on conflict (user_id) do nothing;
  insert into highland.hs_admins (user_id, note) values (v, 'given with superadmin') on conflict (user_id) do nothing;
  insert into highland.hs_super_audit (who, what, player, args) values (null, 'grant', v, '{}');
  select p.name into v_name from highland.hs_profiles p where p.user_id = v;
  return 'superadmin: account ' || v::text || case when v_name is null then ' (no game name yet: choose one in the game, then open ?stats)'
    else ' (game name ' || v_name || '). Open ?stats and choose Players.' end;
end $$;

-- select highland.hs_revoke_superadmin_by_email('<the address>');   as postgres, through the SSH tunnel
-- Takes the superadmin away, and the admin row the grant gave with it (an admin row made otherwise stays).
create function highland.hs_revoke_superadmin_by_email(p_email text) returns text
language plpgsql security definer set search_path = '' as $$
declare v uuid; n integer;
begin
  perform highland._owner_only();
  v := highland._account_by_email(p_email);
  delete from highland.hs_superadmins where user_id = v;
  get diagnostics n = row_count;
  delete from highland.hs_admins where user_id = v and note = 'given with superadmin';
  insert into highland.hs_super_audit (who, what, player, args) values (null, 'revoke', v, jsonb_build_object('was', n > 0));
  return case when n > 0 then 'superadmin taken away from account ' || v::text else 'account ' || v::text || ' was not a superadmin' end;
end $$;

-- ---------------------------------------------------------------- two functions of 002 and 005, kept as they were plus P10's part
-- hs_profile_get: as 002 made it, and whether the caller is a superadmin
create or replace function highland.hs_profile_get() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_uid uuid := highland._uid(); r highland.hs_profiles;
begin
  select * into r from highland.hs_profiles where user_id = v_uid;
  return jsonb_build_object('user_id', v_uid, 'name', r.name, 'hidden', coalesce(r.hidden, false),
    'name_changed_at', r.name_changed_at, 'admin', highland._is_admin(), 'super', highland._is_super(), 'now', highland._now());
end $$;

-- "Delete my account": as 005 made it, and a superadmin's row, and the account taken out of the audit rows (they stay,
-- naming nobody: that a look was taken is the owner's record, not the player's data)
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
  delete from highland.hs_superadmins where user_id = v_uid;
  update highland.hs_super_audit set player = null where player = v_uid;
  update highland.hs_super_audit set who = null where who = v_uid;
  update highland.hs_rulesets set published_by = null where published_by = v_uid;
  delete from highland.hs_profiles where user_id = v_uid;
  return jsonb_build_object('ok', true);
end $$;

notify pgrst, 'reload schema';

-- nothing of this migration is left to the API roles (the same block as lockdown.sql, for this migration's objects)
revoke all on all routines in schema highland from public, anon, authenticated, service_role;
revoke all on all tables in schema highland from public, anon, authenticated, service_role;
revoke all on all sequences in schema highland from public, anon, authenticated, service_role;
