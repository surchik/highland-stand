# G6 review: the daily's battle (gameplay 6.4)

Reviewer: an independent agent, on branch gp/work at ef87743 ("G6: the daily's battle (gameplay 6.4)", one commit on
fd8da51). Read: RULINGS (whole), gameplay.final.md 6 (whole), 8.1, 8.3, 9.1, platform.final.md's daily parts (0.3 (5),
2.4, 5.6, the share card, `Platform.daily()`), the server's `_daily_pick` and `_bounds`, `tools/platform/ref.js`, and
the whole diff of ef87743 (index.html, tools/balance.js, tools/playtest-daily.js, the balance tables, the spec's new
paragraph). Probes and logs: `/tmp/claude-0/-home-user/169f7cc7-9178-569c-b36f-88a849db13cf/scratchpad/top/build/review/G6/`.
No code of the package was changed.

REVIEW G6: 0 blockers, 3 majors, 10 minors.

The package is sound where it matters most. The pick equals the server's lines, the day is UTC in every timezone, the
draws that move foes do not touch `Math.random`, a daily never writes `hs_run`, `hs_best_*` or `hs_records` on any path I
walked, and the seam P6 reads is in `rulesetData().daily` and matches `ruleset-2.json` byte for byte. The majors are one
spec sentence not built (Sis's days), one check that cannot fail, and the stars a daily's event still reports.

## Findings

### 1. Major: Sis's days in a daily are counted by played wave, not by script wave (6.4 sentence not built)

6.4: "Sis counts its days by script wave (`DAYS_PER_WAVE * scriptWave(w)`), so its last wave is still day 60." The code
counts by played wave:

- `index.html:14142` `function heldCount(L, waves) { return L.clock === "days" ? waves * DAYS_PER_WAVE : waves; }`
- `index.html:13561` the HUD's note: `"Day " + (1 + DAYS_PER_WAVE * lastCleared) + " of the siege"`

Evidence: the builder's own photo `shots/g6/end-victory-sis-1600x900.png` reads "You held the castle for 36 days of the
siege" after a won 12-wave daily (12 x 3). The campaign's Sis is 20 waves, where played wave equals script wave, so the
campaign never showed it.

Fix: count by script wave in both places, `waves => DAYS_PER_WAVE * scriptWave(waves)` in `heldCount` and
`1 + DAYS_PER_WAVE * scriptWave(lastCleared)` in the HUD note (with `scriptWave(0) = 0`). The campaign's text is unchanged
(20 waves, identity map). Add to suite 2's daily checks: a staged Sis daily victory whose `#ovSub` contains "60 days", and
the HUD note after wave 6 of the daily reads "Day " + (1 + 3 * scriptWave(6)).

### 2. Major: the check that a daily writes no record cannot fail (lens 5)

Mutant m02 deletes the daily's guard in `saveBest` (`if (dailyRun) return null;`, `index.html:13736`). Suite 2 still
passes: `node tools/selftest.js --suite=2 mut/m02_savebest.html` gives "suite 2: PASS, 38 checks, 72.7 s of 125". The
check stages its victory on Mari, a battlefield the campaign has not opened, and `saveBest`'s older guard (a battlefield
not reached is never recorded) already refuses it. So the guard that protects the common case, a daily on a battlefield
the player has opened (today's pick is often one), is untested.

Fix: in "daily: a victory and a defeat leave hs_best ...", stage a second daily victory on an open battlefield whose best
is below its length (Erebuni with `hs_best` "4", which the check already sets) and assert `bests()`, `hs_records` and
`hs_run` unchanged and no `star_gain` event. Rerun m02 to see it fail.

### 3. Major: a daily's events still carry stars (seam with P6 and the share card)

`battleFacts().stars` is `victoryStars(held, max)` for a daily (`index.html:13155`), and suite 2 asserts it
(`f.stars !== victoryStars(f.held, f.lives_max)` in the daily check). The page says the opposite: "A daily gives your hero
experience, but no stars", and `showRecord(0, ...)`. RULINGS S2 makes "the stars shown are the event's stars", and the share
card (platform 6) draws "the three stars, won ones gold" from them. So once P6 and P7 land, a won daily's strip and share
card show 2 or 3 gold stars that the page says it does not give.

Fix (gameplay, one line, and the check changed with it): `stars: won && !dailyRun ? victoryStars(held, max) : 0`; and
name to the platform track that its daily strip and the daily's share card leave the stars row out. If the owner prefers
stars on the card as a measure of defenders kept, then the page's sentence must change instead; either way the two must
agree.

### 4. Minor: Iron ranks is nearly no twist, and the skip walk serves it most (lens 2)

From `docs/specs/balance/g6-daily-twists-normal-seeds3.txt`, the mix's defenders kept with Iron ranks against no twist
are identical on 8 of the 16 battlefields that serve it (Erebuni 8.0, Tushpa 11.7, Avarayr 11.0, Sevan 15.0, Mari 12.0,
Gyumri 17.0, Halidzor 7.7, Shushi 11.0) and within one defender on two more (Ani 15.0 against 16.0, Sis 16.0 against
15.3), and its clock moves 1%. With 52 pairs skipped, the
pick's walk to "the next twist in the list" lands on Iron ranks far more than on others. Over 136 days from day 20406
(the page's own lines on the committed skip list): iron 28, nocatapult 21, few 19, swift 17, nodrums 17, quiet 16,
thin 11, noballista 7. The same twist comes two days running 7 times in those 136 days (platform 5.6 promises "no twist
two days running" only for the unskipped pick).

This is as 6.4 specifies (+3 armor; skip by the mix), so it is the owner's: candidates are +5 armor (rechecked with
`DAILY=1 TWIST=iron`), or a walk that steps by `j` instead of 1 so a skipped pair does not always fall to its neighbor.
The second needs the platform's SQL and `ref.js` changed in step, so it is a seam item.

### 5. Minor: suite 2 has no check for leaving a daily by Abandon or Resume, and none under a non-UTC clock (lens 5)

Mutants that survive suite 2 (each "suite 2: PASS, 38 checks"):
- m16: `dailyLeave()` deleted from Abandon (`$("menuBtn")`): the map comes up with `dailyRun` still set (and `trayBan`).
- m15: `dailyLeave()` deleted from `resumeRun`.
- m17: `dailyDayNum("YYYY-MM-DD")` parsed in local time; m18: `dailyToday()` takes the local day.
m17 and m18 are wrong in every timezone but UTC, and the self-test runs in this machine's UTC. The code as committed is
right: my probe (`probe.js`, section 3) opened the page in UTC, Pacific/Kiritimati (+14) and America/Los_Angeles one
minute either side of UTC midnight and got the same day and pair in all three (20770 stepanakert92/quiet, then 20771
avarayr/nodrums); Abandon and Replay tutorial out of a daily both leave it (probe sections 1e, 5d).

Fix: add to the daily checks an Abandon from a daily battle (two presses of `#menuBtn`) asserting `dailyRun === null`,
`trayBan` empty, `curDiff === prefDiff`; and run suite 2 under `timezoneId: "Pacific/Kiritimati"` in `tools/selftest.js`
(a context option; it costs nothing) so a local-time day fails it.

### 6. Minor: a lost daily's page hides the debrief

A daily's defeat page uses the victory layout (`showVictoryScreen()` after `showDebrief`, `index.html:15131`), and
`.ovDebrief.on` shows only under `#overlay:not(.brief):not(.victory)` (`index.html:738`). So the campaign defeat's
"what came through" chips and its Tip are missing exactly where a player will try again at once (photo
`shots/g6/end-defeat-ani-667x320.png`: title, one line, two doors). Fix: a class for the daily's end
(`overlayEl.classList.add("dailyEnd")`) and `#overlay.victory.dailyEnd .ovDebrief.on { display: ... }` with the
defeat's own rule, checked at 667 x 320 where the page has room for two short rows.

### 7. Minor: on a phone the daily's door has no words

At 667 x 320 the door is a 46 px horn with its words only in `title` and `aria-label` (probe 5a:
`{"w":46,"h":46,"visibleText":""}`; photo `shots/g6/entry-map-667x320.png`). A finger has no hover, and the horn is not
an icon the game uses for "challenge" anywhere else. Fix: a one-word caption inside the square ("Daily", 10 px, as the
Hall's button carries a red dot), or the red dot the platform gives `#hallBtn` while today's daily is unplayed.

### 8. Minor: the door's title cannot tell the two Stepanakerts apart

`dailyEntry` names `L.name`: probe 1a reads "Today's challenge: Stepanakert, No spells. 12 waves on Normal, the same for
everyone" (Stepanakert 1992 and Stepanakert 2023 are both "Stepanakert"). The share text of P6 will meet the same.
Fix: add the year where two battlefields share a name (`L.name + " " + L.year`, as the bot's tables do), in the door's
title and in a `dailyTitle(levelIndex)` the platform can call beside `twistName`.

### 9. Minor: `startDaily` takes dates that do not exist

`dailyDayNum("2026-02-31")` is 20515 (March 3) and `dailyDayNum("2026-13-01")` is 20819 (probe 4b), so
`startDaily(i, t, "2026-02-31")` begins a battle, against its comment "refuses a day it does not know". Fix: after the
regex, refuse unless `dailyDate(d) === day`.

### 10. Minor: the victory line promises experience after the day's cap is used

`dailyDoneLine(true)` always says "A daily gives your hero experience, but no stars." A second won daily on one day gains
0 (`heroGain` caps at 150). Fix: when `heroGrowth.xp === 0`, "Your hero has learned all he can from today's challenge."
(or drop the clause).

### 11. Minor: the README's win counts disagree with the committed table

`docs/specs/balance/README.md` (G6) gives the mix's wins of 51 as Forced march 27, Few defenders 37, No spells 34; the
committed `g6-daily-twists-normal-seeds3.txt` says 28, 38, 35. I recomputed the skip list from the committed table and it
equals `rulesetData().daily.skip` exactly (Shushi's No drums by the watch rule), so only the README is stale. Fix: copy
the three numbers.

### 12. Minor: the skip list and `t` were measured on one day's outflanker lines

Every table was made with `DAY=20406`; the lines move with the day, so a pair at 2 of 3 seeds on that day may be 1 of 3
on another. Fix (cheap): rerun only the served pairs that won exactly 2 of 3 on a second day (`DAY=20407`) and skip any
that drop; say in the README that the list is one day's.

### 13. Minor: for P6, the map's door and practice battles (seam, to be named, not changed here)

- `#dailyBtn` starts the daily directly (`startDaily(dailyToday()...)`). With the platform on, 5.6 and the welcome card
  send "Today's challenge" to the Hall's Daily tab, which counts attempts and offers Practice. The line is
  `$("dailyBtn").addEventListener("click", ...)`; the platform should either own that click or call it only while
  `Platform.daily()` is null.
- A daily after the third attempt is "Practice, unranked" (5.6), but `battle_start` sends `ranked: true` for every daily
  (`battleRanked()` knows nothing of attempts). P6 must decide rankedness itself, or `startDaily` gains a fourth argument
  `{ practice: true }` that `battleRanked()` reads. Name it now so the two tracks do not both assume the other does it.

## What I reran (each to its end, on ef87743 in /home/user/hs-wt/gp)

| Command | Result |
| --- | --- |
| `node deploy/check-page.js index.html` | OK, exit 0 |
| `timeout 900 node tools/selftest.js --suite=all` | PASS. Suite 1: 151 checks, 111.8 s of 125. Suite 2: 38 checks, 64.2 s of 125 (the three daily checks inside; the largest 8.9 s). Load average about 1. |
| `node tools/run-fixtures.js check` | PASS, 8 fixtures, 0 fails |
| `node tools/town-isolation.js` | PASS, 9 cases |
| `node tools/playtest-daily.js index.html` (667 x 320, iPhone UA) | PASS in 57 s: today's daily (Stepanakert 1992, No spells) through the map's door, lost holding 6 of 12; 14 built, 16 ranks, 83 taps, 16 misses. The misses are the script's 250 ms wait while the tower panel slides in: my `probe3.js` with a 900 ms wait reached Upgrade on 24 of 24 towers. |
| `node tools/ruleset.js`, `--json` | the page's pin e25854e1 equals RULESET_PIN; the JSON equals `docs/specs/balance/ruleset-2.json` |
| suite 2 against 13 mutants (`mkmut.js`, `runmut.sh`) | caught: no skip walk, castSpell guard, the daily tray, the map's dailyLeave, a seed without the day, the watch rule, clearRun's guard, Fight again. Survived: saveBest's guard (finding 2), Abandon's and Resume's dailyLeave, local-time day parse and local-time today (finding 5). |
| `probe.js` | the flows of findings 5, 7, 8, 9 and the timezones; no page errors |
| `probe2.js` | the door shows on the map and the campaign defeat (which is the map), hidden on victory, chronicle and chapter pages |
| skip list recomputed from the committed table | equal to `daily.skip` |
| `node tools/regress/run-all.js --quick` | 11 of 11 PASS in 992 s: padplace, plots, probe, vic, nag, dance10 (6 of 6), live, doors (1 known town line), iphone, waves, platform. Load average 3 to 4 (the other track at work). |
| `node tools/regress/run-all.js --only=iphone,doors,vic` (full) | 3 of 3 PASS in 1011 s: iphone 737 states at 10 sizes; doors 18 doors, 6 battles (1 known town line); vic 249 presses on 17 battlefields. The builder's doors failure did not occur here. |
| `node tools/shot.js "shot=daily&lv=12&twist=few&day=2026-11-13"` at 1194 x 834 | the chronicle with its card, as the builder's photos show |

## What I could not check

- The platform's daily flow (9.1 "the platform's daily flow passes"): P6 does not exist.
- A won daily by touch: the scripted player loses (as the builder said); the victory page was checked by suite 2's staged
  battle and my probe 2, not by a finger.
- Real devices and Safari: only headless Chromium with an iPhone user agent.
- I ran no balance-bot battles (RULINGS E); every balance statement above is read from the committed tables.

## CLOSE (gameplay track, G6 close)

- 1 (Sis's days): fixed. heldCount counts by script wave, so the HUD note and the held line agree; a staged Sis daily
  ends on day 60. Suite 2 checks the note after wave 6 and the victory's "60 days".
- 2 (the record check could not fail): fixed. Suite 2 now wins a daily on Erebuni, which is open and holds a best, and
  checks hs_best_*, hs_records, hs_run and that no star_gain is sent. Mutant m02 is now caught.
- 3 (stars on a daily's events): fixed. battleFacts().stars is 0 for a daily, and the victory card draws no stars on a
  daily. The platform track must leave the stars row off a daily's strip and share card.
- 4 (Iron ranks weak, twist two days running): owner's call, not changed.
- 5 (Abandon, Resume, the clock): fixed. Suite 2 checks Abandon and Resume from a daily and the UTC day, and runs on a
  Pacific/Kiritimati clock (tools/selftest.js). Mutants m15, m16, m17, m18 are now caught.
- 6 (a lost daily hides the debrief): fixed. The overlay gains .dailyEnd and the debrief shows under it; checked in
  suite 2 and photographed at 667 x 320.
- 7 (the phone's door has no words): fixed. A "Daily" caption at 11 px in the 46 px square (iphone.js reads it).
- 8 (two Stepanakerts): fixed. dailyTitle(levelIndex) adds the year where names clash; the door's title uses it, and
  the platform may call it for the share text.
- 9 (dates not on the calendar): fixed. dailyDayNum refuses them.
- 10 (experience promised after the cap): fixed. A second line once the day's experience is used.
- 11 (README counts): fixed.
- 12 (one day's lines): the five pairs won on exactly two of three seeds were rerun on DAY=20407; all still won two of
  three, so the skip list stands. The README says the list is one day's, with that second-day check.
- 13 (the door's click and rankedness with P6): for the platform track; named in the close report, not changed here.
