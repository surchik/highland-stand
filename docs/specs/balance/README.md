# Balance tables

The bot's tables that a package's numbers were set from (gameplay.final.md 5.6 and 8.3). One cause at a time:
each package adds its own files and never rewrites an older package's.

## G1: the baseline, and the pars of ruleset 1

G1 changes no rule. Its tables show that, and give the clock the later packages are measured against.

| file | what it is |
| --- | --- |
| `g1-base-normal-seeds1.txt` | The bot on the page before G1 (branch `next` at 3714b0d): Normal, one seed, all 17 battlefields, 7 builds, 119 battles. |
| `g1-normal-seeds1.txt` | The same run on the page with G1, with the clock (`CLOCK=1`). Its table equals the base's cell for cell, and its 119 battles equal the base's battle for battle (won, defenders, wave, towers, leaks, commanders, damage by tower, the tricks' toll, each wave's trace). |
| `ruleset-1.json` | `rulesetData()` of the page with G1, as JSON (`node tools/ruleset.js --json`, indented for reading). `RULESET_PIN` in `index.html` is the hash of its compact form, as `JSON.stringify` writes it; `node tools/ruleset.js` checks the page against its pins. |

How they were made, on the build machine (4 cores):

```
cd /home/user/hs-wt/next && NODE_PATH=$(npm root -g) SEEDS=1 node tools/balance.js 1          # the base
cd /home/user/hs-wt/gp   && NODE_PATH=$(npm root -g) CLOCK=1 SEEDS=1 node tools/balance.js 1  # with G1
NODE_PATH=$(npm root -g) node tools/ruleset.js --json > docs/specs/balance/ruleset-1.json
```

Both runs were also taken with `JSON=1` and compared battle for battle; the JSON lines are not kept here.

### The clock

The battle clock is the game's own (`battleFacts().sec`): game seconds from the first wave's horn to the last
foe's fall. Waiting between waves counts, pauses do not, and the speed button does not change it.

The bot sends each wave the moment the last is cleared, so that its battles are the same battles as before the
clock existed. A player with Auto on waits about 4 s between waves, and the spec's par assumes that wait. So the
clock the bot reports is the game's clock plus 4 s for each wave after the first (76 s on a 20-wave victory).
Nothing happens in those 4 s that the bot's battle would notice, except that the spells cool 4 s further: a real
battle with the wait is, if anything, a little easier than the bot's.

Columns of the clock's block: each build's clock on its victories (seconds, "-" where it lost); then for the
best build its clock as par, the same in minutes, the gold it earned, and `minS`.

### The pars of ruleset 1

`LEVEL_PAR` in `index.html` holds the best build's clock on each battlefield, from this table. The speed share
of a score is full at `fast` (six tenths of par, or `min` if that is longer), half at par, and nothing at
`slow` (1.4 times par).

These pars have limits, and ruleset 1 is never published (RULINGS B2, E):

- They were measured on Normal with one seed. The same par is used for Easy and Hard.
- With one seed the best build is the build that happened to keep the most defenders in one battle.
- The full tables (three difficulties, three seeds) are made once the new lengths are in (G4, G5).

Each battlefield's part also carries `fight`: a short hash of the tables it is fought by (its foes, its
strength, its tricks, its roads and pads, the towers of its tray, each wave's groups, and what every battlefield
shares). It is there for the pins: a change of balance moves `RULESET_PIN` and the pin of every battlefield it
touches, so the self-test's second suite fails until `RULESET` and those battlefields' `rev` are raised.

`min` and `earnMax` are not from the bot. The page works them out from its own wave plans (`rulesetData()`):
`min` is the sum over the waves of the moment the wave's last foe comes on, and `earnMax` is every coin a battle
can pay with a tenth more. The table bears them out: in the 119 battles no victory was shorter than 1.7 times
`min`, the bot's own count of `minS` equals the page's `min` on every battlefield, and no battle earned more
than 73% of `earnMax`. The self-test's second suite also plays the quickest battle there can be on two
battlefields (every wave called the moment the last has come on, every foe falling as it comes) and holds it
between `min` and `min` plus 30 s.

