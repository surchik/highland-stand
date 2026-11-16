-- Highland Stand: the sign-in handoff between two windows. OPTIONAL: kept beside the migrations, not one of them.
--
-- Load this ONLY if the owner's check on a real iPhone (docs/specs/platform.final.md, section 1.6) shows that a
-- sign-in begun in the Home Screen app comes back in another window. Until that is shown the page does not call
-- these functions and the database should not have them: two functions that any visitor may call are two more
-- doors than the game needs.
--
-- Needs the migrations up to 003 at least (highland._rate_ok, highland._limit_hit, the grants). Load it as the
-- migrating role in one transaction (psql -1 -f ...); take it away with handoff.down.sql BEFORE rolling 003 back.
-- migrate.js's 003 grants these two functions again whenever they exist. No secret in it.

create table highland.hs_handoff (  -- a sign-in that came back in another window
  id text primary key,
  code text not null,
  created_at timestamptz not null default now()
);
alter table highland.hs_handoff enable row level security;
create policy hs_handoff_no_rows on highland.hs_handoff as permissive for all to anon, authenticated, service_role using (false) with check (false);

-- The window that got the sign-in's code but not its verifier leaves the code here for the window that has the
-- verifier (an iPhone's Home Screen app and Safari keep separate storage). A code is useless without the verifier.
-- Limits: three puts per id in five minutes, 600 puts a minute for everyone, 200 takes per id in five minutes
-- (the waiting window asks every two seconds for five minutes: 150).
create function highland.hs_handoff_put(p_id text, p_code text) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if p_id !~ '^[A-Za-z0-9_-]{32,64}$' or p_code !~ '^[A-Za-z0-9-]{20,80}$' then raise exception 'handoff_invalid' using errcode = 'P0001'; end if;
  if not highland._rate_ok('hand', 'all', 60, 600) then perform highland._limit_hit(); end if;
  if not highland._rate_ok('handput', p_id, 300, 3) then perform highland._limit_hit(); end if;
  delete from highland.hs_handoff where created_at < highland._now() - interval '10 minutes';
  insert into highland.hs_handoff (id, code, created_at) values (p_id, p_code, highland._now()) on conflict (id) do nothing;
  return jsonb_build_object('ok', true);
end $$;

create function highland.hs_handoff_take(p_id text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_code text;
begin
  if p_id !~ '^[A-Za-z0-9_-]{32,64}$' then raise exception 'handoff_invalid' using errcode = 'P0001'; end if;
  if not highland._rate_ok('handtake', p_id, 300, 200) then perform highland._limit_hit(); end if;
  delete from highland.hs_handoff where id = p_id and created_at > highland._now() - interval '5 minutes' returning code into v_code;
  return jsonb_build_object('code', v_code);
end $$;

revoke all on table highland.hs_handoff from public, anon, authenticated, service_role;
revoke all on function highland.hs_handoff_put(text, text), highland.hs_handoff_take(text) from public, anon, authenticated, service_role;
grant execute on function highland.hs_handoff_put(text, text), highland.hs_handoff_take(text) to anon, authenticated;

notify pgrst, 'reload schema';
