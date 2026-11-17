# Review of P6, the daily board (platform track)

REVIEW P6: 0 blockers, 1 major, 8 minors.

Reviewed: branch `pf/work` at `fa8750c` ("P6: the daily board"), the whole change `git diff 79086b8 fa8750c` (12 files,
1212 lines added), read line by line against platform.final.md 0.3, 0.5, 2.3, 2.4, 3.4, 5.3, 5.5, 5.6 and 7.2, RULINGS
A, F and G, and the reviews of G6 (findings 3 and 13) and P5 (finding 4). My probes are in
`/tmp/claude-0/-home-user/169f7cc7-9178-569c-b36f-88a849db13cf/scratchpad/top/build/review/P6/` (named below as
`review/P6/...`). No code of the package was changed.

Summary: the package does what its report says. The server's pick, the page's pick and gameplay's pick agree on every
day I tried, in every time zone I tried. 008 is locked down and granted as it should be, and it goes down and up to
the same schema. Its tests fail when their subject is broken (five mutations, below). One hole in the attempt count
lets a player get a fourth ranked attempt. The other findings are small.

## Findings

### 1. MAJOR. A fourth ranked attempt: two daily starts across an hour's turn are both let in (cheating)

`hs_run_begin` (007, not changed by 008) counts the day's daily runs, then inserts a new one, with no lock of its own.
Two calls in flight at once are put in order only by `_rate_ok`'s row (`hs_rate`, key `run:<hour>`). Two calls whose
`_now()` falls on either side of an hour's turn take two different rows. They run side by side, both count 2, and both
insert. With two attempts used, a player who fires starts at hh:59:59.9 gets two of them accepted.

Evidence: `node review/P6/race.js` (a throwaway database with the migrations, one player, ruleset 2 published, each
call made as PostgREST makes it):

```
(a) in flight: {"ok":true,...} | {"ok":false,...,"reason"...}      the same hour: the second waits, and is refused
(a) daily runs that day: 3
(b) in flight: {"ok":true,"now":"...T10:59:59.900845..."} | {"ok":true,"now":"...T11:00:00.10021..."}
(b) daily runs that day: 4
```

The code is P5's, but the daily board's three attempts are what P6 ships, and 008 is not merged yet.

Fix: restate `hs_run_begin` in 008 (or in a 009 with its rollback) with this line in the daily branch, before the
count: `perform 1 from highland.hs_profiles where user_id = v_uid for update;` (the player's own row; no new
function, nothing to grant). An advisory lock on the player, day and channel would also work. Add a sql-test with two
connections held open, clocks at hh:59:59.9 and hh+1:00:00.1, and two attempts used: exactly one call is accepted.
The probe above is that test.

### 2. MINOR. The tests hold the pick to a file, not to the page

