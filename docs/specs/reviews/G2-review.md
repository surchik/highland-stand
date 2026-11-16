# Review of G2, the War Council (gameplay track)

Reviewed: commit 5662888 on gp/work (parent 15331ba, the merge of p0-done), index.html sha256
5ba75f30fcb6abc336f9da3748a746b846d19fb62d67503bc1970c30749bef3e. The whole change was read line by line
(`git diff 15331ba 5662888`: index.html, tools/balance.js, tools/ruleset.js, tools/council-shots.js, tools/regress
doors.js, iphone.js, lib.js, vic.js, docs/specs/balance). Every acceptance test was run again to its end, and the
claims were probed with scripts of my own (the probes, their output and photos are in the session scratchpad under
`top/build/review/G2/`). No package code was changed.

REVIEW G2: 0 blockers, 3 majors, 10 minors.

## Findings

### 1. Major: `councilMerge` cuts the cloud's Council by this device's old records (it is not a pure merge)

`councilMerge` (index.html 9933) ends with `councilSane(c)`, and `councilSane` (9904, line 9913) reads
`starsEarned()` and `councilTierOpen()` from this device's own `hs_records` and roads. The platform's
`Cloud.merge(mine, theirs)` is "a pure function of two documents" (platform.final.md 4.4): the merged records are
not on the device yet when a key's function runs. So on a device with fewer stars, the account's Council is cut down,
keeps its `n`, is written to the device and is pushed back to the cloud.

Evidence (probes/p1.js, a fresh save, as a new device at its first sign-in):

```
councilMerge(null, {"own":{"bows":3,"engines":3,"captains":2,"heralds":3,"stewards":2},"n":5})
-> {"v":1,"own":{"bows":0,"engines":0,"captains":0,"heralds":0,"stewards":0},"n":5}
```

Effect: the player's tiers read as gone on the new device and in the cloud. The old device puts them back only at its
next pull (a tie on `n`, per branch the larger). If the player takes any tier on the new device first (`n` 6), that
copy wins everywhere and the whole earlier arrangement is lost (the stars come back unspent, but the player did not
ask for a reset). The suite 2 check "the cloud's merge keeps the later change, and councilSane cuts a forged value"
stages the records first, so it holds this behavior in place rather than catching it.

Fix: make `councilMerge` pure. The larger `n` wins, on a tie per branch the larger, each value clamped by
`councilParse` (whole numbers 0 to 5) and nothing more. Do not call `councilSane` there: `councilLoad` already applies
it on every read against the records then on the device, so a forged or overspent copy never counts. Change the suite
2 check to: with `hs_records` removed, `councilMerge(null, cloud)` returns the cloud's `own` and `n` unchanged, and
`councilLoad()` of a forged copy is still cut. Tell the platform track (its P3 `Cloud.merge` unit cases) and note
in gameplay.final.md 4.7 that `councilSane` runs at read, not in the merge.

### 2. Major: the "War Council opens" card put away by a press beside it leaves its state behind and swallows a key

The card uses the trick card's frame with `read: true` (13016). The trick card's own handler (55024) closes a `read`
card on a press on its backdrop through `closeTrickCard()`, which knows nothing of `unlockCardOn`. After a click
beside the card:

```
after:    {"unlockCardOn":"council","trickCardOn":false,"cls":"unlock","seen":[],"hall":false}
Enter on the map -> the Hall opens on the Council; unlock_seen and council_open are sent only then
Escape in a battle (probes/p2.js) -> swallowed by the card's capture listener (13039); the battle's own Escape
(cancel placing, close the panel) does not run
```

The card is also not remembered (`hs_towers_seen` has no "council"), so it comes back at the next load, and
`councilCardDue()` stays false for the rest of the visit. A press beside a card is the usual way to put it away on
a phone and with a mouse.

Fix: in `closeTrickCard()` start with `if (unlockCardOn) { closeUnlockCard(false); return; }`, and in
`dropTrickCards()` clear `unlockCardOn` and the `unlock` class. Add a check (suite 2 or iphone.js): the card shown,
a press on its backdrop, then `unlockCardOn === ""`, `towersSeen()` holds "council" and one `unlock_seen` was sent.

