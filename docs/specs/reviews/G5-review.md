# Review of G5: the tray of n tiles and the Garrison Post (with RULINGS B7 and B8)

Reviewer: an independent agent, on branch gp/work at 4db55f7 (base 44689a2, the merge of next). The package's code was not
changed. Probes, mutants and logs are in the session scratchpad under `top/build/review/G5/`, photos under
`top/build/shots/g5-review/`.

REVIEW G5: 0 blockers, 4 majors, 11 minors.

Nothing found breaks the game, an old save or a test. The post plays as 2.2 to 2.4 say. The rally works by mouse and by
finger. The tray fits. B7 and B8 are built as ruled. The majors are balance rows of 5.2 that the build misses (the builder
reported three of them) and one that no table measured. They are the owner's to rule on before the post is released.

## Findings

### 1. Major: a board of posts alone fells the commanders (5.2's commander row, 2.4 "a delay, never a wall")

Evidence: `CMD=probe SEEDS=3 node tools/balance.js 1 all posts,mix7` (rerun by the reviewer, the same as the builder's
`g5-probe-posts-normal-seeds3.txt`). The "posts" board deals the first commander 1.26 to 3.47 times his strength on its
road (Erebuni 2.06, Tushpa 1.66, Avarayr 1.59, Dvin 3.47, Tashir 1.26 ...), and the wave-20 pair 0.90 to 1.47. 5.2 asks
that both reach the walls above 60%. Under CMD=probe the posts board even wins Erebuni 3/3 (1.0 kept): the commanders were
all that stopped it. The cause is the tripled blow of G5's tuning (Sortie: 144 piercing every 0.8 s a man).

Fix proposed: a commander takes a share of a man's blow, `POST_RULES.cmdBlow` (try 0.25), and Sortie's pierce does not
apply to him (in `postTick`, `damageEnemy(foe, st.dmg * might * (foe.type === "boss" ? POST_RULES.cmdBlow : 1), !!st.pierce
&& foe.type !== "boss", t)`). Then CMD=probe on posts and postdrum again, and mix7 against mix (Mari) again. If Mari's row
cannot be held with it, the owner chooses between the two rows.

### 2. Major: mix7 against mix misses three rows of 5.2 (reproduced)

Evidence: `SEEDS=3 CLOCK=1 node tools/balance.js 1 all mix,mix7,posts,postdrum`, rerun by the reviewer: every cell equals
the builder's `g5-normal-seeds3.txt`. mix7 keeps +0.80 over mix on the mean of 17 (bound 1 to 3). Van +9.3 and Musa Dagh
+7.0 (bound: no battlefield above +5). Mari -10.0 (mix7 lets its third commander reach the walls on all three seeds:
"3/3 2.0c3") and Sis -5.7. The post is in the best build on 4 of 17 (Tushpa, Ani, Van, Sardarapat; bound at least 6).
posts and postdrum lose everywhere on Normal and Hard (met).

