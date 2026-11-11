# Review of package G1 (gameplay track): hooks and numbers on today's game

Reviewer: an independent agent that did not build G1. Reviewed: branch `gp/work` at bac1ddb (a merge whose tree is
the same as 74e73b3, "G1: hooks and numbers on today's game, with no rule changed"), against its base 3714b0d
(`next`). Probe scripts and logs are in the reviewer's scratch folder (`review/G1/`): `mutate.js`, `probe.js`,
`probe2.js`, `fx/` (fixtures made by the reviewer), and the logs named below.

REVIEW G1: 0 blockers, 1 major, 6 minors.

## Findings

### 1. MAJOR: the pins and `earnMax` do not see the pay rules that live in code

Evidence: `index.html` line 9426, inside `rulesetData()`:

```js
pay += 25 + w * 3 + 60 + 60;   // the clear's bonus, the interest at its cap, an early call at its cap
```

These three numbers are copies of `endWaveIfClear` (`const bonus = 25 + waveIdx * 3;`,
`Math.min(60, Math.floor(gold * 0.05))`) and `earlyBonus()` (`Math.min(60, 10 + 4 * enemies.length)`), not reads
of them. The page's own comment above `RULE_SKIP` admits the clear's bonus, the interest and a sale's share are
outside `fight`. Mutation probe (`mutate.js`, a copy of the page with one change, then
`node tools/selftest.js --suite=2 <copy>`):

```
normalGold:  suite 2: FAIL ... the rules changed without a new RULESET: RULESET_PIN would be "7b6f1f8f"
clearBonus:  suite 2: PASS, 12 checks      (25 + 3w  ->  26 + 3w in endWaveIfClear)
interestCap: suite 2: PASS, 12 checks      (cap 60  ->  90 in endWaveIfClear)
```

So a change to how a battle pays (a rule of the fight) passes suite 2 with no new `RULESET`, and `earnMax` then no
longer bounds `earned`: with the interest cap raised past the 10% margin, honest scores would be refused by the
server (gameplay 6.3: `rulesetData()` is "built by the page from its own tables so it cannot drift from the game";
platform 0.3 item 1: "RULESET must change whenever anything in rulesetData() or in the fight itself changes").
Ruleset 1 is never published, so no player is hurt today; the mechanism is what G4 to G7 will lean on.

Fix: name the pay rules once and use the names in both places, with no change to any number:
`const PAY = { clear: [25, 3], interestRate: 0.05, interestCap: 60, earlyBase: 10, earlyPerFoe: 4, earlyCap: 60, sell: 0.7 }`;
`endWaveIfClear`, `earlyBonus`, `sellRefund` and `rulesetData` read `PAY`, and `PAY` joins the `shared` list hashed
into `fight`. Add to the pins check of suite 2 a moved-pins case for `PAY.clear[0] += 1` (every battlefield moves),
beside the archer case. The bot's tables must still equal the base cell for cell after the edit.

### 2. MINOR: the save at each defender lost is not tested

Evidence: `leakFoe` gained `else if (lost > 0 && phase === "wave") saveRun();` (gameplay 6.1: redo "is written with
every saveRun, at each defender lost (leakFoe) and when the page is hidden"). Mutation `noLeakSave` (that line
disabled): `suite 2: PASS, 12 checks`. Every resume check reaches its save through `holdOnLeave()`, which saves too.
The reviewer's probe (`probe.js`, "killedVisible") shows the line works: a tab dropped while visible, right after two
defenders fell in wave 2, leaves `redo {"w":2,"lost":2,"sec":6.05}`.
Fix: in suite 2's first resume check, read `hs_run` straight after the leak (before `run(3)` and `holdOnLeave()`)
and assert `redo.lost === lost`.

### 3. MINOR: a second reload before anything is saved does not count as a resume

Evidence: `probe.js`, "twice": leave wave 2 with 2 lost, resume (`resumed` 1), wait 10 s, reload again with nothing
bought: `resumed` is still 1 (gameplay 6.1: on a resume "`resumed` rises"). `resumeRun` writes nothing back, so the
second resume starts from the same `facts.resumed`. The clock also drops the 10 s waited after the first resume, but
the spells' clocks drop them too (both come from the same save), so nothing is gained; only the count is wrong.
Fix: call `saveRun()` at the end of `resumeRun()` (after `battleResume`), so the run on the device carries the new
`resumed` and the owed `redo` (`saveRun` already writes `{ w: redoW, lost: dropped, sec: 0 }` between waves).
Check it in suite 2: reload, resume, reload, resume: `battle.resumed === 2`, `battle.dropped` kept.

### 4. MINOR: `battleFacts()` runs outside `track`'s guard, on the first line of `victory()` and `defeat()`

