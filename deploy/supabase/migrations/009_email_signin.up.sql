-- Highland Stand, migration 009 (up): players may sign in by email and password (stage 6, the owner's request of
-- 17 November: "lets also add a normal login and sign up with email").
--
-- Until now every function a player's data goes through asked for a session that began with Google, Facebook or
-- Discord (_game_session: the token's amr holds "oauth"), and only an account that once signed in with one of them
-- could become a player (_game_account). That was written for a sign-in service shared with other apps, whose email
-- sign-up is open: an account made there was no player. The game's own Supabase (deploy/hs-supabase) is the game's
-- alone, and its email sign-up is the game's own form. So from this migration:
-- - _game_session(): a session that began with a provider ("oauth") or with the game's email and password
--   ("password"). Every function of a player (the name card, saves, scores, the daily, "Delete my account") takes
--   either. A one-time code or a magic link ("otp") is still not one: the game sends no mail.
-- - _game_account(uid): an account with a provider's identity or an email identity may choose a name and become a
--   player.
-- - The admin's and the superadmin's functions keep asking for a provider's session: _is_admin() and _is_super() are
--   true only in one (_provider_session), so the stats page and the Players view refuse a password session, as
--   before; and the owner's grant (hs_grant_superadmin_by_email) still asks for an account that signed in with a
--   provider (_provider_account).
-- The known cost, accepted by the owner (docs/specs/owner-requests-stage6.md, section 3): with no mail sent, an
-- address can be signed up by someone who does not own it, and a later Google sign-in with that address joins the
-- same account. An address that already has an account cannot be signed up again.
-- Two new helpers, granted to nobody (the lockdown takes back what Supabase's default privileges grant); four
-- helpers and the owner's grant replaced with the same signatures, so no grant changes. No table changes.

-- the session began with Google, Facebook or Discord (what _game_session was before this migration)
create function highland._provider_session() returns boolean
language sql stable set search_path = '' as $$
  select coalesce(auth.jwt() -> 'amr', '[]'::jsonb) @> '[{"method": "oauth"}]'::jsonb;
$$;

-- the account signed in with Google, Facebook or Discord at least once (what _game_account was before)
create function highland._provider_account(p_uid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from auth.identities i where i.user_id = p_uid and i.provider in ('google', 'facebook', 'discord'));
$$;

-- a session of the game's own sign-in: a provider's, or the game's email and password
create or replace function highland._game_session() returns boolean
language sql stable set search_path = '' as $$
  select coalesce(auth.jwt() -> 'amr', '[]'::jsonb) @> '[{"method": "oauth"}]'::jsonb
      or coalesce(auth.jwt() -> 'amr', '[]'::jsonb) @> '[{"method": "password"}]'::jsonb;
$$;

-- an account the game's own sign-in made: a provider's identity, or an email identity (the game's sign-up form)
create or replace function highland._game_account(p_uid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from auth.identities i where i.user_id = p_uid and i.provider in ('google', 'facebook', 'discord', 'email'));
$$;

-- an admin, in a provider's session only (a password session of an admin's account is no admin)
create or replace function highland._is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from highland.hs_admins a where a.user_id = auth.uid()) and highland._provider_session();
$$;

-- a superadmin, in a provider's session only
create or replace function highland._is_super() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from highland.hs_superadmins s where s.user_id = auth.uid()) and highland._provider_session();
$$;

-- the owner's grant (006's), asking as before for an account that signed in with a provider
create or replace function highland.hs_grant_superadmin_by_email(p_email text) returns text
language plpgsql security definer set search_path = '' as $$
declare v uuid; v_name text;
begin
  perform highland._owner_only();
  v := highland._account_by_email(p_email);
  if not highland._provider_account(v) then
    raise exception 'not_game_account' using errcode = 'P0001', hint = 'That account never signed in with Google, Facebook or Discord. Sign in to the game with one of them under that address first.';
  end if;
  insert into highland.hs_superadmins (user_id, note) values (v, 'the owner''s command') on conflict (user_id) do nothing;
  insert into highland.hs_admins (user_id, note) values (v, 'given with superadmin') on conflict (user_id) do nothing;
  insert into highland.hs_super_audit (who, what, player, args) values (null, 'grant', v, '{}');
  select p.name into v_name from highland.hs_profiles p where p.user_id = v;
  return 'superadmin: account ' || v::text || case when v_name is null then ' (no game name yet: choose one in the game, then open ?stats)'
    else ' (game name ' || v_name || '). Open ?stats and choose Players.' end;
end $$;