unit.js ("the game's daily: the page's pick equals the server's arithmetic for 366 days") and sql-tests.js ("the
game's daily: the server's pick equals the page's arithmetic") both read `docs/specs/balance/ruleset-2.json`, not the
page's `rulesetData().daily`. Today the two are the same (`review/P6/rsprobe.js`: "whole daily equal: true"). But
nothing in unit.js or sql-tests.js would notice if gameplay changed `DAILY_SKIP` or `DAILY_TWISTS` and left the file
behind. Only flow 8 compares the page with the server, and it is in the full platform run, not in `--quick`.

Fix: in unit.js, check that the file is the page's ruleset: `sha256(JSON.stringify(file)).slice(0, 8)` must equal
the `RULESET_PIN` read out of index.html by a regex. Both are `e25854e1` today (I computed the file's). If they differ,
fail with "the published ruleset file is not the page's".

### 3. MINOR. A daily won after midnight UTC is shared with the wrong day, and its strip says "today"

`shInfo()` takes the daily's date from `pg.at`, the moment the battle ended
(`shareDay(new Date(Math.floor(pg.at / 86400000) * 86400000), false, true)`, index.html near line 83823). The strip
says "#1 of 1 today". But the score goes on the board of `run.day`, the day the first wave was sent
(`hs_score_submit`). A daily begun at 23:50 UTC and won at 00:10 says "Highland Stand daily, Nov 18: ..." for the
board of Nov 17, and "today" for yesterday's board.

Fix: keep the battle's day in `SC.page` (`DY.day`, which `dyPlay` sets, or `dailyRun.day`) and use it for the share
date. When that day is not `dyToday()`, the strip says "#1 of 3 on Nov 17" in place of "today".

### 4. MINOR. State left behind: DY.att, DY.pr and DY.practice outlive a daily that is never ranked

`dyStarted` is the only place that resets `DY.att` and `DY.pr`, and it runs only when `scWhyNot(p) !== "unranked"`. A
daily that gameplay marks unranked (test mode, `testUnlockAll`, an older ruleset) keeps the last daily's values. Its
`daily_played` then says `attempt: 2, ranked: true` for a battle that was never ranked.

Fix: at the top of scStart's daily branch, whatever `why` is: `DY.att = 0; DY.pr = why === "unranked" ? "unranked" : "";`.

### 5. MINOR. The turn of the day is set only for a signed-in player, and no test runs it

`dyTimer()` is called only from `pfWithSession` (index.html near line 82359). A guest (the gate optional, or "Play
now") with the Daily tab open over midnight keeps yesterday's challenge, and so does the map door's title. Flow 8's
"the day changes" step clears `DY.st` and calls `hs_config` by hand, so the timer's own path (`DY.st = null; dyAsk();`
then the tab drawn again) is never run by any test.

Fix: call `dyTimer()` once when the platform starts (with the platform on), not only with a session. In flow 8 on the
desktop, set the stack's clock to 3 s before midnight, let the page hear it (`hs_config`), keep the tab open, and wait
for its head to name the next day without touching `DY`.

### 6. MINOR. "Yesterday's battle" is worked out with today's ruleset

`hs_daily_status` picks yesterday's battlefield and twist with `_daily_pick(rs.data, v_day - 1)`, the page's ruleset.
After a new ruleset with another daily is published, the line can name a battle nobody fought yesterday, while the
rows above it are the real board's.

Fix: take yesterday's battlefield and twist from that day's runs when there are any
(`select level_id, twist from highland.hs_runs where mode = 'daily' and day = v_day - 1 and channel = v_chan limit 1`),
and fall back to the pick.

### 7. MINOR. The guest's tab says one thing twice, and two lines are not quite right

Photographed in `shots/p6/review-probe/guest-tab-ses.png` (`review/P6/guest.js`):
- "Sign in to play for today's board." is both the note under Practice and the sign-in box's line.
- "One sitting. Leaving the battle ends the attempt." is shown to a guest, and on the tab with no attempts left, when
  there is no attempt to end.
- "Hold Erebuni once to open the daily challenge." The rule (`levelBestAnyEra(0) > 0`, the same as gameplay's door) is
  fighting Erebuni once (5.6: "who has fought Erebuni once"), not holding it.

Fix: in `dyFill`, leave the note out when the sign-in box is drawn. Draw "One sitting..." only beside "Play today's
challenge". Say "Fight Erebuni once to open the daily challenge."

### 8. MINOR. Paths no test takes

No flow covers these: the daily switch off on the page (the tab's note, and the "board is closed" practice word); a
stale ruleset (the tab's "Reload the page" note, and `daily_mismatch` at a first wave turning the attempt into practice
with `DY.st` cleared); a signed-in player with no name; a guest's practice daily; the stats page's new "The daily
challenge" On and Off (flow 10 does not press it).

I ran the guest's path myself (`review/P6/guest.js`, at 1600x900 and 667x320). The tab offers Practice with the
sign-in buttons. The first wave says "Practice: sign in to play for today's board." The end page says "Score 6,760 ·
Practice: not ranked". `daily_played` has `ranked: false, attempt: 0`. The server has no daily run. No page error. So
it works, but no test holds it.

Fix: add them to flow 8 at desk and ses: the guest as guest.js does it; the switch off with
`hs_admin_set_config('daily', false)`; a stale page by publishing ruleset "3" with another pool and pressing Play on
the old page. Press the stats page's daily switch in flow 10 (its answer line, and `hs_config` after).

### 9. MINOR (the owner's, already open). The same twist two days running

5.6 says "for the real sizes no twist comes two days running". With 8 twists and the skip walk, the published daily
serves the same twist on consecutive days 18 times in the next 366 days, and Iron ranks 75 times. Tomorrow is one:
November 17 and November 18 are both "swift", Forced march (`review/P6/tz.js`). This is G6's finding 4, still the
owner's. P6's tests check that no battlefield comes two days running, but not the twist. When the owner rules, either
the sentence in 5.6 changes or the walk does.

## Not findings (the builder's choices, checked)

- No Share on a lost daily: 5.5 says so and section 6 disagrees; following 5.5 is reasonable. Flow 8 checks it.
- Guests get Practice; "stale" and "yesterday" added to the status: sensible, and tested in sql-tests (stale, yesterday)
  and by my probe (the guest).
- The P5 bug fixed in 008 is real: with 008's `hs_score_submit` put back to a record, the fresh-connection test fails
  with `record "rw" is not assigned yet`.
- For the owner: practice before the ranked attempts is open to anyone who goes offline or signs out (as 5.6 allows),
  and the daily's battle is the same every time, so the three attempts limit tries on the board, not learning.

## What I reran, each to its end, on fa8750c (/home/user/hs-wt/pf)

| test | result |
| --- | --- |
| `node deploy/check-page.js index.html` | OK, exit 0 |
| `timeout 900 node tools/selftest.js --suite=all` | suite 2 **PASS**, 39 checks, 83.2 s. Suite 1 **FAIL on time only**: 151 checks all pass, 137.8 s of 125 (load 0.2 at its start, then the other track's photos and my probes) |
| suite 1 again, `--suite=1` | 147.3 s (load 2.9 rising to 8.2). Then paired with the page before P6 (79086b8), back to back: base 192.2 s, P6 183.8 s; base 153.8 s, P6 166.9 s. Never under 125 s for either page; P6 is no slower than its base under the same load. Not green: the budget was never met on a quiet machine |
| `node tools/run-fixtures.js check` | **PASS**, 8 fixtures |
| `node tools/town-isolation.js` | **PASS**, 9 cases |
| `node tools/platform/sql-tests.js` | **PASS**, 1033 assertions, 0 failed |
| `node tools/platform/isolation.js` | **PASS**, 448 checks, 0 failed (players A and B, the outsider, anon, the admin, service_role) |
| `node tools/platform/unit.js` | **PASS**, 419 checks, 0 failed |
| `bash tools/platform/test-update.sh` | **PASS**, 36 cases |
| `bash deploy/supabase/restore-rehearsal.sh` | **PASS**, 22 of 22 (the unregranted copy fails isolation as it must, e.g. "anon cannot call the helper _daily_top") |
| migrate.js up, down 7, up, down 0, up 7, up, regrant (`review/P6/migcheck.js`, the builder's script rerun) | OK. Schema hash at 8: 3290840c; after down 7: 72c33684, the same as a fresh up to 7; up again and regrant: 3290840c; down 0: empty. 008's helpers `postgres=X/postgres` only |
| `NODE_PATH=$(npm root -g) node tools/platform/p0.js` | **PASS**, 402 s |
| `NODE_PATH=$(npm root -g) node tools/regress/run-all.js --quick` | **PASS**, 11 of 11 in 1753 s (dance10 6 of 6; platform quick 627 s) |
| `NODE_PATH=$(npm root -g) node tools/regress/platform.js --photos=.../shots/p6/review` (every flow at every size, flow 8 included) | **PASS**, 0 fails, 2888 s, 176 states; flow 8: desk 82 s, ipad 40 s, ses 46 s, i15h 32 s, i15u passed; "p6 pick" 366 days equal at each size. 50 photos in `shots/p6/review/p6/` |
| long dashes in the added lines | 0 |
| the two Supabase constants in the committed page | both empty |

My probes (in `review/P6/`):
- `race.js`: finding 1 (4 daily runs in one day across an hour's turn; 3 within one hour).
- Mutations on a copy of fa8750c (`review/P6/mut`), each run through the test that should catch it:
  - 008's `hs_score_submit` back to a record for the week's rank: sql-tests 5 failed.
  - `_daily_top` without `not p.hidden`: sql-tests 1 failed (the hidden player listed). isolation.js did not catch it
    (448, 0 failed), which is fine: sql-tests owns that rule.
  - `stale` always false and `attempts_left` for everyone: sql-tests 3 failed, isolation 1 failed.
  - the page's `dailyOf` without the skip walk: unit 2 failed (140 skipped pairs served).
  - the page's `dailyOf` with the cycle's shift off by one: unit 4 failed.
- `rsprobe.js`: the page's `rulesetData().daily` and `dailyRules()` equal ruleset-2.json's daily; RULESET 2,
  PF_RULESET_ID 2.
- `tz.js`: in Pacific/Kiritimati, America/Los_Angeles, Asia/Yerevan and UTC, 30 s before and after 00:00 UTC,
  gameplay's `dailyToday()`, the platform's `dyToday()` and `dailyOf`, the tab's date words and the share date all give
  the same day and pick (20774 erebuni swift, then 20775 sevan swift).
- `guest.js`: the guest's practice daily at desk and 667x320 (finding 8), and the owner's switch read by the page after
  a reload (`pfDailyOn()` false).

## What I could not check

- A real Supabase and a real PostgREST connection pool (the fresh-connection bug was shown on the stand-in), a real
  Safari or iPhone, the real providers.
- Finding 1 against the real server's clock: shown with the test clock. The window is real time there.
- Selftest suite 1 under its budget: the machine was never quiet (load 3 to 9 from the other track).
- The tab's look with the daily switch off and with a stale ruleset: not photographed, only read in the code.
