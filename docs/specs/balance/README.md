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
the same hero with their Council. `HERO=off` (the default) is the bot as it always played; `HERO=hold` parks the hero
under the most towers near the walls and sounds the Call on a crowd of three. With `KIT=none HERO=off` the tables
equal G2's cell for cell on all 17 (0 differences in 3,332 fields). RULESET and every battlefield are unchanged.

The hero alone is small: `KIT=hero` against `KIT=none` keeps 0.33 more defenders (2 at most) with `HERO=off` and 0.00
(1 at most) with `HERO=hold`. The Call is sounded about 3.4 times a battle.

`HERO=hold`, as gameplay 5.4 words it (any road point, the one the most towers reach), cost 4 to 19 defenders a battle
and lost Dvin and Van outright: a hero parked mid-field gives up his place as the walls' last line, which is worth
more than the towers' cover. The bot therefore parks him within 150 px of his own place by the walls (a builder's
choice, said in the bot's header). Even so `HERO=hold` is worse than `HERO=off` on Dvin, Tashir and Van (Van is lost
with any kit), so it measures the bot's placement as much as the hero: read the bounds on both.

The bounds of 5.2 with the heroes in the kit, on the sample:
- `HERO=hold` on both sides: PAR mean 2.33 (bound 2), most 7 (Dvin; bound 6); CAP mean 2.22, most 6.
- `HERO=off`: CAP mean 3.78 (bound 4), most 7 (Van; G2 had 6 there).
Neither broken cell is the hero's: cutting the Call (one more held, not two) or every level's strength (430, 480,
550, 640) left both cells exactly where they were, and the hero alone is worth 0 on Dvin and Van. So no hero number
was cut. These are the Council's edges that G2's review (finding 3) already marked, at one seed, and they go to the
gate G2 named for G4: `KIT=par` and `KIT=cap` (now with `HERO=hold` and `HERO=off`) on all 17 at SEEDS=3 before any
Open board is published; cut the Council (or the hero, if the larger table shows it is his) there.
