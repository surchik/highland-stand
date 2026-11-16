# P10 review: the superadmin's Players view

REVIEW P10: 1 blocker, 0 majors, 7 minors.

Reviewed: branch pf/work, commit 1223571, against its base 718b825 (next). I read the whole diff line by line:
migration 006 (up, down and grants), migrate.js's grants files, index.html (csSum, the ?stats tabs, the Players
list, a player's page, the privacy page's new part), sql-tests.js, isolation.js, platform.js flow 15, stack.js,
p0.js, guide-check.sh, restore-rehearsal.sh, the owner's page superadmin.md, shared-supabase-plan.md and the
guide. I reran every claim of the builder's report (listed below). I also ran five probes and nine mutants.

The probes and mutants are outside the repo, in
`/tmp/claude-0/-home-user/169f7cc7-9178-569c-b36f-88a849db13cf/scratchpad/top/build/review/P10/`:
`perf.js` (the Players view on a big table), `loopprobe.js` (a superadmin in a password session), `sumprobe.js`
(the page's csSum on a returning player's save), `migcheck.js` (migrate.js up, down, up on a fresh cluster) and
`mutate.sh` (one break in a copy of the package, then sql-tests.js and isolation.js). Logs are in `logs/` there.

The privilege and tenancy walls hold. As a visitor, a player, an outsider of another app, an admin who is not
super, a superadmin's account in a password session and service_role, nothing reads a row of the two new tables
or calls the view. The owner's grant and revoke are refused to every API role, even with a mistaken grant
(`owner_only`). Only players' auth.users rows are read. No other role's answer holds an email. Every read is
audited without the search's words. The tests are real: each of the nine mutants failed sql-tests.js or
isolation.js or both. What fails is size. The view computes every player's row on every call, with quadratic
correlated subqueries. With 4,000 players the list and one player's page both hit the 30 s statement timeout
(finding 1).

## Findings

### 1. blocker: the Players list and a player's page time out once the game has a few thousand players

Evidence: `node <review dir>/perf.js P V E` from /home/user/hs-wt/pf. It makes P players with V signed-in visits
each and E events per visit, as many anonymous visits again, and five times P other apps' accounts. Then it calls
the view as a superadmin through the stack's API (logs/perf-big.log, logs/perf-mid.log):

| players | player events | events+sessions | hs_super_players | hs_super_player (one player) |
| --- | --- | --- | --- | --- |
| 500 | 100,000 | 37 MB | 0.7 to 0.8 s | 0.8 s |
| 2,000 | 400,000 | 149 MB | 7.8 to 9.5 s | 8.1 s |
| 4,000 | 1,600,000 | 659 MB | 500, `57014 canceling statement due to statement timeout` after 30 s, for every sort, a search and offset 1000 | 500, the same timeout |

The machine was shared with the other track while these ran, so the absolute times are high. The growth is the
point: four times the data took about eleven times as long. 659 MB is under the default event ceiling of
`ev_max_mb` = 1024. Events are kept for 180 days, so a game with a few thousand regular players reaches this size.
At that point the owner sees "The players did not come" on both pages, and the view he asked for is gone.

Cause (006_superadmin.up.sql):
- `_super_rows` builds the CTE `visits` once and then looks into it once per player with correlated subqueries:
  line 139 (`count(distinct v2.aid) ... where v2.uid = d.uid`), 158 (`min(v.started_at)`), 159 (`max(... ) from
  per_visit`), 160 (`count(*) from visits`) and 161 (`sum(pv.sec) from per_visit`). A CTE referenced more than
  once is materialized without an index, so each lookup scans every visit. That is players x visits.
- `per_visit` runs three subqueries into hs_events for each visit.
- hs_super_player calls `_super_rows(p_channel)` and then filters it to one player (line 235). A SECURITY DEFINER
  SQL function is never inlined, so a single player's page computes every player's row first.
- The list sorts and pages correctly on the server, but only after all of this. The output is bounded (100 rows);
  the work is not.

