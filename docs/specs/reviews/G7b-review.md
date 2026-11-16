# Review of G7b: the Stores (`stores`)

Reviewer: an independent agent, on branch gp/work at 44c309e (base 46eec7b, G7a's close WIP). The package's code was not
changed. Probes, mutants and logs are in the session scratchpad under `top/build/review/G7b/`.

REVIEW G7b: 0 blockers, 4 majors, 8 minors.

The Stores are built as 3.3 says in the cases probed. They pay `pay` times `payStep` at a clear. A wrecked one pays
nothing. Two Caravans pay one share, and the Standards' plunder and a Caravan's share never stack. A Field Forge does
not tend itself. The limit refuses a third with its sentence, and the tile dims. A run saved before the Stores resumes,
a run with them resumes with what they paid, and a third in a saved run is refused. Dvin's card line is sourced
(`docs/history/town-history.json`, Procopius) and Ani's card makes no claim. The art reads well at all three sizes. The
balance tables the builder reports agree with the reviewer's rerun of mix, greedy and bazaar (below). Nothing found
breaks the game, an old save or a test.

The majors: the placement's undo grace turns the Stores into free gold, suite 2 misses most of the Caravan's and the
Field Forge's rules, the tower is a trap on Tashir (the battlefield that introduces it), and three rows of 5.2 are not
met (reported by the builder, for the owner).

## Findings

### 1. Major: a Stores placed just before a clear and sold in the undo grace pays and refunds in full

Evidence: `sellRefund` (index.html 13335) gives the full price back for 5 s after a placement (`fresh`), with no regard
to a clear in between. Probe `review/G7b/exploit.js` (Tashir, wave 3 on the field, its last foe gone): two Stores placed,
`endWaveIfClear()`, both sold at once:

```
{"afterBuild":-320,"afterClear":-192,"paid":60,"step":1,"toast":"Wave 3 repelled! +34 gold · +34 interest · +60 stores",
 "afterSell":128,"toast2":"Placement undone: full refund","stores":0}
```

The 60 gold is kept and the 320 comes back. The grace runs on `performance.now()`, so it is 5 s of real time: 10 s of
game time at 2x and 20 s at 4x. A player who taps the tile and a pad as a wave's last foe falls, then sells, earns
`pay x payStep` per Stores at every clear for nothing: no pad held, no hunter risk. On a wave that pays for two script
waves it is 120 per clear. It moves `earned`, the thrift part of the score and the ranked boards.

Fix proposed: a tower placed before the last clear is not fresh. In `placeTower` keep `t.placedClear = lastCleared`, and
in `sellRefund` `fresh = ... && t.placedClear === lastCleared` (a resumed tower already has `placedAt: -1e9`). A narrower
fix is `&& !t.yielded`. Add to suite 2's pay check: place, clear, sell at once; the refund is the sale price, not the
full price.

### 2. Major: suite 2's Stores checks do not fail when most of the Caravan's and the Field Forge's rules are broken

Evidence: mutants of the page (`review/G7b/mk.py`, `mutants.txt`), each run through suite 2's checks named
`^(stores|tray|ruleset|daily: 12|resume|tricks: save)` (11 checks; the unmutated page passes them):

| Mutant | Suite 2 |
|---|---|
| A. the Standards' plunder and a Caravan's share stack (`share += plunder`) | PASS (not caught) |
| B. a wrecked Caravan still pays its share | PASS (not caught) |
| C. the Field Forge works at any distance (no range test) | PASS (not caught) |
| D. a wrecked Field Forge still mends and cuts repairs | PASS (not caught) |
| E. no cut on the rebuild (only the repair) | PASS (not caught) |
| F. the clear's toast does not name the Stores' gold | PASS (not caught) |
| L. the panel's "paid so far" row is gone | PASS (not caught) |
| G. `yielded` not saved in the run | caught (the resumed run) |
| H. the pay booked as `clear`, not `stores` | caught (the pay check) |
| I. the refusal sentence changed | caught (tray, stores, pin) |
| M. Ani's card claims a trade | caught (the card check) |
| J. the daily's earnMax leaves the Stores out | caught only by the pin |
| N. the Stores' strength 24, 30, 38 | caught only by the pin |

A is 3.3's own rule ("does not stack ... nor with the Standards' plunder"); the check's kill has no Standards near it.
J and N pass every Stores check and fail only `RULESET_PIN`, which a builder rewrites with `node tools/ruleset.js`.

Fix proposed, in the pay check: a Standards (drums at Plunder) beside the kill with a Caravan standing: the kill pays
`b + ceil(b * 0.3)`, not more; the Caravan wrecked: `caravanShare()` is 0; the forge wrecked: `forgeOf(T, "mend")` and
`forgeOf(T, "repair")` are 0; the archer moved out of the forge's 220: both 0; `rebuildCost(T)` 25% under the same tower's
cost with the forge at Caravan; the clear's toast holds "+N stores"; `statText(A)` holds "paid so far" and A's
`yielded`. For J: `rulesetData().daily.levels.tashir.earnMax` grows when the Caravan's pay is raised, as the campaign's
does; for N: `towerMaxHp` of a Stores at each rank is `[240, 300, 380]` times the difficulty's multiplier.

### 3. Major: on Tashir, where the Stores are first offered, one Stores as the third building loses the battle

Evidence: `docs/specs/balance/g7b-normal-seeds3.txt` and the reviewer's rerun (`review/G7b/bal-normal.txt`, below):
Tashir greedy 1/3 won, ending 6.3 under mix, 6.3 more lost by the end of the first commander's wave (5.2 asks 1 to 2
more and an end within 2). At 3.3's price of 120 the same build ended 1.3 under mix (`g7b-trials/n3-price120.txt`);
140 (p3), 150 (p5) and 160 all give 5.7 to 6.3. The reviewer's playtest by finger (`review/G7b/play.js`, Tashir,
Normal, the starting purse, the bot's order with the Stores third, Auto at 2x, no spells or masteries): at the horns
of waves 1 to 5 the iPad's lives were 20, 20, 18, 15, 6 and the stand fell on wave 6; at the iPhone SE size 20, 19, 17,
15, 7 and it fell on wave 9. The same player and order without the Stores (mix, iPad): 20, 20, 20, 20, 14, and it fell
on wave 10. (This player is weaker than the bot, who wins the mix there with 8.0: the numbers compare the two orders,
not the battle's band.) The card shown on Tashir's
brief invites exactly this build ("gold later for a tower now"), and the playtest the builder ran
(`tools/playtest-stores.js`) sets the purse to 2000 and raises the shooters to their third rank by script, so it never
meets the cost.

The builder reports the row as NOT met. It is a major because it is the battlefield where every player meets the tower,
on the first play.

Fix proposed: the owner rules on it with the rows of finding 4. Before he does, two trials on Tashir alone at SEEDS=3:
`STORES_RANK=never` (is it the bot's ranking or the pad?), and the Stores' first rank at 120 with the second Stores at
200 (a field's second costs more: it answers bazaar and keeps 3.3's price for the one-Stores board; it does not answer
Sevan's greedy 18.0 at 120, so Sevan needs its own look). And `tools/playtest-stores.js` gains a mode with the starting
purse and no scripted ranks, which fails if one Stores built third on Tashir loses where the same order without it holds.

### 4. Major: three rows of 5.2 are not met (reported by the builder, for the owner)

Evidence: `g7b-normal-seeds3.txt`, `g7b-easy-seeds3.txt`, `g7b-hard-seeds3.txt`, README G7b.
- The Stores in the best build on a third of their battlefields: Normal 1 of 6 (bazaar on Sevan), Easy 2, Hard 2.
- greedy's gold invested 6 to 10% above mix: +4.7, -54.5, +15.5, +5.8, +2.3, +3.5% (none in the band).
- greedy's end within 2 of mix: NOT met on Tashir (-6.3) and Mari (-7.3, a commander at the walls on every seed).
- The endless row (three battlefields where mix7 falls 8 to 20 beyond): met on Dvin and Tashir only, 2 of 3 over the
  17. README G7b gives the numbers but does not say "NOT met" for this row; G7a's review asked the same.

The measure of "gold invested" counts what stands on the board at the end, so a full board (every pad built, every tower
mastered) cannot show the Stores' gold. That is a fault of the measure as much as of the tower.

Fix proposed: the owner rules on the three rows. Report the invested row also as `earned` and `spent` (the facts have
both) so the owner sees where the Stores' gold went; README G7b says "NOT met" for the endless row.

### 5. Minor: the Council's line reads "Drums, posts and the Horse Lines and the Stores"

Evidence: probe `review/G7b/council.js`: the Captains' tiers read "Men return 7.5% sooner; the Horse Lines and the Stores
cost 5% less" and "Drums, posts and the Horse Lines and the Stores: masteries cost 7.5% less". `ageTowersNamed`
(index.html 10941) joins with "and", and the tier line already has one. Also: the Captains' fourth and fifth tiers now
discount the Stores on six battlefields, and `KIT=par HERO=hold` was not run on them (see "What could not be checked").

Fix proposed: the fifth tier's line "Drums, posts, {age}: masteries cost 7.5% less" with `ageTowersNamed` joining by
commas and a last "and" ("Drums, posts, the Horse Lines and the Stores: ..."), and the run of `KIT=par HERO=hold SEEDS=3`
on the six against `KIT=none` for the bound of 2.3.

### 6. Minor: Dvin's sourced line is on a card few players will see

Evidence: `storesHistory` (index.html 15185) adds Procopius only when the card is first shown on Dvin. The card is
shown once (`hs_towers_seen`), and it is due first on Tashir, the battlefield that opens the Stores (suite 2 checks that
Tashir's card has no Procopius). A player sees Dvin's line only if he goes back to Dvin after Tashir opens and before
he fights Tashir. 3.3 asks for "one sourced sentence ... for the tile's card".

Fix proposed: show the line where Dvin's Stores are met every time: under the Granary's `depicts` in the tile's
tooltip on Dvin, or in the Stores' panel on Dvin (one short row), and keep it on the card too.

### 7. Minor: the panel's words on the phone and one word short

Evidence: `shots/g7b/panel-dvin-forge-667x320.png`: the row "+10% mended at each clear nearby" breaks with the words
on a line of their own under the number. "gold a wave" (index.html 57610) is the pay for each script wave; a wave that
stands for two pays twice (suite 2's pay check: a wave 4 with a payStep of 3 paid 282 for two Stores of 64 and 30
a wave). "-25% repair cost nearby" also covers the rebuild.

Fix proposed: shorter words that fit one line at 667 x 320 ("+10% mend nearby"); "gold a wave held (more for a long
wave)" or the pay of the next wave (`pay x payStep(waveIdx + 1)`); "repairs and rebuilds nearby".

### 8. Minor: tools/balance.js's header says the Stores are "ranked and mastered as any tower"

Evidence: tools/balance.js 145 says so; the default is `STORES_RANK=last` (ranked and mastered after every fighting
tower) and README G7b says that.

Fix proposed: the header names STORES_RANK, its three values and its default.

### 9. Minor: the 8.4 playtest is a scripted check, not a play of the decision

Evidence: `tools/playtest-stores.js` sets `gold = 2000`, builds five shooters and two Stores at once, raises the shooters
to their third rank by script and plays six waves. It shows the taps work (they do: the reviewer's own run had no slip
on the Stores and its tile, panel and Upgrade by finger at 1194 x 834 and 667 x 320) but not what 8.4's Tashir play is
for: whether the decision reads and feels right with the battle's own purse. See finding 3 for what that play found.

Fix proposed: as in finding 3, a mode with the starting purse.

### 10. Minor: the daily's skipped pairs were not run again with the Stores in the daily's tray

Evidence: README G7b says so. The daily has every tower, so on the six battlefields its best build may change (it did on
Sevan: DAILY_PAR 1373 to 1328). A tower added can only help the best build, so `daily.skip` stays on the safe side; but
a pair skipped only because it was too hard may now be fair.

Fix proposed: `DAILY=1` with the twists on the six (as G6 did) before the stage closes, or a note for the owner.

### 11. Minor: the builder's "not done" list names a file that is done

Evidence: `docs/specs/balance/ruleset-2-g7b.json` is in commit 62f93c4, and its SHA-256 (JSON.stringify of the parsed
file) begins `04888354`, the page's `RULESET_PIN`. The report says it was not saved.

Fix proposed: none in the code; the stage's status page takes the file as done.

### 12. Minor: suite 1 alone now runs 121.2 s of its 125 s budget

Evidence: `timeout 900 node tools/selftest.js --suite=1` alone (load about 3.5): PASS, 151 checks, 121.2 s. The builder
measured 114.2 s; G7a's review measured it lower. Suite 1 is untouched, but the page it photographs grew (the Stores'
art, the tray of seven on six more battlefields). Under the other track's load it runs 151 to 213 s.

Fix proposed: none in G7b; the stage's status page names it, so that G7c to G7e measure suite 1 alone before and after.

## What was rerun, and its results

[RESULTS]

## What could not be checked

[NOTCHECKED]
