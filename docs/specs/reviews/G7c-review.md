# G7c review: the Powder Mine (`mine`)

Reviewed: branch gp/work, commit 6d2558c (tag g7c-done) against its base 1fe5a73 (G7b close). Independent review: the
builder's report was not taken on trust; every claim below was rerun or read in the code. No code of the package was
changed. Probes are in the reviewer's scratch folder (`review/G7c/probe1.js` to `probe4.js`, `playtest-mine3.js`, two
mutant pages).

REVIEW G7c: 0 blockers, 3 majors, 9 minors.

## Findings

### 1. Major: a save made during a wave keeps the mine's arming as it is now, not as it was at the horn

A run saved in the middle of a wave resumes from that wave's horn (`cleared` is the wave before), and spec 1.7 and 6.1
say the run keeps "a mine's arming, as they stood at the save (at the horn, for a wave fought again)": a resume gives
nothing back. `saveRun()` (index.html, the `phase === "wave" && waveStart` branch) puts the horn's kills, damage, hp and
the spells' clocks (`run.cd = sent.cd`) into the record, but `r.mine` comes from `runRecord()` as the charge stands now.
Every leave of the page during a wave saves (`holdOnLeave`), so this is the common path on a phone.

Evidence (`probe2.js`, Gyumri Road, 1600 x 900): the charge set to arm in 20 s, the wave sent, the horn's record holds
`arm: [20]`; the wave run until the charge arms; `holdOnLeave()`. Saved: `{"cleared":0,"mine":{"at":[[180,505]],"arm":[0],"trig":0}}`.
A reload fights wave 1 again from its horn with the charge already armed: 20 s of arming for free, as often as the
player likes. The reverse (a charge fired mid-wave comes back unarmed at the horn) costs an honest player.

Fix: in `saveRun`'s mid-wave branch, for every tower that stood at the horn, take `mine` from `sent.towers` (matched by
pad and type) in place of the current one; a mine built since the horn keeps its spot and trigger but its full arm time
(drop `arm`, `mineInit` then lays it fresh). The purse branch that already resumes from `sent` is right. Add to suite
2's mine check: arm 20 at the horn, armed mid-wave, `holdOnLeave()`, the saved `arm` is 20 and `resumeRun()` gives 20.

### 2. Major: on an iPhone SE an armed charge takes the finger meant for the tower beside it

The marker is read before the towers on every device (pointerdown, `mineUnderPointer`), with a catch of at least 22 px.
On a phone's small scale that catch can cover most of a neighboring tower's own tap zone, and then the tower cannot be
opened while the charge is armed: the press fires the charge instead (and wastes it).

Evidence: `probe3.js` (a mine on every second road pad, shooters between, every charge armed) samples each tower's
exact tap zone (`towerTapAxes`). Desktop and iPad: no tower touched. 667 x 320, Halidzor: the ballista on pad 7 has
22 of 29 sample points, its center included, under the armed charge of the mine on pad 6 (its default spot); also
three mines' own zones (10/29, 8/29, 1/29) and on Gyumri Road a catapult (4/29). `probe4.js` confirms it with a real
finger: Halidzor at 667 x 320, a mine on pad 6 (armed, by hand) and a ballista on pad 7, one tap on the ballista's
middle: `{"blasts":1,"panelFor":null}`. At 852 x 393 the same tap opens the ballista. probe.js does not see it: it holds
every charge at `armT = 1e6` while it presses the towers.

Fix: in pointerdown, let the marker win only where it is the nearer claim: compute the tower under the press with
`towerUnderPointer(e, phoneTouch)` and its normalized distance, and fire the charge only if the press is nearer the
marker (normalized by its catch) than the tower's zone center (normalized by its axes), as `phoneTapPick` already
weighs a tower against a plot. Then make probe.js press each tower once with the charges armed on the phone pass
(Halidzor and Gyumri Road in its phone list), failing on a blast or a missing panel.

### 3. Major: Gyumri Road on Hard: the mine gives +3.4 defenders over the best board without it (3.1 rule 2: at most 2 to 3)

Rerun at SEEDS=3 CLOCK=1, cell for cell equal to the builder's tables: Hard, Gyumri Road, greedy (the mine third)
3/3 6.7 against the best without a mine, mix 2/3 3.3c1. 3.1's rule 2 ("with it the best build keeps at most 2 to 3 more
defenders than without it") is a design rule of all five towers, not a Normal-only band. The builder names it for the
owner but ships it as is. The cause is plain in the damage table: a mastered mine deals 20,330 (Great Charge) and
19,904 (Twin Fuses) per 100 gold in the bot's hands, twice the best mastered shooter (catapult.a 9,868), firing 15 to
19 times a battle.

Fix: try the masteries at two times 3.4's blow (2,600 and 1,240) or their arming at 3.4's own (24 and 20) before
anything else (5.3 knob 4), and rerun Normal and Hard on the two: the mine must stay in the best build on Gyumri Road
Normal (it leads there by 1.0 only) and Hard must come to +3 or less. If no setting does both, the owner rules on the
Hard cell; say so in README G7c as "NOT met" rather than "for the owner".