Fix proposed: the owner rules on the rows. The builder's numbers table (balance README, G5) shows the post's own numbers do
not move mix7's mean, so the bot's order is the lever: try mix7 with the post 7th on battlefields without a commander
threat on its pad (or let the bot skip the post when the pad it would take is the mix's commander killer, which is what
Mari's -10 is). Retune nothing for Van and Musa Dagh alone: there the mix loses seeds and any winning board gains much.

### 3. Major: a board of many posts is near trivial on some battlefields, and no table measured one

Evidence: a build the bot never plays, posts on every second pad (`BUILD_halfpost=archer,post,ballista,post,catapult,post,
fire,post,drums,post,archer,post,catapult,post SEEDS=3 node tools/balance.js 1 all halfpost,mix`, WAIT 0). It is the best
build on 8 of 17: Tashir 3/3 19.0 (the best of the ten builds in the builder's table keeps 14.7; band 12 to 16), Musa
Dagh 16.0 (13.0), Sardarapat 15.0 (13.3), Van 11.0, Gyumri 12.0, Dvin 12.0, Tushpa 12.3, Stepanakert 2023 10.0. It loses
Ani, Halidzor and Stepanakert 1992. A post's damage per 100 gold in that board is 10,580 (the archers' 3,415), with 97 s
of hold per 100 gold: rank 1 is two men of 390 with a blow of 30 for 50 gold. The tables of 5.2 tried the post only twice
per board (mix7, 9th and 17th) and alone (posts, postdrum), so they could not see this. A player who likes the new tower
will build it often.

Fix proposed: add a post-heavy build (this one) to `BUILDS` in tools/balance.js and to the G5 tables, and bound it like
mix7 (on no battlefield more than 5 above mix, never above the band). The likely knob is the rank 1 price (50 is the
cheapest tower in the game while it deals more per gold than any shooter at rank 1): try 70, or men of 2x instead of 3x
at rank 1 only. This interacts with finding 2 (mix7's row moves the other way), so it is the owner's to rule on with 1 and 2
together.

### 4. Major: the stone fix changed the classic game: the mix on Sevan 13.3 to 18.0, out of its band

Evidence: `g4-after-normal-seeds3.txt` mix Sevan 3/3 13.3; `g5-normal-seeds3.txt` and the reviewer's rerun 3/3 18.0. The
mix builds no post, so this is 2.2's fix (a stone at a foe the hero holds is no longer led), not the post. 5.2: "the classic
five stay a whole game: mix meets every target above that it meets today": Sevan's band (12 to 16) was met by the mix at
G4 and is not now. Tushpa's best (mix7) is 17.0 and Erebuni's and Tushpa's wave times are +18% and +16% (bound 15%), also
moved by G5. RULINGS B9 accepted the cells measured at G4; these are new.

Fix proposed: retune Sevan on its own entry (the builder tried its spoils and reports whole seeds turning over: try its
`hpTune` instead), or the owner accepts the new cells under B9 explicitly. Report it in the stage's status page either way.

### 5. Minor: the Council's par-hold is +6.7 on Van, over 5.2's bound of 6 on any battlefield; the tool still says bound 2

Evidence: `docs/specs/balance/g5-kit-bounds.txt`: mean +2.29 (inside RULINGS B7's 2.3), most +6.7 (Van), Halidzor +6.3,
and the file ends "RESULT balance-kit FAIL". `tools/balance-kit.js` line 47 still holds `par ? 2`. B7 raised only the mean's
bound. Not rerun by the reviewer (the full kit pair is two more 17-battlefield runs).

Fix proposed: `tools/balance-kit.js`: the par bound 2.3 (RULINGS B7); the owner rules on Van's +6.7 (it is mostly the Call
and the hero, so the Heralds' tiers are the place to cut if he asks).

### 6. Minor: selling a post in a fight is untested; the phone's wider catch (110) is untested

Evidence: mutants of the page run through suite 2 (`top/build/review/G5/mutants.txt`). Caught by suite 2: held foes walk
(postHolds false), no stone fix, a tray that does not limit kinds, B8 reverted, the commander held without end, no man for
a hunter, flyers and engines held, a wrecked post sending men, the rally not saved, the post in the coached stand. Not
caught: `sellTower` without `postRelease` (suite 2 PASS: in the game the foe the man held would then stand forever, which
the reviewer's probe confirmed does not happen in the built code), and `pickPhone: 70` (caught only by the ruleset pin,
not by a behavior check). The check's own comment says "a press 90 world units off the road takes it on a phone (110) and
not with a mouse (70)", but no line tests it (index.html, the check "post: pads with road in reach ...").

Fix proposed: in that check, after `const was = ...`: a point 90 world units off the road, `rallyPress(t, px, py, false)`
false and `rallyPress(t, px, py, true)` true; and in the second check, a held foe, `sellTower(t)`, `run(0.5)`, the foe's
`heldBy` null and its `dist` grown.

### 7. Minor: key 7 is never tested with a seventh tile

Evidence: the tray check presses Digit7 only with six tiles (nothing happens). The stand-in seventh tile is staged later in
the same check, but no key press is made there.

Fix proposed: in the `try` with the stand-in, `document.dispatchEvent(new KeyboardEvent("keydown", { code: "Digit7" }))`
and `placing === "stores"`.

### 8. Minor: the Heralds' third tier does nothing at the hero's levels 4 and 5, and its line does not say so

Evidence: `COUNCIL` "Hero returns in 18 s, not 20" with `heroBack() = min(heroLv().back, kitNow().heroBack)`;
`HERO_LEVELS` back is 17 at level 4 and 14 at level 5, so the tier is worth 0 there. KITSET 1's line said "(14 s at his
level 5)". Halving it also took the level 4 gain (1 s) to nothing.

Fix proposed: the line "Hero returns in 18 s, not 20 (no sooner at his levels 4 and 5)", or make the effect "2 s sooner"
(`heroBack = heroLv().back - 2`), which needs a new KITSET pin.

### 9. Minor: the Captains' fourth tier sells something not in the game

Evidence: "Men return 7.5% sooner; the special tower costs 5% less". No special tower exists until G7 (`ageTower` null).
The builder names it in his report.

Fix proposed: until `ageTower` answers for some era, the line reads "Men return 7.5% sooner" and `kitSummary` keeps the
`age` effect (no pin change: only the line's text, which `kitsetPin` may hash; if it does, raise the pin with G7).

### 10. Minor: a press on the hero while the rally is armed moves the men to the road under him

Evidence: `top/build/review/G5/touch1.js` (iPad 1194 x 834 and SE 667 x 320 by touch): with the hero standing on the road in
the ring, a tap on him moved the rally ("moved": true) instead of putting it down (2.3: "Pressing the post, a tile, a
spell, the hero, Escape or right-click disarms"). A press on the post disarms ("Rally point unchanged."), a press off the
road says "Out of reach." and stays armed, and 12 presses during a wave at 2x on random road points moved the men 11 times
(the twelfth was where they stood) with no slip. Most players will find moving the men to the hero's road natural.

Fix proposed: keep the behavior and add a note to 2.3 ("a press on the road under the hero takes the rally"), or test
`onHero` before `rallyPress` in the canvas handler.

### 11. Minor: the post's panel line runs out of its box

Evidence: `shots/g5-review/post-panel-sardarapat-1600x900.png`: "Holds foes on the road. Outflankers go round." reaches
past the stats box's right edge at 1600 x 900.

Fix proposed: let that row wrap (`white-space: normal` on the wide row) or shorten it to "Holds foes. Outflankers go
round."

### 12. Minor: Sardarapat's post shows "fixed bayonets" with no source

Evidence: `POST_LEVEL.sardarapat.depicts` "Armenian infantry with fixed bayonets", and the era 5 mastery "Bayonet
Charge". 2.6 marks the bayonet charge CHECK; nothing in docs/history or Sardarapat's own text names bayonets. Its text does
say "On 22 May the Armenians counterattacked across the plain beneath Ararat". Mari's and Sis's "Cilician foot soldiers
with spears and shields" are the age's generic, also CHECK in 2.6.

Fix proposed: "Armenian infantry in the counterattack across the plain" for Sardarapat, and "Counterattack" for era 5's
second mastery as in era 6 (or "(the game's invention)" after the depicts).

### 13. Minor: on a phone held upright, the tray shows names on five tiles and none on the post

Evidence: `shots/g5-review/tray-tushpa-375x553.png` and the builder's `rally-touch-armed-SE-upright-375x553.png`: the
post's tile (and Dvin's trebuchet) lose their name to `noNm` while the others keep theirs on two lines. 3.8: upright,
"no names (noNm), the picture and the price only".

Fix proposed: in `fitCardNames`, when `isPhone()` and the window is taller than wide, give every tile `noNm`.

### 14. Minor: the upgrade line and the panel disagree on a man's strength under the Captains

Evidence: `statText` shows `postManMax(t)` (the kit's 5% in it) while `statDeltaHtml`'s post branch shows `a.hp -> b.hp`
from the raw table.

Fix proposed: `statDeltaHtml` multiplies both by `kitNow().postMen`.

### 15. Minor: the builder's photos were taken before the post's tuning

Evidence: `shots/g5/age-*`, `tray-*`, `rally-armed-van-*` are dated 17:46 to 17:50; the tuning commit ee1ab30 is 18:02. The
post's tile reads 90 gold in them (50 on the final page). No photo of the tray at the smallest iPhone size was taken. The
reviewer took them again on the final page: `shots/g5-review/age-<9 battlefields>-1600x900.png`, `tray-tushpa-1600x900,
1194x834, 667x320, 375x553.png`, `post-panel-sardarapat-1600x900.png`, `rally-touch-armed-dvin-1194x834.png` and
`-667x320.png` (by touch).

Fix proposed: none needed beyond using the new photos.

## What the reviewer reran, and the results

RUN_RESULTS

## What the reviewer could not check

- The Council's par-hold (+2.29) and its per-battlefield cells were not rerun (two more full 17-battlefield runs); taken
  from the builder's files.
- Easy and Hard tables were not rerun; read from the builder's files (posts lose everywhere on Hard; Easy asks nothing).
- The frame rate on a real iPhone: playtest 6 compares two headless pages on a shared machine.
- Sound by ear (the men's blows, `heroDown`, `rally`): only that no sound threw (live.js).
- The art at close range in every age beyond the 1600 x 900 photos: the men read as the age's soldiers in Erebuni and Van;
  the other ages were looked at only at that size.