### The pins written anew at G1's close

How a battle pays (`PAY` in `index.html`: a cleared wave's bonus, the interest and its cap, the early call's bonus
and its cap, a sale's share) was written in code and not in a table, so the pins did not see it. It is now named
once, read by the battle and by `rulesetData()`, and part of what every battlefield's `fight` hash covers. No
number changed: the bot's 119 battles equal the base's in every field, and `earnMax` is the same on every
battlefield. Only the `fight` hashes, `RULESET_PIN` and `LEVEL_PIN` moved, so RULESET stays 1 and every rev stays
1. `ruleset-1.json` was written again with `node tools/ruleset.js --json`.

## G2: the War Council's kit (g2-kit-normal-seeds1.txt)

`KIT=none|floor|par|cap` in `tools/balance.js` gives every battle the War Council a player owns on first arrival at
the battlefield played (gameplay 4.8, `setKitForTest`, `councilStandard`). With `KIT=none` (the default) the tables
equal G1's cell for cell. The bounds of 5.2 are measured on RULINGS E's sample (Erebuni to Sevan, Sis, Van, Shushi;
Normal, SEEDS=1): the best build keeps at most 2 more defenders with the PAR kit (mean), at most 4 with the CAP kit,
and no more than 6 anywhere. The spec's first numbers broke them (4.56 and 4.56, 8 at most), so every tier's
number was cut (the table `COUNCIL` in index.html); no battlefield was retuned. After the cut: PAR 2.00 (5 at most),
CAP 2.78 (6 at most). A Council number is pinned by `KITSET_PIN` (node tools/ruleset.js prints it), not by RULESET.

### What the G2 sample does not show (the review's finding 3, G2 close)

The PAR mean of 2.00 stands exactly on its bound, at one seed, on nine battlefields. The bound of 5.2 is a mean
over all 17, and the sample underweights the battlefields where the kits are largest: over the six sampled
battlefields after Chapter I the PAR mean is 3.17 and the CAP mean 4.33, both over their bounds. FLOOR (2.11) is
above PAR (2.00) on the same sample, so at one seed much of the table is noise. The bound is therefore not shown to
hold, only not shown to break on RULINGS E's sample. A gate for G4: before any Open board is published, run
`KIT=par` and `KIT=cap` on all 17 battlefields at SEEDS=3 (gameplay 8.3 b) beside `KIT=none`; if the 17-battlefield
mean passes 2 (PAR) or 4 (CAP), or any battlefield passes 6, cut the Council's numbers (a new KITSET and its pin),
never a battlefield.

## G3: the heroes (g3-hero-normal-seeds1.txt)

`KIT=hero` gives a battle the first play's hero (his chapter's level after one Normal victory on each earlier
battlefield of the chapter, 1 to 4) and the Call from Dvin on, with no Council tier; `KIT=floor|par|cap` now carry
the same hero with their Council. `HERO=off` (the default) is the bot as it always played; `HERO=hold` leaves the hero
where he appears by the walls and sounds the Call on a crowd of three. `KIT=none` gives the same battles with either:
with `HERO=off` the tables equal G2's cell for cell on all 17 (0 differences in 3,332 fields), and `HERO=hold` equals
`HERO=off` there (no Call to sound). RULESET and every battlefield are unchanged.

`HERO=park` is the parking G3 first built for `HERO=hold` (the road point the most towers reach, within 150 px of the
walls). It is kept for experiments only: by itself, with no kit, it lost Van and cost Dvin 9 defenders, so any kit
measured on top of it looked smaller than it was. A measure whose base loses a battlefield `HERO=off` wins is not used.

