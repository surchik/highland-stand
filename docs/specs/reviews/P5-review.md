# Review of P5, scores and boards (platform track)

Reviewed: pf/work at 4be5720. The package is 648bd44 on 1d62a39 (p10-done), merged with next 7218812. The reviewer
did not build it. Every claim below was rerun or read in the code. Probe scripts are in the session's scratch folder
under `top/build/review/P5/` (`probe-outbox.js`, `probe-resume.js`, `probe-rules.js`, the mutation copies).

REVIEW P5: 0 blockers, 1 major, 7 minors.

## Findings

### 1. MAJOR. Two tabs of one player throw away both ranked results and say "Not ranked"

The run token lives in one shared key, `hs_pf_run`. A fresh `battle_start` drops it (`scStart`, `pfDrop("hs_pf_run")`)
and writes its own. At the victory, `scEnd` reads the shared key again and needs its `lv` and `diff` to match this
tab's battle; when they do not, the state falls through to `"refused"`, and it drops the key, which takes the other
tab's token with it. So a player with the game open in two tabs (or a phone browser that kept an old tab) loses both
battles' results, and each strip says "Score 7,000 · Not ranked" with no `score_rejected` sent. When both tabs fight
the same battlefield and difficulty, one tab posts its result under the other tab's run, and the other then has none.

Evidence (`probe-outbox.js`, two pages in one browser context, gameplay's event shapes sent through `track`):

```
tab A token after its start: {"rid":"023c45d4-...","lv":"erebuni","diff":1,"ruleset":"2",...}
token after tab B's start (shared key): {"rid":"5f8e6186-...","lv":"tushpa","diff":1,"ruleset":"2",...}
tab A's strip after its win: {"state":"refused","score":7000,"rank":null}
tab B's strip after its win: {"state":"refused","score":7000,"rank":null}
scores on the server after two tabs: []
```

Fix: keep the battle's own token in the tab's memory and use it first. In `scBegin` set `SC.tok = { rid, lv, diff,
ruleset, mode }` beside the write to `hs_pf_run`; in `scStart` (resumed) set `SC.tok` from the stored token when it
matches; in `scEnd` post with `SC.tok` when `SC.why === "held"`, and fall back to `pfRead("hs_pf_run")` only when
`SC.tok` is empty. Drop the stored key only when its `rid` is this tab's (`if ((pfRead("hs_pf_run") || {}).rid ===
SC.tok.rid) pfDrop("hs_pf_run")`), in `scStart`, `scEnd` and on `battle_quit`. Add a flow 7 step (or lift the probe
into `platform.js`) with two pages of one context: both results on the server, both strips "posted".

### 2. MINOR. The token is dropped before the post, so a result whose request never reaches the server is lost

`scEnd` drops `hs_pf_run` before `scPost`, and the outbox is written only after the request has failed. A tab closed
or evicted while the post is out (a phone on a slow network: the post waits up to 10 s) leaves nothing on the device:
no token, no outbox entry. In the probe the stack held the post 6 s and the tab was closed: the server still finished
it, because the request had already arrived; a request cut before it arrives has no second chance.

Fix: write the entry to `hs_pf_out` before the first send (`{ rid, uid, stats, t, ... }`), and remove it when the
server answers in any way (as `scFlush` already does). `scFlush`'s `run_finished` branch already makes a double send
harmless.

### 3. MINOR. A resumed battle whose session or name is missing at the resume throws its held token away

`scStart` with `resumed: true` keeps a matching token when `why` is `signin` or `noname`, and sets `SC.why` to that
word. `scEnd` then posts only when `SC.why === "held"`, so it shows "Sign in to post it" and drops the token, though
the token and the account (`hs_pf_me.uid`) are known. The 401 path of `scPost` already puts such a result in the
outbox for the same account's next sign-in.

Fix: in `scEnd`, when a matching token is held and the state is `signin`, put `{ rid, uid: hs_pf_me.uid, stats }` in
the outbox and show "It posts when you are back online" (or a sentence that says it posts at the next sign-in), as
`scPost` does on a 401.

### 4. MINOR. A lost daily's strip on the defeat page cannot show

5.5's last line: "The defeat page gets the strip only for a lost daily". `Platform.defeatPage()` sets `SC.shown`, but
`scRender` draws only while `#overlay` has the class `victory` (`on = ... overlayEl.classList.contains("victory")`),
the CSS hides `#ovScore` off a victory page (`#overlay:not(.victory) #ovScore { display: none; }`), and the
MutationObserver turns `SC.shown` off as soon as the class is missing. A daily cannot be started until P6, so no
player meets this now; the package's report does not say it is left for P6.