Evidence: `track("victory", battleFacts());` (line 11908) and `track("defeat", battleFacts());` (line 12307):
the argument is built before `track`'s `try` is entered. A throw there (a chapter missing for a battlefield, a
malformed value in a saved run that slipped past `savedLeaks`) would stop the victory before `saveBest()` and the
record, and raise the crash card. `probe2.js` found no such throw (a malformed leak tally is handled), so this is a
guard, not a live bug. Gameplay 7: "track never throws" should hold for the whole call.
Fix: `function trackFacts(name, extra) { let p = null; try { p = Object.assign(battleFacts(), extra || {}); } catch (e) {} track(name, p); }`
used by `victory`, `defeat` and `battleQuit`.

### 5. MINOR: the bot's clock is the page's clock plus a synthetic 4 s a wave

Evidence: `tools/balance.js` (CLOCK=1): `const sec = waveSec + 4 * Math.max(0, secs.length - 1);`. Gameplay 6.2 and
5.6 say the bot sends each wave 4 s after the last is cleared. The builder kept the bot's battles identical to the
base's on purpose (G1 must not change a cell) and documented the difference in `docs/specs/balance/README.md`. The
4 s are not fought: spells and the hero do not recover in them, so a real battle at par is a little easier than the
bot's. Fine for ruleset 1, which is never published.
Fix: none in G1. In G4 (the first package that may change the tables) make the bot wait the 4 s in the battle
itself (`run(4)` before `startWave` when `CLOCK=1`), and retake the pars from that.

### 6. MINOR: `BUILD_ID` was not raised

Evidence: `const BUILD_ID = "2026-11-09";` is unchanged from the base. The platform posts `build` in `p_stats` and
the facts carry it, so the stats cannot tell a G1 page's battles from the base's. Not a rule; saves of either build
resume in the other (fixtures below).
Fix: the integrator raises `BUILD_ID` when `next` takes G1 (or each package raises it in its commit).

### 7. MINOR: a hand-edited save resets the clock and the debt and stays ranked

Evidence: `battleResume` takes every `facts` value in `[0, 1e9]` and any `redo` whose `w` is `cleared + 1`.
Removing `redo`, or setting `facts.sec` and `facts.debt` to 0, from a run with `rules: 1` resumes as ranked with
no debt and a short clock. Suite 2's forged-save case covers values out of range only. A page cannot stop this
(platform 2.5 lists edited local state among what a cheater can still do), but it can make it visible.
Fix: send `sec`, `debt` and `dropped` on the `battle_start` of a resume (they are numbers, the event stays far
under 3 KB) so the platform can keep the largest `sec` seen under a run token and flag a run whose clock went back.
Name it to the platform track; no gameplay rule changes.

## What was checked and found as the builder said

- No rule changed. The bot, Normal, SEEDS=1, all 17 battlefields, 7 builds (119 battles) on the base
  (`/home/user/hs-wt/next`) and on `gp/work` with `JSON=1`: the text tables are identical except the added CLOCK
  block, and all 119 JSON rows are equal in every field the base writes. The six-battlefield sample of the lens
  (Erebuni, Dvin, Sis, Musa Dagh, Stepanakert 1992, Stepanakert 2023) was also run and is equal. The CLOCK block of
  my run equals the committed `docs/specs/balance/g1-normal-seeds1.txt` line for line, and its pars line equals
  `LEVEL_PAR`. Read line by line, the index.html diff only adds counters, saves, events and the ruleset: every
  `spendGold` call keeps its amount; `saveRun` works on a parsed copy of the horn (`JSON.parse(waveStart.json)`), so
  the extra saves at each leak and on hide change nothing of the battle; `rulesetData()` restores the six globals it
  borrows, draws no `Math.random` (probe: 0 calls) and gives the same pins in the middle of a battle with the
  adaptive enemy at work (`probe2.js`).
- Suite 1 untouched: the text of `runSelftest()` is byte for byte the base's (155,982 characters); the only edit
  near it is the boot line, which now wraps it in `runSuite` for its clock.
- The clock (RULINGS S1): `update` runs only when nothing holds the battle (`frame`: not paused, no coach freeze, no
  trick card, no page over the field), and `battleTick` is the first line of `update`. Probe: the same battle through
  `frame()` gives 3.84 s at 1x, 2x and 4x; a trick card and Settings each hold it at 0.16 s for 30 frames; it grows
  between waves (`idleS`).
