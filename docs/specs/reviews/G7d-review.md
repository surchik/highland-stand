# G7d review: the Aid Post (`aid`)

Reviewed: branch gp/work, commit cca4b15 (tag g7d-done) against its base eb0ae9e (G7c close); b7b655a between them changes
no file. Independent review: the builder's report was not taken on trust. Every claim below was rerun or read in the code.
No code of the package was changed. The reviewer's probes are in the scratch folder `review/G7d/` (`probe-rules.js`, six
mutant pages in `mut/`, the bot logs).

REVIEW G7d: 0 blockers, 1 major, 8 minors.

## Findings

### 1. Major: 5.2's Aid Post row is missed on Musa Dagh, and the acceptance asks for it

5.2: "mix" plus an Aid Post as its sixth building never loses more defenders than "mix" by more than 1. On Musa Dagh it
loses all three Normal seeds the mix wins.

Evidence: `SEEDS=3 CLOCK=1 JOBS=3 node tools/balance.js all van,musadagh,sardarapat mix,aid,mix7` (`bot-aid.log`), cell for
cell the builder's tables:
- Normal Musa Dagh: mix 3/3 4.0, aid 0/3 w16c3, lost 16.0 against 20.0 (+4.0).
- Easy Musa Dagh: mix 25.0, aid 22.0 (+3.0).
- Hard: +0.0 on all three. Van and Sardarapat: +0.0 on all three difficulties.
- A seed turned: Hard Sardarapat, aid 3/3 against the mix's 2/3. Returns never pass the cap (most 5).

The builder's reading ("the post takes the pad of the mix's last tower") holds. The reviewer checked it two ways:
- The same order with a fighting tower in the post's place wins. `BUILD_mixarch` and `BUILD_mixfire` (the mix with an
  archer or a fire as sixth, the aid build's shape) on Normal Musa Dagh at SEEDS=3: 3/3 12.0 and 3/3 12.3. aid: 0/3.
  (`bot-musa-perturb.log`)
- `JSON=1 SEEDS=1` trace, seed 1: the aid board holds more defenders than the mix from wave 6 to 15 (7 against 3 at
  wave 15, its returns at work). It falls on wave 16 (7 to 0) to the last commander; the mix holds that wave with 3.
  (`musa-json.txt`)

So the post is not weak here. It costs the one fighting tower that stops Musa Dagh's last commander, which the mix holds
with 0.1% of its road to spare. That is 5.5's counter ("a board that buys it instead of a tower leaks more than it
returns"), and 5.2's row cannot be met on this field by the post's numbers.

Fix (the owner's ruling, nothing to change in the code meanwhile): rule one of these, and write it into 5.2 and
README G7d.
- (a) Recommended: the row is read where the mix holds its last commander with a margin, and Musa Dagh is excepted.
- (b) Retune Musa Dagh's last commander. This is a battlefield change (G4 or G5's domain), not the post's.
Until then the package does not meet its acceptance line "its builds meet 5.2 on its battlefields". Say so at the close.

### 2. Minor: a stunned Aid Post still returns a defender

The 3.5 build note (item 2) and the code's comment over `aidCovers` say a stunned post tends no one until it recovers.
`aidReturn` uses `aidPost()`, which skips only a wreck.

Evidence: `probe-rules.js` on Van. The post has `stunnedT = 5`, the walls are 3 short, and a clean clear comes:
`{"returned":1,"lives":18}`.

Fix: in `aidReturn`, write `if (!a || a.stunnedT > 0 || !clean || gameOver) return false;`. Or, if returns are meant to
ignore a stun, say so in the 3.5 note. A stun rarely outlasts a clear, so either is cheap. The first is consistent.

### 3. Minor: the hero's heroBack is fixed at the instant he falls

`heroDie` sets `hero.respawn = heroAwayS()` once. A post stunned at that instant gives nothing for the whole wait.

Evidence: `probe-rules.js`. Post stunned for 0.5 s, hero falls: `respawn 20, own 20`. Unstunned: 17.

The same happens if the post is built a second after he falls, or sold while he is away (he keeps the shorter wait).
Neither is a big deal, but the first reads as a bug to a player who watched the post recover at once.

Fix: drop the `a.stunnedT > 0` clause from `heroAwayS`. He is carried back to the walls, as the note says, and a stun of a
few seconds should not cost him 3 to 12. Or re-read the post each frame in `updateHero` while he is down. Either way, add
the case to suite 2's check.

### 4. Minor: a suite 2 sub-check can pass without testing anything, and one rule is untested

Check "aid: heals only out of a fight..." (index.html, about line 89878):
`if (aidHaste(P) === 0 && Math.abs((r0 - m.respawn) - 0.5) > 1e-6) fail(...)`. If the post's rally is still in the
moved post's range, the condition is false and nothing is asserted. The rally line before it
(`P.rally = Object.assign({}, P.rally)`) moves nothing.