Fix:
1. Rewrite `_super_rows` with GROUP BY aggregates instead of per-player subqueries: one pass over hs_events for
   the visits in question, grouped by sid (page_hide max, min and max ts, the victory/defeat count and sum), then
   grouped by uid. Do the same for visits, devices and first and last seen.
2. Give it a `p_user uuid default null` that filters `players` first, so hs_super_player reads one player's
   visits only.
3. Add `create index on highland.hs_sessions (uid, channel)` in 006.
4. Add a size check to sql-tests.js: for example 3,000 players x 10 visits x 20 events under a few seconds for
   the list and under 1 s for a player's page. Without it, this regression comes back unseen.

If the list still costs too much at the event ceiling, keep a small per-player rollup table updated by hs_track.
It would also fix finding 3's window.

### 2. minor: a superadmin in a session that is not the game's makes ?stats call the server in an endless loop

Evidence: `node <review dir>/loopprobe.js`. For the superadmin's account in a password session:
`hs_profile_get 200 super=true | hs_stats 403 not_admin | hs_super_players 403 not_superadmin` (in an oauth
session all three answer 200). hs_profile_get reports `_is_super()` without the game-session check that
`_need_super` makes. In index.html:
- pfStatsLoad: `if (!data && stSuper && r.code === "not_admin") { ... pfPlayersLoad(); return; }`.
- pfPlayersLoad gets `not_superadmin`, so stPlayersFail sets `stSuper = false` and calls `pfStatsLoad()`.
- pfStatsLoad asks hs_profile_get again, gets `super: true`, and goes back to pfPlayersLoad.

Each turn makes four requests, with no end. The page's own sign-in always makes an oauth session, so a player
does not normally reach this. A session that is not the game's in the page (a linked identity, a future sign-in
path) would hammer the server.

Fix: in 006, return `'super', highland._is_super() and highland._game_session()` from hs_profile_get (the same
rule as `_need_super`). In stPlayersFail, on `not_superadmin`, draw the refusal or the Numbers tab without
reloading the Players tab: keep a flag such as `stSuperRefused` that pfStatsLoad honors. Add the password-session
case to flow 15 or to a unit check.

### 3. minor: "play time" covers only the events still kept, but the page's help says "every battle"

The battle clock and the time on the page are summed from hs_events and hs_sessions. Those are kept 180 days
(`ev_keep_days`), and the admin can purge them early (`hs_admin_purge_events`). So a long-time player's totals
shrink as old visits leave.
- superadmin.md says so: "Counts of visits and battles go back as far as the events are kept (180 days by
  default)".
- The page's column help does not. ST_PCOLS's Battle clock says "the battle clock ... of every battle won or lost
  while signed in", and the privacy page says "the play time".

Fix: add to the help of Visits, Time on page and Battle clock: "Over the visits still kept (180 days unless the
owner chose otherwise)." Or keep lifetime totals in the rollup that finding 1 suggests.

### 4. minor: "Time on page" counts the time a tab sat hidden, up to 12 hours a visit

`page_hide`'s `sec` is `Math.round(performance.now() / 1000)` (index.html, pfEvHide). That is the time since the
page loaded, including every stretch the tab spent in the background. The view takes its largest value
(`_super_rows` per_visit). A tab left open behind other tabs all day counts as 12 hours of play. The help says
"each visit's length as the page told it". That is literally true, but the column is called "Time on page" and the
privacy page says "time on the page".

Fix: in PF-MAIN, keep a running total of the seconds the page was visible (from visibilitychange) and send it as
`vis` on page_hide. Have `_super_rows` prefer `max(vis)` and fall back on `sec` for older builds. Or rename the
column "Visit length" and say in its help that hidden time counts.

### 5. minor: "Won E / N / H" leaves out battlefields won before the star records existed

Evidence: `NODE_PATH=$(npm root -g) node <review dir>/sumprobe.js`, which runs the real page with the platform off.
Battlefields 1 and 2 are won with star records `[3,2,0]` and `[1,0,0]`. Battlefield 3 is won with no record, as
a returning player's older save has it. The result: `"won":[2,1,0],"stars":5,"farN":3,"far":"avarayr"`.
- The third battlefield counts in Stars (levelStanding gives it 1) and in Furthest.
- It counts on no difficulty, so Won E / N / H says 2 / 1 / 0 for a player who holds three battlefields.

