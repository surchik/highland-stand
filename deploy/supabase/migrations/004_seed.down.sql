-- Highland Stand, migration 004 (down): removes the starting values 004 put in (a ceiling the admin has changed
-- since goes too: it is one of 004's keys). Rows only; every delete names its rows.
delete from highland.hs_config where key in ('ev_cap_hour', 'ev_max_mb', 'ev_keep_days');
delete from highland.hs_name_blocklist where pattern in ('admin', 'moderator', 'highlandstand', 'support', 'owner', 'official', 'system',
  'null', 'undefined', '卐', '卍');