The bounds of 5.2 are read as the worse of `HERO=off` and `HERO=hold`. 4.4's first table (460 to 700 strength, a
blow of 40 to 62, the Call two more held) broke them: PAR 3.44 more defenders (bound 2) and CAP 7 on Van (bound 6).
G2 had left PAR at 2.00, exactly its bound, so the hero's levels at a first play (2 to 4) had no room for strength.
The hero's numbers were cut, never a battlefield or the Council: levels 1 to 4 are 400 strong with a blow of 34, level
5 is 470 with 40, and the Call holds one more foe, not two. The levels keep the rest of 4.4's table (the Call 50 s,
healing, the scouts' reveal, four held, a sooner return, a longer Call, the burn). On the sample:
- PAR: 2.00 more (most 5) with `HERO=off` and with `HERO=hold`.
- CAP: 2.78 more (most 6) with `HERO=off`, 2.89 (most 6) with `HERO=hold`.
- The hero alone (`KIT=hero`): 0.00 with off, 0.22 (most 1) with hold; the Call is sounded about 4 times a battle.

The margin is thin: PAR sits on its bound and one seed decides a cell. G4's full tables (all 17, SEEDS=3, with
`HERO=off` and `HERO=hold`) must hold the same bounds before any Open board is published; if they break there, the
hero's or the Council's numbers are cut, which for the Council is the owner's call.

## G4: the lengths and the retuning (gameplay 1, 5.6)

Every battlefield now plays N steps of the 20-step script (1.1, 1.2). The tables are at SEEDS=3 on Easy, Normal and
Hard on all 17 battlefields, with the clock (`CLOCK=1`). From G4 on the bot waits the 4 s between waves in the battle
itself (`WAIT`, the default with `CLOCK=1`; G1's review, finding 5), so the spells and the hero recover in them and the
pars are the game's clock as it ran. `WAIT=0` is the bot as it played before.

| file | what it is |
| --- | --- |
| `g4-pre-sis-sardarapat-vs-master.txt` | Before retuning: Sis and Sardarapat (both left at 20 waves), Normal, SEEDS=1, `WAIT=0`, master (f905f4a) and the G4 page. The tables are equal cell for cell and the 14 battles equal battle for battle (308 fields compared, 0 differences). |
| `g4-before-{easy,normal,hard}-seeds3.txt` | The lengths before retuning (every number as G3 left it). |
| `g4-after-{easy,normal,hard}-seeds3.txt` | After retuning: the numbers in `index.html` at G4's close (the close's rerun, 3 x 357 battles). Two rows are from their own runs at the final numbers: `g4-after-easy-erebuni-seeds3.txt` (Erebuni on Easy, its climb put back to 1.5 after the family run) and `g4-after-hard-tushpa-seeds3.txt` (Tushpa on Hard at `hpTune` 1.42). |
| `g4-kit-*.txt` | The kit's gate of 5.2 at the final numbers (Normal, all 17, SEEDS=3): `KIT=par` and `KIT=cap` with `HERO=off` and `HERO=hold`, read against the Normal table by `node tools/balance-kit.js`. |
| `g4-endless-normal-seeds3.txt` | `ENDLESS=10`: the endless stand's first ten waves on Erebuni, Ani and Sardarapat (5.6). |
| `g4-after-probe-normal-seeds3.txt` | `CMD=probe` on Normal after retuning: the commanders' margins by script wave (10, and the pair of 20). |
| `g4-{before,after}-bands.txt` | The bands of 5.1 read off both (`node tools/balance-bands.js`, from the bot's `JSON=1` lines). |
| `ruleset-2.json` | `rulesetData()` of ruleset 2 (`node tools/ruleset.js --json`). |

How they were made (4 cores, shared with the other track):

```
NODE_PATH=$(npm root -g) JOBS=4 SEEDS=3 CLOCK=1 JSON=1 node tools/balance.js <0|1|2> > out.txt
node tools/balance-bands.js out.txt
NODE_PATH=$(npm root -g) JOBS=4 SEEDS=3 CMD=probe node tools/balance.js 1
```

### What the lengths did before retuning (Normal)

As the prototype said (0.3), the shortened first six came out easier: the best build kept 18 to 20 on Erebuni, Tushpa,
Avarayr and Sevan (band 12 to 16). Mari's commanders reached the walls on every seed (its second road opens on wave 8
of 12 with both still to come). Musa Dagh's mix lost every seed to its commanders. Gyumri, Halidzor, Van and
Stepanakert 1992 kept 16 to 20; Sardarapat, left at 20 waves, kept 7 to 9 with the waiting bot. Wave time was inside
15% of 1.2 everywhere already.