csSum counts a difficulty only where `levelRecord(i).stars[d] > 0`. The stats page's own "Returning players
(progress from before the accounts)" are exactly these players.

Fix: in csSum, also send `held` (the number of battlefields with `levelConquered`). Show it in the column, for
example "3 held: 2 / 1 / 0", or add a note "won before difficulties were kept". Add the case to the check proposed
in finding 6.

### 6. minor: nothing tests the page's own progress summary (csSum) end to end

sql-tests.js (line 1086) and flow 15 (platform.js, about line 2166) post a hand-made `sum` through hs_save_put.
No test has the page build the summary from real records and push it. So two failures would go unseen:
- csSum's arithmetic (finding 5 slipped through).
- Gameplay renaming one of the six functions it calls. csSum swallows the error by design, so the column would
  quietly turn to dashes.

Fix: add a check, in unit.js's page-loading part or in flow 15, that seeds localStorage (bests, records, heroes,
Council), lets the page push, and reads the summary back from hs_saves. `sumprobe.js` is a starting point.

### 7. minor: the owner's by-hand deletion (the P8 checklist) does not know migration 006

docs/specs/owner/p8-privacy-checklist.md, section 3 (lines 84 to 94), deletes a player's game rows by hand. It
was not changed. It leaves the player's hs_superadmins row, and it leaves his id in hs_super_audit's `player`
and `who`. hs_delete_account now clears both (006 lines 338 to 340), and superadmin.md promises "the audit's rows
about him stay but no longer name him". tools/platform/owner-delete-check.js runs the checklist's SQL as written,
so it does not notice.

Fix: add to the checklist's block, after the hs_admins line:

```sql
delete from highland.hs_superadmins where user_id = current_setting('hs.del')::uuid;
update highland.hs_super_audit set player = null where player = current_setting('hs.del')::uuid;
update highland.hs_super_audit set who = null where who = current_setting('hs.del')::uuid;
```

Then extend owner-delete-check.js to look at both tables.

### 8. minor: the owner's address, typed in psql, stays in psql's history file

superadmin.md and the plan say "Type the address only there, never in a file". The command as given,
`select highland.hs_grant_superadmin_by_email('THE_ADDRESS');`, typed in psql, is written to `~/.psql_history`
on the machine the owner runs psql from. It can also reach the server's log when statement logging is on.

Fix: in superadmin.md and in the guide's two blocks, give the history-free form:

```
psql "$HS_DB_URL" -X -v HISTFILE=/dev/null
\prompt 'Address: ' addr
select highland.hs_grant_superadmin_by_email(:'addr');
```

The last line can also be used with the history on, since only `:'addr'` is kept. Keep guide-check's `[tried]`
coverage by having it run that form.

## What I reran (from /home/user/hs-wt/pf at 1223571, each to its end)

- `node deploy/check-page.js index.html`: OK (exit 0).
- `timeout 900 node tools/selftest.js --suite=all`: suite 1 PASS, 151 checks, 119.2 s of 125; suite 2 PASS, 39
  checks, 71.7 s of 125.
- `node tools/run-fixtures.js check`: PASS, 8 fixtures, 0 fails.
- `node tools/town-isolation.js`: PASS, 9 cases.
- `NODE_PATH=$(npm root -g) node tools/platform/p0.js`: PASS, 0 fails, 248 s.
- `node tools/platform/sql-tests.js`: 964 assertions, 0 failed.
- `node tools/platform/isolation.js`: 418 checks, 0 failed.
- `node tools/platform/unit.js`: 300 checks, 0 failed (scoreOf and dailyOf still waiting for P5 and P6).
- `bash tools/platform/test-update.sh`: PASS, 36 cases.
- `bash deploy/supabase/restore-rehearsal.sh`: 22 passed, 0 failed.
- `bash tools/platform/guide-check.sh`: 19 passed, 0 failed.
- `migcheck.js` (migrate.js through its own CLI on a fresh pgtemp cluster): up gives 6 of 6, 53 relations and 55
  functions; down 5 gives 45 and 44; up again, down 0 (0 and 0), up again and regrant each give the same 53 and
  55 and the same hash of every function's source and ACL. hs_super_players and hs_super_player are executable by
  postgres and authenticated only. The grant and revoke are executable by postgres only.
