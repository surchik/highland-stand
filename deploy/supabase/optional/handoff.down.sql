-- Highland Stand: takes the optional sign-in handoff away again (handoff.up.sql). Drops nothing outside highland.
drop function highland.hs_handoff_put(text, text);
drop function highland.hs_handoff_take(text);
drop table highland.hs_handoff;
notify pgrst, 'reload schema';
