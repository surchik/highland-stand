# G7e review: the Observation Post (`spotter`)

Reviewer: an independent agent who did not build it. Package: commit 1cfe006 on gp/work, on top of 025edb6 (G7d close).
Read: gameplay.final.md 3.1, 3.6, 3.7, 3.8, 2.6 to 2.9, 5.1 to 5.6, 8.1, 8.4, 9.1; RULINGS whole; the G5 review; the
whole diff of 1cfe006 (index.html 523 lines, tools/balance.js, playtest-spot.js, iphone.js, live.js, padplace.js,
probe.js, docs). Probe scripts and logs: the reviewer's scratchpad, `review/G7e/` (probe1.js, mut/, bal/, *.log).

REVIEW G7e: 0 blockers, 0 majors, 7 minors.

The tower does what 3.6 says. Its numbers are 3.6's to the digit. One multiplier (`markMult`) is applied once per blow.
That covers every place a blow lands: `damageEnemy` (towers, the post's men, Horse Lines, the mine, spells, Fire
Direction), the hero's blow, the fire altar's burn, `burnT` and the pitch pots. A grep of every `.hp -=` in the page
found no other path. Commanders take half. A marked scout is seen, and outflankers and drones are marked. A fallen or
leaked foe loses its mark (both set `e.dead`), and so does one that leaves the reach. Stunned or wrecked, the post marks
nothing. The limit is one, with its sentence, and the tile dims. The run saves the tray and the order. 5.2's two rows
hold, and they hold even against builds made to beat them (see 5 below). Every acceptance test I ran passed except
suite 1's budget, which fails on the base page too. The findings are small.

## Findings

1. **minor: a retarget or a sale while paused leaves the old mark on the field until play resumes.** The Target handler
   (index.html, `showPanel`, `if (def.mark) t.marks = [];`) and `sellTower` empty the post's list but leave `e.spotAmp`
   on the foe. `drawSpotMark` draws from `e.spotAmp`, so the ring and tick stay on the old foe while the game is paused.
   Evidence (probe1.js, both 1600x900 and the 667x320 phone): paused, Target pressed, `{"prio":"weak","strongAmp":0.15,
   "strongMult":1.15,"marks":0}`. Sold while paused, the weak foe kept `spotAmp 0.15, markMult 1.15`. Both clear on the
   first frame after resume (`afterFrames [0,0]`). No blow lands while paused, so only the picture is wrong. But "a
   retarget moves the ring at once" (the build report) is not true while paused, and a player who pauses to plan sees
   the old ring. The playtest hides this: its watch calls `spotTick(0)` itself after the press (finding 6).
   Fix: put the marking half of `spotTick` (the filter, the fill by `sortByPrio`, setting `spotAmp`) in its own
   `spotMark(t)`, with no shell and no clock. Call it from the Target handler. Before the handler empties `t.marks`, zero
   `spotAmp` on the old marks and set `spotOn = true`. In `sellTower`, zero `spotAmp` on a sold spotter's marks.

2. **minor: suite 2 does not cover the mark on the fire altar's burn or on the catapult's pitch pots.** I ran mutants of
   the page through `node tools/selftest.js --suite=2 <copy>` (logs in `mut/`):
   - `markMult` returning 1: caught ("a tower's blow on a marked foe: 100").
   - the hero's blow without the mark: caught ("the hero's blow on a marked foe: 34").
   - no half on a commander: caught ("a marked commander took 115").
   - no `max`: caught ("one on a field: 2", plus the ruleset pin).
   - both the altar burn's (`st.burn ... * markMult(e)`) and the pots' (`slotMult(e, q.src && q.src.type) * markMult(e)`)
     multipliers removed: **no check failed** (`"errors":[]`). The check's name promises "burns", but only the
     `burnT` path is tested.
   Fix: in the second spotter check, add two assertions. Put a fire altar in reach of a marked and an unmarked foe for
   one `update(0.05)`, and compare the two burns at the ratio `1 + amp`. Then push one pot (`e.pots = [{ dps: 100, t: 1,
   src: { type: "catapult" } }]`) on the marked foe and assert `100 * 0.05 * (1 + amp)`.

