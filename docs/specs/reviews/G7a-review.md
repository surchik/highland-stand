# Review of G7a: the Horse Lines (`horse`)

Reviewer: an independent agent, on branch gp/work at f629103 (base 718b825, the merge of next after stage 3). The package's
code was not changed. Probes, mutants and logs are in the session scratchpad under `top/build/review/G7a/`, photos under
`top/build/shots/g7a-review/`.

REVIEW G7a: 0 blockers, 3 majors, 11 minors.

Nothing found breaks the game, an old save or a test. The charge plays as 3.2 says in every case probed: a sold tower's
riders stop, a foe the hero or a man holds is struck and not thrown, an elephant or a commander goes a quarter as far, a
stunned or wrecked tower does not set out, the 8 s rest holds, nothing is thrown behind its road's start, and the charge
is the same at a step of 0.05 s and of 0.2 s (the 4x speed). An Avarayr run saved by the base page resumes with its six
tiles. The builder's tables reproduce cell for cell. The majors are two balance rows of 5.2 that are missed (one
reported, one not marked as missed) and a suite 2 check set that does not fail when most of 3.2's rules are broken.

## Findings

### 1. Major: the Horse Lines are in no best build, and an early horse loses battles (5.2, reported by the builder)

Evidence: `SEEDS=3 CLOCK=1 JOBS=3 node tools/balance.js 1 erebuni,tushpa,avarayr` (all builds), rerun by the reviewer:
every cell of every build equals `docs/specs/balance/g7a-normal-seeds3.txt` (and Easy and Hard equal theirs). Best
builds: archers (Erebuni), mix7 (Tushpa, which builds no horse there), balldrum (Avarayr). 0 of 3; 5.2 asks for at least
a third. Two builds of the reviewer's own:
- `BUILD_mixh=archer,age,ballista,catapult,fire,age,archer,drums,ballista,catapult,archer,fire,ballista,drums,catapult,archer`
  (the mix with its two horses 2nd and 6th, the way a player who likes the new tile builds it): Normal Erebuni 0/3 w10c3,
  Tushpa 0/3 w10c1, Avarayr 3/3 11.0. On Hard it is the best build on Avarayr (3/3 4.0 against balldrum's 3.7), so on
  Hard the row is met once (1 of 3).
- `BUILD_mixh10` (the mix, then the horse 10th and 16th): 13.0, 12.7, 9.3, the mix's cells.
- Damage per 100 gold on Normal: horse 3,597 (archer 4,802, catapult 9,362); Lancers 2,782 and Harriers 506 in the
  CMD=probe run, Harriers 27 px thrown per 100 gold. The masteries are the weakest purchase in the game.
- In the reviewer's playtest (finding 14 and the list below) two horses at rank 3 on Avarayr charged 0 and 2 times in
  ten waves (1,599 damage for about 1,000 gold).

So the tower is a trap where it is built early and does nothing where it is built late. It never trivializes a battle
(the builds that must lose do lose; see the reruns).

Fix proposed: the owner rules on the row, with G5's cells. Before he does, one more tuning pass on 5.3's fourth knob that
the trials did not try: the reach (rank 1 150 to 180, so that more pads reach live road just past a kill zone) together
with `HORSE_RULES.crowd` 2, then `BUILD_mixh` and the table again at SEEDS=3 on the three. If Erebuni's commander pair
still falls to mixh, the price of rank 1 (`g-cheap` tried 80 with the old charge rule; try it again with the crowd rule).

### 2. Major: the endless stand's row of 5.2 is missed and the README does not say so

Evidence: `docs/specs/balance/g7a-endless-normal-seeds3.txt`. 5.2: "on three battlefields a mix7 board and a harriers
board fall between waves 8 and 20 beyond the chronicle". mix7 falls 0 to 3 beyond on Erebuni and Avarayr (below 8) and
holds all 20 on Tushpa on every seed (the stand is endless there); harriers never reach the stand. README G7a lists the
best-build row as "NOT met" and describes this one without the words, so the stage's status page would carry only the
first. The builder's `f-null` trial shows it is G5's board, not the horse.

Fix proposed: README G7a and the build note under 3.2 say "NOT met" for this row too, with the cause (G5's mix7 board,
the horse changes nothing), and it goes to the owner beside G5's cells. No tuning in G7a.

### 3. Major: suite 2's horse checks do not fail when most of 3.2 is broken

Evidence: mutants of the page, each run through suite 2's horse, tray, post, ruleset and privacy checks
(`review/G7a/mutants.py`, `mutants.txt`):

| Mutant | Suite 2 |
|---|---|
| a foe the hero holds is thrown (`horseHeld` without the hero) | PASS (not caught) |
| a war elephant (`ram`) thrown the full push | PASS (not caught) |
| a stunned tower charges | PASS (not caught) |
| the horse's card never comes (`newTowerCardDue` returns "") | PASS (not caught) |
| the charge's damage is not booked to `adapt.other` | PASS (not caught) |
| a pad with no road in reach takes the horse (`placeTower`) | PASS (not caught; the first check's comment says it is tested) |
| a hunter off the road is struck (`e.off` dropped) | PASS (not caught) |
| an unseen scout is struck (`foeUnseen` dropped) | PASS (not caught) |
| a cloned tile's portrait is left blank (`eraLabelsDrawn` reset dropped) | PASS (not caught) |
| the limit of two at placement removed | FAIL (caught) |
| `validRun` without the limit | FAIL (caught) |

The card check calls `showUnlockCard("horse")` itself, so it proves only that the card exists; the harness's
`postCardDue` is false under `HARNESS_ON`, so the order (post first, then horse) is never tested. The reviewer's
`cardprobe.js` shows it does work in a page without the harness (1600 x 900 and 667 x 320: horse alone; post, then horse
after "Got it").

Fix proposed, in the charge check after the commander's lines:
- the hero: `hero.alive = true; const hp = enemyPos(h); hero.x = hp.x; hero.y = hp.y; hero.rally = null;` on a fresh
  foe `h`, then a charge: `h` struck and `h.dist` unchanged;
- an elephant: `foe("ram", 0.6)` thrown `st.push * HORSE_RULES.heavy`;
- `t.stunnedT = 5; t.cd = 0; run(1)`: no new charge;
- `adapt.acc.other` grows by the damage of a charge on foot soldiers;
- a hunter with `off = true` and a scout with `hid = true` unseen on the stretch: untouched;
- in the first check: a pad with no road in the horse's reach (Avarayr has none; Tushpa's pads 1, 8, 9 and 13 and
  Erebuni's pad 12 have none at 150) refuses it with "No road in reach of this pad.";
- in the card check: with `HARNESS_ON` held false for the line, `newTowerCardDue()` is "post" with `hs_towers_seen` empty
  and "horse" with `["post"]` on Avarayr's brief;
- the tray check: after `trayCard("horse")`, `eraLabelsDrawn === -1`.

### 4. Minor: the tile does not dim at the limit (3.7)

Evidence: 3.7: "`placeTower` refuses the next one with that kind's sentence, and its tile dims". `syncHud` (index.html
13799 to 13801) toggles only `poor` by gold. The reviewer's playtest on the iPhone 15 size: with two horses built the
tile's class is `card` (no state). A third press is refused with the sentence (correct), but the tile looks buyable.

Fix proposed: in that loop, `const capped = TOWER_DEFS[c.dataset.type].max && towers.filter(t => t.type === c.dataset.type).length >= TOWER_DEFS[c.dataset.type].max;`
and `c.classList.toggle("poor", capped || towerCost(...) > gold)` (or a class of its own with the same look).

### 5. Minor: an unseen scout on the stretch is not struck, which 3.2 does not say

Evidence: `horseStrikable` (index.html 13066) skips `foeUnseen(e)`. Probe `PROBE hidden scout unseen`: a hidden spearman on
the stretch, unseen before the charge, is not struck. 3.2: "Each ground foe on that stretch takes dmg once". The Powder
Mine's text (3.4) says a hand-fired blast hits an unseen scout. Riders sweeping the road would ride into him. The
builder's report names the rule ("unseen scouts ... are untouched") but not as a difference from the spec.

Fix proposed: strike him (and reveal him, as `damageEnemy` already does), counting him for the crowd rule only when seen;
or keep the rule and add it to the G7a note under 3.2 and the README.

### 6. Minor: the card says "siege engines" on the one battlefield where the engines are war elephants

Evidence: the card shows first on Avarayr's brief, where the `ram` role is "War Elephant" (index.html 9813); its line
"Siege engines and commanders barely move" never names the elephants, which are what the player meets there. The foe
card's line "a charge strikes the whole group and throws it back" (index.html 58164) says more than the charge does (the
foes on its stretch of road).

Fix proposed: "Elephants, siege engines and commanders barely move" (or the era's role name for `ram`), and "a charge
strikes every foe on its road and throws it back".

### 7. Minor: riders already out keep striking after their lines are wrecked

Evidence: probe `PROBE wrecked mid-ride`: `t.wreck = true` 0.1 s into a charge; a foe further down the stretch is still
struck. The block that moves the ride runs before the wreck test in `horseTick`. Defensible ("the riders cannot be hurt"),
but the panel and the card say nothing, and a sold tower's riders do stop.

Fix proposed: keep it and say so in the comment over `horseTick`, or end `t.ride` when the tower is wrecked.

### 8. Minor: the Captains' fourth and fifth tiers are live now, and their line names "the special tower" everywhere

Evidence: `tierLine` (index.html 10889) shows the full line as soon as any special tower exists, so from G7a on the
Council reads "Men return 7.5% sooner; the special tower costs 5% less" for every player, though 14 battlefields have no
special tower yet and 3.1 never names the groups ("he sees a new tower"). `towerCost` and `specCost` now take the 5% and
7.5% off the horse. The Council's par-hold tables were not rerun (the builder says so); KITSET's pin did not move because
the table did not change, but what the tiers do on three battlefields did.

Fix proposed: `KIT=par HERO=hold SEEDS=3 node tools/balance.js 1 erebuni,tushpa,avarayr mix7` against `KIT=none` to show
the bound of 2.3 still holds there; the line "the new tower of a battlefield costs 5% less" until every age has one.

### 9. Minor: a daily player meets the horse with no card

Evidence: a daily's tray is `trayStandard` (index.html 10624): the horse is in it on Erebuni, Tushpa and Avarayr for
everyone, but `postCardDue` asks `towerUnlocked("horse")`, which is false until Avarayr is open (probe: `wonTo(0)`,
`towerUnlocked("horse")` false). The same holds for the post since G5.

Fix proposed: in `postCardDue`, `(towerUnlocked(what) || dailyRun) && trayTypes().includes(what)`.

### 10. Minor: live.js records the horse's charges but never fails on none

Evidence: tools/regress/live.js: `horse = { charges, dmg, thrown }` is put in the result only. A Horse Lines that never
charges (a broken `horseTick`) passes live.js.

Fix proposed: fail when no Horse Lines charged on any of the three battlefields in their three waves (one is enough
across the three, so a pad near the walls does not make it flaky).

### 11. Minor: the panel's last row stands its icon alone on a line on the phone

Evidence: `shots/g7a/panel-avarayr-harriers-667x320.png` and `shots/g7a-review/play-panel-852.png`: the "wing" icon
sits on a line of its own and "Thrown once in 8s. Outflankers untouched." wraps under it. (At 1600 x 900 the row is one
line.)

Fix proposed: drop the icon on that row (`statRow("", ...)`), or keep the icon inline with `white-space: normal` on the
text span only.

### 12. Minor: the phone tile's line is placed only when a tile is chosen, not on a turn or a resize

Evidence: `placeCardTip` is called from `setPlacing` only (index.html 64592). With a tile chosen, turning the phone or a
Home Screen resize keeps the old `translate`. Not seen in a photo; read in the code.

Fix proposed: call `placeCardTip(document.querySelector("#shop .card.selected"))` from the window's resize handler that
already lays out the tray.

### 13. Minor: mix7's order moved for every battlefield, and the next packages inherit it

Evidence: tools/balance.js mix7: "age" 15th, not 12th. 5.4 says mix7 is "the mix with the post and the special tower in
its order"; G7b to G7e will measure their towers 15th of 17, where some battlefields' boards are already full.

Fix proposed: none for G7a; name it in the stage's status so that G7b to G7e read their mix7 rows knowing the slot, and
let a package move "age" for its own battlefields only (a per-battlefield order) if its tower needs it.

### 14. Minor: the playtest's horse feels idle on the pads that look best

Evidence: the reviewer's playtest on Avarayr (below): two horses on the two free pads with the most road (the placement
preview lights that road). Pad 9 reaches road 3,200 to 3,530 of 4,020 (the last stretch before the walls): at rank 3 it
never charged in ten waves, because the crowd rule waits for three foes or one past the middle and the shooters kill
everything first. Pad 13 charged twice. The builder's own playtest saw the same ("the upgraded one ... never charged").
3.2 says the best place is "just past a kill zone, to throw foes back into it", and nothing in the game tells the player.

Fix proposed: the tile's line (`SLOT_BLURB.horse`) adds "Best just past your strongest towers." and the card's second
sentence the same; consider charging at one foe once the reload has waited a full `cd` more (a lines that never rides
looks broken).

## What the reviewer ran (each to its end)

- `node deploy/check-page.js index.html`: OK (1 inline script parse).
- `timeout 900 node tools/selftest.js --suite=all` (load about 5, the other track running): suite 1 151 checks all
  passing but 128.9 s against 125 (a load failure); suite 2 PASS, 43 checks, 80.7 s.
- `timeout 900 node tools/selftest.js --suite=1` alone (load 2 to 3): PASS, 151 checks, 116.0 s.
- `node tools/run-fixtures.js check`: PASS, 8 fixtures.
- `node tools/town-isolation.js`: PASS, 9 cases.
- `node tools/regress/run-all.js --quick` (load 6 to 7, the other track running): 11/11 PASS in 1,826 s (dance10 passed
  on this run).
- `node tools/regress/run-all.js --only=padplace,probe,iphone,live` in full: 4/4 PASS in 1,736 s (padplace 1,265 placed,
  41 refused; probe 759 probed, 54 rallies; iphone 747 states at all ten sizes, 0 failures; live all 17, Tushpa's horse 2
  charges, 840 damage).
- `node tools/ruleset.js`: every pin as the page carries it; `--json` byte for byte `docs/specs/balance/ruleset-2.json`.
- Balance, `SEEDS=3 CLOCK=1 JOBS=3`, Erebuni, Tushpa and Avarayr, every build plus `mixh` and `mixh10`, on Normal, Easy
  and Hard: every shared cell equals the builder's three tables. agemix and harriers lose every seed on all three
  difficulties (met). mix7 keeps no battlefield more than 5 above mix (Tushpa +4.6: met). `CMD=probe` on mix, mix7,
  agemix, harriers and mixh: agemix deals the first commander 0.29 to 0.47 of his strength, harriers never reach him;
  mixh fells the first (1.16 to 1.24) and on Erebuni and Avarayr leaves the pair short (0.84, 0.81).
- Probes in a copy of the page with a check filter (`review/G7a/probe-checks.js`): sold mid-charge (the riders stop),
  the hero's hold (struck, not thrown), an elephant (thrown 10 of 40), an unseen scout (untouched, finding 5), a stunned
  tower (no charge), `adapt.other` (414 booked), dt 0.05 against 0.2 (the same strikes and throws on seven foes), a
  single foe at the stretch's far end (no charge: the crowd rule), a resumed run (the horse back, its reload 0), a
  wrecked tower mid-charge (finding 7).
- Mutants (finding 3).
- `cardprobe.js`, no harness, 1600 x 900 and 667 x 320 by touch: the horse's card alone when the post was seen; the post's,
  then the horse's after "Got it", when neither was.
- `oldrun.js`: a run on Avarayr saved by the base page (718b825) in its fourth wave: `validRun` true, resumed on Avarayr
  with its six tiles and no horse tile, no page error.
- Playtest 8.4 item 3 by finger (`review/G7a/play.js`), Avarayr on Normal, at the iPhone 15 from the Home Screen
  (852 x 393, the iPhone's user agent) and the iPad (1194 x 834). Every press a finger's: the tiles, two taps a pad, a tap
  on a tower, Upgrade, Send Wave, the speed button, Auto, each trick card's button. Test gold of 1,400 at the start, then
  the game's own gold; every rank bought by a tap on the tower and Upgrade (18 upgrades), none by script. Seven shooters
  and drums, then two Horse Lines on the free pads with the most road, then ten waves at 2x. Both sizes: held ten waves
  with 4 of 20 left, no page error. The tiles are 115 x 52 (phone) and 112 x 82 (iPad); the horse tile's line stands
  clear of the wave column at 852 px (its box 496 to 692, the column 709 to 841); the horse's panel opened by a tap on
  it, its buttons 218 x 55 and 218 x 44 on the phone. On the iPad the panel's second button (Undo or Sell) is 36 px high,
  as it is for an archer (Target 32, Sell 36): the iPad panel's sizes are older than G7a and not counted here. The horses
  charged 0 and 2 times (finding 14). How it felt: the build and the panel are easy by finger, the card reads well, the
  riders look right when they go (the builder's photos `shots/g7a/age-*`), but over ten waves they were hardly seen, and
  a player would think the tower broken on the pad near the walls.

## What the reviewer could not check

- A real iPhone or iPad, Safari, or sound on a device.
- The Council's par-hold with the horse's discount (finding 8): not run (two more battles per cell on three
  battlefields at three seeds; left for the fix).
- Daily (`DAILY=1`) and endless (`ENDLESS=20`) tables: read from the builder's files, not rerun.
