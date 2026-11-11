-- Highland Stand: the sign-in handoff between two windows. OPTIONAL. DRAFT of deploy/supabase/schema-handoff.sql.
--
-- Run this file ONLY if the owner's check on a real iPhone (docs/specs/platform.final.md, section 1.6, and the
-- setup guide's step 6) shows that a sign-in begun in the Home Screen app comes back in another window. Until
-- that is shown the page does not call these functions and the database should not have them: two functions that
-- any visitor may call are two more doors than the game needs.
--
-- It needs schema.sql first (hs_private.rate_ok, hs_private.limit_hit). Safe to run again. No secret in it.
-- To remove it again: drop function public.hs_handoff_put(text, text), public.hs_handoff_take(text);
--                     drop table public.hs_handoff;

set role postgres;

create table if not exists public.hs_handoff (  -- a sign-in that came back in another window
  id text primary key,
  code text not null,
  created_at timestamptz not null default now()
);
alter table public.hs_handoff enable row level security;
revoke all on table public.hs_handoff from public, anon, authenticated;

-- The window that got the sign-in's code but not its verifier leaves the code here for the window that has the
-- verifier (an iPhone's Home Screen app and Safari keep separate storage). A code is useless without the verifier.
-- Limits: three puts per id in five minutes, 600 puts a minute for everyone, 200 takes per id in five minutes
-- (the waiting window asks every two seconds for five minutes: 150).
create or replace function public.hs_handoff_put(p_id text, p_code text) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if p_id !~ '^[A-Za-z0-9_-]{32,64}$' or p_code !~ '^[A-Za-z0-9-]{20,80}$' then raise exception 'handoff_invalid' using errcode = 'P0001'; end if;
  if not hs_private.rate_ok('hand', 'all', 60, 600) then perform hs_private.limit_hit(); end if;
  if not hs_private.rate_ok('handput', p_id, 300, 3) then perform hs_private.limit_hit(); end if;
  delete from public.hs_handoff where created_at < now() - interval '10 minutes';
  insert into public.hs_handoff (id, code) values (p_id, p_code) on conflict (id) do nothing;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.hs_handoff_take(p_id text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_code text;
begin
  if p_id !~ '^[A-Za-z0-9_-]{32,64}$' then raise exception 'handoff_invalid' using errcode = 'P0001'; end if;
  if not hs_private.rate_ok('handtake', p_id, 300, 200) then perform hs_private.limit_hit(); end if;
  delete from public.hs_handoff where id = p_id and created_at > now() - interval '5 minutes' returning code into v_code;
  return jsonb_build_object('code', v_code);
end $$;

revoke all on function public.hs_handoff_put(text, text), public.hs_handoff_take(text) from public, anon, authenticated;
grant execute on function public.hs_handoff_put(text, text), public.hs_handoff_take(text) to anon, authenticated;

notify pgrst, 'reload schema';
reset role;
