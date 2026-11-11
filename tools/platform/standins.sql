-- Stand-ins for a self-hosted Supabase, for tests on a plain PostgreSQL (15 or newer). Loaded by
-- tools/platform/stack.js and sql-tests.js into a throwaway database, before deploy/supabase/schema.sql.
-- NEVER run this on the real Supabase: it already has all of this, and its own versions of it.
--
-- What it copies, and why each matters to the tests:
-- - the roles. The cluster's superuser is supabase_admin (initdb -U supabase_admin), as on Supabase, and postgres
--   is not a superuser: it may create roles and databases and bypasses row level security, as Supabase's
--   "demote postgres" migration leaves it. schema.sql begins with "set role postgres", so its functions belong
--   to that ordinary role here too, and its closing check for functions owned by a superuser is really run.
-- - anon, authenticated and service_role, and authenticator, the login role PostgREST uses, which may become
--   anon or authenticated and nothing else. The stand-in for PostgREST logs in as authenticator, so a call can
--   only ever do what those roles may do. (Here it logs in over a local socket with no password at all.)
-- - Supabase's statement timeouts for the two API roles (3 s and 8 s).
-- - the auth schema: auth.users, auth.identities (one row for each provider a person signed in with), the
--   sign-in service's audit log, and auth.uid(), which reads the caller's id from the JWT claims PostgREST
--   sets for the transaction. postgres holds every privilege on these tables, as on Supabase.
-- - Supabase's permissive default grants in the public schema: everything that postgres creates there is
--   granted to the API roles. So the tests prove that schema.sql's own revokes and row level security are what
--   protects the tables, not a quiet default of this stand-in.
-- It is safe to run again.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'postgres') then
    create role postgres login createrole createdb bypassrls;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin noinherit bypassrls; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticator') then create role authenticator login noinherit; end if;
end $$;
grant anon, authenticated, service_role to authenticator;
grant anon, authenticated, service_role to postgres;
alter role anon set statement_timeout = '3s';
alter role authenticated set statement_timeout = '8s';

create schema if not exists auth;
grant usage on schema auth to anon, authenticated, service_role, postgres;
create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  email_confirmed_at timestamptz,
  raw_app_meta_data jsonb not null default '{}',
  raw_user_meta_data jsonb not null default '{}',
  last_sign_in_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- one row per provider account a person signed in with (Supabase links them to one user by a verified email)
create table if not exists auth.identities (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  identity_data jsonb not null default '{}',
  email text,
  created_at timestamptz not null default now(),
  unique (provider_id, provider)
);
-- the sign-in service's log, as GoTrue keeps it (the payload names the account and its email)
create table if not exists auth.audit_log_entries (
  id uuid primary key default gen_random_uuid(),
  payload json,
  created_at timestamptz default now(),
  ip_address varchar(64) not null default ''
);
-- as in Supabase: the caller's id and role from the JWT claims PostgREST sets for the transaction
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub', '')::uuid
$$;
create or replace function auth.role() returns text language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', 'anon')
$$;
grant all on all tables in schema auth to postgres;

grant usage on schema public to anon, authenticated, service_role;
alter default privileges for role postgres in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges for role postgres in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges for role postgres in schema public grant all on sequences to anon, authenticated, service_role;
