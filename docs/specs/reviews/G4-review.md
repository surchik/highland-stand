# G4 review: the script map and the 17 lengths, retuned

Reviewer: an independent agent. Package: gameplay G4, commit 1e720bb on gp/work (one commit on G3's a3163de; index.html
sha256 94cc322d15bc4fbf). Read: gameplay.final.md 0.2, 0.3, 1, 5, 6.1 to 6.3, 8.1 to 8.4, 9.1; RULINGS whole; the
G1, G2 and G3 reviews; the whole diff (index.html 843 lines, the tools, the tables). Probes and their outputs are in
the review's scratch folder (`.../scratchpad/top/build/review/G4/`): probe1.js (the map on every battlefield),
probe2.js (runs saved by master's page resumed on G4), mutants.js (one change at a time, then the suites), bot/.

REVIEW G4: 1 blocker, 4 majors, 7 minors.

## Findings

### 1. Blocker. A 20-wave run saved before G4 does not finish under its old rules: it is fought with G4's retuned numbers

Spec 1.7: "A run in hs_run carries what it was begun with, and resumes with exactly that, whatever the page has
become since." The acceptance asks that a run saved on master "resumes and finishes under its old rules".

What `resumeRun` restores for a run without `script` (index.html, resumeRun): the 20-step table, the kit (none), and
`trickLegacy` for a run from before the tricks. Everything G4 retuned is read from the live `LEVELS` and `LEVEL_HP`:
`hpTune`, Erebuni's `hpFrom` (1.65 to 1.9 on Normal), its outflankers (`hpMult` 1.3 to 1.8), its scouts (`from`
[8,6,6] to [8,7,7], `n` [2,4] to [3,3]), every `econ` (Erebuni .5 to .38, Tushpa .58 to .45, Avarayr .75 to .7, Dvin and
Halidzor new, Sevan), Avarayr's ambush share, the commanders of Mari, Musa Dagh and Stepanakert 2023. So the old run
is a 20-wave battle with today's harder numbers and without pay ahead.

Evidence:
- probe2.js: a run made by master's page and resumed on G4, every foe felled as it comes, against master playing the
  same run on: Erebuni (Hard) wave 6 brings 25 foes on G4 and 28 on master (the scouts' count), and the gold differs
  from the first wave on Erebuni and Avarayr (econ). Mari and Van, whose spoils did not change, match wave for wave in
  gold and foes (their hit points differ; the probe does not compare those).
- The bot, Normal, SEEDS=1, WAIT=0, with every battle forced onto the 20-step table (exactly what a resumed old run
  is): `PATCH='(function(){var r=resetGame;resetGame=function(){r.apply(this,arguments);setRunScript(SCRIPT_TABLES[20]);};})()'`
  against master's own table (docs/specs/balance/g1-base-normal-seeds1.txt):

  | battlefield | master: mix, best | an old run on G4: mix, best |
  |---|---|---|
  | Erebuni | W 13, W 17 archers | L 19, every build lost |
  | Tushpa | W 16, W 16 mix | L 7, every build lost |
  | Avarayr | W 14, W 16 firemix | W 2, W 11 balldrum |
  | Dvin | W 12, W 13 archdrum | W 7, W 7 mix |
  | Sevan | W 13, W 13 | W 10, W 10 |
  | Tashir (unchanged) | W 12, W 16 | W 12, W 16 (equal) |

  A player who had an Erebuni or Tushpa run in progress on the day G4 ships resumes into a battle no build of the
  bot wins.
- Why the tests did not see it: the six fixtures of tools/run-fixtures.js are all Erebuni saved at wave 3, where script
  wave 4 is played wave 4 on both tables; the check then stages the last wave and kills every foe. Suite 2's old-saves
  check compares the composition (`waveGroups(19)` against `scriptGroups(19)`) and the pay step, never hit points,
  spoils or trick counts.

Fix: keep ruleset 1's battlefield numbers beside the new ones and fight a run saved under ruleset 1 with them.
- A table `RULES1_TUNE` keyed by battlefield with the values G4 replaced (hpTune, hpFrom, `units.flyer.hpMult`,
  `tricks.hidden` from and n, `tricks.econ`, `tricks.ambush.share`, the `LEVEL_HP` commander column), taken from
  a3163de. `resumeRun` applies it when `!Array.isArray(r.script)` (a run begun before the lengths), through one
  function the read sites already pass through (`levelHpMult`, `levelHpFrom`, `trickCfg`, `trickEcon`, the flyer's
  `hpMult` in `foeHp`), and `resetGame` drops it. Nothing in `rulesetData()` reads it, so no pin moves.
- A suite 2 check that holds it: a run saved by master on Tushpa at wave 12 (a fixture made on master, as COACHED's
  numbers were) resumes on G4, and for every wave 13 to 20 the queue, a foe's hit points and bounty of each kind, and
  the gold after the wave (foes felled as they come) equal master's.
- run-fixtures: add one master fixture on a battlefield whose numbers changed and that is saved late (Tushpa, wave 12,
  between waves, and Avarayr in the middle of wave 11), fought for three waves through the page's loop before the
  staged end.

### 2. Major. Playtest 1 fails: the coached newcomer loses Erebuni, the first battle of the game

8.4 playtest 1 belongs to G4. Rerun here (`NODE_PATH=$(npm root -g) node tools/playtest-lengths.js --only=1`, 667 x 320,
touch, iPhone UA): RESULT FAIL, "Erebuni was lost: 9/10", 17.8 min on the battle clock, 166 presses, 14 towers all at
rank 3, no mastery, 34 gold left. The builder's two runs read the same. The coach plays as written (16 steps, ten
waves, at most two new kinds a wave: 4 shields, 5 horse and rams, 6 scouts and outflankers, 7 commander).