Also, no check covers the read where 3.5 is silent (a post counts as in range when only its rally point is).

Fix:
- Put the rally out of range explicitly (for example `P.rally = { x: A.x + 4000, y: A.y }`), assert `aidHaste(P) === 0`,
  then assert the plain rate.
- Add the case of the pad out of range with the rally in range: the haste applies.

The rest of the checks do fail when their subject is broken. Six mutant pages, each run through `--suite=2`, each fail
only an aid check:

| mutant | what it breaks | the check that failed |
|---|---|---|
| m1 | a clear that cost a defender still returns one | "a wave that cost a defender returned one" |
| m2 | men heal while they fight | "a man was healed while he fought" |
| m3 | `heldNow` counts returned defenders | "the resumed run" and "a clean wave" |
| m4 | `max: 1` removed | "one on a field: 2" |
| m5 | no stop at the starting count | "a return past the start: 21" |
| m6 | a wrecked post still cares | "a wrecked Aid Post still gives care" |

### 5. Minor: live.js's Aid Post check cannot see a return, and its cap is a literal

`live.js` plays three waves from full walls, so `returned` was 0 on all three battlefields in the reviewer's full run
(`four/live.txt`: Van `{"returned":0,"held":14,"lives":14}`). Its test, `a.lives !== a.held + a.returned || a.returned > 5`,
then only checks that `lives === held`. The 5 is Surgeons' cap written as a number.

Fix:
- Read the cap from the game: return `cap: getStats(t).restore` in the `aid` probe and test `a.returned > a.cap`.
- To make the line mean something, lower the walls by 2 before the first horn, as `playtest-aid.js` does, and require
  `returned >= 1` on at least one battlefield.

### 6. Minor: on a phone the card's required last line is below the fold

