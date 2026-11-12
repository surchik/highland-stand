-- Highland Stand, migration 001 (down): removes the twelve tables, the bookkeeping table and the schema highland.
-- Every name is spelled out and nothing cascades: if anything outside the schema had come to depend on these
-- tables, the drop stops with an error instead of removing it. It drops nothing outside the schema highland.
-- ALL THE GAME'S DATA GOES WITH IT: take a backup first (deploy/supabase/README.md).
drop table highland.hs_events;
drop table highland.hs_sessions;
drop table highland.hs_score_best;
drop table highland.hs_scores;
drop table highland.hs_runs;
drop table highland.hs_saves;
drop table highland.hs_profiles;
drop table highland.hs_rulesets;
drop table highland.hs_admins;
drop table highland.hs_config;
drop table highland.hs_name_blocklist;
drop table highland.hs_rate;
drop table highland.schema_migrations;
drop schema highland;