3. **minor: Fire Direction shells outflankers and drones, which the mortar it borrows cannot reach.** `spotShell` hits
   `t.marks[0]` whatever it is. The shooting loop skips a flying foe for a tower without `air`
   (`if (e.fly && !def.air) continue;`, index.html line 16502), so the 82 mm mortar crew never hits a drone. Fire
   Direction lands the same mortar shell, and its sound, on one. Evidence (probe1.js): an outflanker alone in reach,
   rank 3 plus Fire Direction, `{"flyerMarked":true,"shellOnFlyer":187.5}`. 3.6 does not say. "The marked foe is
   shelled" reads most naturally as a foe on the ground.
   Fix: shell the first marked foe that does not fly (`t.marks.find(e => !e.fly)`), and wait like an empty mark when
   there is none. Or, if the owner wants it, say on the mastery's line that it reaches the sky. Write the reading in the
   3.6 note either way.

4. **minor: the endless stand row is reported as met when it is not.** README G7e: "mix7 falls 4 beyond on Stepanakert
   1992 on every seed, under 5.2's 8". 5.2 asks for a fall between waves 8 and 20 beyond. Every earlier package
   (README lines 498, 585, 726, 832) reads it as a band and marks a fall under 8 "NOT met". Evidence (`ENDLESS=20
   JSON=1 SEEDS=3 CLOCK=1`, mix7, Normal, Stepanakert 1992): beyond 4, 4, 4. With the post's amp and shell set to 0 by
   PATCH it is 4, 4, 2. So the post does not cause the short stand: the battlefield does. Only the README's words are wrong.
   Fix: write in README G7e that the row is NOT met on Stepanakert 1992 (4, 4, 4, against 8 to 20). Say that the post
   is not the cause (4, 4, 2 without its mark) and that it is the owner's to rule on, beside G5's open cells.

5. **minor (for the owner, not a defect): the post is worth its mark but never its pad.** 5.2's cap holds. To test it,
   I added builds that put the post into the best builds, which the builder's tables never did (his "with" column is
   always mix7 or aid):
   - `ballspot`: ballista with the post 3rd.
   - `balldrumspot`: balldrum with the post 5th.
   - `mixspot`: the mix with the post 4th.
   - `balllate`, `bdlate`, `mixlate`: the same with the post late.

   SEEDS=3, CLOCK=1, all three difficulties (`bal/spot-d*.txt`, `late-d*.txt`):
   - No build with the post beats the best without it. The largest gain is Hard Stepanakert 1992's +0.3, the same as the
     builder's.
   - Built early, the post costs a win: Normal Shushi `ballspot` 0/3 w7 against ballista 3/3 14.3, and `mixspot` 0/3 w5
     against mix 3/3 3.3.

   The mark itself works. With amp and shell at 0 (PATCH, `bal/amp0-d1.txt`):
   - Normal Stepanakert 1992 `mixspot` drops from 11.3 to 6.0.
   - Stepanakert 2023 `aid` drops from 11.7 to 6.3.

   So it is worth about 5 defenders to the board that has it. Its cost is the best pad (rankAir gives it the archers'
   pad) and 90 gold early. The cells for mix, ballista, balldrum and mix7 match the builder's tables cell for cell on
   all three difficulties.
   For the owner: 5.2 caps the post and does not ask it to be bought, so nothing is owed. If he wants it chosen
   sometimes, the knob is its price (90), not its amp: the amp already moves a board by 5.