- The sums of 6.1 after a quit (probe: `left` 256 = `earned - spent + refunds` 256, `lives` = `held` 19, lost 1),
  and suite 2's own victory, defeat, endless end, undo, sale, plot, rank, gift and test cases. Mutations that break
  the undo (`undoAsSale`), the sale (`saleTrimsSpent`), the idle clock (`noIdle`, `noIdleSec`), the speed
  (`speedSec`), the debt (`noDebt`), the saved clocks (`noCd`), the dropped attempt's time (`noRedoSec`) and the save
  on hide (`hideNoSave`) each make suite 2 fail with a message that names the fault.
- Resumes (RULINGS S2): a second drop with a smaller loss keeps the larger (probe: saved `lost` 2, debt 2,
  `lives_board` 18 of `held` 20); a commander's wave left in the middle (Erebuni wave 10) comes back with the
  commander unmet and is counted once when fought again (`cmdMet` 1); the spells' clocks and a fallen hero survive a
  reload (suite 2); a run between waves owes nothing.
- Runs saved by the base resume: I made my own fixtures with the builder's tool copied out of the repo, from
  `/home/user/hs-wt/next/index.html` and from `master` (54207ce, the live game): a run saved between waves and one
  saved in the middle of a wave with a defender lost, each. All four resume, fight on, save again under ruleset 0
  (legacy, never ranked) and win with 3 stars. The builder's two fixtures pass too.
- Events: names and props against platform 7.2 and gameplay 7; worst case 1,559 bytes, one level of nesting
  (suite 2). `track` itself is wrapped in `try`. The counters allocate nothing per frame (`battleTick` adds to
  fields of one object); a save at a defender lost costs 0.06 ms with 14 towers on Stepanakert 1992 (2.5 KB).
  `ranked` is false for the coached stand (also after a skip and after a resume of it), test mode, endless and a
  legacy run.
- Phone and iPad: every hunk of the diff is inside the script (from line 9335; the script opens at 3088); no CSS or
  HTML changed. Playtest 7 at 667 x 320 by touch passed and its victory photo shows the debt line fitting with no
  page scroll.

## What I reran, with results

| command | result |
| --- | --- |
| `node deploy/check-page.js index.html` | OK, 1 inline script parses |
| `timeout 900 node tools/selftest.js --suite=all` (load 0.3 to 2.8) | suite 1 PASS, 151 checks, 103.8 s of 125; suite 2 PASS, 12 checks, 6.5 s of 125; exit 0 |
| `mutate.js` (13 one-line mutations, suite 2 on each) | 11 caught, 2 not caught (findings 1, 2); one pattern skipped |
| bot, Normal, SEEDS=1, 17 battlefields, base and `CLOCK=1 JSON=1` branch | 119 rows equal; tables equal but the CLOCK block; clock block equals the committed file |
| bot, Normal, SEEDS=1, 6 battlefields (earlier life of this review) | 42 rows equal, tables equal |
| `node tools/town-isolation.js` | PASS, 9 cases |
| `node tools/playtest-resume.js` (667 x 320, touch) | PASS: debt 1 with the line, debt 0 without it, scroll 0 |
| `tools/run-fixtures.js check` (builder's fixtures) | PASS, 2 fixtures |
| reviewer's fixtures from `next` and `master`, checked on `gp/work` | PASS, 4 fixtures |
| `node tools/ruleset.js` and `--json` | pins match; JSON equals `docs/specs/balance/ruleset-1.json` |
| `probe.js`, `probe2.js` | results quoted above |
| `node tools/regress/run-all.js` (full, no script edited, load 5 to 14) | PASS, 9 of 9 in 2561 s: padplace 719 s, plots 209 s, probe 214 s, vic 578 s, nag 85 s, dance10 143 s, live 305 s, doors 23 s (1 known: the hidden town's start card, not G1), iphone 285 s (657 states, 10 sizes, 0 fails); no rerun needed |

## What I could not check

- A real phone or iPad: playtest 7 was the scripted touch player at 667 x 320, as the builder's; the five minutes
  away were not waited (a closed page has no clock).
- The platform's side: nothing posts, so `p_stats` built from these events was read, not run.
- Easy and Hard pars: ruleset 1 uses Normal's for all three by RULINGS E; no table on the other difficulties was run.

## For the other track and the owner

- Use 74e73b3 for a linear history; bac1ddb is a merge of `origin/gp/work` (the three WIP commits) with the same tree.
  Something pushed those WIPs to `origin/gp/work`; the builder says it never pushed.
- Platform 2.4's daily example carries `k` and `j`; `rulesetData().daily` does not (gameplay 6.4 does not list them).
  The platform should supply its own steps or name them to gameplay before G6.
- For the owner (RULINGS S2, by design): a wave about to be lost can be left and fought again; the boards count the
  dropped attempt's loss, but a battle that would have fallen can end as a ranked victory.