Fix: let `scRender` draw when `SC.page.daily && !SC.page.won` on the defeat page (add a `won` flag to `SC.page`), and
scope the CSS to `#overlay:not(.victory):not(.dailyEnd)`, or say in the package's notes that P6 builds it, with a
flow 8 check.

### 5. MINOR. The boards' switch says more than it does

The stats page's switch says "On: battles are ranked and the Hall has its Leaderboards tab. Off: no battle is ranked."
The guide (step 7) says "Off, no battle is ranked (nothing is posted ...)". In the code, with the boards off, a run
begun before the switch still posts (sql-tests asserts it: "a run begun before the switch still posts"), and the
Leaderboards tab stays in the Hall ("The boards are closed for now.") with the map's trophy door still shown. Flow 7's
comment says "no strip, no tab, no run begun", but the test checks only the strip and the runs.

Fix: either make `hs_score_submit` answer `{ accepted: false, reason: "boards_off" }` for a campaign run while the
switch is off (and the page then shows no strip), or change the two sentences to what happens ("Off: no new battle
is ranked; the boards stay to read."). Make flow 7 check the tab as its comment says, or drop "no tab" from it.

### 6. MINOR. Sign-out empties the outbox without a word

`pfSignOut` (P2's code, line about 81662) removes `hs_pf_out` with the other `hs_pf_` keys. A result waiting for a
connection is lost when the player signs out, while an unsent save gets the "unsaved" question. This was there before
P5, but P5 is what puts results in the outbox.

Fix: try `scFlush()` before the sign-out's clear, and count this account's outbox entries as unsaved for the
sign-out's question; or keep the account's entries (they are never sent as another account, by `uid`).

### 7. MINOR. Tests: `unit.js` tests a helper the page does not use; flow 7 leaves the outbox's account rule, a session's end and a resume untested

`outSendable` is exported and tested ("another account's entry is never sent"), but `scFlush` filters inline
(`all.filter(e => e.uid === s.uid)`). A mutation of `outSendable` fails `unit.js` (checked: 1 failure); a mutation of
`scFlush`'s filter would not. Flow 7 does not cover: an entry of another account kept and not sent, a 401 during the
post and the same account's sign-in sending it, a resumed battle's token, two tabs. The reviewer's
`probe-resume.js` shows the page does the first three today (results below); nothing keeps it so.

Fix: make `scFlush` call `outSendable(all, s.uid, pfNow())`. Add to flow 7 (desktop only is enough): the session
expired by the stack's control before the victory, then a sign-in as another player (the entry stays, the server has
nothing), then the first player again (sent); a reload in the battle and the result posted; and finding 1's two tabs.

### 8. MINOR. The quick suite is now much longer than its budget says, and it can run out under load

`run-all.js`'s header says `--quick` is "about 7 minutes in all". `platform.js --quick` alone took 999 s on a quieter
machine (load 2 to 9) and was stopped at its limit, 1,560 s (0.6 of `LIMIT_S.platform`, raised by P5 from 1,800 to
2,600), on a loaded one (load 13 to 24): `FAIL platform 1560 s ... FAIL stopped after 2600 s` (run-all's message names
the full limit, not the 0.6 it applied: an older wording slip, not P5's). 10.5 asks `--quick` to run flows 1, 2, 4,
5, 7 and 11 at two sizes; `platform.js --quick` runs every flow at two sizes.

Fix: make `platform.js --quick` run the flows 10.5 names (that roughly halves it), update the header's minutes, and
have run-all print the limit it applied.

## What holds (checked, no finding)

- Cheating. The server scores every result from its own ruleset copy and refuses what cannot be: a run not the
  caller's or posted twice (`for update`, `finished_at`, and a unique index on `run_id` behind it), more defenders
  than the difficulty has, a wrong wave count, under nine tenths of `min`, gold over `earnMax` or spent over earned,
  sooner than the clock at 4x allows (4x is the game's top speed: `speedMult >= 4`), a daily's loadout forced `std`.
  A forged result inside the bounds still gets on a board with a flag at most: 2.5 states and accepts this. Open and
  Standard are different boards (`_campaign_board` has the loadout in its key); the loadout is the event's and is
  final (B8). Mutation checks: with the loadout taken out of the board key, or the `run_finished` check removed,
  `sql-tests.js` fails (11 failures); with the boards' switch taken out of `hs_run_begin`, `sql-tests.js` fails (2).
- Isolation. `hs_run_begin` and `hs_score_submit` are executable by `authenticated` only, `hs_board` by `anon` and
  `authenticated` (as 003 set it); `service_role` has none. The switch check in `hs_run_begin` comes after
  `_member()`, so an outsider, a visitor and `service_role` are refused before they learn of the switch
  (`isolation.js` checks it). `hs_board`'s rows carry no ids except to an admin in a game session.
- The outbox: offline at the victory it says "It posts when you are back online" and keeps the entry; a 401 keeps it
  under the account's id; another account signed in on the device leaves it alone; the same account's sign-in sends
  it (`probe-resume.js`). A reload in the battle keeps the token, and the resumed battle posts with `lives_board`
  counted (12 of 20 posted). A battle resumed on another device brings its token in the cloud save (P3's `tok`).
- Off means off: with the constants empty, `PF_ON` is false and none of the new elements, listeners or tabs is made;
  `track` calls `__hsRunKick` only when it is set. vic.js and iphone.js unchanged and green confirm it.
- Migration 007 keeps the three signatures; down to 6 gives the same function set and grants as a fresh 6.
- No long dash in the diff; no British spelling found; HS_SUPABASE_URL and HS_SUPABASE_ANON_KEY are empty.
- `rulesetData()` (memoized at the first victory) took 52 ms on its first call, 27 ms after: no hitch worth a change.

## What I reran (on 4be5720, the machine shared with the gameplay track; load averages 2 to 24)

Database and owner tools (load 4 to 7):
- `node deploy/check-page.js index.html`: OK, exit 0.
- `node tools/platform/unit.js`: 359 checks, 0 failed (dailyOf waits for P6).
- `node tools/platform/sql-tests.js`: 1000 assertions, 0 failed (27 s).
- `node tools/platform/isolation.js`: 435 checks, 0 failed.
- `migrate.js` on a fresh cluster (`rehearsal-cluster.js --no-source`, database hs_scratch): up (7), down 6, up, status
  (7 applied), down 0, up 6, up. Relations 53 and functions 55 at 6 and at 7. A digest of every function's definition
  and grants: at 7 `b6060cbb` both times; down to 6 `46185eb0`, the same as a fresh up to 6. Grants after 007:
  `hs_board` postgres, anon, authenticated; `hs_run_begin` and `hs_score_submit` postgres, authenticated.
- `bash deploy/supabase/restore-rehearsal.sh`: 22 passed, 0 failed.
- `bash tools/platform/test-update.sh`: PASS, 36 cases.
- `bash tools/platform/guide-check.sh`: 23 passed, 0 failed.
- `node tools/run-fixtures.js check`: PASS, 8 fixtures.
- `node tools/town-isolation.js`: PASS, 9 cases (twice).
- Mutation checks on a copy (`git archive 4be5720`): the boards' switch removed from `hs_run_begin`: sql-tests 2
  failed; the loadout taken out of the board key and the `run_finished` check removed: 11 failed; `scoreOf`'s share
  of defenders changed: unit.js 4 failed; the outbox's 20 cap removed: 2 failed; `outSendable` sending every
  account's entries: 1 failed (see finding 7 for what that does not cover).

The selftest:
- `timeout 900 node tools/selftest.js --suite=all` under load (my probes and the other track's run-all): suite 1
  151 checks, all passed, 168.5 s of 125 (over budget); suite 2 PASS, 39 checks, 97.7 s.
- Suite 1 again under load 9 to 12, the base page (1d62a39) and P5's back to back: base 143.0 s and 177.9 s, P5
  135.6 s, every run 151 checks passed: the overrun is the load, not P5.
- Suite 1 alone (load 2 to 4): PASS, 151 checks, 112.4 s of 125.

Regression (Playwright):
- `run-all.js --quick` (load 13 to 24, the other track's run-all beside it): 7 of 11 passed (padplace, plots, probe,
  vic, live, iphone, waves). nag failed (the coach at "fight"), dance10 failed 4 (taps at 9.9 s and 10.2 s ended the
  dance; Sis's horn call ended by a tap at -1 ms, twice), doors failed 1 (`?town`: the waiting town gift not paid),
  platform stopped at its limit (finding 8).
- Reruns: `run-all.js --only=nag,dance10,doors` (load about 9): nag PASS, doors PASS, dance10 FAIL 6 (taps at 9.7 to
  12.1 s ended the dance; Sis's horn call at -1 ms). `dance10.js --quick` on the base page and on P5's, back to back
  under the same load: each FAIL 1, Sis's horn call ended by a tap at -1 ms. The same failure on the base page: not
  P5's, but reported as the brief asks (dance10 failed each time it ran here).
- `run-all.js --quick --only=platform` (load 2 to 9): PASS, 0 fails, 999 s.
- `vic.js` in full, unchanged: PASS, 17 levels, 249 presses, 0 fails (1,974 s under load).
- `iphone.js` in full, unchanged (load about 20): FAIL 5, all at Pro Max Home Screen 932x430 (the Council's Reset
  needing a second tap, and the Nardi game-over card not shown). Rerun `iphone.js --sizes=maxh` alone: PASS, 73
  states, 0 failures. The other nine sizes passed in the full run (737 states in all).
- `platform.js` in full, every flow at every size (desk, ipad, ses, i15h, i15u), with `--photos`: PASS, 0 fails, 60
  flow runs, 117 audited states, 2,368 s. Flow 7 passed at all five sizes (166 s at the desktop).
- Photos: the builder's set in `top/build/shots/p5/` (35 files: the strip's seven states and the board, guest and
  offline tabs at 1600x900, 1194x834 and 667x320, the map's door, the two stats cards) was looked at; the review's
  own full run made the same set again in `top/build/review/P5/photos/p5/`. No photo of "posting" (it shows only
  until the server answers), as the builder said.
- Probes: `probe-outbox.js` (finding 1; a 401 at the post goes to the outbox under the account's id) and
  `probe-resume.js` (a reload in the battle keeps the token and the resumed battle posts with lives_board; another
  account's entry is kept and not sent; the same account's sign-in sends it), each with no page error.

## What I could not check

- A real Supabase, Safari, a real iPhone.
- Finding 2's loss itself: the stack cannot cut a request before it reaches the server; the code path is plain.
- The lost daily (finding 4) end to end: no daily can be started before P6.
- Flow 7 against a mutated page (about 3 minutes a size, the stack included; the machine's time went to the
  acceptance runs): whether flow 7 fails when, for example, `scWhyNot` ignores the switch was not tried.