6. **minor: the playtest's watch changes the game it watches.** tools/playtest-spot.js calls `spotTick(0)` inside the
   page at every look and after every retarget. It also sets `paused = true` by script around the retarget.
   - `spotTick` re-marks, plays `uiTick` and, with Fire Direction ready, fires a shell (the playtest's post is rank 2,
     so no shell fired here).
   - Its check "after Target the mark is the first of that order" therefore tests the watch's own tick, not the
     game's. That is how finding 1 got past it.
   - The pause is a variable set by script, not the pause button pressed by a finger.

   Fix: read `t.marks` and `e.spotAmp` without calling `spotTick`. Allow one game frame after the press (unpaused) for
   the order to show. Pause with a tap on `#pauseBtn` if a pause is wanted. Once finding 1 is fixed, assert that the
   paused retarget moves the ring with no tick.

7. **minor: the panel's last line reads "0 kills · 0 damage dealt" on every post without Fire Direction.** The post
   deals no damage, so the shared tally row is always zero, and a player may read that as "this tower does nothing".
   Seen in the photo `panel-stepanakert92-rank1-*.png`. Fire Direction shows only its shells' damage
   (`panel-stepanakert23-firedirection-667x320.png`: "0 kills · 188 damage dealt").
   Fix: for `def.mark`, replace the tally row with the foes marked this battle (`t.markN` is already counted). If the
   extra damage is wanted, keep a `t.markDmg` added in `markMult`'s callers as `eff - eff / mult`. Example: "Marked 38
   foes · 2,140 more damage".

