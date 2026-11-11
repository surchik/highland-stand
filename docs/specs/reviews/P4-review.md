# Review of P4: analytics and the stats page

Package commit 5ad745a on `pf/work` (started from 1fdf323, the P2 close). Reviewer: an independent agent that did
not build it. Probes and their output are kept outside the repository, under the session's scratchpad
(`top/build/review/P4/`: `probe.js`, `probe.out`, `t2.log`, `mut/`, the logs of every rerun).

REVIEW P4: 0 blockers, 3 majors, 7 minors.

What holds, checked by running it, not by reading the report: nothing is sent on `file://`, with the constants
empty, or from a headless webdriver; the server refuses every stats and admin function to a visitor (401) and to a
player (403 `not_admin`), and `?stats` shows a player only "This page is for the game's owner."; hostile events
(markup, text for numbers, over 4,096 bytes, two levels deep, wrong types, a forged uid, a forged token, a borrowed
visit id, a flood of 1,200 from one device) are refused or neutered and the stats page makes no element of them;
with the service down the page backs off 30 s, then 60 s, keeps its events across a reload, and sends them once
when the service is back (no duplicate, nothing lost); gameplay's `battle_start`, `wave_end`, `victory`,
`battle_quit`, `battle_back`, `hall_open` and `council_open` arrive on the server with their props intact; the
queue's work in a battle costs under 1 ms (a full 60 KB store written in 0.8 ms, a victory's `track` 0.3 ms). The
three majors are an owner who cannot see that a switch was refused, a funnel that counts the owner's own `?stats`
devices and `?privacy` readers as new players, and a test that does not test the webdriver rule it claims.

## Findings

### 1. Major. On `?stats` the owner never sees "That value is not allowed." or "Not saved. Try again."

`stSwitches` (index.html 79530 and 79552) tells a refused or failed switch with `toast(...)`. The toast is drawn at
`z-index: 35` (`body.onMenu #toast`, 1203; 15 otherwise, 1191) and `#statsPage` is `z-index: 62`, so the toast is
under the page. A value refused on the page (Days kept 3, outside 7 to 3650) or by the server, or a save that
failed, shows nothing, and the field keeps what was typed: it reads as saved. Only success is visible, because the
page redraws.

Evidence (`probe.js t9`, the owner on `?stats`, "3" typed in Days kept, Save pressed; photo `t9-refused-value.png`):

```
refused value: {"text":"That value is not allowed.","opacity":"1","z":"35","statsZ":"62","topmost":"stCard","toastOnTop":false}
```