### The knobs, in 5.3's order

The first six: the tricks, then the economy, then strength as fine tuning.
- Erebuni: scouts every wave from its sixth (script 7 on Normal and Hard, `hidden.from [8, 7, 7]`), three and one more
  every third script wave on Normal and Hard (`n [3, 3]`); spoils from script wave 4 at 0.4 / 0.38 / 0.35; the late climb
  (`hpFrom`) to 1.5 / 1.9 / 1.6; its outflankers at 1.8 on Normal (they now come on waves 6, 8 and 9). The coached
  waves 1 to 3 are master's to the foe, the hit point and the coin (suite 2 holds them to a fixture).
- Tushpa: spoils 0.5 / 0.45 / 0.5, `hpTune` 1.45 / 1.3 / 1.45 (its map solves its tricks).
- Avarayr: the reserves' road takes a fifth of a wave on Normal and Hard (was 0.15 and 0.15), spoils 0.75 / 0.7 / 0.7 and
  `hpTune` 1.45 / 1.2 / 1.2 (unchanged on Easy: see playtest 5 below).
- Dvin: spoils 0.86 on Normal (it had no economy knob), `hpTune` 1 on Hard.
- Sevan: spoils 0.65 / 0.85 / 0.9, `hpTune` 1.17 / 1 / 1.08.
- Tashir: unchanged.
- At G4's close, Easy and Hard got their own entries (5.6), each confirmed at SEEDS=3 on the battlefields touched and
  then in the full tables: on Easy, Tushpa's spoils 0.47 (was 0.5), Dvin's 0.84 (was 1) and Tashir's `hpTune` 1.17 (was
  1.1); on Hard, Avarayr's `hpTune` 1.23, Tushpa's 1.42, Sevan's 1.12, Gyumri's 1.12 and Van's 1.55, Dvin's spoils 0.92
  and Halidzor's 0.95. Erebuni's Easy climb was tried at 1.75 and 1.85 (the mix kept 26 to 28 either way) and its spoils
  at 0.3 (no change); at 1.75 the family of playtest 5 kept only 8 of 30, so it stays 1.5. Avarayr's Easy spoils stay
  0.75 for the same reason (below). Normal was not moved: Dvin and Sevan were tried at eleven settings between them
  (the ladder parties' damage and cap, the spoils, the hill track's share, the torch-bearers' count, `hpTune` from 0.97
  to 1.04) and no setting put all three seeds in 12 to 16; the cells jump by 5 to 10 between neighboring settings.

The later eleven: `hpTune` by difficulty, the commanders' column of `LEVEL_HP` with `CMD=probe`.
- Mari first: its commanders' column 1 to 0.8, then `hpTune` 1 / 0.92 / 0.8. Its road keeps its script wave (11).
- Musa Dagh: commanders 0.68 to 0.45. Stepanakert 2023: commanders 0.65 to 0.55, `hpTune` 1.02 / 0.92 / 0.85.
- Gyumri 1 / 1.3 / 1; Halidzor spoils 0.84 on Normal and `hpTune` 1.18 on Hard; Van 1.42 / 1.46 / 1.5; Sardarapat
  1.18 / 1.165 / 1.18; Stepanakert 1992 1.35 / 1.5 / 1.5; Shushi 0.95 on Hard. Ani and Sis: unchanged.