- `NODE_PATH=$(npm root -g) node tools/regress/run-all.js --quick`: 10 of 11. platform PASS (963 s, flow 15 at
  desk and ses included). dance10 FAILED, 1 of 6 jobs: "mouse 1600x900 erebuni (taps): a tap at 10334 ms ended the
  dance". The known intermittent failure (a tap at about 10 s). Rerun alone (`--quick --only=dance10`): PASS, 6 of
  6 jobs.
- `NODE_PATH=$(npm root -g) node tools/regress/platform.js` (every flow, 1 2 3 4 5 6 10 11 13 14 15, at desk,
  ipad, ses, i15h, i15u): 54 of 55. Flow 15 passed at all five sizes. Flow 11 at i15h FAILED: "signed in with the
  service hanging, the checking card stayed 5.9 s" (load average about 9 then). Rerun alone (`--flows=11
  --sizes=i15h`): PASS. A load failure, as the builder's was at ses.
- The other track was running tests the whole time; all timing results above were taken under that load.
- `git diff 718b825 1223571`: every address in it is on example.com (`super-owner@`, `Player.One@Example.com`,
  `p10-player-N@`, `iso-*@`, `perf*`, and others). No long dash. No .png committed. The committed page still has
  both Supabase constants empty. With the platform off, csSum is called only from csPush, and p0.js (no request
  but the page) passed.
- Mutants (`mutate.sh`, each in a copy of the package), each caught:
  - m1, `_need_super` without the game-session check: sql-tests 1 failed, isolation 6 failed.
  - m2, no audit row for the list: sql-tests 1 failed, isolation 4 failed.
  - m3, `_owner_only` that only warns: sql-tests 3 failed.
  - m4, the view granted to anon: sql-tests 6 failed.
  - m5, the list built from every auth.users row: sql-tests 6 failed, isolation 1 failed.
  - m6, the search as a LIKE pattern: sql-tests 2 failed.
  - m7, no cap of 100 a page: sql-tests 1 failed.
  - m8, no audit row for a player's page: sql-tests 3 failed, isolation 2 failed.
  - m9, page_hide counted as a battle: sql-tests 4 failed.
- Probes: `perf.js` at three sizes (finding 1), `loopprobe.js` (finding 2), `sumprobe.js` (finding 5).
- Photos: the builder's photos in `shots/p10/` at 1600x900 and 667x320 were looked at. They show only
  example.com accounts, the 14 columns, and the tools wrapping at 667x320. My platform.js run made its own set
  under `review/P10/photos`.

## What I could not check

- A real Supabase (GoTrue's own amr values, Kong, Postgres 17, the real `auth.identities` shapes). In
  particular Discord's `global_name` under `custom_claims` and Facebook's `name`: the stand-in's identities
  are made by hand.
- Safari and real iPhones. The phone sizes were only Chromium's emulation in platform.js and p0.js.
- The rewrite proposed in finding 1. I measured the cause; I did not write or time the fix.
- How the view feels with hundreds of rows a page on a phone. The limit is 25 a page, and I checked only the
  builder's photos at 1600x900 and 667x320 (the 1194x834 ones exist but I did not open them). They show only
  synthetic example.com accounts.

## For the builder, the other track and the owner

- Gameplay: csSum (PF-MAIN) calls levelConquered, levelRecord, starsEarned, heroLevel, councilOwn and levelId. If
  any of them is renamed, the Players view's progress columns turn to dashes with no error (finding 6).
- P5: once ranked runs are posted, the battle clock could be read from hs_scores.sim_sec. The events would then
  serve only unranked battles. Do not count a battle twice.
- Owner: nothing to do before finding 1 is fixed. The view works today, with no players.
