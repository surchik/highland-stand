-- Highland Stand, migration 004 (up): the starting values. The analytics' three ceilings, and the names nobody may
-- take: the game's own and the words of authority (the owner adds the words to refuse, in folded form, to
-- highland.hs_name_blocklist; none are listed here). Rows only, no object: nothing to grant.
insert into highland.hs_config (key, value) values ('ev_cap_hour', '20000'), ('ev_max_mb', '1024'), ('ev_keep_days', '180')
  on conflict (key) do nothing;
insert into highland.hs_name_blocklist (pattern, kind) values
  ('admin', 'contains'), ('moderator', 'contains'), ('highlandstand', 'contains'), ('support', 'exact'), ('owner', 'exact'),
  ('official', 'contains'), ('system', 'exact'), ('null', 'exact'), ('undefined', 'exact'),
  ('卐', 'contains'), ('卍', 'contains')
on conflict (pattern) do nothing;