Never touched: `DIFFS`, `hpScale`, the five towers, the star thresholds, the pay rule of 1.4.

### After retuning: the bands of 5.1 (`g4-after-bands.txt`)

- Normal, the first six: the mix wins every seed on all six. The best build keeps 12 to 16 on every seed on Erebuni
  (13, 13, 14), Tushpa (13, 13, 13), Avarayr (14, 13, 14) and Tashir (16, 14, 14). Two miss by one seed: Dvin
  (archers and drums 13, 19, 11) and Sevan (the mix 16, 9, 15). Both are cliffs (above): one seed decides these cells,
  and no knob of 5.3 brought all three seeds in. Read as a miss for the owner to rule on.
- Normal, the later eleven: the best build keeps 10 to 15 on two of three seeds on all eleven and fells both
  commanders on every seed; the mix wins two of three or more on 10 of 11 and none of three on none (Van's mix wins one
  of three).
- Wave time on Normal is inside 15% of 1.2 on all 17 (the furthest: Tushpa 21.2 minutes against 19, +12%).
- Easy: the mix wins every battlefield on every seed. On the first six it keeps 25 to 27 on Tushpa, 24 to 26 on
  Tashir, 22 to 25 on Sevan, 24, 29, 24 on Dvin, 28 to 29 on Erebuni and 29 to 30 on Avarayr: Erebuni, Dvin (one
  seed) and Avarayr stay above "about 22 to 27", because the family of playtest 5, who plays far below the bot, comes
  close to losing Erebuni and Avarayr at anything harder.
- Hard: the best build wins two of three or more on all 17 (bound: 12) and loses some seeds (Erebuni, Sevan, Ani,
  Gyumri, Van, Sardarapat). Every victory of a best build keeps 2 to 8 of 14.
- "ballista" and "archers" lose 18 and 16 of their 18 battles on the first six on Normal. The adaptive enemy adapts on
  16% of the mix's waves and on 99 to 100% of the one-tower builds'.
- The toll: where two or more tricks cost a defender (Sevan, Shushi), no trick is more than 75% of the best build's
  toll on any difficulty (the largest: the adaptive enemy at Shushi on Normal, 65%). `tools/balance-bands.js` prints the
  share and flags TOLL above 75%.

Avarayr on Easy was taken to spoils of 0.65 by the build, and its family run (playtest 5: a finger that never watches
the reserves' road) then lost it three times in three. Back at 0.75 the same finger won it, so Easy's spoils there
stay as they were.

### The pars of ruleset 2

`LEVEL_PAR` holds a par for each difficulty, `[Easy, Normal, Hard]`: the best build's mean clock over its victories in
the after tables. `fast` and `slow` in `rulesetData()` are read per difficulty. Each battlefield's `rev` is 2 (fifteen
changed length, and the pay rule they all share is new), `RULESET` is 2 and its pins are written anew. KITSET is
unchanged (96485c5b).

### The kit's gate (5.2), run at G4's close: it fails (`g4-kit-bounds.txt`)

G2's and G3's gate at the final numbers: `KIT=par` and `KIT=cap` with `HERO=off` and `HERO=hold` on all 17 at SEEDS=3
against the Normal table (`KIT=none`), read by `node tools/balance-kit.js`:

| kit | mean more kept (bound) | most (bound 6) |
| --- | --- | --- |
| par, `HERO=off` | +3.10 (2) | +8.0 Halidzor |
| par, `HERO=hold` | +3.16 (2) | +8.0 Halidzor |
| cap, `HERO=off` | +3.12 (4) | +8.0 Halidzor |
| cap, `HERO=hold` | +3.27 (4) | +8.0 Halidzor |