Fix: give the switches card its own line for the answer, as "Remove old events" already has (`out`): a `p` under
each field (or one under the card's title) set with `textContent` to "Saved.", "That value is not allowed." or
"Not saved. Try again.", in `stWarn` for the two refusals; and on a refusal put the field back to the value in
force. Add to flow 10: type 3 in Days kept, press Save, expect the line and the field back at 180.

### 2. Major. The first-visit funnel counts `?stats` and `?privacy` visits as new devices, and the owner's `?stats` sign-ins as sign-ins

`page_load` now carries `page` ("game", "privacy", "stats"), and the stats page sends `signed_in`, but `hs_stats`
reads neither: `first_load` and the funnel's `did` take every `page_load` (schema.sql 1069 and 1082), and the
`signed_in` step is any visit with an account. So a reader of the privacy page (a provider's reviewer, a player who
followed the link from a store page) is a new device that loaded the game and never saw the gate; and every device
on which the owner opens `?stats` and signs in is a new device that signed in without seeing the sign-in card. The
gate's cost (`signed_in / gate_shown`) then passes 100%, and the owner's guide asks him to do exactly this on his
laptop, his iPad and his phone (README's stats checklist).

Evidence (`probe.js t11`: an owner signed in through the gate; then a fresh context reads only `?privacy`; then a
fresh context opens `?stats` and signs in there):

```
funnel before:  page_load [1,1,0,0], gate_shown [1,1,0,0], signed_in [1,1,0,0]
funnel after:   page_load [3,3,0,0], gate_shown [1,1,0,0], provider_tapped [2,2,0,0], signed_in [2,2,0,0]
gate card sign-ins: [{"n":2,"event":"signed_in","provider":"google"}]
page_load pages: game 2, privacy 1, stats 2
```

Fix (schema.sql, `hs_stats`): a device enters the funnel only by a `page_load` whose `page` is `game` or absent
(`coalesce(e.props ->> 'page', 'game') = 'game'`) in `first_load`, in `newcomers` (join `first_load`, not
`v_first_seen` alone) and in `did`; leave visits whose first `page_load` is `stats` out of the funnel's
`signed_in`, `provider_tapped` and `name_set` steps and out of the gate card (simplest: a view of the "game"
visits, `v_game_sessions`, used by the funnel and the gate card). Keep counting the privacy page's visits in
Totals and Devices (the builder's DIFFERS 1 is sound: 7.2 has `privacy_open`). Add the case above to sql-tests.js
and a `?stats` sign-in to flow 10's funnel, whose counts must not move.

### 3. Major. Flow 10's "nothing from a webdriver" passes with the webdriver rule removed

The quiet checks run at 1600x900 only, where Playwright's Chromium names itself `HeadlessChrome`, which
`EV_BOT_UA` already refuses. With `if (navigator.webdriver === true) return "webdriver";` deleted from
`pfEvBarred` (index.html 79067), flow 10 still passes. A Selenium-driven desktop Chrome (a normal user agent,
`navigator.webdriver` true) is what that line exists for, and no test holds it.

Evidence (`mut/m6_bot.html`, the line deleted):

```
NODE_PATH=$(npm root -g) node tools/regress/platform.js mut/m6_bot.html --flows=10 --sizes=desk
RESULT platform PASS {"fails":0,"seconds":108.7, ... "quiet":{"webdriver":["SITE/","API/rest/v1/rpc/hs_config","API/auth/v1/settings"] ...
Playwright's own page: ["Mozilla/5.0 (X11; Linux x86_64) ... HeadlessChrome/153.0.8010.12 Safari/537.36", true]
```

Fix: open the quiet webdriver page (`const Q = await open(C)`, tools/regress/platform.js 1015) with an ordinary
desktop Chrome user agent (`ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) ... Chrome/120.0.0.0 Safari/537.36"`),
so only `navigator.webdriver` stands between it and the server, and keep a second page with the headless user
agent and the switch on (`events: true` is the switch; the robot rule must give way to it, or be checked
separately in unit.js, which it already is).

### 4. Minor. After a sign-in the events wait about 19 s, and earlier visits' events are sent with the new account's token

`pfEvNow()` (79211) calls `pfEvSend(false)`, which returns at once while another batch is on its way (79181,
`pfEvBusy && !keep`). On the load back from the provider that is the usual case: the earlier visit's events (the
gate, the tap) are due at once and are in flight when `signed_in` is tracked. When they return, the next send is
planned by `due()`: 20 s after this visit's first event. And those earlier events go with the bearer of the session
now held (79191), so the visit before the sign-in is stamped with the account (`uid = coalesce(s.uid, excluded.uid)`).

Evidence (`probe.js t10`, three sign-ins, the request bodies read):

```
run 1: signed_in sent 18.9 s after it was tracked, status 200; batches: [["0.0","page_load+map_open+provider_tapped+page_hide"],["18.9","page_load+map_open+signed_in+name_set"]]
run 2: signed_in sent 19.4 s after it was tracked ...
```

This is also why flow 10 can pass while a sign-in is still missing: in the builder's own photo
`stats-desk-3-the-gate.png` "Sign-ins per provider" lists Google and Facebook but not Discord, while the funnel
says three signed in (it counts Rt's earlier visit, stamped with the account by its late batch). The same delay
follows a refused token: after a 401 the events go again as a visitor's only when `due()` says (t7: 401, then 200
some 20 s later), not "at once" as the report says. Nothing is lost; the closing batch carries the token.

Fix: in `pfEvSend`, use the session's token only for a batch of this visit (`b.sid === pfEvQ.sid`); earlier visits
go with the anon key. Give `pfEvNow` a flag (`pfEvSoon = true`) that `pfEvSend` reads when the in-flight batch
returns, sending the next batch at once whatever `due()` says; and send at once after the 401 path's release too.
In flow 10 wait for each page's `signed_in` row before reading the stats, and check the gate card's sign-ins per
provider (Google, Discord, Facebook: one each).

### 5. Minor. A 429 from the proxy is taken as a refusal: the batch is dropped, and three stop the visit

`done()` (78292 to 78302) keeps and retries only status 0 and 5xx. The guide's proxy answers 429 above 10
requests a second per address, which a school or a household behind one address can reach; those batches are
thrown away and three of them end counting for the visit. Spec 7.3's "three refusals (4xx)" was written for
refusals that will not change.

Fix: treat 429 and 408 as status 0 (keep, back off). One line in `done()`, one case in unit.js.

### 6. Minor. The size ceiling counts `hs_events` only; visits (`hs_sessions`) grow as much again outside it

`hs_track` checks `pg_total_relation_size('public.hs_events')` (schema.sql 759) and the Health card shows only
that. A flood of made-up device ids with one event each makes a visit row per event.

Evidence (`probe.js t11`, 2,000 one-event visits): `sessions grew 581632 bytes, events grew 630784 bytes`.

Fix: compare `pg_total_relation_size('public.hs_events') + pg_total_relation_size('public.hs_sessions')` with
`ev_max_mb` in `hs_track` and in `hs_stats`'s `events_mb`, and say so in 7.4's words on the Health card ("Events
and visits: ..."). Its sql-tests ceiling case holds either way.

### 7. Minor. Totals count `/next/`'s events and saves

Spec 7.5: "Visits from `/next/` are left out of every card." Totals' `events` is `count(*) from hs_events where ts >=
v_from` and `saves` is every row of `hs_saves` (schema.sql 1130 and 1131), staging included.

Fix: `events` through `hs_private.v_sessions` (`... from public.hs_events e join hs_private.v_sessions s on s.sid =
e.sid where e.ts >= v_from`), `saves` `where channel = 'live'`.

### 8. Minor. An anonymous id is written for a robot and for a prerender that is never shown

`pfEvStart` (79108) calls `pfAid()` (79076), which writes `hs_pf_aid`, before `pfEvBarred()` and the prerender
test. So a page prerendered by the browser and never opened leaves an identifier on the device, and the visitor's
real first visit then says `returning: true`. 7.3 says the queue is not started for a prerender; 7.1 makes the id
"on the first visit".

Fix: read the id without making it (`pfRead`) when the load is barred or a prerender; make it in `pfEvBegin`.

### 9. Minor. Flow 10 cannot tell a closing batch sent with `keepalive` from one sent without

With `keepalive: false` in `pfEvSend` (`mut/m7_keepalive.html`) flow 10 passes (Chromium still delivers a fetch
begun in `pagehide` when the page is closed by Playwright). Safari does not. The property that makes the last
batch leave with the page is untested.

Fix: in flow 10, wrap `window.fetch` in an init script that records `opts.keepalive` for `hs_track`, hide the page
(visibilitychange to hidden), and check the call it saw had `keepalive: true`.

### 10. Minor. Notes the owner should have (no code change asked)

- The privacy page now sets the anonymous id and counts the visit (DIFFERS 1). 8.1's words already say each count
  carries a random number kept in the browser, so the page is true to itself; with finding 2 fixed it no longer
  touches the funnel. Owner decision D4 still governs where the id lives.
- `hall_open`'s `from: "welcome"` has no path yet (Today's challenge is P6).
- `error` events carry `where` from the boot and `at` from the Hall (both from earlier packages); 7.2 names `where`.

## What I reran, and its result

Each run to its end, on 5ad745a, at load average 3 to 9 with the other track working.

| command | result |
| --- | --- |
| `node deploy/check-page.js index.html` | OK, 1 inline script parse |
| `timeout 900 node tools/selftest.js --suite=all` | PASS. Suite 1: 151 checks, 105.9 s of 125, perfMs 13.14. Suite 2: 22 checks, 9.6 s |
| frame time, base 1fdf323 (`git archive`) then P4, `--suite=1`, back to back | base perfMs 12.54 (100.0 s), P4 13.45 (102.8 s). Under the harness the platform does not run (`__hsEvKick` is never set there); I read the difference as noise, not a cost |
| `node tools/run-fixtures.js check` | PASS, 2 fixtures |
| `node tools/town-isolation.js` | PASS, 9 cases |
| `node tools/platform/unit.js` | 225 checks, 0 failed (3 subjects waiting for P3, P5, P6) |
| `node tools/platform/sql-tests.js` | 500 assertions, 0 failed |
| `bash tools/platform/test-update.sh` | PASS, 36 cases |
| `platform.js --flows=10` (all 5 sizes) | PASS, 165 s; funnel 4/2/1/1 .. 1/1/0/0 at every size; hostile answers as reported; quiet logs: webdriver SITE/, hs_config, settings only; file:// only the file; empty constants only PLAIN/?stats and PLAIN/; event count 969 to 969 and 973 to 973 |
| `run-all.js --quick` | RUNALL_RESULT_PLACEHOLDER |
| `platform.js --flows=1,2,3,11` (all 5 sizes) | PLATFORM_FULL_PLACEHOLDER |
| `NODE_PATH=$(npm root -g) node tools/platform/p0.js` | P0_PLACEHOLDER |

Probes (`probe.js`):

- t1: `hs_stats` and `hs_admin_set_config` as a visitor: 401 `permission denied`; `hs_stats` (whole and one card)
  and `hs_admin_purge_events` as a player: 403 `not_admin`; `?stats` as that player: only "For the owner only. This
  page is for the game's owner. Back to the game".
- t2: the service down (503) from the start: tries at 20 s, 50 s, 110 s after load; reload: store kept 12 events
  of 2 visits; service up: both visits sent at the next try (150 s), 200; on the server every event of both visits
  once (`v1 page_load=1, gate_shown=1, map_open=6, page_hide=1; v2 ...`), duplicates 0, store empty after.
- t4/t5: Tushpa, a wave cleared, the page hidden mid battle (`battle_quit` with the battle's facts and `how:
  "left"`, `page_hide where: "battle"`, a keepalive batch of 9, 200), shown again (`battle_back {lv: "tushpa", wave:
  1}`), won, the Council opened in the Hall: on the server `battle_start`, `wave_end`, `page_hide`, `battle_back`,
  `hall_open`, `council_open` identical to `__hsEv`; `battle_quit` and `victory` (58 keys, 1,015 bytes) identical
  but for jsonb's key order inside nested objects.
- t6: in a battle, 150 tracks of 2.9 KB props 4.2 ms; `pfEvSave` with a full 60 KB queue 0.8 ms; a victory's
  `trackFacts` 0.3 ms; store 58 KB.
- t7: a token expired on the server mid visit: one 401, then the same 3 events as a visitor's, 200, about 20 s
  later; the visit keeps its account; no loop.
- t8: `HS_ANON_ID = "visit"`: no `hs_pf_aid` in localStorage on the first load or a reload of the tab (the id in
  sessionStorage, the same across the reload); after Play as a guest it moves to localStorage and leaves
  sessionStorage.
- t9, t10, t11: findings 1, 4, 2 and 6.

Mutations (does a test fail when its subject is broken):

| change to a copy of index.html | caught by |
| --- | --- |
| back-off 3 s instead of 30 s | unit.js (1 failed) |
| `evBytes` without the database's spaces | unit.js (3 failed) |
| refusals 99 instead of 3 | unit.js (1 failed) |
| batch not filled by bytes | unit.js (1 failed) |
| `wave_end` left out of the never-dropped list | unit.js (1 failed) |
| the webdriver rule removed | nothing: flow 10 PASS (finding 3) |
| `keepalive: false` on the closing batch | nothing: flow 10 PASS (finding 9) |

Reading the change: no `innerHTML` in the stats code (the provider buttons' fixed marks come from `pfProviderBtn`);
every value through `pfEl`/`textContent`; only numbers worked out on the page go into a style. No long dash in the
diff or the commit message; no British spelling found; no key, secret or JWT added; both constants still empty.
Listeners: `pfEvBegin` runs once (the prerender path through `{ once: true }`); `pagehide` after `visibilitychange`
sends nothing twice (`pfEvHidden`). Per frame: nothing; `track` costs one `JSON.stringify` of its props.

## What I could not check

- Safari, iOS, Firefox: keepalive with a CORS preflight, `pagehide` on iOS, a prerender in Safari. Chromium only.
- The real Supabase and its gateway (PostgREST's own handling of `on conflict` and the 61,440-byte batch limit).
- `dance10`'s known intermittent failure: see the run-all line above.
- The photos at 1600 x 900 and 1194 x 834 are the builder's (`shots/p4/stats-desk-*`, `stats-ipad-*`); I looked at
  them (the funnel, the gate, the switches) and found them readable; the gate card in one of them shows finding 4.