### 4. Minor: the armed marker's sparks pile up while the game is paused

`drawMineMarks` (a draw function) pushes a spark into `particles` on about a quarter of frames for every armed charge.
Particles age only in `update()`, which does not run while paused, on a card, under the coach's freeze or on the
victory page, but `draw()` does. `probe1.js`: one armed charge, paused 5 s: `particles.length` 0 then 44, never falling.
Ten minutes of pause is about 5,000 per charge, drawn every frame, and all thrown up at once on resume. (G7a's rider
dust in `queueHorseRiders` has the same pattern while a ride is frozen.)

Fix: push the spark from `mineTick` (game time) instead, or only when `battleLive() && !paused` and `update` ran this
frame.

### 5. Minor: the card says siege engines "shrug off most of it"; they do not

Armor is a flat cut (`armorCut`: `dmg - armor`, at least 20%). Engines carry 12 to 28. A rank 1 blast of 780 loses 2% to
4% to it. The card's second line ("Outflankers are untouched, and siege engines shrug off most of it.") tells the
player something false, against the house rule that the game's words say what it does.

Fix: "Outflankers are untouched. Siege engines take the blast, but they are built to soak it." or simply "Outflankers
are untouched."

### 6. Minor: suite 2 does not fail when the blast stops dropping shields, or the drums stop speeding and strengthening it