Over the bound: PAR's mean, and Halidzor (+8), Sevan, Van and Sardarapat (+6.3) for both kits. CAP's mean is inside.
What it is, measured on the five worst (Sevan, Halidzor, Van, Sardarapat, Stepanakert 1992, par with `HERO=hold`):
- Not the Call: `HERO=off` gives the same cells (+3.10 against +3.16 over the 17).
- Not the hero: the hero alone (`KIT=hero`) keeps +0.67 on the five.
- The Council, and no one branch: with each branch's tiers emptied in turn the five keep +3.7 (no Bowmen), +6.3 (no
  Engineers), +6.3 (no Captains), +6.4 (no Heralds), +6.3 (no Stewards), against +6.5 with all. The retuned
  battlefields stand where a board holds whole or leaks, and a few percent of damage, range and tower strength turn the
  leaks of the Standard battle into none.
- Every Council effect halved (a candidate, not in the page: `g4-kit-par-hold-halved-normal-seeds3.txt`): PAR +2.20
  on the mean, most +5.7. Still over 2.

The rule of 4.8 is that the Council's numbers are cut, not a battlefield. Cutting the Council by half or more is the
owner's call (G3's README said so, and the review of G4 asks it of the owner too), so the close leaves the Council and
KITSET (1, 96485c5b) as they were and records the gate as failed: no Open board may be published until it holds.

## G5: the Garrison Post and the tray of n tiles (gameplay 2, 3.8, 5.2, 5.6)

Tables: `g5-normal-seeds3.txt`, `g5-easy-seeds3.txt`, `g5-hard-seeds3.txt` (all 17, SEEDS=3, CLOCK=1, every build with the
post's: mix7, posts, postdrum), `g5-kit-par-hold-normal-seeds3.txt` and `g5-kit-bounds.txt` (RULINGS B7), and
`g5-probe-posts-normal-seeds3.txt` (CMD=probe). `ruleset-2.json` is rulesetData() at G5's close.

### What else moved every build's cells

- 2.2's fix: a stone aimed at a foe that stands (stunned, held by a post's man or by the hero) is led by nothing. The
  hero's hold is in every battle, so every build's cells move a little from G4's: the mix on Normal keeps 9.57 on the
  mean of the 17 (G4: 9.39), Sevan 18.0 (13.3), Tashir 8.0 (9.0), Ani 12.3 (13.3).
- The bot builds at most two watch towers of its own for hidden scouts. With the post in its order it met a road's last
  stretch no free pad watches 120 px of, and built a watch tower at every look (eight on Erebuni).