Read and found sound, with no finding:
- the limit and its sentence, the dimmed tile, key 7;
- `validRun` refusing two posts and a tray without the post, and a run from before the post resuming;
- the RULESET pin and the three revs (`node tools/ruleset.js` prints exactly the page's pins);
- `bookAdapt` booking the shells to `adapt.other`;
- the drums' haste and might on the shell;
- `uiTick` throttled, with `performance.now` used only for sound, so the battle stays deterministic;
- a stale mark on a leaked foe (cleared, since `leakFoe` follows `e.dead = true`);
- drones striking the post (stun drops its marks, as 3.6's note says);
- the foe card's line;
- text: American spelling, no long dashes in any added line, no history claim, neutral.

The two art departures (the Artsakh kit's `binoc` lookout instead of Silikyan's figure, and a ring painter of its own
instead of the hunters') are written in the 3.6 note. They are reasonable: the ring reads clearly in the photos. PF
blocks and table 0.4 are untouched (no line of PF-0, PF-CSS, PF-HTML or PF-MAIN is in the diff).

## What I reran, and the results

The other track was running tests the whole time (load 3 to 12).

- `node deploy/check-page.js index.html`: OK, exit 0.
- `timeout 900 node tools/selftest.js --suite=all` (load 1.6 to 3.6): suite 1 has 151 checks, all pass, at 147.2 s:
  FAIL on budget. Suite 2 has 57 checks, all pass, at 113.3 s of 125: PASS.
- Suite 1 alone, back to back:
  - the base page 025edb6 (git archive): 151 pass, 135.5 s, FAIL on budget;
  - this page: 151 pass, 133.8 s, FAIL on budget.

  The overrun is not this package's: the diff adds nothing to suite 1, and the base overruns the same way. It is
  G7d's finding 8, still open. Suite 2 is past the 100 s split line again (113 s here).
- `node tools/run-fixtures.js check`: PASS, 8 fixtures.
- `node tools/town-isolation.js`: PASS, 9 cases.
- `node tools/ruleset.js`: the pins equal LEVEL_PIN for the three fields, and KITSET 2 is unchanged.
- `node tools/regress/run-all.js --quick`: SUMMARY 11/11 passed in 2172 s, nag and dance10 included:
  - padplace 98 placed, 8 refused;
  - probe 126 probed, 9 rallies, 3 Target presses;
  - iphone 159 states;
  - live 3 levels;
  - platform 1064 s.
- `node tools/regress/run-all.js --only=padplace,probe,iphone,live` (full): SUMMARY 4/4 passed in 2274 s:
  - padplace 1265 placed, 71 refused;
  - probe 801 probed, 66 rallies, 10 Target presses;
  - iphone 797 states at 10 sizes;
  - live 17 battlefields.
- Bot, `SEEDS=3 CLOCK=1`, the three fields, all three difficulties, builds mix, ballista, balldrum, mix7 and my six
  post builds: the builder's cells reproduce exactly, and the post's 5.2 rows hold (see finding 5).
- Bot A/B with the post's amp at 0, Normal: see finding 5.
- Bot `ENDLESS=20`, mix7 on Stepanakert 1992, with and without the mark: see finding 4.
- mix7's bound over the 17: not rerun over all 17. The post changes nothing on the other 14, because no field there
  offers it and `markMult` returns exactly 1 with no post. On its three fields mix7's Normal cells equal G5's. So the
  bound stands where G5 left it: MISSED, and not moved by this package.
- Mutation tests of suite 2: 5 mutants, 4 caught, 1 not (finding 2).
- probe1.js (Playwright, 1600x900 and 667x320 touch): findings 1 and 3. No page errors.
- Photos: I checked the builder's 90 photos (the post in its age on all three fields, every rank and mastery, the
  panels, the card and the tray at 1600x900, 1194x834 and 667x320). I added two of my own under
  `shots/g7e/review/` (the Night Sights panel at 667x320, a Fire Direction field at 1600x900). The card reads whole on
  the SE. The sheet does not cover the tray's first tiles or the spell bar. The mark is a thin ring and a chevron,
  plain up close but small on the full 1600x900 field.
- `node tools/playtest-spot.js` (8.4 playtest 3, touch helpers, three sizes): PASS, 1056 s (see the last section).

## What I could not check

- A person's hands on a real iPhone. The playtest is the Playwright touch player, at the sizes of 8.4.
- The daily's +6.0 for "aid" on Stepanakert 2023 (README G7e). 5.2 binds the campaign's Normal only, so I left it as
  the builder reported it and did not rerun the daily tables.
- The Council (`KIT=par HERO=hold`) table: not rerun.

## The playtest (8.4, 3)

`node tools/playtest-spot.js --verbose`: PASS in 1056 s, at load 6 to 10.

| Size | Retargets | Orders | Looks with a mark | Marks set | Lives at wave 6 |
|---|---|---|---|---|---|
| iPhone 15 852x393 | 5 | weak, first, last, strong, weak | 593 | 38 | 12 |
| iPad 1194x834 | 5 | weak, first, last, strong, weak | 602 | 42 | 9 |
| iPhone SE 667x320 | 5 | weak, first, last, strong, weak | 592 | 39 | 12 |

At each size, the post was built from its tile and a second was refused with its sentence. A tap on its body opened
its panel, and Upgrade raised it.

How it felt, from the run and the photos:
- The post is easy to find and to tap at all three sizes.
- Target on the sheet is a 36 px button, as 3.8 rules, and was hit every time.
- The ring and the chevron show clearly which foe is marked. At 1600x900 on the full field they are small.
- Two gaps in what the playtest proves:
  - `hiddenMarked` is 0 at every size, because Stepanakert 1992 has no hidden foes (only Shushi does). The playtest
    never shows a marked scout being seen. Suite 2's check covers that rule.
  - The retarget is checked by the watch's own tick (finding 6).

## Close

- 1 fixed: a press of Target or a sale settles the marks at once (`spotTick(0, true)`: marks only, no shell, no reload);
  suite 2 asserts a paused retarget and a paused sale.
- 2 fixed: suite 2 asserts the mark on the fire altar's burn and on a pitch pot (both mutants now caught).
- 3 fixed: Fire Direction shells the first marked foe on the ground and waits when only the air is marked (the 3.6 note
  says so); suite 2 asserts it.
- 4 fixed: README G7e writes the endless row as NOT met on Stepanakert 1992, not caused by the post.
- 5 reported to the owner (the price is the knob), no change.
- 6 fixed: the playtest's watch never ticks the post, pauses with a finger on the pause button, and asserts that a
  paused retarget alone moves the ring.
- 7 fixed: the post's record reads "N foes marked", with Fire Direction's shell damage beside it.
