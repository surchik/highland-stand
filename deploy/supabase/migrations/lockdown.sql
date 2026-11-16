-- Highland Stand: the lockdown. Every object in the schema highland is taken away from PUBLIC and from Supabase's
-- three API roles (anon, authenticated, service_role); only its owner, the migrating role, keeps it.
--
-- Why it exists: Supabase sets default privileges (among them a global
-- "alter default privileges for role postgres grant all on tables/functions/sequences to anon, authenticated,
-- service_role") so that everything the migrating role creates, in ANY schema, is granted to the API roles at
-- once. A per-schema "alter default privileges in schema highland revoke ..." cannot take a global default away
-- (PostgreSQL adds per-schema defaults to the global ones, it never subtracts), and the global ones belong to the
-- other apps on the server, so they are left alone. What protects the game is this block, run after every
-- migration (tools/platform/migrate.js runs it, then 003's grants when 003 is applied) and at the start of 003.
-- It is idempotent and touches nothing outside the schema highland.
do $lockdown$
begin
  if to_regnamespace('highland') is null then return; end if;
  revoke all on schema highland from public, anon, authenticated, service_role;
  revoke all on all tables in schema highland from public, anon, authenticated, service_role;
  revoke all on all sequences in schema highland from public, anon, authenticated, service_role;
  revoke all on all routines in schema highland from public, anon, authenticated, service_role;
end $lockdown$;
