-- Highland Stand, migration 009 (down): a provider's session only again. _game_session and _game_account as 002 made
-- them, _is_admin as 002 made it, _is_super and the owner's grant as 006 made them (the same signatures, so no grant
-- changes), and 009's two helpers dropped. Players who signed up by email keep their rows, but their password sessions
-- reach nothing until they sign in with a provider under the same address. No table or row is changed.
create or replace function highland._game_session() returns boolean
language sql stable set search_path = '' as $$
  select coalesce(auth.jwt() -> 'amr', '[]'::jsonb) @> '[{"method": "oauth"}]'::jsonb;
$$;

create or replace function highland._game_account(p_uid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from auth.identities i where i.user_id = p_uid and i.provider in ('google', 'facebook', 'discord'));
$$;

create or replace function highland._is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from highland.hs_admins a where a.user_id = auth.uid());
$$;

create or replace function highland._is_super() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from highland.hs_superadmins s where s.user_id = auth.uid());
$$;

create or replace function highland.hs_grant_superadmin_by_email(p_email text) returns text
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

drop function highland._provider_account(uuid);
drop function highland._provider_session();