How it felt: too hard, at the end. The walls fall on wave 9, which stands for script waves 14 to 16 (wave 8 for 11 to
13), with Erebuni's late `hpFrom` now 1.9 and its outflankers 1.8: a full board of rank 3 towers without a mastery
cannot hold it. The
G3 page with the same finger also lost (wave 18 of 20), so the newcomer's trouble is older than G4, but G4's retune made
Erebuni's late waves harder still (the owner's band asks the best build to lose 4 to 8, and it does: mix 13, 14, 13).
The band and a first battle a newcomer can win pull against each other on the one battlefield that is both.

Fix (the owner's call; I recommend the first): the coached stand is never ranked (RULINGS S2), so make it gentler
without touching Erebuni's Standard numbers: while `tutGentle`, waves 4 to 10 take `tutorialHp`'s idea further (for
example foes at 0.8 times their strength, Erebuni's Easy `hpFrom` and spoils). Rerun playtest 1 until the finger wins
with 5 to 12 defenders kept, under 25 minutes. Or the owner accepts that the first battle is lost by a careful
newcomer who never masters a tower, and 8.4's line is changed.

### 3. Major. The kit's bound of 5.2 breaks at the new lengths, and the gate the G2 and G3 reviews set for G4 was not run

The G2 review (finding 2) and the README's G2 and G3 sections made `KIT=par` and `KIT=cap` on all 17 at SEEDS=3, with
`HERO=off` and `HERO=hold`, a gate of G4's tables. The builder lists it under "not done". A sample, Normal, SEEDS=3,
`HERO=hold` (bot/kit-*.txt):
`NODE_PATH=$(npm root -g) JOBS=4 SEEDS=3 CLOCK=1 JSON=1 KIT=<none|par|cap> HERO=hold node tools/balance.js 1 erebuni,avarayr,ani,sis,van,sardarapat,stepanakert23`

| best build kept | Erebuni | Avarayr | Ani | Sis | Van | Sardarapat | Stepanakert 2023 | mean |
|---|---|---|---|---|---|---|---|---|
| none | 13.3 | 13.7 | 13.3 | 11.3 | 13.7 | 12.3 | 13.0 | |
| par | 13.3 | 16.0 | 15.3 | 15.0 | 20.0 | 18.7 | 15.3 | |
| par minus none | 0 | +2.3 | +2.0 | +3.7 | +6.3 | +6.4 | +2.3 | +3.29 |

`KIT=cap` gives the same cells. The bound is a mean of at most 2 (PAR) over the 17 and no battlefield above 6: Van
and Sardarapat break the second outright, and the sample's mean is 3.29 (its first battlefields carry little kit, so
the 17's mean will be lower, but not near 2 with these later cells). With the par kit the mix keeps all 20 on Van.
Pay ahead may add to it on the short battlefields (the Stewards' interest cap is paid `payStep` times), which the
sample does not separate.

Fix: run the gate in full (all 17, SEEDS=3, `KIT=none|par|cap`, `HERO=off` and `hold`) and cut the Council's numbers or
the hero's, never a battlefield, until PAR is at most 2 and CAP at most 4 on the mean and no cell passes 6; a new
KITSET and its pin. Cutting the Council is the owner's call (G3 review, finding 1). No Open board before it holds.

### 4. Major. The bands of 5.1 are not met on all three difficulties

The acceptance asks for the bands on all three difficulties at SEEDS=3. My rerun of seven battlefields on each
difficulty reproduces the committed tables cell for cell (so the misses below are real, not noise of a run):
- Normal, the first six: Dvin's best build keeps 13, 19, 11 and Sevan's 16, 15, 9 (band 12 to 16 on every seed).
- Easy, the first six: the mix keeps 26 to 30 on Erebuni, Tushpa, Avarayr, Dvin and Tashir ("about 22 to 27").
- Hard: the best build keeps more than 8 of 14 on Gyumri (11, 11, 11), Avarayr (9), Dvin (10), Sevan (10), Halidzor
  (9) and Van (9).
The rest holds: the mix wins every seed on Easy and on Normal's first six; on the later eleven the band holds on two of
three seeds and the mix wins two of three on 10 of 11; on Hard the best build wins two of three on all 17;
"ballista" and "archers" lose 18 and 16 of 18 on Normal's first six; the adaptive enemy adapts on 16% of the mix's
waves and 99 to 100% of the one-tower builds'; wave time on Normal is within 15% of 1.2 on all 17 (Tushpa +12% is
the furthest; the report says +11%).

Fix, in 5.3's order, each confirmed at SEEDS=3 on all three difficulties of the battlefield touched:
- Hard: Gyumri `hpTune` Hard 1 to about 1.12; Dvin a Hard `econ` bounty about 0.92; Sevan `hpTune` Hard 1.08 to about
  1.12; Avarayr and Halidzor their Hard spoils by 0.05.
- Easy: thinner Easy spoils on the first five (Erebuni `econ` Easy 0.4 to about 0.3, Tushpa 0.5 to about 0.42, Dvin 1 to
  about 0.88, a Tashir Easy `econ` about 0.88), then playtest 5 again: the family must still win all six (Avarayr's
  Easy spoils went back to .75 for that reason, so leave Avarayr's).
- Normal: Dvin's and Sevan's cliffs (one seed each) are spoils cliffs by the builder's own notes; move a trick instead
  (Dvin's ladder parties' or hunters' `n`, Sevan's hill track's `share`), or record the one seed as the owner's
  accepted miss.
- If the owner accepts "about" for Easy and these Hard cells, write that into 5.1 and README's G4 section in those
  words; today the README calls it done.

### 5. Major. The core rule "a played wave is as strong as the script wave it stands for" is held by no check

Mutation runs (mutants.js: one replacement in a copy of the page, then `node tools/selftest.js --suite=2`, and
`--suite=1` for the survivors):
- `foeHp` with `commanderClimb(w)` / `hpScale(w)` (played wave) instead of `s`: survives suite 1, suite 2 and the pins.
- `levelHpFrom(type, w)` instead of `s`: survives both suites.
- `levelPhase` comparing the played wave with `q.from`: survives both suites (Ani's phases and their roads).
- `showBrief` without `runScript = null` (a resumed old run's 20 leaking into the next chronicle's line and notes):
  survives both suites.
- The cap of a lost stand's `hs_best` at 20 removed: survives both.
Killed, as they should be: the five pins (a number in hpTune, a par, a table, a spoils, a commander column), the pay
mutants (interest, early call, bounty; the mend by suite 1), the commander's outflankers, the resume ignoring `script`,
`validRun` without `scriptOk`, the records' fallback, the scouts by covered waves, Avarayr's ambush on the
commander's wave, the hero's experience, the facts' `script`, Mari's road by script wave (suite 1).
The COACHED check covers waves 1 to 3 only, where a played wave is its script wave; waves.js plays with test gold and
refilled walls. So a regression that made every short battle easier or harder by a third would pass every test.

Fix: in suite 2's waves check, on Tushpa (12) and Erebuni (10), for every played wave w and every role in it,
`foeHp(role, u, w)` equals the same call made with the 20-step table at `scriptWave(w)` (`setRunScript(SCRIPT_TABLES[20])`,
then put the table back), and the same for `levelPhase(w)` on Ani (`levelPhase` with the 20-step table at
`scriptWave(w)`). In the old-saves check, after `resumeRun()` of the old run, `showBrief()` on Tushpa must read
"12 waves." And one line: a lost stand at wave 25 of an endless-free battle never writes above 20 (or drop the cap,
which nothing needs).

### 6. Minor. Suite 1's "an ambush does not meet a commander wave" still tests script waves against a played tell

index.html 80846 to 80853: `f % 10 === 0 || (f - t) % 10 === 0`, with `f` the data's script wave and `t` the tell in
played waves. 8.1 asks for `isCommanderWave(playedWave(f))`. It passes today by luck of the numbers and would pass a
table that put Avarayr's road on its commander's wave (suite 2's own check catches that: mutant avarayr-amb-cmd).
Two comments in the same suite are stale: "Mari's other road: told on wave 10" (it is `playedWave(11) - 2`, wave 6).
Fix: for each difficulty, `stage` the battlefield, then `A = trickCfg("ambush")` and test
`isCommanderWave(A.from) || isCommanderWave(A.from - byDiff(A.tell))`; update the two comments.

### 7. Minor. On a phone held sideways the new length line pushes the trick chip out of sight on the chronicle

`node tools/shot.js "shot=brief&lv=0" out.png 667 320` on G3 (a3163de) shows "Hidden scouts from wave 6" under the host;
on G4 the "10 waves. A commander leads wave 7 and wave 10." line takes its place and the chip sits in the left
column's bottom fade (review/G4/shots/g3-erebuni-brief-667.png, g4-erebuni-brief-667.png; the builder noted it).
iphone.js passes because the chip is inside its scroll box. The trick chip is the chronicle's one warning of the
battlefield's trick. Fix: under PHONE_MQ show the length in the brief's date line ("782 BC · Assyrian Invasion · 10
waves") and hide `#briefLen`, or drop its commander clause there, so the chip comes back into view.

### 8. Minor. "A commander leads wave 8 and wave 14" where the strongest foe is a rocket battery, a drone strike or a column

On Stepanakert 1992 ("BM-21 Grad battery"), Shushi ("Harop strike wave") and Stepanakert 2023 ("Blockade column") the
chronicle's line and the debrief tip (`briefLenHtml`, `commanderTip`) call it a commander. The old tip said "Every tenth
wave is led by one" of "the strongest foe", which was true everywhere. Fix: in the drone war (`droneWar()`) and on
Stepanakert 1992 say "The strongest foe comes on wave 8 and wave 14." (or name `eraUnit("boss").name`); keep the spec's
wording elsewhere.

### 9. Minor. The bands file is stale for Avarayr on Easy

docs/specs/balance/g4-after-bands.txt reads Avarayr Easy "mix 3/3 29 26 28", from the spoils of .65. The page has .75:
g4-after-easy-avarayr-seeds3.txt and my rerun read 29.7 (30, 30, 29). Fix: regenerate the bands file with Avarayr's
Easy JSON lines from the .75 run.

### 10. Minor. waves.js is 33 minutes, not "about 10", and close to its limit

The builder measured 1,964 s; run-all gives it 2,400 s. 8.2 says about 10 minutes in full. Under the shared machine's
load it will time out before it fails on substance. Fix: kill each wave's foes as they come on (the script checks the
count, not the balance; `--quick` stays a real fight on Erebuni, Avarayr and Mari), or raise the limit to 3,600 s and
say why in run-all's comment. (My run-all time for it is in the list below.)

### 11. Minor. Two measures of 5.1 and 5.6 owed by G4 are missing

The endless stand's first ten waves on three battlefields (5.6 G4; 5.2: a board falls between waves 8 and 20 beyond the
chronicle) and the 75% one-trick toll cap cell by cell (5.1). The bot has no endless mode. Fix: `ENDLESS=n` in
tools/balance.js (after the victory, `endless = true` and play on n waves, reporting `beyond` at the fall) on Erebuni,
Ani and Sardarapat with the mix, and the toll table per trick from the JSON lines (`toll`); both into README's G4 section.

### 12. Minor. tools/platform/p0.js reads TOTAL_WAVES, which G4 removed

tools/platform/p0.js lines 717 and 824 (pf: 718 and 825) set `waveIdx = TOTAL_WAVES`, a ReferenceError on any page from
G4 on. It is the platform's file (RULINGS S7), named here so the integrator fixes it when gp is merged: replace with
`(typeof totalWaves === "function" ? totalWaves() : TOTAL_WAVES)`. Not run here.

## What differs from the spec, accepted as built

- The "· 12 waves" is in the map's subtitle, not on the chosen plate; the map's endless mark is "∞ +N", the ribbon
  "held N waves beyond the chronicle". Fine: the plate's fit and its suite 1 check are kept.
- Pars per difficulty, `LEVEL_REV` 2 everywhere (the shared pay rule changed): as 6.3 asks.
- The bot waits the 4 s in the battle (`WAIT`, default with `CLOCK=1`), G1 review finding 5. `WAIT=0` reproduces the old
  bot: confirmed below.
- Suite 1 edits beyond 8.1's list (playedWave for staged waves, the new texts): each is a 20-wave number or an old text,
  no check removed except "the constant is 20", which became "the endless defeat page names no twenty". The free-mend
  check now multiplies by `payStep`. 151 checks, 97.5 s.
- Suite 2's G1 check of the quickest battle now accepts earned at 0.4 of `earnMax` (was 0.5), because `earnMax` counts
  the interest and the early call at their caps `payStep` times. Reasonable.

## What I reran, with results

- `node deploy/check-page.js index.html`: OK (1 inline script parse).
- `timeout 900 node tools/selftest.js --suite=all` (load 1.5): suite 1 PASS, 151 checks, 97.5 s of 125; suite 2 PASS,
  29 checks, 27.5 s of 125.
- probe1.js, every battlefield, difficulty, campaign and daily table: commander waves equal 1.2 on all 17; no ambush
  opens or is first told on a commander's wave (Mari's legacy road excepted); a commander's wave brings outflankers
  only in the drone war and on Ani's last wave (its raiders); the first waves of 1.3's table on Normal hold;
  Erebuni's waves bring at most two new kinds (4 shields; 5 horse, rams; 6 scouts, outflankers; 7 commander);
  coveredWaves and paidWaves split 1 to 20 on every table; Erebuni's wave 9 pays for four script waves.
- Before retuning, Sis and Sardarapat, Normal, SEEDS=1, WAIT=0, master (f905f4a) against the WIP page dba52cc (the
  lengths before any number moved): the tables are equal; battle for battle every field both pages keep is equal (the
  only differences are counters master lacks: `earned` and `spent` null, `heroFalls`, and `sec` by 1 s on one battle).
- The bot at SEEDS=3, CLOCK=1, JSON=1 on Erebuni, Avarayr, Ani, Sis, Van, Sardarapat and Stepanakert 2023, on Easy,
  Normal and Hard: every row equals the committed g4-after tables cell for cell (Avarayr Easy equals
  g4-after-easy-avarayr-seeds3.txt). Bands: finding 4.
- The kit sample (finding 3) and the old-run sample (finding 1).
- Mutation runs: 23 mutants on suite 2, 8 survivors on suite 1 (finding 5).
- `node tools/run-fixtures.js check`: PASS, 6 fixtures (base, master, g3; between and mid-wave), each 20 waves,
  legacy, won with 21 written. See finding 1 for what it does not test.
- `node tools/town-isolation.js`: PASS, 9 cases.
- `node tools/playtest-lengths.js --only=1`: FAIL (finding 2).
RUNALL_AND_PT5

## What I could not check

- A person's play, Safari, a real iPhone or iPad.
- The kit gate on all 17 and with `HERO=off` (finding 3 is a sample of seven with `HERO=hold`).
- tools/platform/p0.js on this branch (the platform's file; finding 12).
- The 75% toll cap and the endless stand (finding 11): not measured by me either.