### 3. Major (risk): the PAR bound is held exactly at its edge, on a sample that underweights the large kits

I reran the bound on RULINGS E's sample (Normal, SEEDS=1, KIT=none, par, cap; logs in review/G2/bot/). The numbers
reproduce the builder's exactly: best build's defenders, kit minus none, Erebuni to Sevan, Sis, Van, Shushi:

```
par  0 -2 1 3 -1 5 4 3 5   mean 2.00 (bound 2), max 5
cap  0 -1 0 5 1 5 4 6 5    mean 2.78 (bound 4), max 6 (bound 6)
```

So the ruled sample passes, but at the edge (PAR mean exactly 2.00, CAP max exactly 6), and the builder's own note
says one more gold at the start moved two cells by 2. The bound is "the mean over the 17"; the sample has three
Chapter I fields where PAR is 0 to 4 stars. Over the six sampled fields after Chapter I the means are PAR 3.17 and
CAP 4.33, both over their bounds, and eight of the 17 (Ani, Mari, Gyumri Road, Halidzor, Musa Dagh, Sardarapat,
Stepanakert 1992 and 2023) carry the largest kits and were not measured. FLOOR (2.11) reading above PAR (2.00)
shows how much of the table is noise at one seed. RULINGS E keeps G2 to this sample, so this is not a failed
acceptance, but the bound of 5.2 is not shown to hold.

Fix: record in docs/specs/balance/README.md (G2 section) that the bound is held at the edge on the sample and is not
resolved at SEEDS=1, with the post-Chapter-I means above. Make KIT=par and KIT=cap on all 17 at SEEDS=3 (8.3 b) a
gate of G4's tables before any Open board is published, and cut the Council there if the 17-field mean breaks 2 or 4
(the Bowmen branch drove most of the excess in the builder's experiments).

### 4. Minor: on a phone held sideways the growth line can drop the defenders tally (Sis) or the closing words

`victoryGrowth` (12961, line 12973) removes the last sentence of `#ovSub`. On most fields that is "Your army still
stands: hold forever, if you dare.", which is fine. But (probes/p3.js at 667 x 320, iPhone UA):

- Sis (`noEndless`): the last sentence is the tally, so "...with 16 defenders to spare on Normal." is gone
  (`tallyKept: false`). On Sis after a resumed wave the debt line would go instead.
- The campaign's closing page loses "Return to any of them on a harder difficulty, or hold forever here."
- It sets `textContent`, so any markup `richText` gave the prose is flattened.

Fix: drop only the endless invitation (build the prose without it when the growth line shows); where the page has
none (`L.noEndless`, the closing page) keep the prose whole and show no growth line (the map's tally is the door, as
4.6 says). Add the Sis victory to iphone.js's growth check (today it checks Ani only).

### 5. Minor: the victory page's "Spend N stars" button is stale after spending

`syncCouncilDoors` (12885) refreshes the map's tally and the chronicle's row, not `#ovGrowth`. probes/p5.js: after a
victory, the Hall opened from the button, every open tier taken and the Hall closed, the button still reads "Spend 5
stars at the War Council" with 0 stars left. Fix: in `syncCouncilDoors`, when `menuMode === "victory"`, hide the row
if nothing can be bought, else rewrite its count.

### 6. Minor: the coached stand's kit reset refunds land already bought

`startTutorial` (62502) sets `gold = startPurse()` when the kit is not empty and no tower stands, which ignores plots.
probes/p6.js: Erebuni with Stewards I, a plot bought (gold 230 to 80, `land` 150), then the tutorial started (the
Settings "Replay tutorial" fresh path): gold 220 with the plot kept, and the battle's numbers no longer add up
(`earned` 220, `spent` 150, gold 220). Fix: take only the kit's part back (`gold -= kitNow().purse` before
`setKit(KIT_EMPTY)`, and `battle.start` and `battle.earned` by the same amount), or add `plotsBought === 0` to the
condition.