- The Standard battle's tray holds the post on every battlefield (`trayStandard`), and the ruleset says so: the pins of
  ruleset 2 were written anew (RULESET stays 2: G4 and G5 are released together, R3, and no board ever opened on G4's).
  `LEVEL_PAR` is taken again from these tables (the best build may now be mix7).

### The post's numbers (5.6, G5)

2.1's first numbers (90 gold; men of 130 with a blow of 10) kept "mix7" 1.1 defenders below "mix" on Normal (SEEDS=3, the
posts fourth and twelfth in its order), and 5.4 when the post was the fourth building. Measured on mix against mix7, all
17, SEEDS=3 (every candidate in the build's scratch notes):

| candidate | mix7 against mix, mean of 17 |
| --- | --- |
| 2.1 as written, posts 4th and 12th | -5.4 (SEEDS=1) |
| 2.1 as written, posts 9th and 17th | -1.1 |
| ranks 70/80/150 gold, men and blows x1.5, posts 9th and 17th | -0.8 |
| ranks 60/70/120, men x3, blows x2, posts 7th and 17th | -1.2 |
| ranks 60/70/120, men x3, blows x3, posts 9th and 17th | +0.4 |
| the same, a commander held 12 s | +0.6 |
| ranks 50/60/110, men x3, blows x3, a commander held 12 s (built) | +0.8 |

Built: ranks of 50, 60 and 110 gold, every man three times as strong with three times the blow (rank 1: two men of 390,
a blow of 30; rank 3: three of 750, a blow of 66; Shield Wall four of 1,260, Sortie three of 900 with a blow of 144 that
pierces), masteries at 300 as before, `POST_RULES.cmdHold` 12 s. A post's damage per 100 gold is then 5,195 on Normal
(the archers' 3,613), with 53 s of hold per 100 gold. Doubling or quintupling the men without making the post cheaper
moved nothing: what the post costs mix7 is the shooting tower whose pad and gold it takes, and a commander that the
missing tower would have felled.

### 5.2's rows for the post (Normal, SEEDS=3)

- mix7 against mix: +0.80 on the mean of the 17 (bound 1 to 3: MISSED, under it), most +9.3 (Van; bound 5: MISSED, and
  Musa Dagh +7.0: both where the mix loses seeds, 1 of 3 and none, so any board that wins gains much). Per battlefield:
  Erebuni -0.3, Tushpa +4.3, Avarayr 0, Dvin +0.3, Tashir 0, Sevan -1.0, Ani +1.0, Mari -10.0, Sis -5.7, Gyumri 0,
  Halidzor +4.7, Van +9.3, Musa Dagh +7.0, Sardarapat +1.0, Stepanakert 1992 -1.3, Shushi +2.0, Stepanakert 2023 +2.3.
  Mari: mix7's third commander reaches the walls with a tenth of his strength on every seed (the post's pad held a
  ballista in the mix); Sis: the post on the 17th pad leaks more of the rank and file over twenty waves. Neither moved
  with the post's own numbers (above), and a retune of the battlefields for this row alone was not made.
- The post in the best build: Tushpa, Ani, Van and Sardarapat, 4 of 17 (bound: a third, 6: MISSED).
- posts and postdrum lose every battle on every battlefield on Normal (bound: two of three seeds: met), and on Hard.
- A commander is never stopped by posts (CMD=probe, a board of posts alone leaves both commanders above 60% at the
  walls): MISSED at the built numbers. A board of posts alone deals the first commander 1.3 to 4.9 times his strength
  on its road (`g5-probe-posts-normal-seeds3.txt`; postdrum 1.3 to 4.8); the posts boards still lose every battle, to
  the rank and file that walks past a full line and to the engines. The men's blow, tripled for mix7's row, is what
  fells him (Sortie's 144 pierces his armor). A cut on the men's blows against a commander is the fix to try first; it
  moves mix7's row the wrong way (Mari's commander), so it is left for the review and the owner.

### The bands of 5.1 again, with the best build free to use the post

- Normal, the first six: the best build keeps 14.3 (Erebuni, archers), 17.0 (Tushpa, mix7), 13.7, 14.3, 14.7 and 18.0
  (Sevan, the mix): Tushpa and Sevan above 16 (RULINGS B9 asks no more tuning for the bands alone; the retunes tried,
  Sevan's and Tushpa's spoils, turned whole seeds over at once). The mix wins every seed on the six.
- Normal, the later eleven: the best build keeps 10 to 15 on every battlefield (Van 10.0, mix7) and wins every seed;
  the mix wins two of three or more on 10 of 11 and none of three on none (Van 1 of 3).
- Easy: the mix wins every battlefield on every seed; on the first six 28.3, 26.0, 29.7, 25.7, 24.7, 25.0.
- Hard: the best build wins two of three or more on 16 of 17 (Van 1 of 3) and loses some seeds; its victories keep 2 to
  8 except Erebuni (1.7, catapults) and Van (1.0).
- Wave time on Normal: inside 15% of 1.2 on 15 of 17; Erebuni +18% and Tushpa +16% (their best builds now keep more and
  take longer).
- The adaptive enemy adapts on 18% of the mix's waves, 14% of mix7's, 99 to 100% of the one-tower builds'.

### The Council after RULINGS B7 (KITSET 2): par-hold

`KIT=par HERO=hold` against the Standard battle, all 17, SEEDS=3: +2.29 on the mean (RULINGS B7's bound 2.3: inside),
most +6.7 (Van; 5.2's bound of 6 on any battlefield: over), Halidzor +6.3, Gyumri +5.0.
