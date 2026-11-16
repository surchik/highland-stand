# G3 review: heroes (gp/work 099fb01, tag g3-done)

Reviewer: an independent agent who did not build G3. Base of the package: next d0c334c. Page reviewed: index.html
of 099fb01 (sha256 837067a6...). Every number below was rerun by the reviewer unless it is marked as the builder's.
Probe scripts, logs and bot tables are in the reviewer's scratchpad (`review/G3/`); none of the package's code was
changed.

**REVIEW G3: 1 blocker, 2 majors, 8 minors.**

## Findings

### 1. Blocker. The hero breaks the bounds of 5.2, and the report puts the cause on the Council

The acceptance asks for the hero's worth "inside the bounds of 5.2 (if a bound is broken, the hero's numbers are
tuned, never a battlefield)". The builder left two cells broken and wrote that "neither broken cell is the hero's"
and that "cutting every level's strength left both cells exactly where they were". Both statements are wrong, and
the worst cell was never measured: the builder ran `KIT=par` only with `HERO=hold`, never with `HERO=off`.

Evidence (Normal, SEEDS=1, the sample of RULINGS E: Erebuni to Sevan, Sis, Van, Shushi; best build's defenders kept
minus `KIT=none HERO=off`; the reviewer's runs, which equal the builder's files cell for cell where both exist):

