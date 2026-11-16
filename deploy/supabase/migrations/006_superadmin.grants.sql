-- Highland Stand, migration 006's grants: the Players view's two functions, to authenticated only (each asks for a
-- superadmin itself). Not to anon, not to service_role. The owner's two commands (hs_grant_superadmin_by_email,
-- hs_revoke_superadmin_by_email) are granted to nobody: only their owner, postgres, runs them.
-- tools/platform/migrate.js runs this after the lockdown and 003's grants, after every step while 006 is applied, and
-- on "regrant" (a restore). It is idempotent and grants nothing else.
grant execute on function highland.hs_super_players(text, boolean, text, integer, integer, text), highland.hs_super_player(uuid, text) to authenticated;
