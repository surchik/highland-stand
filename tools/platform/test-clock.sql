-- The test stack's clock. Loaded after deploy/supabase/schema.sql in a throwaway database only (never on the
-- real Supabase). schema.sql reads the time through hs_private.now() alone; here that function adds the
-- offset held in the setting hs_test.clock (an interval such as '1 day' or '-90 seconds'), which the stack's
-- stand-in for PostgREST sets in every transaction it runs. So a test can move to the next day or across a
-- Sunday midnight without waiting. With the setting empty the clock is the real one.
create or replace function hs_private.now() returns timestamptz
language sql stable set search_path = '' as $$
  select pg_catalog.now() + coalesce(nullif(pg_catalog.current_setting('hs_test.clock', true), ''), '0 seconds')::interval
$$;