| Kit | HERO | Mean | Most | Bound |
|---|---|---|---|---|
| par | off | **3.44** | 6 | mean 2, most 6 |
| cap | off | 3.78 | **7** (Van) | mean 4, most 6 |
| par | hold | **2.33** (vs hold base) | **7** (Dvin) | mean 2, most 6 |
| par, the G2 hero (PATCH: hero 1, no Call) | off | 2.00 | 5 | |
| cap, the G2 hero | off | 2.78 | 6 | |
| par, variant B (every level's strength 400, blow 34) | off | 2.00 | 5 | |
| cap, variant B | off | 2.78 | 6 | |
| par, variant A (the levels' strength, blow and healing gains halved) | off | 3.11 | 6 | |
| cap, variant A | off | 3.00 | 6 | |

The G2 hero under G3's code gives G2's own numbers exactly (G2 close: PAR 2.00 / 5, CAP 2.78 / 6), so the Council
fights as it did in G2 and the whole rise is the hero's level. Variant B (the levels keep holds, healing, return,
reveal and the Call, but no strength or blow) gives G2's numbers again: the levels' strength and blow account for all
of it, on Tushpa (-2 to +4), Tashir, Van (3 to 6, CAP 6 to 7) and Shushi. The hero alone looks small (`KIT=hero`
0.33) only because he adds little on an empty Council; with a Council he moves the best build's choice.

Commands: `KIT=par JSON=1 node tools/balance.js 1 erebuni,tushpa,avarayr,dvin,tashir,sevan,sis,van,shushi` (and
`cap`, `hero`, with `HERO=off|hold`); the G2 hero: `PATCH='{const f=kitForTest; kitForTest=function(m,i){const
k=f(m,i); return k===KIT_EMPTY?k:{own:k.own,hero:1,call:false};};}'`; variant B:
`PATCH='for(let l=2;l<=5;l++)HERO_LEVELS[l]=Object.assign({},HERO_LEVELS[l],{hp:400,blow:34});'`; tables summed with
the builder's own `g3/bot/bound.js`.

Fix: tune the hero, as the package says, until PAR keeps mean at most 2 and CAP at most 4, no battlefield above 6,
with `HERO=off` and with the measure of finding 2 (both, since a player may leave the hero alone). Variant B shows
the room: G2 left PAR at exactly its bound (2.00), so the levels' strength and blow must add next to nothing at a
first play's levels 2 to 4. A concrete start: strength 400, 420, 440, 470, 520 and blow 34, 35, 36, 38, 42 (level 5
stays the returning player's reward), rerun par and cap with `HERO=off` and the fixed `HERO=hold`, and keep cutting
the gains (never a battlefield, never the Council's G2 numbers without the owner) until the cells hold. Then raise
`KITSET_PIN`, update 4.4's table note, `docs/specs/balance/g3-hero-normal-seeds1.txt` and the README's G3 section,
whose sentence "Neither broken cell is the hero's" must go. If the owner prefers to keep 4.4's table, the spec's
alternative is to cut a Council tier to make room; that is the owner's call and must be said, not left at "the G4
gate".

### 2. Major. `HERO=hold` as built does not measure the hero's worth: it costs defenders by itself

`KIT=none HERO=hold` against `KIT=none HERO=off` (no level, no Call: only the bot's parking differs): Dvin 13 to 4,
Van 12 to 0 (lost), Tashir 16 to 11, Shushi 11 to 20, mean -1.22. Every `HERO=hold` row is measured against that
crippled base, which is how PAR reads 2.33 with `hold` and 3.44 with `off`. The builder's own table shows `hold`
negative against `off` on every kit (hero -1.56, cap -2.78). A measure that makes the kit look smaller hides a broken
bound; 5.2 asks for the bounds "with `HERO=hold`".

Reviewer's probe: the same bot with the parking switched off and the Call kept (the hero stays where he appears and
sounds the Call on a crowd of three; `review/G3/balance-callonly.js`): `KIT=hero` mean 1.00, most 3, 4.1 Calls a
battle; par 3.44 / 6; cap 3.89 / 7. That is the Call's worth with no harm from the parking, and it breaks the same
bounds.

Fix: in `tools/balance.js`, make `HERO=hold` park the hero only where he stands by the walls (or within the last
road stretch only when `KIT=none HERO=hold` keeps every battlefield `KIT=none HERO=off` keeps), and sound the Call
on a crowd of three; or keep the parking as `HERO=park` and add the stay-and-call mode as `HERO=hold`. Report the
bounds as the worse of `off` and `hold`. Say in the header that a measure whose base loses a battlefield `off` wins
is not used for a bound.

### 3. Major. The new checks do not hold the commander rule (two mutants live)

4.4's rule "Stand Fast's half damage does not apply to a commander's blows" and the builder's rule that a
commander's blow is the level's number times the Heralds' first tier are not held by any check. Mutation probes
(each one line changed in a copy of the page, then `node tools/selftest.js --suite=2 <copy>`):

- `standfast-halves-commander` (commander's blow times `CALL.cut` under the Call): suite 2 PASS, 27 checks.
- `heralds1-not-on-commander` (commander's blow without `kitNow().heroHp`): suite 2 PASS, 27 checks.

The fourteen other mutants failed suite 2 as they should: the guard removed, the Standard battle given the level,
the Call's clock not saved, the merge by the smaller, no veteran's floor, test mode earning, a saved hero not cut to
his chapter, the Call open before Dvin, the Heralds' fifth tier ignored, the clock running only while he is down,
the daily's day reversed, no `hero_level`, a defeat earning nothing, a forged `call: "yes"` standing. (A third live
mutant, the `tutGentle` branch of `battleKit` removed, is equivalent: `resetGame` clears `tutGentle` before the kit
is set and `startTutorial` sets the empty kit itself.)

Also, in the medallion check `paused = true; paused = false;` (index.html, suite 2, "a pause stops it") asserts
nothing: the pause is not tested. The reviewer's Playwright probe shows the pause does hold the clock (49.90 before
and after 2.5 s paused), so this is a test gap, not a bug.

Fix: in "heroes: the medallion ...", hold a commander on a level 2 hero under the Call and assert he loses
`HERO_LEVELS[2].boss` a second (not half); with Heralds 1 owned, `boss * 1.05`. Replace the pause lines with a check
that runs the page's frame loop (or `requestAnimationFrame` for a few frames) with `paused` true and asserts `callCd`
did not move.

### 4. Minor. The touch toast and the tooltip promise a Call the press will not give

Played at 667 x 320 (iPhone UA, `review/G3/probe-play.js`): with the Call cooling, a tap chooses the hero and the
toast says "Ashot II: select, then tap the field to march to that spot. Press again for his Call."; the next tap
lets him go (`{"sel":false,"calls":1}`). The tooltip's "(R, T)" also reads as if R sounds it, while R only chooses
and lets go.

Fix: in the `#heroBtn` pointerdown handler and `syncHeroTitle`, add "Press again for his Call." only when
`callReady()`; while it cools, "His Call is ready in N s." The keys: "(R; T sounds his Call)".

### 5. Minor. The captains' line names one man twice

The War Council's line for Chapter II reads "II · Theodoros Rshtuni, Ashot II, Ashot II Erkat" (photo
`hero-desk-1600x900-captains.png`). Tashir's `L.hero` is "Ashot II" (son of King Smbat) and Sevan's is "Ashot II
Erkat" (the Iron King): the same king (docs/history/text-audit.json, the Sevan entry: "Ashot II (r. 914 to 929) is
usually known as Erkat"). Under "The captains of a chapter learn from each other's stands" it reads as two men. The
hero card's lore line repeats it.

Fix: `chapterHeroes` keeps one name per person: a small map of a battlefield's hero to the name the chapter line uses
(`{"Ashot II": "Ashot II Erkat"}`) or a `who` id on `L.hero`, and the line reads "Theodoros Rshtuni, Ashot II Erkat".

### 6. Minor. The chronicle shows the level a Standard battle does not use

With the Standard switch on, `#briefHero` still reads "Level 2" (`showBrief` reads `heroLevel(...)` whatever
`standardBattle` is, and the `#bkStd` click handler redraws only `briefKitRow`), and the hero card shows his level's
stats without the Heralds' first tier he fights with. The card does say "A Standard battle is fought with him at
level 1 and no Call", but the line does not.

Fix: the `#bkStd` handler also redraws the hero line; with the switch on it reads "Level 1 · Standard". The card's
strength reads `Math.round(HL.hp * kitSummary(playerKit()).heroHp)` outside a Standard battle.

### 7. Minor. The Heralds' third tier says "16 s, not 20" where it is not true

The tier's card reads "Hero returns in 16 s, not 20". At level 4 he returns in 17 s and at level 5 in 14 s
(`heroBack()` takes the sooner), so at level 5 the tier does nothing and its sentence is false. Deviation 3 of the
report names the choice but not the words.

Fix (a rule change, so the owner or the spec decides): word it "Hero returns 3 s sooner" with `back - 3` at every
level, or keep the rule and say on the card "Hero returns in 16 s, not 20 (sooner at his level 5)". Either way
`KITSET_PIN` moves with the numbers.

### 8. Minor. The Call's coach bubble tells a finger "Key: T"

At 667 x 320 the bubble reads "... It is ready again in 50 s. Key: T. The Call is a game ability." (photo
`hero-phone-667x320-bubble.png`, and the probe's text). The bubble already picks "Tap" or "Click" by
`(pointer: coarse)`.

Fix: add "Key: T." only when the pointer is not coarse.

### 9. Minor. No regression script checks the phone's hero line on the victory page

8.2 asks `iphone.js` for "the victory page with `#ovGrowth`" at the ten sizes. Its victories are staged in test mode,
which earns no experience, so the line "Name · Level n · k stars to spend" is never laid out at the ten sizes (the
builder says so in iphone.js's comment). Only suite 2 holds its words, with `phoneWide` faked at the harness size.
The longest name, "Arkady Ter-Tadevosyan · Level 3 · 12 stars to spend", is not measured at 667 x 320, where the page
is "full to the pixel".

Fix: in iphone.js, stage one victory (Stepanakert 1992) with seeded records and no test mode, and hold `#ovGrowth`
to one line and the page's buttons on screen at every size.

### 10. Minor. The builder's table of the hero's worth is incomplete

`docs/specs/balance/g3-hero-normal-seeds1.txt` and the README's G3 section have no `KIT=par HERO=off` row, the row
that breaks the PAR bound most (finding 1). Fix: add `par-off`, and the two G2-hero control rows, to the committed
tables when finding 1 is fixed.

### 11. Minor. Regression scripts failed under load (reruns below); dance10 is the base's too

In the reviewer's full run, with the other track's load at 8 to 14: suite 1 126.4 s of 125; doors "touch 834x1194
?town: the waiting town gift was not paid"; vic "mouse 1440x900 stepanakert23: the page crashed" (990 s); dance10 two
taps. Rerun alone: suite 1 PASS 104.7 and 111.5 s (next d0c334c, the same minutes: 110.6 and 107.4 s); doors PASS;
vic PASS. dance10 failed every time (gp 6 and 3 of 15, next 6 of 15 at the same load: "a tap at 9.6 to 11.4 s ended
the dance", and Sis "a tap at -1 ms ended the horn call"): the base fails the same way, so it is not G3's, but it
could not be seen green on this machine today. Nothing to fix in G3; the integrator should rerun dance10 on a quiet
machine.

## What is right (checked)

- Fairness: a Standard battle and the coached stand fight with `KIT_EMPTY` (suite 2 and its mutants; the reviewer's
  finger probe could not reach the switch at 667 x 320 without scrolling, see "The pages"); the loadout tag is `std` with the empty kit and `open` with a level or the Call; `RULESET_PIN`
  b065cbc7 and every battlefield are untouched; the bot's `KIT=none` table on all 17 equals G2's cell for cell
  (3,332 fields, 0 differences) and the builder's (3,689 fields, 0).
- The rules: 300 / 225 / 450 a victory, 10 a wave cleared by difficulty, none in test mode or at an endless stand's
  end, the thresholds, the derived veteran's floor (not counted twice: heroGain runs before the records take the
  victory), the daily cap built, the merge pure and per chapter, a forged `hs_heroes` read as zeros (a probe loaded
  `"9e9"`, `1e300`, `-1`, arrays and objects: every chapter level 1, no error), `hs_run.cd.call` saved and loaded
  (probe: a reload mid-wave resumes with the horn's clock, as the spells do), pause holds the clock, a saved hero is
  cut to his chapter, the Call opens with Dvin.
- The pages: the medallion's face, ring and arc at the ten iPhone sizes (iphone.js PASS); the double tap's guard by a
  finger (the builder's playtest and the reviewer's probe: the bubble's tap chose him, a tap 0.5 s later sounded the
  Call, the cooling tap chose, the next let go); the hero card opens and closes by the line and by its button (doors,
  iphone); the Standard switch at 667 x 320 sits under the fold of the chronicle's scrolling column with its "more"
  fade (G2's layout).
- The seam: no hunk of the diff touches PF-CSS (from line 2429), PF-HTML (3442), PF-0 (3463 to 3600) or PF-MAIN
  (77975 to 78272), nor a line of platform table 0.4; `hs_heroes` is registered by `CLOUD_KEYS.push` after
  `heroesMerge`, which matches the contract (`(mine, theirs)` raw strings, `null` when missing).
- Text: no long dash in the diff or the commit message; American spelling; "The Call is a game ability", "A rule of
  the game, not a record of history" and the Council's note label the inventions. "Stand Fast" is the game's word,
  echoing the Avarayr story line the history audit proposed. Except finding 5, the names are the battlefields' own.
- Listeners: the bubble's Got it listener is added once (`dataset.call`), the resize and pointerdown listeners at top
  level once; `resetGame` and suite 2's guard clear `callCd`, `callT`, `heroGrowth`, `councilCapts` and the bubble.

## What I reran, with results

| Command | Result |
|---|---|
| `node deploy/check-page.js index.html` | OK |
| `timeout 900 node tools/selftest.js --suite=all` (load 6) | suite 1 FAIL on time only: 151 checks pass, 126.4 s of 125; suite 2 PASS 27 checks, 24.1 s |
| `node tools/selftest.js --suite=1` alone, twice, gp and next alternately | gp PASS 104.7 s, 111.5 s; next PASS 110.6 s, 107.4 s |
| `node tools/run-fixtures.js check` | PASS |
| `node tools/town-isolation.js` | PASS |
| `run-all.js --only=doors,vic,iphone` (load 8 to 14) | doors FAIL 1 (town gift), vic FAIL 2 (page crash), iphone PASS 563 s, 707 states, ten sizes |
| `run-all.js --only=doors` alone | PASS, 18 doors |
| `run-all.js --only=vic` alone | PASS, 657 s, 249 pressed, 17 battlefields |
| `run-all.js --quick` | padplace, plots, probe, vic, nag, live, doors, iphone PASS; dance10 FAIL 2 |
| `run-all.js --only=dance10`, three times (gp, next, gp; load 8 to 9) | FAIL 6, FAIL 6 (next), FAIL 3 |
| bot `KIT=none` all 17, CLOCK=1 JSON=1 | equals G2 close and the builder: 0 differences |
| bot sample: hero, par, cap with HERO=off and hold; none hold | as finding 1 and 2; equal to the builder's files where both exist |
| bot sample: par, cap with the G2 hero; variants A and B; hero, par, cap stay-and-call | finding 1 and 2 |
| 17 mutants of suite 2's subjects | 14 caught, 2 live (finding 3), 1 equivalent |
| Playwright probes at 667 x 320 (bubble, choose, Call, cooling, pause, reload, Standard switch), 1600 x 900 (pause, forged hs_heroes) | as findings 4, 6, 8 and "What is right" |

## What I could not check

- Safari and real iOS devices; a person's playtest 4 on an iPad.
- The 17-battlefield bounds and Hard with `KIT=cap` at SEEDS=3 (outside RULINGS E for G3).
- The daily's cap end to end (`heroDay()` is null until G6).
- dance10 green: the machine was never quiet enough; the base fails the same way under the same load.
- The level 5 burn's balance worth (no first-play kit reaches level 5).