Mutant A (scratch copy of the page): the shield-guard drop removed from `mineFire`; arming with no drums' haste and no
`towerPace` (a damaged store arms as fast as a whole one); the blast without the drums' might. `selftest.js --suite=2`
on it: PASS, 50 checks (`mutA.log`). Mutant B (an unseen scout counts for the trigger): caught ("an unseen scout counted
for the trigger"). 3.4 names the shield drop; the stats panel and the drums' aura promise the other two.

Fix: in the second mine check, put a shield guard (`guardDrop`) in the blast and assert `shieldDownT`; stand a drum by
the store and assert a shorter arming and a bigger blow; damage the store below its failing line and assert a slower
arming.

### 7. Minor: "a commander counts as three" is a new rule outside 3.4, and its reason holds only at CLOCK=1

3.4's trigger counts ground foes; the build adds `MINE_RULES.boss = 3`. 5.3 lets a package tune its tower's numbers, not
add rules. README G7c says without it "no mine build beat the board without a mine". Rerun with `PATCH='MINE_RULES.boss = 1'`:
true with CLOCK=1 (Gyumri Road Normal: greedy 10.0, minemix 11.0, catapults 12.0), false at WAIT 0 (greedy 13.0 against
catapults 11.0). The reason is a measurement of the 4 s wait, not a property of the tower.

Fix: list it with the owner's items in stage status as a rule change, with both measurements; keep it meanwhile.

### 8. Minor: the panel and the card say "tap" to a mouse

`statText`'s last row says "Tap its match to fire." and the card says "tap the glowing match to fire it" on every
device; the arming toast already chooses "Tap" or "Click" by `(pointer: coarse)`. Fix: the same choice in both lines.

### 9. Minor: two of 5.2's rows are reported as met where they do not measure the mine

(a) mix7 builds the special tower 15th and these battlefields have 14 pads, so mix7 never builds a mine: its row
("mix7 keeps 1 to 3 lives more than mix") says nothing about the mine, and README G7c should say so instead of "met
as G5 left it". (b) The endless row asks that "a mix7 board and a harriers board" fall 8 to 20 waves beyond; on Gyumri
Road harriers loses the chronicle, and mix7's 9, 10, 9 is again a board without a mine. Counting Gyumri Road toward
"met on three battlefields" needs the owner's reading. Fix: reword both lines in README G7c.

### 10. Minor: a wrecked store's charge that was laid but still arming can never be fired

3.4: "a wrecked store's laid charge can still be fired once". The build stops arming on a wreck, so only a charge
already armed can go. Either reading may be right; the spec note under 3.4 does not list it among the differences. Fix:
add it to the note (difference 7), or let a wrecked store's charge finish arming and then fire once.

### 11. Minor: Twin Fuses' Fire button and X fire both charges at once

`mineFireAll` fires every armed charge, even the one with no foe over it, which then spends 16 s arming. 3.4 says "the
tower's Fire button" fires it, so this is within the words, but a Twin Fuses player loses half his mastery to the
button the panel offers first. Fix: Fire (and X) fires the armed charges with a seen ground foe in their blast, all of
them if none has one; or say in the tooltip that it fires both.

### 12. Minor: the builder's report is inexact in two places

It says "four new mine checks"; there are three (`check("mine: ...")` lines 89212, 89257, 89339; 47 + 3 = 50). The
8.4 playtest names three devices; the builder ran two (the iPhone 15 from the Home Screen at 852 x 393 was skipped). I
ran it (below): PASS. Fix: add 852 x 393 to `tools/playtest-mine.js`'s list.

## What holds (checked, no finding)

- Rules: offered only on Gyumri Road and Halidzor, from Gyumri Road's first play; key 7; refused with "No road in reach
  of this pad." where no road lies in reach (`needsRoad` in `placeTower` and the preview); no limit; the blast skips
  outflankers (`e.fly`, the stone's rule) and foes outside it; damage booked to `adapt.other`; a stun pauses arming;
  a rebuilt store lays its charge again; selling while Lay the charge is armed clears it (`sellTower`, probe1); spells
  and the hero's move are read before the marker in pointerdown; the speed button changes nothing (game time).
- Saves: today's runs resume (run-fixtures 8 PASS); a run saved before the mine (tray without it) still validates and
  refuses a mine; forged spots and arm times are clamped (suite 2).
- The Fire button counts down while the panel is up (probe2: "Arms in 22s", then "Arms in 17s" after 5 s).
- Text and history: the Chaldiran line is in docs/history/era-dossier.json and in Gyumri Road's own facts; both cards
  end with the invention line; no claim on Halidzor; no long dashes in the new player text.
- Balance: every cell of `g7c-{normal,hard,easy}-seeds3.txt` reproduced exactly. With the trigger at 5 (a patient
  player, WAIT 0) the bot's greedy falls from 14.0 to 9.7 on Gyumri Road: waiting for bigger crowds does not trivialize
  it in the bot's hands. agemix and harriers lose every seed on all three difficulties. The Council at `KIT=par
  HERO=hold` on the two: Gyumri Road's best stays 17.0 (mix7, as at G5's close) while its Standard best rose from 12.0
  to 13.0, so the mine lowers its par-hold excess there; Halidzor's best is balldrum 16.0 with no mine in it. The kit's
  2.3 bound is not threatened by this package.
- RULINGS S7: no PF block and no line of table 0.4 touched (`git diff 1fe5a73 6d2558c` shows none).

## What I reran, and the results

All on gp/work at 6d2558c, beside the platform track's tests (its iphone.js and others; load 5 to 20).

- `node deploy/check-page.js index.html`: OK.
- `node tools/run-fixtures.js check`: PASS, 8 fixtures.
- `timeout 900 node tools/selftest.js --suite=all` at load about 20: did not start, `page.goto` timed out at 300 s on
  suite 1. Rerun one suite at a time:
  - `--suite=2` alone at load 17: every check passed (50), FAIL on the budget only, 180.9 s of 125.
  - `--suite=1` alone at load 8 to 17: every check passed (151), FAIL on the budget only, 166.3 s of 125.
  - RESULTS_AT_LOW_LOAD
- `node tools/town-isolation.js`: PASS, 9 cases (first run, no hang).
- `NODE_PATH=$(npm root -g) node tools/regress/run-all.js --quick`: RUNALL_QUICK
- `run-all.js --only=padplace,probe,iphone,live` in full: RUNALL_FOUR
- Balance (SEEDS=3, CLOCK=1, every build): Normal, Hard, Easy on gyumri,halidzor: identical to the builder's tables.
  Variants (SEEDS=3): `PATCH='MINE_RULES.trigger = 5'` (WAIT 0); `PATCH='MINE_RULES.boss = 1'` at WAIT 0 and at CLOCK=1;
  the page as built at WAIT 0; `KIT=par HERO=hold` on mix, balldrum, catapults, firemix, mix7, halfpost, greedy, bazaar,
  minemix. Results quoted in findings 3 and 7 and above.
- Playtest 8.4 (`tools/playtest-mine.js` with 852 x 393 added): PASS at 852 x 393, 1194 x 834 and 667 x 320, 397 s,
  five hand blasts on crowds of 3 to 5 at each size, no missed tap, no self-firing, no panel opened by a marker tap,
  20 of 20 through wave 5. How it felt: the glowing match is easy to find and hit at all three sizes, and Arms in Ns
  tells you when to look. But the playtest raises the shooters to their third rank by script and stops at wave 5, so
  "20 of 20" says nothing about balance; and it is Gyumri Road only, where the finding 2 overlap is small.
- Probes: probe1 (paused sparks; sale during Lay), probe2 (mid-wave save; Fire countdown), probe3 (marker catch against
  every tower's tap zone at three sizes), probe4 (the real finger tap of finding 2). Mutants A and B of suite 2.
- Photos: the builder's 45 in shots/g7c/ looked at (the ages, ranks, panels, Lay, cards, tray at the three sizes): the
  panel fits the SE sheet with Lay, Fire, the trigger, both masteries and Sell; the card fits at 667 x 320.

## What I could not check

- The suites' time inside their budget: the machine never fell below a load of about 5 while I could run them. The
  builder also saw suite 1 over budget at load 4 to 9 on both this page and its base; a low-load measure is still owed
  by the next agent before the close.
- The Council's mean over all 17 at par-hold (only the two battlefields were run); Halidzor's firemix at par-hold
  read 13.7 here against 17.0 in G5's close table, a change I could not trace to this package (no mine in that build).
- A human hand on a real iPhone; everything above is headless Chromium with CDP touches.
