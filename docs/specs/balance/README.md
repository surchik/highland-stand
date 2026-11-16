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

### Playtests 2 and 6 (gameplay 8.4), by the touch helpers (`tools/playtest-post.js`, 667 x 320, an iPhone's Safari)

- 2, Tushpa: the card "A new tower: the Garrison Post" came up on the chronicle and its Got it kept it; the post was
  built by its tile and two taps; at 2x, twenty times during waves 1 to 3 the post was tapped, Rally point pressed and
  the road tapped at either end of its stretch: the rally moved 20 times of 20, no slip (no panel, no land, no hero).
  The first build missed 4 or 5 of 20 at the far edge of the field (the world point under a finger stops there, as a
  pad's does) and when the tap came within 80 ms of the arming: the press is now measured on the screen and taken at
  once (the button arms on its click, the finger already up).
- 6, Sardarapat's 20 waves at 2x, four posts (Shield Wall) against four archers on the same pads, side by side: the
  median frame 16.7 ms both, frames over 22 ms 6.1% against 5.1%, and the frame governor left the posts' page at its
  full density (2) while it stepped the archers' page down to 1.5 (the machine's load, not the men). Sixteen men on the
  field cost nothing that shows. (That board of posts fell on the last wave; the archers' kept 10.)

## G5 close: after the review (docs/specs/reviews/G5-review.md)

Tables: `g5-close-normal-seeds3.txt`, `g5-close-easy-seeds3.txt`, `g5-close-hard-seeds3.txt` (all 17, SEEDS=3, CLOCK=1,
every build, the new "halfpost" included), `g5-close-probe-posts-normal-seeds3.txt` (CMD=probe: posts, mix7, halfpost),
`g5-close-kit-par-hold-normal-seeds3.txt` and `g5-close-kit-bounds.txt` (worked from the two tables' best columns), and
every trial below in `g5-close-trials/`. `LEVEL_PAR`, the pins of ruleset 2 and `ruleset-2.json` were taken again
from these tables (RULESET stays 2, as at the build).

### What changed

- A commander takes 0.18 of a man's blow, never through his armor (`POST_RULES.cmdBlow`). Tried on CMD=probe, a board
  of posts alone, the least share of the first commander's strength taken on his road over the 17:

  | cmdBlow | most taken | battlefields over 0.40 | mix7 on Normal |
  | --- | --- | --- | --- |
  | 1 (the build) | 4.92 | 17 | as the build |
  | 0.25 | 0.75 | 7 | as the build, Sevan 13.7 |
  | 0.22 | 0.50 (on 5 tried) | 3 | Erebuni 9.7c1 |
  | 0.2 | 0.43 (on 5 tried) | 2 | Erebuni 9.7c1 |
  | 0.18 (built) | 0.39 | 0 | Erebuni 9.7c1 |
  | 0.1 | 0.45 (Erebuni: the hero and the bot's watch archer) | 1 | Musa Dagh 0/3 w9c3 |

  At 0.18 the row of 5.2 is met: a board of posts alone leaves the first commander above 61% of his strength at the
  walls on every battlefield (posts never reach the wave-20 pair). The cost: one of mix7's three Erebuni battles lets a
  commander through (9.7c1, 13.0 without it), on every value under 0.25. With SPELLS=0 the probe is the same, so the
  floor on Erebuni is the hero and the watch archer, not the spells.
- Rank 1 costs 70, not 50. "halfpost" (a post on every second pad, the review's board) was the best build on 7 of 17 at
  50; at 70 on 2 (Tashir, Musa Dagh). mix7 moves by at most a seed's worth either way. Rank 1 at 90, or men of 260
  with a blow of 20, left Tashir's halfpost at 19.0 all the same: Tashir's cell is the battlefield's, not the post's
  price (`w-c90.txt`, `w-r1x2.txt`).
- Sevan on Normal: `hpTune` 1.1 (was 1). The stones' fix had taken the mix from 13.3 (G4) to 18.0. At 1.05 the mix lost
  a seed (2/3 11.3c1), at 1.1 it wins all three with 11.0 and the best build (mix7) keeps 13.3, at 1.15 the mix keeps
  12.3 and archdrum loses all three. Easy and Hard are untouched.
- mix7's order was tried with the post 7th ("mix7b": worse on Erebuni 1.0c3, Van, Sevan) and with one post only
  ("mix7e": the same battles as mix7: its second post never finds a free pad). The order stays.

### 5.2's rows for the post at the close (Normal, SEEDS=3)

- mix7 against mix: +0.82 on the mean (bound 1 to 3: MISSED, under it). Van +9.3 and Musa Dagh +7.0 (bound 5: MISSED);
  Mari -10.0 (its third commander reaches the walls on every seed, as at the build) and Sis -5.0. Owner's ruling.
- The post in the best build: Tushpa, Tashir (halfpost), Sevan, Ani, Van, Musa Dagh (halfpost), Sardarapat: 7 of 17
  (bound 6: met).
- posts and postdrum lose every battle on every battlefield on Normal (met).
- CMD=probe: met (above).
- halfpost: wins 27 of 51 on Normal; the best build on Tashir (19.3, above 16) and Musa Dagh (14.3). On Hard it keeps
  13.0 on Tashir and 9.0 on Musa Dagh (Hard's band 2 to 8: over). Owner's ruling: a Tashir knob, or the "Wedge" of 5.5.

### The bands again

- Normal: the best build keeps 14.3, 17.3 (Tushpa, mix7), 13.7, 14.3, 19.3 (Tashir, halfpost), 13.3 on the first six;
  10.0 to 14.3 on the later eleven. Tushpa and Tashir above 16. The mix wins every seed on the six (Sevan 11.0).
- Easy: every best build wins every seed (27.0 to 30.0).
- Hard: the best build wins two of three or more on 16 of 17 (Van 1 of 3); Erebuni 1.7, Van 1.0, Tashir 13.0 and Musa
  Dagh 9.0 outside 2 to 8.
- Wave time on Normal: Erebuni +18% and Tushpa +16% (as at the build); every other inside 15%.

### The Council after RULINGS B7 at the close

par-hold +2.12 on the mean (bound 2.3: inside), most +6.7 (Van) and +6.3 (Halidzor): over 5.2's 6 on one battlefield,
as at the build. `tools/balance-kit.js` now reads the par bound as 2.3; it needs JSON=1 lines, so the close's gate was
worked from the tables' best columns.

## G6: the daily's battle (gameplay 6.4, 8.3 (e))

| File | What it is |
| --- | --- |
| `g6-daily-normal-seeds3.txt` | `DAILY=1 CLOCK=1 SEEDS=3`, every build, all 17 battlefields: the daily's 12-wave tables (Normal, the whole tray, the standard loadout) with no twist. Its line of pars is `DAILY_PAR` in `index.html`. |
| `g6-daily-twists-normal-seeds3.txt` | `DAILY=1 TWIST=id CLOCK=1 SEEDS=3`, the mix, all 17 battlefields, for each of the eight twists (and `none` again, the base of the ratios). |
| `ruleset-2.json` | `rulesetData()` again, now with its daily part (pool, twists, k 5, j 3, skip, levels, t). |

How they were made (4 cores, shared with the other track; DAY=20406, the bot's default, seeds the outflankers' lines):

```
DAILY=1 CLOCK=1 SEEDS=3 JOBS=3 node tools/balance.js 1 all                       # 561 battles, 416 s
for t in none thin swift iron few quiet noballista nocatapult nodrums; do
  DAILY=1 TWIST=$t CLOCK=1 SEEDS=3 JOBS=3 node tools/balance.js 1 all mix          # 51 battles each, about 40 s
done
```

The daily without a twist: the mix wins all 51 battles, and so the daily's own table is no harder than the campaign for
the build that 6.4 measures against. The best build keeps 8.0 (Erebuni, whose daily is the default table of 12, not its
coached table of 10) to 19.3 (Tashir). The pars (the best build's mean clock, waiting 4 s between waves):

```
erebuni 1494, tushpa 1353, avarayr 1543, dvin 1383, tashir 1132, sevan 1373, ani 1188, mari 997, sis 1579,
gyumri 1739, halidzor 1680, van 1287, musadagh 972, sardarapat 1259, stepanakert92 2028, shushi 1117, stepanakert23 1309
```

The skip list (6.4: the pairs the mix wins on fewer than two of three seeds), 52 of the 136 pairs, plus No drums on
Shushi, whose drums keep watch:

| Twist | Battlefields skipped | Mix wins of 51 |
| --- | --- | --- |
| Thin purse | erebuni, avarayr, dvin, sevan, ani, gyumri, van, sardarapat, stepanakert92, shushi, stepanakert23 (11) | 17 |
| Forced march | tushpa, dvin, tashir, van, musadagh, sardarapat, shushi, stepanakert23 (8) | 28 |
| Iron ranks | van (1) | 47 |
| Few defenders | erebuni, dvin, halidzor, musadagh, sardarapat (5) | 38 |
| No spells | tushpa, dvin, tashir, van, shushi (5) | 35 |
| No {ballista} | tushpa, avarayr, dvin, ani, mari, halidzor, van, musadagh, sardarapat, shushi, stepanakert23 (11) | 18 |
| No {catapult} | erebuni, dvin, mari, van, stepanakert23 (5) | 37 |
| No {drums} | erebuni, tashir, mari, sis, van (5), and shushi by the watch rule | 38 |

The list is measured on one day's outflanker lines (DAY=20406). The day's seed moves only the outflankers (their
entry, their line over a lake, the side an aircraft circles), so the G6 close reran the five served pairs that the mix
won on exactly two of three seeds on a second day, `DAILY=1 TWIST=t DAY=20407 CLOCK=1 SEEDS=3 node tools/balance.js 1
<field> mix`: Thin purse on Musa Dagh, Forced march on Sevan, Iron ranks and Few defenders on Tashir, No spells on
Musa Dagh. Each again won two of three, so none drops into the list.

Every battlefield keeps at least one twist: Van keeps only Few defenders, Dvin Iron ranks and No drums. Thin purse and
No ballista are served on six battlefields each: a fifth less in bounties is a heavier blow at 12 waves than it reads, and
the ballista slot is the mix's answer to armor and to the sky on most battlefields. The owner may want either softened
(Thin purse at a tenth; a second struck slot instead of the ballista); nothing here changes without a new skip list.

The twists' bounds for the server (`daily.t`): Few defenders sets 12 (`livesSet`); Thin purse's `earn` is worked out
by the page as the largest share of `earnMax` any battlefield keeps under it (0.88, an upper bound); `fast` and `slow`
are the mean ratio of the mix's clock with the twist to its clock without, over the battlefields it won both ways:
Thin purse 1.07, Forced march 0.98, Iron ranks 1.01, No spells 1.04, No ballista 1.09, No catapult 1.07, No drums 1.06.
The clock is mostly the foes' coming on, so a forced march is only 2% quicker; a weaker board is up to 9% slower.

## G7a: the Horse Lines (Erebuni, Tushpa, Avarayr)

Tables (SEEDS=3, CLOCK=1, the Standard battle, every build including the new `agemix` and `harriers`, on the three
battlefields that offer the tower): `g7a-normal-seeds3.txt`, `g7a-easy-seeds3.txt`, `g7a-hard-seeds3.txt`; the
commanders, `CMD=probe` on mix, mix7, agemix, harriers and posts: `g7a-probe-normal-seeds3.txt`; the daily's table on
the three, `DAILY=1`: `g7a-daily-normal-seeds3.txt`; the endless stand, `ENDLESS=20` on mix7 and harriers:
`g7a-endless-normal-seeds3.txt`. The trials that led to the numbers are in `g7a-trials/` (try.sh: Normal, the three
battlefields, SEEDS=3, CLOCK=1; the file names say the patch: spec = 3.2's numbers, x2 = blows doubled and the reload
10/9/8, x3 = blows three times, null = a Horse Lines that deals nothing and throws nothing, heavy0 = commanders and
engines never thrown, cheap = a price of 80/90/160, crowd = the final page's charge rule; m7aN = mix7 with the special
tower Nth in its order, mixhN = the mix with it Nth in place of an archer). The trials before `m-crowd` ran with the riders
charging at the first foe in reach.

What was found, and the numbers chosen:
- 3.2's blows (40, 70, 115; Lancers 260, Harriers 100) dealt 430 to 550 damage per 100 gold in the bot's battles, a tenth
  of an archer's (4,800). The blows are now 140, 240 and 400, Lancers 900 and Harriers 340: 3,600 per 100 gold in the
  Normal table. The cadence (18, 16, 14 s; Lancers 14, Harriers 7), the throw (40 to 70 px), the limit of two and the 8 s
  before a foe is thrown again are 3.2's.
- The riders charged at the first foe to come into reach, struck it alone and reloaded as the column came on. They now
  wait for three foes on their stretches, or for one past the middle of its stretch (`HORSE_RULES.crowd`): in live.js's
  three waves the charges dealt 414 to 834 where they had dealt 276.
- No set of numbers moved a cell of the bot's tables. Where the tower stood, its slot did: mix7 with the special tower
  12th (G5's order) lost Erebuni on every seed whatever the numbers, a Horse Lines that does nothing included
  (`f-null.txt`), because the twelfth tower of that order is the ballista Erebuni's commander pair needs (CMD=probe:
  the pair's margin is 1.05 for the mix and 0.82 for mix7 there). mix7 now puts it 15th; in the tables it is then built
  only on Avarayr (on all three seeds, last) and changes nothing. On Tushpa no free pad with road in its reach is left by
  the time any order reaches it, unless it comes in place of the mix's tenth tower (`mixh10`: Tushpa 16.3 against the
  mix's 12.7, Erebuni 13.0 against 13.3, Avarayr 9.3 the same).
- The bot's pad for it (5.4: the most road within 120 px downstream of a fire or catapult) leaves out a dormant ambush
  road and a track not yet open: on Avarayr it had chosen the ambush road and never charged.

5.2's rows on the three battlefields:
- The classic five and every build of G5: every cell on all three difficulties equals G5's close tables (the mix, mix7,
  halfpost, posts, postdrum and the one-recipe builds). The pars are unchanged (Normal 1242, 1367, 1724; Easy 868,
  1277, 1811; Hard 1125, 1406, 1756), and so is the daily's (1494, 1353, 1543): LEVEL_PAR and DAILY_PAR stay.
- agemix (the horse on every second pad up to two, posts between) and harriers (two at Harriers, fires and drums) lose
  every seed on Normal and Hard, and on Easy (met: 5.2 asks two of three on Normal).
- mix7 against mix: unchanged from G5 on these three (Erebuni -3.6, Tushpa +4.6, Avarayr 0.0), so G5's mean of +0.8 over
  the 17 and its cells for the owner stand as G5 left them. No battlefield gains more than 5 (met).
- The Horse Lines in the best build on a third of their battlefields: NOT met (0 of 3). The best builds are archers on
  Erebuni, mix7 on Tushpa (which builds no Horse Lines there) and balldrum on Avarayr. Putting the tower where it helps
  Tushpa (mixh10, +3.6) would take Tushpa further above its band of 12 to 16 (mix7 keeps 17.3 there, G5's cell), and
  every slot before 15 in mix7 loses Erebuni's pair. The owner's to rule on, with G5's cells.
- The endless stand: NOT met. 5.2 asks mix7 and harriers boards to fall between waves 8 and 20 beyond the chronicle.
  mix7 falls 0 to 3 waves beyond on Erebuni and Avarayr and holds all 20 on Tushpa; harriers never reach the stand.
  The Tushpa stand is the same with a Horse Lines that does nothing (it is G5's board, not the horse's). The owner's to
  rule on, with G5's cells.
- Commanders: CMD=probe on the horse builds shows them felling no commander (agemix deals the first commander 0.29 to
  0.47 of his strength; harriers never reach him);
  3.1's first rule holds (a commander or an engine is thrown a quarter as far, and nothing is thrown twice in 8 s).

### G7a close (review: docs/specs/reviews/G7a-review.md)

Tables at the closing page (SEEDS=3, CLOCK=1, every build, the three battlefields): `g7a-close-normal-seeds3.txt`,
`g7a-close-easy-seeds3.txt`, `g7a-close-hard-seeds3.txt`, `g7a-close-endless-normal-seeds3.txt` (ENDLESS=20, mix7 and
harriers), `g7a-close-probe-normal-seeds3.txt` (CMD=probe) and `g7a-close-kit-par-hold-normal-seeds3.txt` (KIT=par
HERO=hold, read by `tools/balance-kit.js` against the Normal table). The daily's table (DAILY=1) equals
`g7a-daily-normal-seeds3.txt` cell for cell.
- One rule moved: an unseen scout on the stretch is now struck (and so shown), as the stones and 3.4's blasts strike
  him; alone he does not send the riders out. Every cell on Easy, Normal and Hard equals the build's tables; the
  horse's damage per 100 gold on Normal moves from 3,597 to 3,673, and its px thrown per 100 gold from 487 to 500.
- The two rows of 5.2 that are NOT met (the owner's to rule on, with G5's cells): the Horse Lines in the best build on
  0 of 3 battlefields, and the endless stand above. One more tuning pass was tried for the first, as the review asked:
  the reach at rank 1 from 150 to 180 with the riders waiting for 2 foes, not 3 (`g7a-trials/n-r180c2.txt`), and the
  same with a price of 80 (`o-r180c2p80.txt`), each with `mixh` (two horses 2nd and 6th) and `mixh10` beside every
  build. Neither puts a horse build first anywhere: mixh loses Erebuni and Tushpa on every seed at 180 (2 of 3 on
  Erebuni at the price of 80) and keeps 10.7 or 11.3 on Avarayr against balldrum's 13.7; mixh10 keeps 13.0, 15.0 and
  9.3. The page keeps the build's numbers. On Hard mixh is the best build on Avarayr (the review's run: 4.0 against
  balldrum's 3.7), the one cell where the row is met.
- The Captains' tiers 4 and 5 (5% off the special tower, 7.5% off its masteries) now apply to the Horse Lines. KIT=par
  HERO=hold on the three: Erebuni +0.0, Tushpa -0.7, Avarayr +2.3, as at G5's close (+0.0, -0.6, +2.3): the discount
  moves no cell, so G5's mean of +2.12 over the 17 and its Van cell (+6.7, over the bound of 6) stand as G5 left them.
  Their lines now name the towers that are in the game ("the Horse Lines"), not "the special tower".
- mix7 puts "age" 15th for every battlefield, G7b to G7e included. A later package that needs another slot for its own
  tower changes it for its own battlefields only (a per-battlefield order), so that Erebuni's commander pair keeps its
  ballista.

## G7b: the Stores (Dvin, Tashir, Sevan, Ani, Mari, Sis)

Tables (SEEDS=3, CLOCK=1, the Standard battle, every build including the new `greedy` and `bazaar`, on the six
battlefields that offer the tower): `g7b-normal-seeds3.txt`, `g7b-easy-seeds3.txt`, `g7b-hard-seeds3.txt`; the
commanders, `CMD=probe` on mix, mix7, greedy, bazaar and posts: `g7b-probe-normal-seeds3.txt`; the daily's table,
`DAILY=1`: `g7b-daily-normal-seeds3.txt`; the endless stand of mix7, `ENDLESS=20` (JSON lines): `g7b-endless-normal-seeds3.txt`.
The trials that led to the price are in `g7b-trials/` (Normal, the six, SEEDS=3, mix, greedy and bazaar beside the full
table at 3.3's numbers, `n3-price120.txt`; p1 = every pay about a third lower, p2 = a price of 160, p3 = 140, p4 = 140 with
a first rank paying 26, p5 = 150).

The bot (5.4): a build's "age" is the Stores on these six; they go on the free pad that reaches the least road, as the
order says, never once two thirds of the battle's waves are sent. Its Stores are ranked and mastered after every
fighting tower has its own (STORES_RANK=last, the default: ranked as early as any tower they took the gold the first
waves needed, and greedy kept 4 to 10 fewer than the mix in a first trial at one seed), and never after two thirds of the
battle. greedy is the mix with one Stores as its third building (BUILD_AGE_MAX), bazaar two Stores first, then the mix.
The report adds 5.2's rows for the Stores: greedy's gold invested at the end against the mix's, the defenders it lost
more than the mix by the end of the first commander's wave and at the end, and bazaar's end against the mix's.

What was found, and the numbers chosen:
- At 3.3's numbers (price 120, pay 30, 46, 64; Caravan 80, Field Forge 64) a board with Stores became the best on Sevan
  (greedy 18.0 against mix7's 13.3) and Ani (bazaar 16.7 against 14.7): above the bands of 5.1 (12 to 16 on the first
  six, 10 to 15 on the later eleven) and 4.7 defenders above the best board without them, against 3.1's second rule
  (2 to 3 at most). bazaar ended below the mix on only 3 of the 6.
- Lower pay (p1) made greedy and bazaar lose more on Dvin and Tashir and still kept 17.7 and 18.3 on Sevan and Ani.
  The price moves the cells the most: at 160 (p2) the best boards are G5's on five of the six and bazaar's 13.7 on
  Sevan (inside the band, 0.4 above mix7), and bazaar ends below the mix on 5 of 6. The cells jump by several defenders
  between neighboring prices (140 and 150 kept bazaar at 17.7 and 16.7 on Ani): the bot's purchases shift wave by wave.
- Chosen: a price of 160. Every other number is 3.3's.

5.2's rows on the six battlefields (Normal unless named):
- The classic five and every build of G5: every cell on all three difficulties equals G5's close tables (mix, mix7,
  halfpost, posts, postdrum and the one-recipe builds). mix7 builds a Stores 15th, but on these six that changes no cell:
  mix7 against mix stays G5's (Dvin +0.3, Tashir 0.0, Sevan +2.3, Ani +2.4, Mari -10.0 with three commanders at the
  walls, Sis -5.0), so G5's mean over the 17 (+0.8) and its cells for the owner stand.
- bazaar ends below the mix in lives on at least four of the six: met on Normal (5 of 6: only Sevan, +2.7), Easy (4)
  and Hard (4).
- greedy (Normal): gold invested at the end +4.7% (Dvin), -54.5% (Tashir, where it wins 1 of 3), +15.5% (Sevan), +5.8%
  (Ani), +2.3% (Mari), +3.5% (Sis), against 5.2's 6 to 10%: NOT met. A board that holds is full by the last waves (every
  pad built, every tower mastered), so the Stores' gold has nothing left to buy, and the mix's own end board is the same.
  Lost by the end of the first commander's wave against the mix: -1.0, +6.3, +1.0, +2.7, 0.0, +2.0 (1 to 2 asked: met on
  Sevan and Sis, near on Ani). At the end: +1.7, -6.3, +2.3, +2.0, -7.3, -0.3 (within 2: met on Dvin, Ani and Sis, 2.3 on
  Sevan; NOT met on Tashir and Mari). Mari's -7.3 is a commander at the walls on every seed (10 defenders at a stroke),
  as mix7's own Mari cell (2.0c3) is.
- The Stores in the best build on a third of their battlefields: NOT met on Normal (1 of 6: bazaar on Sevan). On Easy 2
  of 6 (greedy on Ani and Sis) and on Hard 2 of 6 (greedy on Dvin, bazaar on Sevan). At 3.3's price 120 it was 3 of 6 on
  Normal, at the cost of the two bands above. The owner's to rule on, with G5's and G7a's cells.
- The bands of 5.1 on Normal: the best boards keep 14.3, 19.3, 13.7, 14.7, 12.0 and 11.3 (Tashir's 19.3 is G5's
  halfpost cell, for the owner). Easy: the mix wins every seed on all six and keeps 21.3 to 29.3 (G5's cells). Hard: the
  best build wins all six (7.7, 13.0, 6.7, 7.7, 5.3, 5.3) and the mix loses some seeds.
- Commanders (CMD=probe): greedy and bazaar deal the commanders about what the mix does (the least margins over the
  seeds: the mix 0.68 to 2.79 of their strength, greedy 0.69 to 2.72, bazaar 0.88 to 2.42 where it reaches them); posts
  alone deal the first commander 0.10 to 0.39 of his strength, so he reaches the walls above 60%.
- The endless stand (ENDLESS=20, mix7, waves held beyond the chronicle on the three seeds): Dvin 10, 12, 12; Tashir 9, 9,
  18; Sevan 4, 4, 16; Ani 2, 2, 3; Mari 2, 2, 2; Sis 0, 2, 2. mix7 falls between waves 8 and 20 beyond on Dvin and Tashir
  (5.2 asks it on three battlefields of the 17; G7a found none on its three). harriers (a Horse Lines board) is not built
  here.
- The pars moved where a board with Stores became the best: Normal Sevan 1730 to 1735; Easy Ani 1558 to 1584 and Sis
  2311 to 2346; Hard Dvin 1115 to 1103 and Sevan 1719 to 1754; the daily's Sevan 1373 to 1328. LEVEL_PAR and DAILY_PAR
  carry them. The revs of the six rose to 3 (the Stores in their trays). The daily's skipped pairs (G6) were not run
  again with the Stores in the daily's tray.
- The playtest of 8.4 (Tashir with Stores, `tools/playtest-stores.js`, by finger on the iPad at 1194 x 834 and an
  iPhone SE at 667 x 320): PASS both, 528 s. See the G7b report for how it felt.
- Acceptance at the package's close: check-page OK; selftest suite 1 PASS (151 checks, 114.2 s alone; 151.9 s, over
  its budget, beside the other track's load) and suite 2 PASS (47 checks, 72.2 s alone); run-fixtures PASS (8);
  town-isolation PASS (9); run-all --quick 10 of 11 (dance10 failed by taps at 9.7 and 10.2 s under load, PASS alone,
  15 runs); run-all --only=padplace,probe,iphone,live in full PASS (4 of 4, all 17 battlefields, iphone at ten sizes);
  nine mutants of the Stores' rules each caught by suite 2's three Stores checks.
