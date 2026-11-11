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