### 7. Minor: text

- The card says "Tap the stars in the corner of the map to open it." To a mouse it should say Click (the chronicle's
  hint already chooses by `(hover: none)`), and on a phone the tally is at the top right of the page, beside the map,
  not in its corner. Proposed: "Tap (or Click) the stars at the top of the page to open it."
- "Spend them at the War Council on small, lasting gains for your towers, your hero, your spells and your gold." is
  long for the house rule. Proposed: "Spend them at the War Council. Each gain is small and lasts."
- The Captains' column, on desktop and iPad, reads "Drums, posts and the special tower": two of the three are not in
  the game yet. Proposed: "Drums" until G5.
- Spelling (American), long dashes (none) and the history label ("The Council is a game system, not a record of
  history.") pass.

### 8. Minor: comments and the spec's table out of date

index.html 10532 says the Stewards' fourth tier "mends 5 points more" (it is 2); 11020 says the last tier "takes 15%
off" land (it is 10%). gameplay.final.md 4.2 still prints the first numbers, while 4.2 says each tier is "shown exactly
so on its card". Fix the two comments; put the numbers now in force in 4.2 (or a line there pointing to the balance
README's G2 section).

### 9. Minor: no `onSavesChanged()`

The platform calls `onSavesChanged()` after a merge if gameplay defines it, else `buildMenu()` only while a menu page
is up (platform.final.md 0.3, 4.4). Without it an open Council panel, the chronicle's chip and switch, and the
victory row are not redrawn after a merge. Fix: define `onSavesChanged()` to call `syncCouncilDoors()` and redraw the
Council tab when the Hall shows it (G3 adds the heroes to it).

### 10. Minor: `openBriefStandard` on a battlefield not open opens another field's chronicle with the switch on

probes/p5.js: `openBriefStandard(9)` with only Tushpa open shows Tushpa's chronicle with `standardBattle` on. A
platform door ("Fight for this board") would land on the wrong field. Fix: return false and do nothing when
`levelOpen(levelIndex)` is false; return true otherwise.

### 11. Minor: tests that do not hold their subject

- Mutation run (review/G2/mut/results.txt): 17 single changes of index.html, suite 2 run on each. 16 fail as they
  should (loadout tag, merge by `n`, Hard seal, kit in `getStats`, the switch, a Standard battle's kit, the star cut,
  the chapter gate, the coached stand, the growth row, a Council number and `KITSET_PIN`, a resumed kit, the reset's
  `n`, spending without the stars, the mastery's paid price, a tree taller than the phone box). One passes: the
  phone strip widened from 170 to 260 px; the check holds "inside the box", not 4.6's column.
- The merge check stages records before merging (finding 1).
- tools/regress/lib.js 118 marks the card seen after load, while the card's timer (600 ms) starts when the map is
  drawn during load; on a loaded machine a script whose save has stars to spend can meet the card. Fix: set a window
  flag from an init script (no storage write) that `councilCardDue()` reads, and keep the storage write for scripts
  that reload.

### 12. Minor: deviations the owner and the platform should know (accepted, not defects)

- The tally still reads "won/51" (suite 1 asserts "5/51"); the 68 are in its title only, and phones show no seal
  count. 4.1 asks for stars of 68.
- The pip is the platform's dot; the number unspent is in the title and the Hall tab's badge (4.1 asks for the
  number on the pip).
- The Council's numbers are the cut ones (builder's difference 1). KITSET stays 1: these are the first published
  numbers.
- `earnMax` (RULESET 1) assumes an interest cap of 60. A battle with Stewards III can earn up to 210 more (10 at the
  start, 10 a wave over 20 waves): about 2% of Erebuni's 12,450, inside the platform's 10% margin. The platform
  should not tighten that margin for Open boards.

### 13. Minor: the tally's title changed, and p0.js expects the old one

Not run here (the platform's scripts are the platform's), but the builder's note stands: the title now starts "War
Council: N stars to spend." and counts "of 68". The platform track must update p0.js's expectation; the Council tab
is now always present, so the Hall always has a tab.

## What I checked and found right

- Fairness: with an empty kit every number the kit touches is the table's (`kitSummary(KIT_EMPTY)` multiplies by 1,
  adds 0, keeps 20 s, 60, 0.7). RULESET 1, RULESET_PIN b065cbc7 and LEVEL_PIN are unchanged; `node tools/ruleset.js`
  reports KITSET 1 pin 577c476e matching. The loadout tag is `std` with the empty kit, with the switch on, in the
  coached stand, for a run saved before G2 (no `kit`) and for a run begun in a Standard battle; `open` with a tier in
  force and for a resumed run begun with tiers, whatever the Council holds by then (suite 2 and its mutants).