3.5 requires the card to say "The aid post as a tower is the game's invention." At 667 x 320 Van's card shows it faded
under the fold, and it needs a scroll (the builder's `shots/g7d/card-van-667x320.png`; the builder says the same).

Fix: on the phone, shorten the second paragraph. Drop "One on a field." (the refusal toast and the panel tell it), and
join "Returned defenders hold the walls. Stars count the defenders you never lost." into one line. Or put the invention
sentence before Van's history line, so the claim the house rules require is read first. Then check the photo again at
667 x 320.

### 7. Minor: README G7d says "mix7 still meets its bound", and it does not

README G7d says mix7 against mix "stand as G5 and G7c left them (mix7 still meets its bound)". G5's close says the
opposite, and it is one of the open cells: +0.82 on the mean, bound 1 to 3, MISSED; Van +9.3 and Musa Dagh +7.0, bound 5,
MISSED.

Evidence: `SEEDS=3 CLOCK=1 node tools/balance.js normal all mix,mix7` on cca4b15 and on eb0ae9e (the base page, `GAME=`).
The two tables are identical cell for cell on all 17 (`bot-mix7-head.log`, `bot-mix7-base.log`). The mean difference is
(169.5 - 155.5) / 17 = +0.82.

So the package moved nothing there, which is what the acceptance needs. The sentence is wrong, and the builder's report
repeats it.

Fix: write "mix7 against mix is unchanged, cell for cell (+0.82 on the mean, Van +9.3: G5's open cell, missed)".

### 8. Minor (not this package's): suite 1 is over its budget alone on the base page too

`tools/selftest.js --suite=1`, run alone at load 1.4 to 1.9:
- cca4b15: 126.0 s.
- eb0ae9e (base): 129.2 s.

Inside `--suite=all` at load 0.9: 129.5 s. All 151 checks pass in every run. The package adds no suite 1 check, and its
page is not slower than the base. But "suite 1 green" is no longer reachable on this machine for any package.

Fix (for the integrator or the owner): profile the slow checks the result lists ("victory, defeat, save on every field"
13 s, "chronicle pages" 8 s), or raise the budget by a ruling. Do not hold G7d for it.

### 9. Minor, for the owner: the bot's Aid Post rules differ from 5.4 and help the 5.2 row

These rules are documented and reasoned, but they shape the very row they measure:
- The pad is the Stores' pad (the least road), not 5.4's "nearest the fortress". There, "aid" lost 2.3 more on Normal
  Sardarapat.
- The post's ranks wait until every pad is built.
- Its mastery comes after every fighting tower.

A human player who ranks the post early is not modeled. The prices were also cut from 3.5's 110, 130, 210 and 320 to
60, 70, 110 and 220. That is within 5.3's knobs and stated in the 3.5 note.

Fix: none in the code. The owner should rule on 5.4's text: amend it to the Stores' pad and the late ranks, or keep it.
Record the ruling in RULINGS or the README.

## Documented differences checked and accepted (not counted)

- A post is "in range" when its pad or its rally point is. The hero's heroBack applies wherever he fell, never under
  5 s. Reasonable reads of a silent spec.
- No return after the last wave: the battle is won. Probe: last wave cleared with walls 3 short gives `returned 0`,
  `held 17`, `stars 3`.
- Art: a tent with a standing orderly (not seated), one stretcher at rank 1 and two from rank 2. 3.5 says two stretchers;
  this is near enough and stated. No red cross. The cloth is plain white.
- Text and history: Van's card sentence is Van's own fact in LEVELS (index.html line 5089, matching its story text at
  line 5079). "The game's invention" is said. Musa Dagh and Sardarapat make no claim (suite 2 checks it). No long dash,
  no British spelling in any added line. The commit message has no long dash.
- Read line by line, with no other bug found:
  - `aidWalkers` is reset in `resetGame`.
  - No listener is added.
  - `held` and the stars go through `heldNow()` in `saveBest`, `recordWin`, `star_gain`, the parley and the celebration.
    `battleFacts` keeps `lives = held + returned` after a lost stand.
  - `clean` reads `waveStart`, which `startWave` marks only from idle, so an early-sent wave cannot hide a loss.
  - The harness paths (`&aid`, `&al`, `&walker`, `&aidpanel`) work from file://.
  - Every place that branches on `def.income` has its `def.aid` branch (`statText`, `statDeltaHtml`, `statDps`,
    `foeCounters`, `serviceRecord`).
- Save: a run keeps the post and `battle.returned` (suite 2). A run whose tray lacks the post refuses one, and one saved
  before still resumes. The 8 fixtures resume.
- G5's open cells: the post moves none but Van's Council par-hold (builder: aid 17.0 against mix 16.7, +0.3). Not
  rerun by the reviewer.

## What the reviewer reran (on cca4b15, the other track testing alongside unless said)

- `node deploy/check-page.js index.html`: OK, exit 0.
- `node tools/run-fixtures.js check`: PASS, 8 fixtures, 0 fails.
- `node tools/town-isolation.js`: PASS, 9 cases.
- `timeout 900 node tools/selftest.js --suite=all` at load 0.9 to 1.9:
  - Suite 1: 151 checks pass, but FAIL on its budget at 129.5 s.
  - Suite 2: PASS, 54 checks, 93.0 s of 125.
- Suite 1 alone: 126.0 s (cca4b15) and 129.2 s (eb0ae9e), both over budget, every check passing (finding 8).
- Suite 2 on six mutant pages: all six FAIL on the intended aid check (finding 4).
- `node tools/regress/run-all.js --quick`: 10 of 11 PASS before the reviewer's 30 minute background limit stopped it in
  platform:
  - padplace 49 s, plots 45 s, probe 38 s, vic 220 s, nag 58 s, dance10 57 s, live 71 s, doors 39 s (1 known: the
    town's card), iphone 157 s, waves 155 s.
  - platform rerun alone (`--quick --only=platform`): PASS, 1049 s.
  - dance10 passed this time.
- `run-all.js --only=padplace,probe,iphone,live` in full (all 17 battlefields): 4/4 PASS in 1923 s.
  - padplace 616 s: 1265 placed, 60 refused.
  - probe 249 s: 787 probed, 68 rallies.
  - iphone 724 s: 787 states at 10 sizes.
  - live 333 s: 17 battlefields.
- The bot, `SEEDS=3 CLOCK=1`, mix, aid and mix7 on the three battlefields, all three difficulties: equal to the builder's
  tables (finding 1).
- `normal all mix,mix7` on cca4b15 and on eb0ae9e: identical (finding 7).
- Musa Dagh perturbation builds (finding 1).
- `probe-rules.js` (findings 2 and 3, the last wave).
- Photos on the final code: the Stretcher Bearers' panel and a walker at 1600 x 900 and 667 x 320. The panel fits the sheet
  at 667 x 320 with Sell inside. The builder's 54 photos were looked at: ranks 0 to 2, both masteries, the panels, the card
  and the tray.
- Playtest 8.4 (`tools/playtest-aid.js --verbose`): PASS in 587.7 s on the iPhone 15 (852 x 393), the iPad (1194 x 834)
  and the iPhone SE (667 x 320), every press a finger's.
  - The second post was refused with its sentence.
  - Walls 16 of 20 at the start. One came back after each of waves 1, 2 and 3, with the toast each time (3 of 3).
  - Then the cap of 3 at rank 2 held. Wave 6 cost 3 and none came back. End: lives 16, returned 3, held 13.
  - No man gained strength while he held a foe.
  - How it reads: the post is found and opened at once at all three sizes. The return is plain in the clear's toast. The
    walker is small but visible. On the SE the card needs a scroll (finding 6).
  - The playtest's start is staged, so it says nothing of balance.

## What could not be checked

- A person's hands on a real iPhone or iPad. The playtest is the scripted touch player (CDP touches), and it sets the
  walls 4 short and ranks the shooters by script.
- The Council's par-hold, endless and daily tables were not rerun. The builder's tables were read.
- The full `run-all.js` (34 minutes): only `--quick` and the four scripts above, as the acceptance asks.