- The Council's rules: costs 1, 1, 2, 2, 3; a tier needs the one under it and its chapter; reset is free and whole
  and raises `n`; stars come from records with the Hard seal and are never stored; a forged copy is cut on read; a
  purchase never passes the stars on hand (`tierState` "short"); FLOOR, PAR and CAP equal 4.8's rows.
- The seam: no line P0 added was edited (every removed line of the diff checked against P0's added lines); the
  registrations are `CLOUD_KEYS.push` and `HALL_TABS.push` from gameplay's code after the functions they name; the
  Hall opens with the platform off (`file://`, doors.js).
- Listeners: the panel's two listeners are on a box rebuilt with each draw; the page-level listeners and the Hall's
  MutationObserver are added once.
- The pages: the photos at 1600 x 900, 1194 x 834 and 667 x 320 (two saves each) show the panel whole inside the
  Hall's box; vic.js pressed 249 buttons against P0's 198, so `#ogCouncil` was found and held to the rule on all 17
  battlefields at all three sizes.

## What I reran, with results

| Command | Result |
| --- | --- |
| `node deploy/check-page.js index.html` | OK, 1 inline script parses |
| `timeout 900 node tools/selftest.js --suite=all` | PASS, exit 0. Suite 1: 151 checks, 108.3 s of 125. Suite 2: 21 checks, 8.6 s of 125 |
| `run-all.js --only=doors,vic,iphone` (full) | SUMMARY 3/3 passed in 926 s. doors 18 doors, 6 battles, the usual 1 KNOWN (the town's card); vic 249 presses, 17 battlefields, 3 sizes; iphone 697 states at 10 sizes, 0 fails (it holds the Council state with its three tiers, reset and buy again at every size, 667 x 320 included) |
| `run-all.js --quick --only=padplace,plots,probe,nag,dance10,live` | SUMMARY 6/6 passed in 273 s |
| `node tools/town-isolation.js` | PASS, 9 cases |
| `node tools/council-shots.js <dir>` | OK at all 6 (1600 x 900 and 1194 x 834: box 680 x 561; 667 x 320 by touch: 579 x 304, no scroll); photos looked at |
| `node tools/ruleset.js` | KITSET 1: page 577c476e, tables 577c476e |
| `KIT=none CLOCK=1 balance.js 1 <sample>` | the win table's and the clock table's 9 rows equal docs/specs/balance/g1-normal-seeds1.txt's, cell for cell |
| `KIT=par` and `KIT=cap` on the sample | as in finding 3: PAR mean 2.00, max 5; CAP mean 2.78, max 6 (the builder's numbers exactly) |
| suite 2 on 17 mutants | 16 caught, 1 not (finding 11) |
| probes p1 to p6 | findings 1, 2, 4, 5, 6, 10 |

Each was run while the other track may have been testing; none failed, so nothing needed a rerun for load.

## What I could not check

- The merge against the platform's real `Cloud.merge` and a real second device: P3 is not built. Finding 1 is shown
  on the function the platform will call.
- The 17-field kit bounds and Hard with KIT=cap: outside RULINGS E for G2 (finding 3).
- Real iPhones and iPads: the touch runs are Chromium with an iPhone user agent and CDP touch.
- The heroes, the Call, the captains' strip and HERO=hold: G3.
