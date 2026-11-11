# Highland Stand: the gameplay spec for "the top tower defense game" (final)

This is `docs/specs/gameplay.md` (commit 2af988b) revised after the review in
`docs/specs/gameplay-critique.md`. It replaces the first version. Appendix A lists every change by the
critique's issue number; Appendix B lists what was kept against the critique, and why.

Written against master 54207ce (index.html, 78,801 lines). Line numbers below are that file's.
Scope: analytics hooks and what a score is made from, progression (D5), wave counts (D4), the road-blocking
tower and one new tower per age (#3), the daily's battle (#9), balance, tests, build order. The platform
(sign-in, cloud saves, boards, the daily's boards, the share card, the stats view) is the other spec:
`docs/specs/platform.md`.

Rules of this document: every number is a starting value to be confirmed with `tools/balance.js` unless it is
marked MEASURED or RENDERED. Player-facing strings are quoted exactly and follow the house rules (short
sentences, American spelling, no long dashes). A history claim is either tied to a text the game already
carries (LEVELS, CHAPTERS, `docs/history/*.json`), marked CHECK (a source must be read before it ships, by
the text audit that closes each work package), or marked INVENTION (the game says so where it tells it).

## 0. The seam with the platform, and what was measured

### 0.1 The seam

Gameplay never talks to the network. The platform's spec fixes the shared names (its sections 0.3 and 7.2);
this spec uses them as they stand there:

1. `track(name, props)`: a global the platform defines (a no-op when it is off). Gameplay's calls are in
   section 7. The platform acts on four of them (`battle_start`, `victory`, `defeat`, `battle_quit`), so
   those carry the battle's numbers (6.1). An event's props are nested one level at most and under 3 KB:
   the server keeps an event up to 4,096 bytes (the platform's review raised it from 1,024 after finding,
   as this review did, that the first version's battle numbers would have been dropped).
2. localStorage under `hs_*` keys through the game's helpers. The platform owns `CLOUD_KEYS`; gameplay adds
   its new keys there with a merge function each (4.7). Gameplay never writes a key that starts `hs_pf_`.
3. `RULESET` and `rulesetData()` (6.3), `DAILY_TWISTS` and `startDaily(levelIndex, twistId, day)` (6.4), the
   loadout tag `"std"` or `"open"` (6.4), and one panel the platform's Hall hosts as a tab (`HALL_TABS`,
   4.6). Gameplay may read `Platform.daily()` and `Platform.player()` where they exist and must work when
   they do not (`file://`, the self-test, the bot).
4. The battle clock is the platform's `simSec` as its first spec defined it: the sum of `dt` in `update`
   from the first wave's horn to the last foe's fall. Waiting between waves counts; pauses, menus and cards
   do not (6.1). The platform's review has since moved to the wave-time clock this spec's first version
   asked for; that request is withdrawn here, with reasons, and is the main point the two final specs must
   settle again (9.5, N3).

What gameplay needs from the platform is 9.5.

### 0.2 MEASURED today (master, Normal, 7 builds, 1 seed, 119 battles)

Tool: a copy of `tools/balance.js` that also records each wave's length in game seconds
(`docs/specs/gameplay-proto/balance-time.diff`). Full tables: `docs/specs/gameplay-proto/`.

- A 20-wave battle is 25 to 54 minutes of wave time at 1x (mean 35), before any time spent between waves:
  Erebuni 36, Tushpa 33, Avarayr 44, Dvin 37, Tashir 28, Sevan 36, Ani 32, Mari 26, Sis 40, Gyumri 44,
  Halidzor 36, Van 40, Musa Dagh 28, Sardarapat 35, Stepanakert 1992 54, Shushi 29, Stepanakert 2023 25.
  The whole campaign is 602 minutes of wave time at 1x for a player who wins every battle once.
- Waves 1 to 3 take about 30 s each. From wave 6 (the first siege engine, 27 px/s) a wave takes 110 to 165 s.
  The late waves are the time: waves 11 to 20 are two thirds of a battle.
- Winning builds end a battle with 6,700 to 16,500 gold invested (the mix: 6,790 on Erebuni, 13,620 on
  Shushi): every pad at rank 3 and the first masteries from about wave 18 (five on Erebuni's last wave).
  A battle cut off at wave 10 would never see a mastery.
- Results (lives kept of 20): the mix wins 14 of 17, the best build 17 of 17 with 10 to 17 kept. Table in
  `gameplay-proto/base-normal.table.txt`.
- The bot plays 4 battles in 10 s with four jobs: a table of 17 battlefields, 14 builds and 3 seeds is about
  30 minutes a difficulty.

### 0.3 MEASURED: a prototype of the new lengths

`gameplay-proto/proto-patch.js` implements section 1 (the script map and the pay-ahead rule) as a patch on a
copy of the page, with the lengths of section 1.2 (Erebuni on the default 10-step table, not yet its own)
and nothing retuned. Same bot, same seeds:

- The campaign's wave time at 1x falls from 602 to 433 minutes. Erebuni 36 to 18, Dvin 37 to 18, Tashir 28 to
  17, Mari 26 to 17, Stepanakert 2023 25 to 16. The two battles left at 20 waves (Sis, Sardarapat) play
  exactly as before, battle for battle.
- The board is as built at the end as today: gold invested by the winning builds is within 6% of today's on
  14 of 17 battlefields (Erebuni 6,702 to 6,958; Dvin 11,763 to 11,575; Sevan and Gyumri 10% richer,
  Stepanakert 2023 6% poorer; the builds that win are not the same set in the two runs).
- The mix still wins 14 of 17 and the best build 17 of 17. The shortened battlefields come out 3 to 6 lives
  easier (fewer waves, fewer chances to leak). Mari came out harder: its mix won 1 of 7 and kept 1, because
  its second road now opens with the commander still to come (5.3).
- The prototype let a commander's wave take the outflankers of the script wave skipped before it. The final
  rule does not (1.1), so the commander waves of the retuned game are today's.

### 0.4 RENDERED and MEASURED by the review

- The tray with seven tiles on a phone held sideways (667 x 320, touch), on a scratch copy of the page, on
  Tushpa, Gyumri Road, Stepanakert 1992 and Stepanakert 2023: each tile is 88.4 x 52 px. A tile's name box
  is 82 px wide; names up to about 17 characters show whole ("Standard of Haldi"), longer ones are cut with
  an ellipsis ("Defense Army rif…"). So seven tiles fit, and only the longest names need a short form (3.8).
- The self-test alone takes 117 s of wall time on this machine; two at once take 120 and 121 s each. Two
  suites side by side fit under 125 s with 4 s to spare (8.1).
- The first version's example of a battle's numbers is 1,063 bytes as JSON: over the server's limit for one
  event as it stood (1,024 bytes, `platform/schema.sql` at f7657c8). The platform's review found the same
  and raised the limit to 4,096 bytes with one level of nesting allowed (`schema.sql` at 2c862b1). Hence the
  size test of 6.1 and 8.1.
- `update()` runs the spells' and the hero's clocks in every phase (lines 12052 to 12053), and a tower can be
  built while the game is paused: there is no pause test in `placeTower`, `upgradeTower` or the field's
  `pointerdown` handler (only `startWave` refuses), and it was TESTED on master with the regression
  library: Pause pressed, a tile pressed, a pad pressed, by mouse at 1600 x 900 and by a finger at
  667 x 320: one tower built, 50 gold spent, the game still paused (`docs/specs/gameplay-review/`). Hence the
  clock of 6.1.

## 1. Wave counts (D4)

### 1.1 The rule: every battlefield plays N steps of the same 20-step script

The 20-wave script stays as the one source of composition and strength: `waveGroups(s)`, `hpScale(s)`,
`commanderClimb(s)`, `bountyScale(s)`, `levelHpFrom`, and every wave number in `L.tricks`, `L.phases`,
`L.flank`, `L.routeOpen`, `L.waveText`, `L.phaseText`, `L.waveCues` keep their meaning: they are SCRIPT waves
(1 to 20). A battlefield of N waves plays N of those steps. Nothing that was tuned loses its meaning, and a
battlefield left at 20 is today's battle exactly.

New data and helpers (replace the constant at line 10013):

```js
const SCRIPT_LEN = 20;
const WON_MARK = 21;                 // hs_best's "won" value stays 21 whatever the length (1.6)
const DAILY_WAVES = 12;              // every daily is a 12-wave stand (6.4)
// the script steps a battle of N waves plays: 1, 2, 3, then even steps to 20, with 10 always present
const SCRIPT_TABLES = {
  10: [1,2,3,5,8,10,13,15,18,20],
  11: [1,2,3,5,7,10,12,14,16,18,20],
  12: [1,2,3,5,7,9,10,12,14,16,18,20],
  13: [1,2,3,5,6,8,10,12,13,15,17,18,20],
  14: [1,2,3,5,6,8,9,10,12,14,15,17,18,20],
  15: [1,2,3,4,6,7,9,10,12,13,14,16,17,19,20],
  16: [1,2,3,4,6,7,8,10,11,12,13,15,16,17,19,20],
  18: [1,2,3,4,5,6,8,9,10,11,12,13,14,15,17,18,19,20],
  20: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20],
};
// L.script: a battlefield's own table; L.dailyScript: its own 12-step table for the daily (Avarayr)
function levelScript(L) { return dailyRun ? (L.dailyScript || SCRIPT_TABLES[DAILY_WAVES]) : (L.script || SCRIPT_TABLES[L.waves || SCRIPT_LEN]); }
function totalWaves() { return curScript().length; }
// played wave w -> script wave. Beyond the chronicle (endless) the script runs on one step a wave
function scriptWave(w) { const S = curScript(); return w <= 0 ? 0 : w <= S.length ? S[w - 1] : SCRIPT_LEN + (w - S.length); }
// script wave s -> the first played wave that reaches it (for every `from` in the data)
function playedWave(s) { const S = curScript(); for (let k = 0; k < S.length; k++) if (S[k] >= s) return k + 1; return S.length + (s - SCRIPT_LEN); }
// the script waves played wave w stands for when it is FOUGHT: itself and the ones skipped before it
function coveredWaves(w) { const out = []; for (let i = scriptWave(w - 1) + 1; i <= scriptWave(w); i++) out.push(i); return out; }
// the script waves played wave w PAYS for: itself and the ones skipped after it (1.4). Waves 1 to 3 pay
// themselves only, and wave 4 also pays a script wave skipped between 3 and it
function paidWaves(w) {
  const S = curScript(), n = S.length, out = [];
  if (w > n) return [scriptWave(w)];                                   // an endless wave pays itself
  const a = w === 4 ? 4 : scriptWave(w);
  const b = w <= 3 ? scriptWave(w) : w < n ? S[w] - 1 : SCRIPT_LEN;
  for (let s = a; s <= b; s++) out.push(s);
  return out;
}
```

`curScript()` is the table the battle began with (saved with the run, 1.7): `levelScript(LEVELS[curLevel])`
for a new battle, the identity table for a run saved without one.

Composition of played wave w (replaces the body of `waveGroups`, whose old body becomes `scriptGroups(s)`):
for every script wave in `coveredWaves(w)` take `scriptGroups(s)`; a role that appears in several keeps the
entry with the most foes; order the groups spearman, raider, shield, cavalry, ram, flyer, boss. So a wave that
stands for script waves 6, 7 and 8 brings wave 8's foot and horse, the larger ram count of the three, and
wave 7's outflankers (odd waves bring them: without this rule a table of mostly even steps would lose them).
One exception, so that the commanders' waves stay what they are today: a played wave that brings a commander
(it covers script wave 10 or 20) takes its outflankers from its own script wave only. Waves 10 and 20 bring
none outside the drone war and Ani's raiders, so no commander arrives with the outflankers of a skipped wave
(a commander at the walls costs 10 defenders; without the exception the pair would come with eight
outflankers on nine battlefields). It still takes the largest ram count of the waves it covers.
Strength: every `w` handed to `hpScale`, `commanderClimb`, `levelHpFrom`, `bountyScale`, `trickEcon` is
`scriptWave(w)`. The prototype does exactly this, but for the commanders' exception (0.3).

Commanders: one on the played wave that covers script wave 10, the pair on the last wave (script 20), as the
script says. `isCommanderWave(w)` is `trickWave(w).some(g => g.type === "boss")` and replaces the two
`waveIdx % 10 === 0 && waveIdx >= 10` tests (lines 11074, 53358). In an endless stand they come every tenth
wave beyond the chronicle (script 30, 40, ...), as today.

### 1.2 The 17 lengths

Time is MEASURED wave time at 1x for that length (winning builds, `gameplay-proto/tables.txt`), today's in
brackets. "Cmd" is the commander's wave and the pair's.

| # | Battlefield | Waves | Cmd | Min at 1x | Why this length |
|---|---|---|---|---|---|
| 1 | Erebuni Rise, 782 BC | 10 | 7, 10 | about 17 (36) | The first battle and the tutorial. No siege of Erebuni is recorded (its own text says so), so a short stand is honest. A first victory inside one sitting, also on a phone at 2x (9 min). Its own table (below). |
| 2 | Vale of Tushpa, 735 BC | 12 | 7, 12 | 19 (33) | Tiglath-pileser III shut Sarduri in the citadel and withdrew: a siege, a little longer than Erebuni. The first battle with the Garrison Post. |
| 3 | Avarayr Plain, 451 | 14 | 7, 14 | 30 (44) | One day's pitched battle, and the set piece that closes Chapter I. Its own table (below). |
| 4 | Dvin Gates, 640 | 11 | 6, 11 | 19 (37) | The city was stormed in a sudden assault (Sebeos: smoke, arrows, ladders). Short and sharp. Chapter II opens gently. |
| 5 | Tashir Gates, 914 | 12 | 7, 12 | 17 (28) | A gorge fight. Mid length. |
| 6 | Sevan Shores, 921 | 15 | 8, 15 | 27 (36) | The Iron King's stand on the island and his sortie: Chapter II's set piece. |
| 7 | Ani, c. 1041 to 1044 | 18 | 9, 18 | 29 (32) | Three assaults over years ("The Testament", `L.phases`): the long set piece of Chapter III. The phases start on waves 1, 7 and 14. |
| 8 | Mari, August 1266 | 12 | 7, 12 | 15 (26) | One lost battle in the passes. The second road opens on wave 8. Short, so the turn comes fast. |
| 9 | Sis, early 1375 | 20 | 10, 20 | 40 (40) | The last siege of the kingdom. Each wave is three days (`DAYS_PER_WAVE`), 60 days in all: the one battle whose length is part of its telling. Unchanged. |
| 10 | Gyumri Road, 1579 | 13 | 7, 13 | 28 (44) | A road fight (the battle is the game's). Today it is one of the two longest; it should not be. |
| 11 | Halidzor, 1727 | 14 | 8, 14 | 26 (36) | A siege of days ended by a sortie. Mid length. |
| 12 | Van, 1915 | 18 | 9, 18 | 35 (40) | A month in the barricaded quarters until relief came. Long. |
| 13 | Musa Dagh, 1915 | 16 | 8, 16 | 23 (28) | Fifty-three days on the mountain. Long in waves, but its short road keeps it under 25 minutes. |
| 14 | Sardarapat, 1918 | 20 | 10, 20 | 35 (35) | Nine days that decided whether there would be an Armenia: the campaign's great set piece. Unchanged. |
| 15 | Stepanakert, 1991 to 1992 | 14 | 8, 14 | 38 (54) | Months under the guns, but today it is the longest battle by 10 minutes because its road is long. 14 brings it into line. |
| 16 | Shushi, 2020 | 14 | 8, 14 | 20 (29) | The fight for the town was days inside a 44-day war. |
| 17 | Stepanakert, 2023 | 12 | 7, 12 | 15 (25) | The last assault lasted a day. A short, hard stand closes the campaign, as its text does. |

Total 245 waves (340 today). The first six fall from 120 to 74.

Erebuni's own table: `script: [1,2,3,4,6,8,10,13,16,20]`, and its scouts come from script wave 7 on Normal
and Hard (`hidden.from: [8, 7, 7]`, today `[8, 6, 6]`). It is the first battle a player fights, so new kinds
of foe come at most two a wave: wave 4 the shieldbearers; wave 5 the horsemen and the rams; wave 6 the
outflankers and the scouts; wave 7 the commander; wave 10 the pair. The default 10-step table would bring
shieldbearers and horsemen on wave 4, rams, outflankers and scouts on wave 5 and the commander on wave 6.
The rule, kept by a self-test: on Erebuni no wave brings more than two kinds of foe or trick that no earlier
wave brought. The price is a steeper last step (script 16 to 20), paid for by wave 9's four waves of pay.

Avarayr's own table: `script: [1,2,3,5,6,8,10,11,12,14,15,17,18,20]`. With the default table of 14 the
reserves' road (ambush from script wave 12 on Normal and Hard, 14 on Easy, told one or two waves ahead)
would be told on the commander's wave. With this table the commander comes on wave 7, the tell on wave 8
and the road opens on wave 9 (Easy: told on 8 and 9, opens on 10).
The rule, kept by a self-test: on every battlefield and difficulty, the wave an ambush road opens and the
first wave of its tell are not commander waves (Mari's road is exempt, as it is today: `legacy`). The same
rule holds for the daily's 12-step tables on Normal: Avarayr's is
`dailyScript: [1,2,3,5,7,10,11,12,14,16,18,20]` (commander on wave 6, the tell on 7, the road on 8).

### 1.3 The enemy's tricks

All `from`, `dense`, `every` values in `L.tricks` and `TRICK_RULES.adapt.from` stay script waves.
`trickCfg(kind)` returns `from: playedWave(from)` and keeps the script value as `sfrom`; every `w >= from`
test then works in played waves unchanged (lines 9409, 9422, 9427, 9438, 9470 to 9474, 9558, 9867, 9933).
Counts use script waves: hunters `N[0] + floor((scriptWave(w) - sfrom) / N[1])`, scouts
`N[0] + floor(scriptWave(w) / N[1])`. Scouts come on played wave w if any script wave it covers would have
brought them (`(s - sfrom) % every === 0 || s >= dense` for an s in `coveredWaves(w)`). The ambush's `tell`
stays a count of played waves. The adaptive enemy studies the last three played waves, as now.
Where each trick first comes with the new tables, on Normal (script wave in brackets):

| Battlefield | Trick | Wave |
|---|---|---|
| Erebuni | scouts (7), every wave from (12) | 6, then every wave (today: every second wave until 12; retune their count) |
| Tushpa | siege shields (4), scouts (7) | 4, 5 |
| Avarayr | wicker shields (5), reserves' road (12) | 4, 9 |
| Dvin | ladder parties (6), adaptive enemy (8) | 5, 6 |
| Tashir | adaptive enemy (8) | 6 |
| Sevan | torch-bearers (7), hill track (9), adaptive (8) | 6, 7, 7 |
| Ani | shield wall (8), second assault (8), third and the raiders (15) | 7, 7, 14 |
| Mari | second road (11) | 8 |
| Gyumri | sappers with picks (9) | 7 |
| Halidzor | mantlets (7) | 6 |
| Shushi | special forces teams (12) | 9 |

`trickFirstWaves()` (line 9502) loops played waves to `totalWaves()` and reports played numbers; the brief's
row and the cards then say the right wave with no text change.
The whole table, and "no ambush opens or is first told on a commander wave" on all three difficulties, was
checked on the prototype (`gameplay-proto/check-tricks.js`).
One thing the map changes and tuning must weigh: outflankers come on the script's odd waves from 7, so a
short battle, whose every late wave covers an odd one, brings them on most waves that have no commander
(Erebuni: waves 6, 8 and 9, where today it is 7 of 20). Their count per wave is a knob
(`L.units.flyer.hpMult` is today's); a board without archers or ballistae is punished sooner.

### 1.4 Gold: a wave pays for the script waves it stands for

Measured need: a board that is as built at the last wave as today's (masteries are the game's top end, and a
short battle must still reach them). So income follows the script, not the count of waves played:

- `paidWaves(w)`: script waves `scriptWave(w)` to `scriptWave(w + 1) - 1` (the wave itself and the ones
  skipped after it); the last wave pays itself only. Exception so the coached waves never change: waves 1, 2
  and 3 pay themselves only, and wave 4 also pays any script wave skipped between 3 and it.
  `payStep(w) = paidWaves(w).length`.
- Bounty: `foeBounty(d, w)` uses `scriptWave(w)` and multiplies by `payStep(w)`.
- The clear's bonus (line 11349): the sum over `paidWaves(w)` of `25 + 3 * s`.
- Interest (line 11350): `min(60, floor(gold * 0.05)) * payStep(w)`.
- The towers' free mend at a clear (line 9698): applied `payStep(w)` times (capped at whole).
- The early call's bonus (line 10237): `earlyBonus() * payStep(w)` for the wave it cuts short. An early call
  gives up that wave's clear bonus, interest and mend (line 11052 on), which pay ahead multiplies; its own
  bonus must grow with them or calling early would be worth least on the short battlefields.
- The starting purse is unchanged.

The toast names the sum as now ("Wave 5 repelled! +129 gold · +45 interest"). A coin pop over a fallen foe
shows the multiplied bounty. Nothing else is told: the player sees bigger waves that pay more.
MEASURED with the prototype (pure pay-ahead, without the wave 4 exception and without the early bonus's
multiplier, which the bot does not use): boards within 6% of today's on 14 of 17 battlefields.

### 1.5 The tutorial

Erebuni's waves 1 to 3 are script waves 1 to 3 in every table, pay themselves only, and keep
`tutorialWave`, `tutorialHp` and the trick-free rule (line 9407) untouched: the coached stand is the same to
the foe, the hit point and the coin. Changes: the coach's last bubble (line 60973) says
"**You're ready.** Hold Erebuni through all ten waves: the battle is yours." (built from `numWord(totalWaves())`),
and the reminder at line 61055 tests `totalWaves()`. The tutorial's tray is the five classic tiles whatever
the save owns (section 3.8).

### 1.6 Stars, records, the endless stand

- Stars: unchanged in their thresholds. `victoryStars(held, max)` is a share of the lives the difficulty
  began with, where `held` is the defenders never lost (`lives_max - lost`): the same number as `lives`
  unless an Aid Post returned some (3.5).
- `hs_best_<id>_<age>`: unchanged format. `WON_MARK` (21) still means won; a lost stand stores the wave
  reached (at most 20). An old value larger than the new length and under 21 is read as the new length
  (`Math.min(v, totalWaves())` in `levelBestAnyEra`, line 55235) for the map's "best wave" only. No rewrite.
- `hs_records[id].endless[d]` today holds the last wave cleared, counted from 1 with 20 as the chronicle.
  New: the truth is `beyond[d]`, the waves held beyond the chronicle. Reading: `beyond[d]` if present, else
  `max(0, endless[d] - 20)`. Writing: both, `beyond[d]` and `endless[d] = 20 + beyond[d]`, so an older page
  that reads the row (another tab, a cached copy, the other device before it updates) still sees a number
  that means the same. No migration step, safe to merge by max in the cloud.
  The map's mark and the ribbons say "held N waves beyond the chronicle".
- The endless stand begins after the last wave, as now. Its waves are numbered on from N
  ("Wave 13 ∞" after a 12-wave battle) and step the script by one a wave, paying themselves only.
  `noEndless` (Sis) stays.
- `dayFactor()` (line 10026) uses `waveIdx / totalWaves()`; an endless night cycles every `totalWaves()` waves.

### 1.7 Saved runs: a run finishes under the rules it began with

A run in `hs_run` carries what it was begun with, and resumes with exactly that, whatever the page has
become since:

| Field | Written from | A run without it resumes with |
|---|---|---|
| `rules` | G1 (`RULESET`, 1 for today's rules, 2 from the new lengths on) | today's rules |
| `kit` | G2 (4.3) | the empty kit, a level 1 hero, no Call |
| `script` | G4 (its table, rising whole numbers from 1 to 20) | the identity table: 20 waves, today's economy |
| `tray` | G5 (the kinds it may build) | the five classic tiles |

So a 20-wave run saved by today's build, or by any build before the lengths change, resumes as a 20-wave
battle with five tiles, the way a run from before the tricks does (`trickLegacy`, line 10749); it tells
nothing new and saves again as it was. Its victory counts in full for the campaign (stars, the next road).
`legacyRun` is `r.rules !== RULESET`: its facts say `legacy: true` (6.1) and the platform keeps it off the
current boards (its run token names the older ruleset). `curScript()` reads the run's table, so a later
change of a battlefield's length never breaks a run in progress.
`validRun` (line 10726) tests `r.cleared >= (Array.isArray(r.script) ? r.script.length : 20)`, checks a
`script` (rising whole numbers, first 1, last 20, at most 20 long), and accepts a tower kind only if it is in
the run's tray.

### 1.8 Every place that says twenty

Code (replace `TOTAL_WAVES` by `totalWaves()` unless noted): 9503, 10726 (1.7), 10869 ("Wave 3/10"), 10870,
10891, 10992 and 11869 to 11873 (the endless record and its words, below), 11044, 11352, 11395, 11880,
12041, 44835, 53626, 54100, 54195, 60428, 61055, 76183 (the old migration: keep 20, it reads old saves).
Script-wave logic that must take `scriptWave(w)`: 9237 to 9239, 9244, 9248, 9293, 11122 to 11132, 11136.
Tests of "a commander wave": 9942 (`w % 10 === 0`), 11074, 53358. The sun: 10026 to 10028.
HTML: line 2850 `Wave 0/20` (written by `syncHud` anyway).
Text:
- 3927 Mari: "You held the passes all twenty waves." and "for {n} of 20 waves." become
  `"You held the passes all {N} waves."` and `"You held the passes for {n} of {T} waves."` ({N}: the length
  as a word, {T}: as a number; `heldLine` fills both).
- 11872 to 11873: "beyond the chronicle's twenty" becomes "beyond the chronicle" in all three sentences.
- 11782 the debrief tip "Every tenth wave is led by one" becomes "A commander leads wave {a} and wave {b}
  here" from `commanderWaves()`.
- 54207 "Not in the twenty waves" becomes "Not in this battle".
- 60973 the coach (1.5).
- Ani's `briefNote` (line 3832 region, "from wave 15") and Mari's ("from wave 11") become templates:
  `"... ride in with the third, from wave {w15}."`, `"... from wave {w11} a Mamluk column ..."`, where
  `{wNN}` is `playedWave(NN)`. `L.phaseText`, `L.waveText` and `L.waveCues` are looked up by script wave: a
  played wave shows the entry of the last script wave it covers that has one.
- Comments at 8725, 9246, 9265, 10025, 10987, 54098 are updated to the new facts.
Self-test lines that assume 20 or stage waves 12 and 19 on every battlefield are listed in 8.1.

New on the brief (the chronicle page), under the host of foes: one line,
"**12 waves.** A commander leads wave 7 and wave 12." (`#briefLen`, the style of `.briefHint`). On the
map's plate for the chosen battlefield the subtitle gains "· 12 waves".

## 2. The road-blocking tower: the Garrison Post

The genre's missing archetype here: a post whose men stand on the road and hold foes in melee, so that
everything else has time to shoot. It is a sixth slot, `post`, with its own tile, built on a pad like any tower.
Unlocked when Tushpa opens (after the first victory at Erebuni) and offered on every battlefield from then on.

### 2.1 Numbers

```js
post: {
  name: "Garrison Post", cost: 90, proj: null, post: true,
  levels: [
    { men: 2, hp: 130, dmg: 10, rate: 1.0, reach: 150, respawn: 12 },
    { men: 3, hp: 180, dmg: 15, rate: 1.0, reach: 165, respawn: 10, cost: 110 },
    { men: 3, hp: 250, dmg: 22, rate: 0.9, reach: 180, respawn: 9, cost: 190 },
  ],
  specs: {
    a: { name: "Shield Wall", cost: 300, desc: "Four men behind great shields. Each holds two foes.",
         stats: { men: 4, hp: 420, dmg: 20, rate: 1.0, reach: 185, respawn: 8, holds: 2, guard: 0.35 } },
    b: { name: "Sortie", cost: 300, desc: "Three picked fighters who strike hard and give chase.",
         stats: { men: 3, hp: 300, dmg: 48, rate: 0.8, reach: 215, respawn: 8, pierce: true, chase: 60 } },
  },
},
```

`TOWER_HP.post = [300, 380, 480]` (the post itself, for hunters and powers). `men`: soldiers. `hp`, `dmg`,
`rate`: each soldier's strength, blow and seconds between blows (the blow is cut by armor like an arrow,
`armorHit`; Sortie's pierces). `reach`: how far from the pad the rally point may lie (ground range, the
game's ellipse). MEASURED (`gameplay-proto/padroad.txt`): a pad's nearest road lies 110 to 140 away on
most pads (the archers' first range is 130 for the same reason) and up to 250 on a few. At 150, ten to
fifteen pads of every battlefield can take a post and a typical pad has about 165 px of road to choose
from; at rank 3 about 260 px. `respawn`: seconds until a fallen man returns to the post and walks out. `holds`: foes one
man holds (1 unless given). `guard`: the share of damage a man does not take. `chase`: px a man follows a
foe along the road before he turns back.
Reading: rank 1 is 20 damage a second for 90 gold against the archers' 22 for 50; its worth is the hold.
Rank 3 is 73 a second for 390. A post alone loses its men: a rank 1 man (130) against a wave 5 spearman
(about 11 a second, 2.2) lasts 12 s and needs 21 s to fell him.

### 2.2 How it fights

State per post: `t.rally = {x, y, route, dist}` and `t.men = [{ x, y, hp, state, foe, cd, down }]`.

- Standing: the men stand in a short line across the road at the rally point (spots 12 px apart across the
  road, staggered 8 px along it). A man at his spot looks up the road.
- Holding: each tick a free man takes the nearest foe he may hold whose position is within 30 px (ground
  range) of his spot and that no one holds: `e.heldBy = man`. A held foe does not move (`moveMult` 0, the
  very rule the hero's hold uses at line 12211: `blocked = heroBlocks(e) || !!e.heldBy`). Man and foe trade
  blows until one falls or the foe is no longer holdable. Foes that arrive while every man is busy walk on.
- What may be held: the rank and file on the ground (raider, spearman, shield, cavalry), a hidden scout
  once it is seen, a tower hunter while it is on the road, and a commander for a while (2.4).
- What may not: outflankers (anything with `e.fly`: they go round, as they go round the fire), siege
  engines and their crews (role `ram` in every age: ram, elephant, ladder party, cannon, tank, sappers),
  and a hidden scout nobody has seen. A man strikes an engine or a commander he cannot hold as it passes
  within 30 px.
- Foes fight back: `FOE_MELEE = { raider: 7, spearman: 9, shield: 11, cavalry: 12, boss: 60 }` damage a
  second to the man that holds them, times `1 + 0.05 * (scriptWave(w) - 1)` (1.95 on the last wave).
  Cavalry also deals 30 (same scaling) on contact: the charge. `HERO_DPS` is unchanged for the hero.
- Healing: a man out of combat for 3 s regains 8% of his strength a second. A fallen man costs no lives
  and returns after `respawn`.
- The drums reach the post like any tower: might raises the blow, haste shortens `rate` and `respawn`.
  A damaged or failing post (`towerPace`) slows `respawn` only. A stunned post (trumpet, guns, stones, a
  mine) pauses `respawn`; its men fight on. A wrecked post sends no one: the men alive fight until they fall.
- Kills count for the post (`e.lastHit`), pay their bounty as any kill, and book no damage for the adaptive
  enemy: `post` is not in `TRICK_SLOTS`, but its damage is added to the total the shares are taken of, so a
  board that fights with its garrison is that much less one-sided.
- A fix this needs: `fireTowerShot` (line 11978) leads a stone by the foe's pace and ignores a hold. A held
  or stunned foe is led by nothing: `lead = (e.stunT > 0 || e.heldBy || heroBlocks(e)) ? 0 : speed * pace * 0.9`.
  Held foes bunched at the rally point are what stones and spells are for; this is the tower's main synergy.

### 2.3 The rally point, by mouse and by touch

- When built, the rally point is the road point in reach nearest the pad (on a tie, the one nearer the
  walls). A pad with no road in a rank 1 post's reach (up to four pads a battlefield, measured) refuses
  the tower: its preview ring lights no road and the press answers "No road in reach of this pad."
- The post's panel has a first button "Rally point" (icon `#i-flag`). Pressing it puts the panel away and
  arms `rallying = tower`: the field draws the reach ring and lights every stretch of road inside it (the
  dormant ambush track too), and the toast says "Tap the road inside the ring." (mouse: "Click the road
  inside the ring.").
- The next press on the field: the nearest point of any road to the press, if it lies inside the ring and
  within 70 px (world) of the press, becomes the rally point. The men walk there at 90 px a second; foes
  they held are let go. A flag marks the point for 2 s and the sound `rally` plays. A press outside
  answers "Out of reach." and stays armed. Pressing the post, a tile, a spell, the hero, Escape or
  right-click disarms. It is a third armed state beside `castingSpell` and `heroSelected`: each of the
  three clears the other two (`setPlacing`, `trySelectSpell`, the hero button, lines 60357 to 60383), and
  the canvas handler (line 60222) tests `rallying` right after the hero's rally.
- Touch (iPad and phone): the same two presses. The finger that pressed "Rally point" must be up before
  the field takes a press: reuse `settlePanel`'s guard (line 60340). On a phone the panel is a sheet; it is
  put away on arming so the whole field is free. The 70 px catch is world units: at the phone's scale
  (about 0.45) that is a 31 px radius under the finger, so the nearest road in the ring within 110 world
  units is taken on a phone (`isPhone()`).
- Keyboard: `G` arms the rally of the selected post.
- The reach ring a tile shows before building (and the tutorial's pad preview) is the post's `reach`, with
  the road inside it lit, so a player sees where the men can stand before paying.

### 2.4 Meeting the enemy's tricks, the commanders and the hero

- Outflankers: never held, never struck. The tile's line says so: "Holds foes on the road. Outflankers
  go round."
- Hidden scouts: a man cannot hold what he cannot see. An unseen scout walks through the line. Seen (a
  watch tower, the hero, any hit) it is held like any raider. The post is not a watch tower and reveals
  nothing: the lesson "build the watch tower" stays. Fire slot and post together are the answer.
- Tower hunters: on the road, before they mark a tower, they are held like any foe. When a hunter marks,
  walks to or works on a tower whose foot lies inside a post's reach, up to two free men of that post leave
  the line, walk to it (90 px/s) and fight it at the tower's foot. A hunter in melee does no work (the rule
  for a held hunter at line 9794 already says so). The post is itself a tower hunters may choose
  (`towerWorth`); its own men defend it the same way. This makes the post the answer to hunters on Dvin,
  Sevan and Gyumri, at the price of men leaving the road.
- The ambush road: a rally point may be set on any road stretch in reach, the dormant track included. A
  post near the track can stand on it before it opens.
- Commanders: held one man at a time (never two, Shield Wall included). A commander deals 60 a second
  (scaled) to his holder, and one post holds one commander for 8 s in all (`TRICK_RULES.post.cmdHold`):
  after that he rides its men down without stopping. A post is a delay on a commander, never a wall.
- The hero: his own hold (3 foes within 32 px, 4 at level 4) is separate and adds to the post's. A hero at
  the rally point with the men is the strongest hold in the game, and his Call (4.4) strengthens the men
  near him.
- Era powers: smoke does not blind men; the elephants' trumpet, the guns and the stones stun the post
  (above), not the men; kettle-drums that quicken foes do not break a hold; a sapper party is an engine
  and is not held.
- The adaptive enemy: no answer to the post in the first release (5.5 lists the builds that must lose).

### 2.5 The two masteries

- Shield Wall: four men, 420 strong, who take 35% less. Each holds two foes: eight foes stand still at one
  spot. For roads where the board's splash and fire can work on a held crowd.
- Sortie: three men who strike 48 through armor every 0.8 s and follow a foe 60 px down the road. Longer
  reach (215). For felling what is held, armored foes above all, and for covering two stretches of road.

### 2.6 Name and look in every age

`TOWER_SKINS.post`, `SLOT_NAMES.post`, per-battlefield `L.towers.post`. Mastery names per skin through
`SKIN_SPECS`, as for the other slots.

| Era (battlefields) | Tile name | What it shows (`depicts`) | Masteries | Basis |
|---|---|---|---|---|
| 0 Urartu (Erebuni, Tushpa) | Spearmen of Biainili | "Urartian foot soldiers with spears and round bronze-faced shields, holding the road below the walls" | Shield Wall / Sortie | Bronze helmets, shields and quivers from Karmir Blur are in Erebuni's facts. Spears: CHECK. Do not call them the 6,600 settlers: `text-audit.json` rules those were deported prisoners, not a garrison. |
| 1 Avarayr | Footmen of the Houses | "Foot soldiers of the noble houses standing in line with spears and shields" | Shield Wall / Sortie | Yeghishe's army "including cavalry and infantry" (`text-audit.json`). |
| 2 Caliphate (Dvin, Tashir, Sevan) | Gate Guard (Sevan: Shore Guard) | "Armenian foot soldiers with spears and shields barring the road" | Shield Wall / Sortie | Generic of the age; the unit name is the game's. Sevan's sortie in boats is in its own text. |
| 7 Ani | Gate Guard of Ani | "Townsmen and soldiers of Ani holding the road before the northern gate" | Locked Shields / Sortie ("Shield wall" is the name of the enemy's guard here) | Chapter III: "Ani's defenders beat back the armies sent against it." The townsmen's part: CHECK (Aristakes). |
| 8 Mamluk wars (Mari, Sis) | Men-at-Arms (Sis: Castle Guard) | "Cilician foot soldiers with spears and shields" | Shield Wall / Sortie | Generic of the age: CHECK. |
| 3 1579 (Gyumri Road) | Road Guard | "Highland villagers with pikes and axes barring the winter road" | Shield Wall / Sortie | INVENTION, as the battle is. |
| 4 1727 (Halidzor) | Fortress Garrison | "Fighters of the garrison at the foot of the walls, sabres and matchlocks in hand" | Palisade Line / Sortie | Halidzor's own text: "He led the garrison down the hill in a sudden sortie, and the besieging army broke and fled." |
| 5 1915 to 1918 | Van: Barricade Fighters. Musa Dagh: Pass Defenders. Sardarapat: Infantry Company | Van: "Defenders with rifles and bayonets behind a barricade across the lane". Musa Dagh: "Villagers holding a breastwork across the mountain path". Sardarapat: "Armenian infantry with fixed bayonets" | Dug-in Squad / Bayonet Charge | Van's text: "the fighters dug trenches and raised barricades". Musa Dagh's breastworks are its fire slot's. Bayonet charges at Sardarapat: CHECK. |
| 6 Artsakh | 1992: Self-defense squad. 2020: Trench squad. 2023: Defense Army squad | "A rifle squad dug in beside the road" | Dug-in Squad / Counterattack | Generic of these wars. |

Blurb (`SLOT_BLURB.post`): "Men who stand on the road and hold foes in melee. Outflankers go round."

### 2.7 Art, all drawn in code

- The men: no new figure painter. In eras 0 to 3, 7 and 8 a man is drawn by `unitPaintInfantry(kit, pal, walk)`
  (line 47229) with one new kit row per era in a table `POST_KITS` (helm, beard, tunic, shield and weapon
  are picked from what the painter already draws: `cone` bronze helmet and `roundSmall` shield for Urartu,
  `round` steel helmet and `oval` shield for 451, and so on) and a palette from `unitPalette()` in the
  defenders' colors (the hero's: `UNIT_COLORS`). In eras 4, 5 and 6 a man is the battlefield's hero figure
  (`HF_HEROES` look, line 50400) at 0.78 scale with a plainer coat and no officer's marks. So: kit and
  palette rows only.
- Fighting: the standing pose with the weapon arm's swing the hero already has (`hero.swing`, 0.25 s);
  rifles of eras 5 and 6 flash at arm's length (`heroShot`). A held foe keeps its slow wobble, as under the
  hero's hold. A small strength bar over each man (`drawHeroBar`'s painter at half size), only when hurt.
- The post on its pad: one painter with four variants, each put together from parts that exist: a low
  stone guardhouse with a spear rack and the age's banner (the archer tower's footing and the banner
  painters; eras 0, 1, 2, 7, 8, 3); a timber palisade corner (the `rollstones` crib's timber; era 4); a
  barricade of sacks and beams (the `barricade` skin's parts; era 5); a dugout with a roof of logs and
  earth (the `minefield` and `commandpost` skins' parts; era 6). Baked once per rank like every structure
  (`SKIN_ART`), with Damaged, Failing and Wrecked states as every tower.
- The rally flag, the reach ring with lit road, a tile portrait (the post and two men), one SVG symbol
  `#i-post` (a shield over a spear) for the mastery and panel rows.
- Sound: reuse `rally`, `heroHit` and `heroShot` (throttled by their `Snd.SPEC` caps), `build` with the
  skin's name, a soft `heroDown` when a man falls. No new sound is needed for the first release.

### 2.8 Telling it

- The first time the post is in the tray (Tushpa's brief, or the map after the update for a player who is
  past Erebuni): a one-time card on the brief, in the trick cards' frame, "**A new tower: the Garrison
  Post.** Its men stand on the road and hold foes so your towers can shoot. Set where they stand with
  Rally point." Seen once (`hs_towers_seen`).
- In the first battle with a post built, when it is first selected: one coach bubble at the Rally point
  button, "Tap here, then tap the road to move your men." Seen once (same key).
- Panel stats (`setPanelStats`): Men 3 · Strength 180 · Blow 15 · Holds 3 · Reach 165.
  `statDeltaHtml` gets a branch for `def.post`.

### 2.9 Save

`runRecord` towers gain `rally: [x, y]` (rounded) for a post. The men are not saved: a resumed run starts
the wave again with the garrison whole, as towers reload. A run carries its tray (1.7), and `validRun`
accepts a tower kind only if the run's tray holds it.

## 3. One new tower in each age

### 3.1 The five special towers

`eraAge` orders the nine eras. An internal table groups them by how war was fought, and each group has one
tower with a mechanic none of the five slots or the post has. The groups are never named to the player (the
player's groups are the five chapters, which the map, the stories and the Council already use): he sees "a
new tower" on a battlefield and finds it again on the others where it belongs.

```js
// which battlefields share a special tower. Internal: no age is named on any page
const AGES = [
  { id: "a1", upTo: 2,  tower: "horse" },    // eras 0, 1: Erebuni, Tushpa, Avarayr
  { id: "a2", upTo: 3,  tower: "stores" },   // eras 2, 7, 8: Dvin, Tashir, Sevan, Ani, Mari, Sis
  { id: "a3", upTo: 5,  tower: "mine" },     // eras 3, 4: Gyumri Road, Halidzor
  { id: "a4", upTo: 6,  tower: "aid" },      // era 5: Van, Musa Dagh, Sardarapat
  { id: "a5", upTo: 99, tower: "spotter" },  // era 6: Stepanakert 1992, Shushi, Stepanakert 2023
];
function ageOf(era) { const a = eraAge(era); return AGES.findIndex(A => a < A.upTo); }
// the battlefield's special tower, or null until that tower is built into the game (9.2)
function ageTower(era) { const A = AGES[ageOf(era)]; return A && TOWER_DEFS[A.tower] ? A.tower : null; }
```

Each is offered only on its own battlefields, as a seventh tile, once the campaign has reached the
battlefield named below (and from then on also when earlier battlefields of the group are replayed).

| Battlefields | Tower (`type`) | The new mechanic in one line | First offered | On one field |
|---|---|---|---|---|
| Erebuni, Tushpa, Avarayr | Horse Lines (`horse`) | Riders charge down the road and throw foes back | Avarayr | two at most |
| Dvin, Tashir, Sevan, Ani, Mari, Sis | Stores (`stores`) | Does not fight: pays gold after every wave | Tashir | two at most |
| Gyumri Road, Halidzor | Powder Mine (`mine`) | A charge under a spot you choose, fired by your tap | Gyumri Road | no limit |
| Van, Musa Dagh, Sardarapat | Aid Post (`aid`) | Brings fallen men and the hero back sooner, and returns defenders to the walls | Van | one |
| Stepanakert 1992, Shushi, Stepanakert 2023 | Observation Post (`spotter`) | Marks a foe: every blow on it lands harder | Stepanakert 1992 | one |

A battlefield that comes before the one named gets the tower on a replay: Dvin, the first time through,
stays a battle about the ladder parties and the adaptive enemy, and has Stores when it is fought again after
Tashir has opened.

New things come one a battlefield on a first play: the War Council after Erebuni, the Garrison Post at
Tushpa, Horse Lines at Avarayr, the hero's Call at Dvin (4.4), Stores at Tashir, the Powder Mine at Gyumri
Road, the Aid Post at Van, the Observation Post at Stepanakert 1992.

Three design rules hold for all five, each kept by a bot build that must lose (5.2, 5.5):
1. No tower stops the column for good: a hold ends when its man falls, a foe thrown back cannot be thrown
   again for 8 s, and no man is healed while he fights.
2. No tower is an automatic purchase: with it the best build keeps at most 2 to 3 more defenders than
   without it, and a tower that deals no damage is capped at one or two on a field.
3. No tower moves a star by itself: stars and the boards count the defenders never lost (3.5, 6.1).

### 3.2 Horse Lines (Erebuni, Tushpa, Avarayr)

Mechanic: displacement. It does not shoot. Every `cd` seconds, if a ground foe is on the road inside its
reach, its riders charge along every stretch of road inside the reach, from the walls' side toward the
enemy, in 0.8 s. Each ground foe on that stretch takes `dmg` once (cut by armor) and is thrown back `push`
px along its own road (`e.dist -= push`, never below 0); siege engines and commanders are thrown a quarter
as far. A foe that has been thrown cannot be thrown again for 8 s (`e.thrownT`, by any Horse Lines); it is
still struck. The riders cannot be hurt or held; they wheel back to the lines. Outflankers are untouched. A
foe a man holds is struck but not thrown (the hold keeps it).
At most two Horse Lines on a field (a third is refused: "Two horse lines are all this field can stable.").

```js
horse: { name: "Horse Lines", cost: 110, proj: null, charge: true, max: 2,
  levels: [ { dmg: 40, range: 150, cd: 18, push: 40 },
            { dmg: 70, range: 170, cd: 16, push: 55, cost: 130 },
            { dmg: 115, range: 190, cd: 14, push: 70, cost: 220 } ],
  specs: { a: { name: "Lancers", cost: 340, desc: "One heavy charge that splits armor",
                stats: { dmg: 260, range: 200, cd: 14, push: 60, pierce: true } },
           b: { name: "Harriers", cost: 340, desc: "Charge twice as often and scatter the foe",
                stats: { dmg: 100, range: 200, cd: 7, push: 50, slow: 0.4, slowS: 3 } } } },
```

Why the two limits: without them six Harriers over one stretch throw 300 px every 7 s, about 43 px a second,
against a shieldbearer's 44 and a slowed horseman's 42, and the rank and file never arrive. With them one foe
loses at most 50 px in 8 s to all the horse on the field: a delay, like a fire's slow, never a wall.
Counters and limits: nothing against outflankers; engines barely move; a charge that throws a crowd back
out of a fire's reach can cost more than it gains, so placement matters (best just past a kill zone, to
throw foes back into it). The adaptive enemy has no answer in the first release.
Names: era 0 "Horsemen of Biainili" ("Urartian horsemen riding out from the lines below the fortress";
Urartian cavalry and chariots in the kings' annals: CHECK, the repo's `era-dossier.json` so far documents
the Assyrian side, so the text audit adds a source line or the name becomes "Horsemen"); era 1 "Nakharar
Horse" ("The mounted contingents of the noble houses"; Yeghishe's "cavalry and infantry" in
`text-audit.json`; the cavalry of the houses is also in Dvin's text: "Armenia kept 15,000 horsemen").
Masteries as above in both eras.
Art: the riders are the cavalry painter (`unitPaintCavalry(style, pal)`, line 47790) in the defenders'
palette, three sprites that run the stretch; dust from the walking-dust particles; the building is a rail,
a trough and one standing horse (`unitPaintHorse`) on the common footing. Sound: `ridersIn` (exists) at a
charge. New: the building's painter, a tile portrait.

### 3.3 Stores (Dvin, Tashir, Sevan, Ani, Mari, Sis)

Mechanic: income. It never fights and holds a pad. After every cleared wave it pays `pay` gold for each
script wave that wave paid for (`payStep`, 1.4), so its yield does not depend on the battle's length.

```js
stores: { name: "Stores", cost: 120, proj: null, income: true, max: 2,
  levels: [ { pay: 30 }, { pay: 46, cost: 120 }, { pay: 64, cost: 180 } ],
  specs: { a: { name: "Caravan", cost: 260, desc: "Richer stores, and every kill pays a tenth more",
                stats: { pay: 80, bounty: 0.1 } },
           b: { name: "Field Forge", cost: 260, desc: "Towers nearby mend more and cost less to repair",
                stats: { pay: 64, mend: 0.1, repair: 0.25, range: 220 } } } },
```

Rules: at most two on a field (a third is refused: "Two stores are all this road can feed.").
`TOWER_HP.stores = [240, 300, 380]`: hunters choose by worth and will come for it; the enemy's stones and
guns stun it to no effect. Stores wrecked at a clear pay nothing. Caravan's bounty share does not stack
with a second Caravan nor with the Standards' plunder (the larger applies). Field Forge: towers in its range
mend 10 points more at each clear and cost a quarter less to repair or rebuild.
The decision it must be (the first version aimed at 150 to 250 gold by the end, under 2% of a board, which
is a pad spent for nothing and still a trap for a player who builds two): gold now against gold later, with
a real stake. Targets for tuning (5.2): "greedy" (the mix with one Stores as its third building) ends with
6% to 10% more gold invested than "mix", has lost 1 to 2 more defenders than "mix" by the end of the first
commander's wave, and ends within 2 of it; "bazaar" (two Stores first) ends below "mix" on at least four of
the six battlefields. The tile's line says the risk: "Pays after every wave. Costs you a tower now."
Names (each battlefield's own, `L.towers.stores`): Dvin "Granary", Tashir "Village Stores", Sevan "Monastery
Stores", Ani "Merchants' Stores", Mari "Baggage Train", Sis "Royal Stores". `depicts`, for example: "Sacks,
jars and pack animals under an awning inside the walls". The trade of Dvin and Ani is history (CHECK: one
sourced sentence each for the tile's card); stores as a tower are the game's, and the card says "Stores as a
tower are the game's invention." It is not called a market: one that trades through the storming of Dvin
reads badly, and every fortress and army had stores.
Art: an awning on poles, sacks and jars, a tethered pack animal (the camel or horse painter, standing), on
the common footing; coins rising at a clear (the bounty pop's particle). Sound: `coin`.

### 3.4 Powder Mine (Gyumri Road, Halidzor)

Mechanic: a blast at a spot the player chooses, at a moment the player chooses. The tower on its pad is a
powder store. Its charge lies under a road point inside `range` (set like a rally point: panel button
"Lay the charge", then a press on the road; default: the road point in reach nearest the pad). The charge
arms `arm` seconds after it is laid or fired. Armed, it shows a small marker on the road. It is fired by
pressing the marker, pressing the tower's "Fire" button, or by its trigger: the panel's second button
cycles "Fire: by hand", "Fire: at 3 foes", "Fire: at 5 foes" (the count of ground foes within the blast;
default "at 3 foes" so a player who never touches it still gets its worth). The blast hits every ground
foe in `splash` for `dmg` (cut by armor), staggers it for `stagger` s and drops a shield guard as a stone
does. Then the charge is laid again at the same spot and arms again.

```js
mine: { name: "Powder Mine", cost: 120, proj: null, blast: true, manual: true,
  levels: [ { dmg: 260, range: 180, splash: 80, stagger: 1.5, arm: 28 },
            { dmg: 440, range: 200, splash: 88, stagger: 1.8, arm: 25, cost: 150 },
            { dmg: 700, range: 220, splash: 96, stagger: 2.0, arm: 22, cost: 240 } ],
  specs: { a: { name: "Great Charge", cost: 380, desc: "A blast that breaks a whole column",
                stats: { dmg: 1300, range: 240, splash: 120, stagger: 2.5, arm: 24 } },
           b: { name: "Twin Fuses", cost: 380, desc: "Two charges under two spots",
                stats: { dmg: 620, range: 240, splash: 96, stagger: 2.0, arm: 20, charges: 2 } } } },
```

Reading: rank 1 is 260 to each foe in the blast every 28 s. On five foes that is 46 damage a second for
120 gold, but only when the player (or the trigger) fires it on a crowd; fired on one foe it is 9 a second.
Timing is the skill. Its partners are the Garrison Post and the hero, who hold a knot of foes on the charge.
Counters: outflankers are untouched; a hidden scout unseen does not count for the trigger (a hand-fired
blast still hits it, as stones do); engines take the blow through their armor (12 to 28): the Great Charge
is the answer there. Hunters may wreck the store: a wrecked store's laid charge can still be fired once.
The adaptive enemy books its damage under no slot (as the post).
Touch: the marker's catch is 22 px at least on the screen (the tower tap zone's rule, `towerTapAxes`), and
on a phone it is tested before towers and plots in `phoneTapPick`.
Name: "Powder Mine" in both eras (Gyumri Road, Halidzor). `depicts`: "Kegs of powder buried under the road,
with a slow match run back to the wall". Card line: "Mines of powder were the siege craft of the age.
Defenders using one here is the game's invention." (INVENTION for both battlefields; Halidzor's real
tunnel, in its facts, is a water tunnel and is not claimed as a mine.)
Art: the store is a lean-to with kegs (the `falconet` and `matchlock` skins' kegs and timber, if they have
them, else four ellipses and staves); the marker is a disturbed patch with a glowing match end; the blast
reuses the Great Boulder's and the firepot's landing particles and the sound `mine` (exists: a wreck's and
the sappers'). New: the store's painter, the marker, a tile portrait.

### 3.5 Aid Post (Van, Musa Dagh, Sardarapat)

Mechanic: it gives back what was lost. Three effects, none of them damage, none of them in a fight:
1. Men of Garrison Posts and the hero inside its `range` begin to recover 1 s after their last fight (3 s
   without it) and recover twice as fast. A man is never healed while he fights: a hold always ends.
2. Fallen men of posts in range return `haste` sooner; the hero returns `heroBack` seconds sooner.
3. Defenders: after a cleared wave in which no defender was lost, one lost defender returns to the walls,
   up to `restore` in a battle and never above the number the difficulty began with. The toast says
   "A defender returns from the aid post."

```js
aid: { name: "Aid Post", cost: 110, proj: null, aid: true, max: 1,
  levels: [ { range: 170, haste: 0.2, heroBack: 3, restore: 2 },
            { range: 190, haste: 0.3, heroBack: 5, restore: 3, cost: 130 },
            { range: 215, haste: 0.4, heroBack: 7, restore: 4, cost: 210 } ],
  specs: { a: { name: "Surgeons", cost: 320, desc: "More defenders come back to the walls",
                stats: { range: 230, haste: 0.4, heroBack: 7, restore: 5 } },
           b: { name: "Stretcher Bearers", cost: 320, desc: "Your men and your hero are back in half the time",
                stats: { range: 260, haste: 0.6, heroBack: 12, restore: 4 } } } },
```

One on a field (a second is refused: "One aid post serves this field.").
What a returned defender is worth: he mans the walls again (the battle is lost only when the walls are
empty), but stars, records and the boards count the defenders never lost (`held = lives_max - lost`, 6.1).
The tile's card says it: "Returned defenders hold the walls. Stars count the defenders you never lost." So
the Aid Post is how a hard-pressed stand survives, not a way to buy a star with gold: a board that would win
with two stars still wins with two.
Counters: it does nothing against the foe; a board that buys it instead of a tower leaks more than it
returns (5.5). Hunters and drones can wreck it: a wrecked post returns no one.
Names: "Aid Post" on all three battlefields. `depicts`: "A room behind the lines where the wounded are
bandaged". INVENTION as a tower, and its card says "The aid post as a tower is the game's invention." Van's
card may add, as history and not as the player's building, the sentence the battlefield already tells: "Dr
Clarence Ussher's American hospital lay inside the Armenian lines and was shelled during the siege." (the
hospital was the American mission's, so the tower is not drawn or named after it). Musa Dagh and Sardarapat:
no claim.
Art: a house corner or a tent with a plain white cloth on a pole and a lantern (no red cross: the emblem is
protected, and Musa Dagh's historical banner stays where it is, on its drums slot), two stretchers, a seated
figure from the crew painter (`unitPaintCrew`). A returning defender: a small figure walks from the post to
the fortress (the hero figure at 0.6). Sound: `uiTick`. New: the painter, a tile portrait.

### 3.6 Observation Post (Stepanakert 1992, Shushi, Stepanakert 2023)

Mechanic: it marks. It deals no damage. It keeps a mark on `marks` foes inside its `range` (the strongest
by default; its Target button cycles First, Last, Strongest, Weakest like a shooting tower). A marked foe
takes `amp` more from every source (towers, men, hero, spells, burns): one multiplier applied in
`damageEnemy` and in the burn ticks. A mark on a commander counts half. A marked hidden foe is seen (the
post is a watch tower here beside the drums' lookouts) and stays seen while marked. Outflankers can be
marked: it is the one new tower that helps against drones. A mark moves when its foe falls or leaves the
range. One on a field (a second is refused: "One observation post serves this field.").

```js
spotter: { name: "Observation Post", cost: 90, proj: null, mark: true, air: true, max: 1,
  levels: [ { range: 230, marks: 1, amp: 0.15 },
            { range: 270, marks: 1, amp: 0.2, cost: 110 },
            { range: 310, marks: 2, amp: 0.25, cost: 190 } ],
  specs: { a: { name: "Fire Direction", cost: 300, desc: "The marked foe is shelled every 4 s",
                stats: { range: 340, marks: 2, amp: 0.25, shell: 150, every: 4, pierce: true } },
           b: { name: "Night Sights", cost: 300, desc: "Three marks, and nothing in reach stays hidden",
                stats: { range: 360, marks: 3, amp: 0.25, revealAll: true } } } },
```

Reading: the first version marked both commanders of the last wave for 60% more from the whole board, for
390 gold: no other 390 gold comes near that, so every board would buy exactly one. At 25%, halved on a
commander, it is a good tower against T-72s (armor 28) and drones and a fair one against the brigade
commander. It is worth nothing where no one shoots.
Counters: a board must still have the guns; the mark is one foe (two, three), not a crowd; the adaptive
enemy's guard still cuts the marked blow (the multipliers multiply).
Names: 1992 "Lookout post", 2020 and 2023 "Observation post". `depicts`: "A lookout with field glasses and
a radio on the heights". Generic of these wars; no claim about a named unit.
Art: a sandbagged nest with a figure holding field glasses (Silikyan's look has them, `glasses: true`) and
an aerial (the `commandpost` skin's); the mark is a thin ring and a tick over the foe (the hunters' red
ring painter in the defenders' color). Sound: `uiTick` on a new mark; Fire Direction reuses the mortar's
landing. New: the nest's painter, a tile portrait.

### 3.7 What the new towers share in code

- `TOWER_DEFS` gains six kinds. `def.proj` stays null for all six, so the shooting loop skips them; each
  has its own short block in `update()` beside the fire altars'. `def.max` caps a kind on a field:
  `placeTower` refuses the next one with that kind's sentence, and its tile dims. `getStats`,
  `towerInvested`, `towerWorth`, `towerMaxHp`, repair, rebuild, sale, wreck and the drums' aura work as for
  any tower.
- `TRICK_SLOTS` is unchanged. `bookAdapt` gains a second tally, `adapt.other`, for damage dealt by the
  post, the horse, the mine and the spotter's shells; `adaptStep` adds it to `total` only.
- `towerName`, `levelTower`, `applyEraLabels`, `renderShopPortraits`, `SKIN_ART`, `SKIN_BLURB`,
  `SLOT_BLURB`, `SKIN_SPECS` take the new kinds through the same tables.
- The balance bot and the self-test read the same tables (5.4, 8).

### 3.8 The tray: it grows to seven, and how it fits

The decision asked for: a loadout chosen before the battle, or a tray that grows. It grows. Reasons:
1. In any one battle the roster is at most seven (five slots, the post, the battlefield's special tower).
   Choosing five or six of seven before the battle would be a rule made only to save space, and every way of
   dropping one of the five classic slots is a trap a new player cannot see (no fire slot: scouts walk in
   unseen).
2. A new tower that simply appears in the tray is the reward the owner asked for. One that must push
   another out is a chore.
3. It fits. RENDERED (0.4): seven tiles on a 667 px phone are 88.4 x 52 px each, twice the 44 px a finger
   needs.
4. The choice is on the pads, where it belongs: 14 or 15 pads, seven kinds, three of them capped at one or
   two on a field.
5. Nothing is closed off: the tray is built from one function, `trayTypes()`, and a daily twist can strike
   a tile out through it (6.4). If a later release adds a second special tower to a battlefield, a loadout
   becomes a filter in that one function.

```js
function trayTypes() {
  if (runTray) return runTray;                               // a resumed run: the tray it began with (1.7)
  const base = ["archer", "ballista", "catapult", "fire", "drums"];
  if (tutGentle) return base;                                // the coached stand: the classic five
  const out = base.filter(k => !trayBan.includes(k));        // trayBan: the daily's struck tile, else []
  if (towerUnlocked("post")) out.push("post");
  const a = ageTower(curEra);
  if (a && towerUnlocked(a)) out.push(a);
  return out;
}
```

`towerUnlocked(kind)` is derived from the campaign, never stored: the kind is built into the game
(`TOWER_DEFS[kind]`) and the battlefield named in 3.1 is open (`levelOpen`), or the run is a daily (everyone
has every tower there, 6.4). The tiles are built from `trayTypes()` in `applyEraLabels()` (today they are
five fixed `div.card` elements, lines 2912 to 2946: the two new ones are created once and shown or hidden;
`#shop` carries `data-n="5|6|7"` for the stylesheet). Hotkeys 6 and 7. Every `#shop .card` loop already
reads `dataset.type`.

Layouts:

- Desktop: tiles are 148 px with 7 px gaps; seven are 1,078 px. Today's steps (lines 1253 to 1268: the
  left end-cap, an ornament, hides under 1,340 px; tiles are 128 px under 1,100; the wave cap leaves the
  tray and hangs under the header under 980) move out with the tile count. With `data-n="7"`: the left
  cap hides under 1,680 px, tiles are 128 px under 1,440 and 112 px under 1,300, the wave cap leaves the
  tray under 1,170. With `data-n="6"`: 1,500, 1,260 (128 px), and 1,100 for the wave cap. Under 760 px a
  tile's width is `(100vw - 28px) / n`, not `/ 5`.
- iPad: at 1194 x 834 seven tiles are 112 px wide and 82 px tall and the wave cap stays in the tray at
  its 320 px. At 1024 x 768 the wave cap hangs under the header (the layout narrow windows have today)
  and the tiles are 128 px. `padplace.js` and `plots.js` run at both.
- Phone held sideways (667 x 320 and up): the tiles share the whole width as now (`flex: 1 1 0`, 6 px
  gaps): seven are 88 px on an SE, 98 px on an iPhone 15 from the Home Screen (852 px less 59 px insets
  each side); six are 104 px on an SE. Height stays 52 px. To keep the bar "text at least 11 px, never cut
  off", a tile's name is chosen by measure, not by a count of letters: the full name if it fits its box
  (`scrollWidth <= clientWidth`; 82 px on an SE with seven tiles, about 17 characters), else
  `towerShort(type)` (the battlefield's `L.towers[k].short`, else `SLOT_SHORT[k][era]`) if that fits, else
  no name at all (class `noNm`: the picture takes the row). The full name always stands in the line over a
  chosen tile, which a phone already shows. Short names are needed only for the long ones; those RENDERED
  as cut at seven tiles and their short forms: "Self-defense riflemen" and "Defense Army riflemen" →
  "Riflemen", "Basement radio post" → "Radio post", "Barricade and mines" → "Barricade", "Bread queue
  shelter" → "Bread shelter". Others of 18 characters and more, to be confirmed by `iphone.js` at seven
  tiles on every battlefield: "Modern Rifle Marksmen" → "Marksmen", "Barricade and Trench" → "Barricade",
  "Ghevond's Exhortation" → "Exhortation", "Ter Avetis' Blessing" → "Blessing", "Castle Stone-Thrower" and
  "Wall Stone-Thrower" → "Stone-Thrower", "Cartridge Workshop" → "Workshop", "Traction Trebuchet" →
  "Trebuchet", "BM-21 Grad battery" → "Grad battery", "Spearmen of Biainili" → "Spearmen", "Footmen of the
  Houses" → "Footmen", "Horsemen of Biainili" → "Horsemen", "Self-defense squad" and "Defense Army squad" →
  "Squad". The hotkey badge (`.card .key`) is hidden on touch, which frees the tile's top left corner.
- Phone held upright (best effort, as today): seven tiles of 49 px share 375 px; no names (`noNm`), the
  picture and the price only; the line over a chosen tile names it.
- The tower panel: the post's and the mine's panels have one more button than a shooting tower's (Rally
  point; Lay the charge and the trigger). On a phone's sheet (`#panel.sheet`, two columns) the action
  column holds five buttons of 44 px at most in 320 px of height less the header: the trigger button takes
  the Target button's 36 px class, and `fitPanelActs` (line 54482) grows the sheet and, at the last, lets
  the column scroll, as it does today for a mastery choice. `iphone.js` proves it (8.2).

## 4. Progression (D5)

Two things grow: the War Council (stars spent on a tree, the same for every battlefield) and the heroes
(experience kept per chapter). Towers are unlocked by reaching battlefields (3.1), never bought. Progression
is a bounded bonus on top of one reference game, the Standard battle, which is what the boards and the daily
are and what the balance is tuned on (4.8, 5.1).

### 4.1 Stars

- Campaign stars, as today: a battlefield's stars are the most any of its victories earned on any
  difficulty (1 to 3, by defenders never lost). 17 x 3 = 51.
- New, the Hard seal: a battlefield won on Hard gives one more star. 17.
- 68 stars in all. They are counted from `hs_records` each time they are needed
  (`starsEarned() = sum of levelStanding(i).stars + (levelRecord(i).stars[2] > 0 ? 1 : 0)`), never stored:
  today's players have their stars the moment the update loads, and the cloud cannot make stars by merging.
- Nothing else gives stars: not the endless stand, not the daily, not a first clear as such. A star always
  means "this battlefield, held this well".
- The map's tally (`#ovStars`, line 56549) shows earned stars of 68, and a pip with the number unspent.

### 4.2 The War Council

Five branches of five tiers. A tier needs the tier under it in its branch, and its chapter: tier t can be
bought once Chapter t is open (its first battlefield is open: `levelOpen(CHAPTERS[t - 1].levels[0])`).
Costs by tier: 1, 1, 2, 2, 3 stars (9 a branch, 45 for all). Reset is free and whole, at any time outside a
battle ("Reset the Council"). Once owned a tier counts on every battlefield, old ones too.

| Branch (`id`) | Tier 1 (1 star) | Tier 2 (1) | Tier 3 (2) | Tier 4 (2) | Tier 5 (3) |
|---|---|---|---|---|---|
| Bowmen (`bows`): archer and ballista slots | Archer slot: 2% more damage | Ballista slot: 2% more damage | Both: 2% more range | Both: reload 2% faster | Both: masteries cost 15% less |
| Engineers (`engines`): catapult and fire slots | Catapult slot: 3% wider blast | Fire slot: 3% more burn | Catapult slot: stagger lasts 0.05 s longer | Fire slot: slows 2 points more | Both: masteries cost 15% less |
| Captains (`captains`): drums, Garrison Post, the special tower | Drums slot: 3% more reach | Drums slot: 1 point more might | Garrison Post: men 10% stronger | Men return 15% sooner; the battlefield's special tower costs 10% less to build | Their masteries cost 15% less |
| Heralds (`heralds`): hero and spells | Hero 5% stronger (strength) | Spells ready 3% sooner | Hero returns in 16 s, not 20 | Spells ready another 3% sooner | The hero's Call ready 20% sooner |
| Stewards (`stewards`): gold and walls | 10 more gold at the start | Repairs and rebuilds cost 10% less | The war chest's interest may reach 70 a wave, not 60 | Towers 5% stronger; they mend 2 points more at a clear | A sale returns 80%, not 70%; land costs 10% less |

(G2 close: these are the numbers the game ships with KITSET 1. G2 cut the first draft's numbers to hold the
bounds of 5.2 on the sample of RULINGS E: see docs/specs/balance/README.md, section G2. The Captains' tiers 3
to 5 and the Heralds' tier 5 are not tuned yet: they are tuned with the post (G5) and the Call (G3).)

A tier is never sold for something that is not in the game yet, and never changed after a player has
bought it: until the Garrison Post ships (G5) the Captains' tiers 3 to 5 are shown closed, "Comes with the
Garrison Post", and the standard order of buying (4.8) skips them. The Council ships before the post (9.2),
which is why the drums' two tiers come first in that branch.
Each tier is one sentence and one number, shown exactly so on its card. Design bound, held by tuning (5.2):
the whole tree and a level 5 hero together are worth less than one step of difficulty to a good build
(Easy's foes are 15% weaker than Normal's): at most 4 defenders on Normal; what a careful first play owns
(PAR, 4.8) is worth at most 2.

### 4.3 How the Council and the hero's level reach the battle

One object, the kit, is fixed when a battle begins (`resetGame`) and saved with the run:

```js
// kit = { own: { bows: 2, engines: 1, captains: 0, heralds: 0, stewards: 1 }, hero: 2, call: true }
// the player's Council, his chapter's hero level and whether the Call is open; KIT_EMPTY (no tier, hero 1,
// no Call: today's hero) in a Standard battle, a daily and a coached stand
function battleKit() { return standardBattle || dailyRun || tutGentle ? KIT_EMPTY : playerKit(); }
function kitHas(branch, tier) { return (kit.own[branch] || 0) >= tier; }
```

- One name for a tower's numbers: `getStats(t)` (line 11894) returns the stats with the kit applied (a copy
  cached per kind, rank and mastery; the cache is dropped in `resetGame`), and the raw table is
  `rawStats(t)`. All 24 call sites of `getStats(` (the shooting loop, fire, drums, `watchReach`, the range
  rings, `setPanelStats`, `statDeltaHtml`, the foe card's "blows to fell", `statDps`) therefore read the
  kit's numbers with no edit, and none can be missed. The panel shows the numbers that are fought with.
- Costs go through `towerCost(type)`, `rankCost(type, level)`, `specCost(type, key)`; `towerInvested` and
  `towerWorth` sum what was actually paid, kept on the tower (`t.paid`).
- Hero: `heroSpawn` reads `HERO_LEVELS[kit.hero]` and the Heralds' tiers. Spells: `SPELLS[k].cd * kitCd()`.
- Stewards: `resetGame`'s purse, `repairCost`, `rebuildCost`, the interest cap, `towerMaxHp`, `mendTowers`,
  `sellRefund`, `plotPrice`.
- The kit of a run in progress never changes: a reset or a purchase made on the map while a run is saved
  applies from the next battle. A resumed run uses `r.kit`; a run saved without one uses the empty kit (1.7).
- A coached stand (`tutGentle`) uses the empty kit and a level 1 hero: the tutorial is the same battle for
  everyone, whatever the save owns.

### 4.4 Heroes

Who leads: always the battlefield's own hero (`L.hero`), as today. A man is never put on a field he did
not stand on, so there is nothing to choose before a battle. What grows is kept per chapter, the grouping
the player already knows from the map: the heroes of one chapter share one experience total and one level
("the captains of a chapter learn from each other's stands": a rule of the game, said as such where the
levels are shown). The level a hero stands at is his chapter's.

Experience from one battle, added to the battlefield's chapter when the battle ends, won or lost:
`xp = round(D * (10 * scriptWave(lastCleared) + (won ? 100 : 0)))`, D = 0.75 on Easy, 1 on Normal, 1.5 on
Hard (until G4 brings the script map, the script wave is the wave itself). A full victory on Normal is 300
whatever the battlefield's length. A daily counts for its
battlefield's chapter, at most 150 a day. A run under older rules gives the same. Test mode
(`recordsBarred()`) gives none. The endless stand and the hero's own kills give none (two more rules for a
few points, and a reason to farm).

Levels: 2 at 150, 3 at 450, 4 at 900, 5 at 1,500.

| Level | Strength | Blow (every 0.7 s) | Holds | Heals out of combat | Returns after | New |
|---|---|---|---|---|---|---|
| 1 | 400 | 34 | 3 | 10 /s | 20 s | (today's hero) |
| 2 | 460 | 40 | 3 | 10 /s | 20 s | The Call is ready in 50 s, not 60 |
| 3 | 520 | 46 | 3 | 14 /s | 20 s | Reveals scouts within 110 px (80 today) |
| 4 | 600 | 54 | 4 | 14 /s | 17 s | The Call lasts 2 s longer |
| 5 | 700 | 62 | 4 | 18 /s | 14 s | The Call's second effect (below) |

On a first play a hero stands at level 1, 2, 3 on the three battlefields of Chapters I, II and V and at 1,
2, 3, 4 on the four of Chapters III and IV. Level 5 is for a player who comes back.
One rule keeps the commanders what they are. Today the hero holds any ground foe he reaches, a commander
included, until he falls: about 12 s (400 strength against the commander's 34 a second, `HERO_DPS.boss`).
A hero's level must not lengthen that: a commander strikes a hero of level 1 to 5 for 34, 39, 44, 51 and
60 a second, and Stand Fast's half damage does not apply to a commander's blows.

The Call: one ability, the same in every chapter, opened once by the campaign and not by a level: every
hero has it from the day Dvin opens (Chapter II), at every level, on every battlefield, old ones too
(`callOpen() = levelOpen(3)`). So it is never lost when a new chapter's hero starts at level 1, and it does
not land on Tushpa together with the Council and the Garrison Post. Levels and the Heralds make it stronger.
It is part of the kit (4.3): a Standard battle and a daily are fought without it, with today's hero.

- Stand Fast, on a 60 s clock: for 6 s the hero takes half damage and holds two more foes, and the men of
  Garrison Posts within 120 px of him take half damage and each hold one more. At level 5 also: the foes he
  holds burn for 20 a second.
- How it is given, with no new button (a phone's left column has room for four medallions and no more):
  while the hero is chosen and the Call is ready, his medallion shows a horn and the word "Call", and a
  press sounds it where he stands. A press within 0.4 s of the press that chose him does nothing (a double
  tap must not spend it). When the Call is not ready, or not yet open, a second press lets him go as today.
  The medallion wears a bright ring when the Call is ready and a thin outer arc while it cools. Keyboard:
  `T`. The tooltip and the touch toast add "Press again for his Call."
- Name: Stand Fast is the game's own word for Avarayr ("Stand as Vardan stood", era 1's story). It claims no
  deed of a named hero: the card says "The Call is a game ability."
- Art: no new figure. A ring that spreads from the hero (the frost ring's painter in gold), the hero's
  swing, the age's horn (`horn`, exists).
- Later, if players ask for more (not in any release planned here): a Call of its own for each chapter
  (Charge, Sortie, To Arms, Call Fire in the first version of this spec).

### 4.5 What is earned where

| Source | Stars | Hero experience | Towers |
|---|---|---|---|
| A victory | 1 to 3 by defenders never lost (the best across difficulties counts) | 300 on Normal, 225 on Easy, 450 on Hard | Reaching a battlefield opens the tower named for it (3.1); reaching Dvin opens the Call |
| A first victory on Hard | 1 more (the Hard seal) | as above | |
| A lost battle | none | 10 for each script wave cleared, by difficulty | |
| The endless stand | none (its record only) | none | |
| The daily challenge | none (its board and its streak are the platform's) | as a battle, at most 150 a day | |

### 4.6 The pages and their doors

One panel: the War Council, with the captains' levels as a strip in it. Gameplay draws it into whatever
element it is given (`renderCouncil(el)`) and reports a badge (`councilBadge()`: stars unspent). It is one
of the tabs of the platform's Hall (`HALL_TABS.push({ id: "council", ... })`) and `openCouncil()` is
`openHall("council")`. The Hall's shell ships with the platform's P0 and works on `file://` and under the
harness (the platform's review settled this), so gameplay builds no page of its own; G2 starts after P0.

Doors:
- The map: the star tally becomes a button (`#ovStars`: `role="button"`, 44 px to a finger, title "War
  Council: 3 stars to spend"). It carries one pip, shared with the platform's "daily unplayed" dot: the
  title says which. It opens the Hall on the Council tab while stars are unspent, else as the platform
  chooses (N4 in 9.5).
- The chronicle: (1) the hero's line under the miniature (`#briefHero`, line 60132) reads "Your hero ·
  Argishti I · Level 2" and, pressed, shows a small card: his level, the bar, what the next level brings,
  the Call's line. (2) A new row `#briefKit` under the tricks row: the towers this battle offers as small
  medallions (5 to 7; a new one wears "New"), a chip "Council · 3 to spend" (shown only when stars are
  unspent) that opens the Council, and the Standard battle switch (6.4) for a player who owns a tier or a
  hero level there.
- The victory page: under the stars, when the victory earned new stars and one of them can buy something,
  a button "Spend 2 stars at the War Council"; and a strip with the hero's name, his level and the
  experience bar filling to its new place. Both go in one row, `#ovGrowth`, under `#ovRecord`, and must
  keep `vic.js`'s rule for every button (wholly on screen, 40 px, apart from the others). On a phone held
  sideways the victory page is full to the pixel at 667 x 320 (the platform's review measured it), so there
  `#ovGrowth` is one line of text and no button, in place of the last line of the page's prose: "Argishti
  I · Level 2 · 2 stars to spend". The Council's door there is the map's tally.
- One-time cards (frame and behavior of the trick cards, `hs_towers_seen`): "The War Council opens."
  (the first time stars are unspent, on the map), "A new tower" (2.8, and one for each special tower),
  "The Call" (the first battle after Dvin opens, a coach bubble on the hero's medallion).

Layouts. The panel is given a content box and must fit it; the box is the Hall's, not the whole page:
- Desktop and iPad (the Hall's column, 720 px): five columns (one a branch, its name over it) of five
  medallions 56 px across, tier 1 at the top. A medallion is owned (gold), open (lit, with its cost in
  stars), closed by its branch (dim) or closed by its chapter (dim, a small lock, "Opens with Chapter III").
  A press chooses it and shows its one sentence, its cost and the "Take it · 2 stars" button (44 px tall)
  in a strip under the tree; a second press on the button buys. Header: "War Council", "4 stars to spend of
  9", and "Reset the Council" (a second press confirms on touch, as Sell does). Under the strip, the
  captains: one line a chapter reached ("I · Argishti I, Sarduri II, Vardan Mamikonian · Level 3" and the
  bar), with "The captains of a chapter learn from each other's stands."
- Phone held sideways: the Hall keeps a 64 px column of tabs at the left, so the box is about 580 x 280 px
  on an SE (667 x 320) and never less than 560 x 280 at the sizes `iphone.js` holds. The strip with the
  sentence and the button is a column on the right, 170 px wide, text at 12 px, button 44 px, with two
  small buttons at its foot, "Captains" and "Reset". The tree takes the rest: five columns at a pitch of
  `(W - 170) / 5` (78 px at the least), five rows of 44 px medallions 6 px apart (244 px) under a 36 px
  header. "Captains" swaps the tree for the five chapter lines and back. Nothing scrolls.
- Phone held upright (best effort): the tree's five columns share the width (62 px each at 375), the
  strip and the captains are under it, the page scrolls.
- On the chronicle held sideways on a phone the left column is full: `#briefKit` shows the Council chip,
  the Standard switch and, if there is one, the new tower's medallion only.

### 4.7 Saves, and CLOUD_KEYS

Three new keys, all pushed onto `CLOUD_KEYS`:

| Key | Shape | Merge rule for the cloud |
|---|---|---|
| `hs_council` | `{ v: 1, own: { bows: 0..5, engines, captains, heralds, stewards }, n: <how many times it was changed> }` | The value with the larger `n` (on a tie, per branch the larger), each value only clamped to a whole number 0 to 5 (`councilParse`). The merge is pure: it never reads this device's records, which the same merge has not brought in yet (G2 close). `councilSane()` runs on every read (`councilLoad`): tiers above the chapter reached are dropped, and if the cost is more than the stars earned, the highest tiers are dropped (last branch first) until it fits. The later change wins because a reset is free and stars are counted from records: nothing can be lost, and a reset made on one device is not undone by another's older copy. A count of changes, not a time, because a device's clock cannot be trusted. |
| `hs_heroes` | `{ v: 1, xp: { kingdoms, faith, crowns, night, artsakh }, daily: { day, xp } }` (the chapters' ids) | Per chapter the larger number; `daily`: the later day, on the same day the larger `xp`. |
| `hs_towers_seen` | `["post", "horse", ..., "council", "call"]` | Union. |

Existing keys that change shape: `hs_records` rows gain `beyond` (1.6; merge: per field and difficulty the
larger, as for stars and lives). `hs_run` gains `rules`, `kit`, `script`, `tray` (1.7), the battle's
counters with `redo` and `cd` (6.1), tower fields `rally`, `spot`, `trigger`, `paid`. Which of two saved runs is newer is the platform's stamp to
say. A daily never writes `hs_run`.

Today's players (migration, no rewrite of anything they own):
- Stars: counted from `hs_records` as it is. A player with 30 stars opens the game to "30 stars to spend".
- Heroes: a chapter's experience is never read below what the campaign shows:
  `heroXp(ch) = max(stored, 300 x battlefields of that chapter already won)`. It is derived each time, not
  written once, so a veteran's heroes stand at the levels a first play would have given whatever order his
  records and his `hs_heroes` reach a device in.
- Towers and the Call: derived from the campaign, so everything a player has reached is open at once.
- Runs: 1.7. Records: 1.6. Nothing in `hs_best_*`, `hs_settings`, `hs_tutorial_done`, `hs_tricks_seen`,
  `hs_chapters_seen`, `hs_unlocked_seen`, `hs_nardi*`, `hs_home_tip` changes.
- `validRun`, `councilSane`, `heroLevelOf` treat every stored value as untrusted: whole numbers in range,
  else the default.

`KITSET` (1 at first) names the Council's and the heroes' tables. It rises when one of their numbers
changes, has its own self-test pin (`KITSET_PIN`, a hash of the two tables), and is carried in a battle's
facts. It is apart from `RULESET` on purpose: a Standard battle uses none of it, so a change to a Council
number restarts no Standard board (6.3).

### 4.8 Fairness: one reference game, and a bounded bonus

The difficulty a new player meets must not depend on grinding, and progression must not tilt a board. Both
follow from one decision: the game is tuned as the Standard battle (no Council tier, today's hero, the
battlefield's whole tray), and everything a player owns is a bonus on top, with a ceiling.

1. The owner's balance targets (5.1) are measured on the Standard battle. That battle is also the daily
   and the Standard boards, so the tuned game and the ranked game are the same game.
2. Towers come from reaching a battlefield, never from stars or replays.
3. A player who wins with one star a battlefield meets the reference game with a small bonus; nobody meets
   a game made harder to make up for upgrades he may not have.
4. Hero experience is per chapter and a victory gives the same 300 whatever the battlefield's length; a lost
   battle gives experience too, so a player who is stuck grows without leaving the battlefield.
5. Council tiers open with chapters, so what can be owned on first arrival is bounded.

What a player has on first arrival, for the bound checks (having won every earlier battlefield once):
- FLOOR: one star a battlefield (every victory earns one). PAR: two (what the best build inside the Normal
  band earns: it keeps 12 to 16 of 20, and three stars need 17). CAP: everything the chapter lets be owned,
  for a player who went back for three stars and Hard seals.
- The standard order of buying, used for FLOOR, PAR and the bot: tier by tier, and inside a
  tier Bowmen, Engineers, Captains, Heralds, Stewards (`councilStandard(stars, chapter)`).
- Hero level: the chapter's level after one Normal victory on each earlier battlefield of the chapter.

| # | Battlefield | Chapter (tiers open) | FLOOR stars | PAR stars spent | CAP stars | Hero level, first play |
|---|---|---|---|---|---|---|
| 1 | Erebuni | I (1) | 0 | 0 | 0 | 1 |
| 2 | Tushpa | I (1) | 1 | 2 | 4 | 2 |
| 3 | Avarayr | I (1) | 2 | 4 | 5 | 3 |
| 4 | Dvin | II (1 to 2) | 3 | 6 | 10 | 1 |
| 5 | Tashir | II | 4 | 8 | 10 | 2 |
| 6 | Sevan | II | 5 | 10 | 10 | 3 |
| 7 | Ani | III (1 to 3) | 6 | 12 | 20 | 1 |
| 8 | Mari | III | 7 | 14 | 20 | 2 |
| 9 | Sis | III | 8 | 16 | 20 | 3 |
| 10 | Gyumri Road | III | 9 | 18 | 20 | 4 |
| 11 | Halidzor | IV (1 to 4) | 10 | 20 | 30 | 1 |
| 12 | Van | IV | 11 | 22 | 30 | 2 |
| 13 | Musa Dagh | IV | 12 | 24 | 30 | 3 |
| 14 | Sardarapat | IV | 13 | 26 | 30 | 4 |
| 15 | Stepanakert 1992 | V (all) | 14 | 28 | 45 | 1 |
| 16 | Shushi | V | 15 | 30 | 45 | 2 |
| 17 | Stepanakert 2023 | V | 16 | 32 | 45 | 3 |

Erebuni is always fought first with nothing: the tutorial is the same for everyone.
The bounds (5.2), on Normal with the best build: with the PAR kit it keeps at most 2 more defenders than on
the Standard battle (the mean over the 17) and with the CAP kit at most 4, on no battlefield more than 6; on
Hard with the CAP kit it still loses some seeds. If a tier or a level breaks a bound, its number is cut, not
the battlefield retuned. So a campaign played with the Council is a little kinder than the owner's bands,
by design and by no more than that; three stars (17 of 20) come into reach for a player who has earned the
tree, which is what the tree is for.
The boards do not use any of this: a Standard battle is fought with the empty kit (6.4).

## 5. Balance

### 5.1 The owner's rulings, carried over, and what they are measured on

With `tools/balance.js`, SEEDS=3, lives 30 / 20 / 14 as today, on the Standard battle (`KIT=none`: no
Council tier, a level 1 hero without the Call, the battlefield's whole tray):
- Normal, the first six (Erebuni to Sevan): the best build loses 4 to 8 of 20 on every seed (keeps 12 to
  16) and fells both commanders on every seed; the balanced mix wins every seed. Erebuni's coached waves 1
  to 3 never change.
- Normal, the later eleven: the best build loses 5 to 10 (keeps 10 to 15, two of three seeds in the band)
  and fells both commanders; the mix wins two of three on at least 8 of the 11 and none of three on at
  most one.
- Easy: the mix wins every battlefield on every seed and keeps about 22 to 27 of 30 on the first six.
- Hard: the best build wins at least 12 of the 17 on two of three seeds, keeps 2 to 8 of 14 and loses
  some seeds.
- One-recipe builds lose: "ballista" and "archers" each lose at least once on the first six on Normal and
  often on Hard; the adaptive enemy adapts on at most 30% of the mix's waves and at least 60% of the
  one-tower builds'.
- Where two or more tricks are active no one trick is more than 75% of the best build's toll.
- A victory gives three stars at 17 of 20: the best build in the Normal band earns two.

### 5.2 What is added for progression, the new lengths and the new towers

- The kit is a bounded bonus (4.8): `KIT=par` keeps at most 2 more defenders than `KIT=none` for the best
  build on Normal (the mean over the 17), `KIT=cap` at most 4, and on no battlefield more than 6; on Hard
  with `KIT=cap` the best build still loses some seeds; on Easy nothing is asked. `KIT=floor` is reported,
  not bound. The hero's level is part of the kit and is measured with `HERO=hold`.
- Lengths: a battlefield's band does not move with its length. A 10-wave Erebuni still costs the best
  build 4 to 8. (The prototype shows what moves: 3 to 6 lives easier before retuning.)
- Time, a new target: wave time at 1x for the best build on Normal within 15% of the table in 1.2. The
  bot prints it (5.4).
- The classic five stay a whole game: "mix" (no new towers) meets every target above that it meets today.
- The new towers are worth their pad and never required: "mix7" (the mix with the post and the special
  tower in its order) keeps on average 1 to 3 lives more than "mix" over the 17 on Normal, and on no
  battlefield more than 5 more. The post, Horse Lines, Stores and the Powder Mine are each in the best
  build on at least a third of their battlefields.
- New one-recipe builds lose on Normal on at least two of three seeds wherever they can be built:
  "posts" (posts only), "postdrum" (posts and drums), "agemix" (the special tower on every second pad up
  to its limit, posts between), "harriers" (two Horse Lines at Harriers, fires and drums: the board that
  tries to pin the column).
- A commander is never stopped by posts: with CMD=probe a board of posts alone leaves both commanders
  above 60% of their strength at the walls.
- Stores (3.3): "greedy" (the mix with one Stores as its third building) ends with 6% to 10% more gold
  invested than "mix", has lost 1 to 2 more defenders than "mix" by the end of the first commander's wave,
  and ends within 2 of it; "bazaar" (two Stores first, then the mix) ends below "mix" in lives on at least
  four of the six battlefields.
- The Aid Post (3.5): it is not asked to be in the best build. "mix" plus an Aid Post as its sixth
  building never loses more defenders (`lost`) than "mix" by more than 1, returns at most its cap, and on
  at least one of Van, Musa Dagh and Sardarapat turns a seed the mix loses into a win.
- The Observation Post (3.6): with it the best build keeps at most 2 more defenders; it is in the best
  build on at most two of its three battlefields.
- Easy and the new towers: the mix alone still meets Easy's band; a family that never touches a new tower
  loses nothing.
- The endless stand is not made endless: on three battlefields a "mix7" board and a "harriers" board fall
  between waves 8 and 20 beyond the chronicle.

### 5.3 Knobs, in the order they should be reached for

The first six (Erebuni to Sevan) and the later eleven are tuned differently, because the game's own record
says so (the comment over `LEVEL_HP`, line 9265 on, and the header of `tools/balance.js`): "Hit points alone
never made the first six hard for a good build": foes 1.8 times as strong did not cost the mix a life on
Tushpa, Avarayr or Sevan. Their pressure is the tricks, the adaptive enemy and their economies.

The first six, where every battlefield is shortened and comes out 3 to 6 lives easier:
1. The tricks' counts and shares in `L.tricks`: the ambush road's `share`, the scouts' and hunters' `n`,
   and `from` (in script waves), with the rule that no one trick is more than 75% of the toll.
2. `L.tricks.econ` (the starting gold and the bounty multiplier).
3. `hpTune`, Erebuni's `hpFrom`, and `L.units.flyer.hpMult` for the outflankers that now come more often:
   fine tuning only.
4. `LEVEL_HP`'s commander column, with CMD=probe.

The later eleven:
1. `hpTune` and `LEVEL_HP`'s rank and file column (a battlefield's own strength), as today.
2. `LEVEL_HP`'s commander column, with CMD=probe. Mari first of all: in the prototype its mix won 1 of 7
   and kept 1, because its second road (script 11) now opens on wave 8 of 12 with the last commanders
   still to come. Its commander number and, if that is not enough, the road's `from` are set before its
   `hpTune` is touched.
3. The tricks' counts where the script map made them denser or thinner.

Then, everywhere:
4. The new towers' own numbers (2.1, 3.2 to 3.6).
5. The Council's numbers (4.2) and the hero's levels (4.4), against the bounds of 5.2 only.
Never `DIFFS`, `hpScale`, `TOWER_DEFS` of the five slots, the star thresholds or the pay rule of 1.4: they
are shared by everything already tuned.

### 5.4 How the bot learns all this (`tools/balance.js`)

- The clock: each battle returns `sec` (the battle clock of 6.1: the bot sends each wave 4 s after the
  last is cleared, as Auto does) and `secs` (game seconds per wave); the table gains a column "min" for the
  best build (the patch is `gameplay-proto/balance-time.diff`). It also returns `earned` and the time the
  last foe of each wave spawned (for `minS`, 6.2).
- Lengths: the loop reads `totalWaves()` (it names `TOTAL_WAVES` at lines 202, 308, 323, 349). `trickWave`
  and the tell are already read through the game. `DAILY=1` plays the daily's 12-step tables.
- Kit: `KIT=none|floor|par|cap` (default `none`) calls a test hook `setKitForTest(kit)` before
  `resetGame()`; the hook builds the kit from 4.8's table for the battlefield played.
- New kinds in a build's order: `post`, and `age` (the special tower of the battlefield played; skipped
  where it is not offered or its limit is reached). New builds in `BUILDS`: mix7, posts, postdrum, agemix,
  harriers, greedy, bazaar, aid (5.2). `BAN=fire` strikes a tile (for the daily's twists).
- The bot's rules for the new towers, the same for every build:
  - Post: the pad that reaches the most road (the existing ranking, radius the post's reach). Rally point:
    the road point in its reach that lies in the range of the most standing shooting towers, on a tie the
    one nearest the walls; set again after each purchase. Where an ambush road is told, a post that
    reaches it moves its rally there for those waves if no other tower covers it.
  - Horse Lines: the pad whose reach holds the most road within 120 px downstream of a fire or catapult.
  - Stores: the free pad that reaches the least road (the worst pad for a tower), bought as the order
    says, never after two thirds of the battle.
  - Powder Mine: pad by road reached; the charge at the road point in reach covered by the most towers;
    trigger "at 3 foes".
  - Aid Post: the free pad nearest the fortress.
  - Observation Post: pad by road and sky reached (`rankAir`); target Strongest.
  - Hero: `HERO=hold` parks the hero at the road point nearest the fortress that the most towers cover
    (today the bot never moves him, so his level could not be measured), and sounds the Call when three
    or more foes are within its radius. `HERO=off` is today's behavior, for comparing.
- Report: defenders never lost apart from defenders returned; gold paid by Stores; per new tower, damage
  per 100 gold as for the others, and for the post "seconds of hold per 100 gold".
- Seeds: `BOT_SLOT` is untouched, so every battlefield keeps its seeds.

### 5.5 Builds that must lose, and why they do

- Posts alone: men deal 20 to 73 a second a post and hold two to four; engines and outflankers walk past;
  a commander is held 8 s a post. Nothing kills the column.
- The special tower alone: Stores, an Aid Post and an Observation Post kill nothing and are capped at one
  or two; a powder mine fires once in 22 to 28 s; horse lines strike once in 14 to 18 s, two at most, and
  no foe is thrown twice in 8 s.
- Two Stores and a thin board: income arrives after the waves that needed it.
The adaptive enemy has no guard against the new kinds in the first release. If tuning shows a board of
one new kind and drums winning, the fix is that kind's numbers. A guard against the post ("Wedge": held
foes break free after 4 s) is specified as the fallback and built only if needed.

### 5.6 Tuning, package by package

Each work package of 9.1 that changes a rule ends with its own tuning step and its tables under
`docs/specs/balance/` (before and after, SEEDS=3, all three difficulties, with the clock). One cause at a
time:

- G1 (no rule changes): the baseline tables of master, with the clock, `earned` and `minS`: the pars of
  ruleset 1.
- G2, G3 (Council, heroes): no battlefield is retuned. `KIT=par` and `KIT=cap` against `KIT=none` with
  `HERO=hold`; a tier or a level that breaks a bound of 5.2 has its number cut.
- G4 (lengths): the knobs of 5.3 until the bands of 5.1 hold again on all three difficulties; Erebuni's
  own table; Mari; commanders with CMD=probe; wave time within 15% of 1.2. Then Easy and Hard (their own
  entries), then the endless stand's first ten waves on three battlefields.
- G5 (the post): its numbers, until "mix7" is 1 to 3 lives above "mix" and the post builds lose; the bands
  again, with the best build free to use the post.
- G6 (the daily): the 12-step tables with `DAILY=1`: the daily's pars per battlefield, and each twist on
  each battlefield (`TWIST=id`, the mix, three seeds): the pairs for `daily.skip` (6.4).
- G7a to G7e (a special tower each): its numbers and its rows of 5.2, on its own battlefields only.
After every one of these: three seeds, all three difficulties, all builds on the battlefields touched; the
`rev` of each battlefield whose numbers moved rises (6.3); a person plays (8.4).

## 6. What a score is made from

### 6.1 The numbers of a battle

Kept by the battle, saved with the run at every wave's horn (`markWaveStart`, so a resumed run neither loses
nor doubles them), and sent as the props of `victory`, `defeat` and `battle_quit`. The first block is the
platform's contract, names as in its spec; the second is gameplay's own, for the stats view and for
checking claims. `battleFacts()` returns both as one object. It is nested one level at most, and
`JSON.stringify(battleFacts())` stays under 3 KB in the worst case (Stepanakert 1992, seven kinds, every
counter at six figures: a self-test builds it, 8.1): the server keeps an event up to 4,096 bytes as
PostgreSQL writes it, and drops a larger one without an error.

```js
{
  // the contract (platform spec 0.3 and 7.2)
  lv: "erebuni", diff: 1, mode: "campaign",      // "campaign" | "daily" | "endless"
  ruleset: "2", rev: 1, loadout: "std",          // rev: the battlefield's own revision (6.3); "std" | "open" (6.4)
  wave: 10, waves: 10,                           // waves cleared, the battle's length
  lives: 15, lives_max: 20,                      // the defenders on the walls at the end; the difficulty's
  held: 15, lives_board: 15, stars: 2,           // never lost; what the boards count (below); stars from `held`
  sec: 1042,                                     // the battle clock (below)
  spent: 7180, earned: 7630,                     // gold laid out; the starting purse plus every coin paid since
  twist: null,                                   // the daily's twist id
  through: "cavalry:3,spearman:2", road: 0,      // a defeat's debrief
  legacy: false, resumed: 0,                     // a run under older rules (1.7); how many times it was resumed

  // gameplay's own
  build: "2026-11-09", kitset: 1, ch: "kingdoms",
  script: 20,                                    // scriptWave(wave): how far through the 20-step script
  beyond: 0,                                     // endless: waves held beyond the chronicle
  lost: 6, returned: 1, debt: 0,                 // lives = lives_max - lost + returned; debt: below
  cmdMet: 3, cmdFelled: 3, trickLost: { ambush: 0, hidden: 1, hunter: 0, adapted: 0 },
  realS: 688, speedS: { x1: 120, x2: 568, x4: 0 }, idleS: 96,   // real seconds, pauses left out; at each speed; clock run between waves
  left: 450, refunds: 0,                         // gold in the purse at the end; gold that sales gave back
  from: { bounty: 5200, clear: 1500, interest: 480, early: 110, stores: 120 },
  on: { build: 2300, rank: 3100, mastery: 1200, land: 275, repair: 305 },
  towers: { archer: 4, ballista: 3, catapult: 3, fire: 2, drums: 1, post: 1 },   // standing at the end
  masteries: 6, built: 15, sold: 1, wrecks: 1, plots: 1,
  tray: "archer,ballista,catapult,fire,drums,post", ban: "",
  spells: { arrows: 6, frost: 7, wrath: 5 }, calls: 4, heroLevel: 2, heroFalls: 1, heroKills: 23,
  council: { bows: 1, engines: 1, captains: 0, heralds: 0, stewards: 0 }, power: 2,   // power: the stars' worth of tiers in force
  early: 3, auto: false, aided: false, tutorial: false,
}
```

The counters, as gameplay keeps them:
- `sec`: the platform's `simSec`, unchanged: the sum of `dt` in `update` from the first wave's horn to the
  last foe's fall. Waiting between waves counts. The speed button does not (a game second is a game second
  at 1x and 2x). Pauses, menus, cards and the coach's freezes do not (`update` does not run). Why waiting
  must count: the spells (60, 75 and 100 s), the hero's healing and return, the Call, a mine's arming and
  the men's return all recover between waves (`update` runs them in every phase), so a clock that stopped
  there would make "wait out every cooldown before every wave" the best play on every board. Why that is
  fair: towers can be built, ranked and sold while the game is paused, on every device, so thinking is free
  for everyone. The player is told once, on the Standard switch's line and under the boards: "The battle
  clock runs between waves too. Pause to plan." `idleS` in the facts is the part of `sec` run between
  waves, for the stats.
- `spent`: gold laid out on towers, ranks, masteries, land, repairs and rebuilds. A sale gives nothing
  back to it, except the full refund of a placement undone within its 5 seconds.
- `earned`: the starting purse plus every coin paid since (bounties, clear bonuses, interest, early
  calls, stores). `left = earned - spent + refunds`.
- `lost`, `returned`, `held`: defenders lost; defenders an Aid Post returned; `held = lives_max - lost`, the
  defenders never lost. `lives = held + returned`. Stars and records are counted from `held`.
- `debt` and `lives_board`: what a resume costs on the boards (below). `lives_board = max(0, held - debt)`.
Counters to add (none exist as totals today): `sec`, `idleS`, `realS`, the speeds, `earned` and its parts
(every `gold +=`), `spent`, its parts and `refunds` (`spendGold` gains a reason), `lost`, `returned`, `built`,
`sold`, spell and Call counts, `early`, `auto`, `resumed`.

A resumed battle stays ranked, and a resume never improves its numbers. Today a reload in the middle of a
wave gives back every defender lost in it (`saveRun` writes the run as it stood at the horn, line 10674),
and the wave is fought again. That stays as forgiving as it is for the campaign, and phones drop tabs, so
barring resumed battles would bar most phone battles. Instead:
- While a wave is on the field the run also keeps `redo: { w, lost, sec }`: the defenders lost and the
  clock run in this attempt of wave `w`. It is written with every `saveRun`, at each defender lost
  (`leakFoe`) and when the page is hidden (`holdOnLeave`).
- On a resume with `redo.w === cleared + 1` the wave is fought again from the horn, as today. The clock
  takes `redo.sec` (time fought is time fought), `resumed` rises, and the battle remembers the dropped
  attempt's loss (the largest, if the wave is dropped more than once).
- When that wave is cleared having lost `m` this time, `debt += max(0, dropped - m)`. So on the boards a
  wave fought twice counts whichever attempt lost more; trying a wave again can never gain a defender or a
  second there.
- A resume between waves has nothing to fight again: no debt, no time.
- A resume gives nothing back. Today the spells' clocks are not in the saved run (`runRecord`, line 10641),
  so a reload makes every spell ready and brings a fallen hero back: with a clock that counts waiting, a
  reload between waves would be the free way to wait. The run therefore also keeps `cd`: the three spells'
  clocks, the Call's, the hero's strength and his seconds to return, and a mine's arming, as they stood at
  the save (at the horn, for a wave fought again), and `resumeRun` restores them.
- The victory page says it only when there is a debt: "A wave fought again counts its worse attempt on the
  boards."
A daily is never saved (6.4), so none of this applies to it.

### 6.2 The score

The platform's formula stands (its section 5.1): a win is 4,000 plus up to 3,000 for defenders, 1,500 for
speed and 1,500 for thrift; a lost daily is under 4,000 by waves. Gameplay owns what goes into it:
- Defenders: `L = lives_board / lives_max`. The platform's `p_stats.lives` is filled from `lives_board`.
- Speed: `S = clamp((slow - sec) / (slow - fast), 0, 1)` with, per battlefield and difficulty,
  `fast = max(minS, round(0.6 * parS))` and `slow = round(1.4 * parS)`. `parS` is the best build's mean
  `sec` on the Standard battle from the balance tables (5.6: the bot sends each wave 4 s after the last is
  cleared); `minS` is the sum over the waves of the time the last foe of the wave spawns (no battle can be
  shorter, early calls included). A battle at par earns half the speed points; early calls earn the rest;
  a battle slower than 1.4 times par earns none (the platform's sentence "0 at par or slower" becomes "0 at
  1.4 times par or slower").
- Thrift: `T = clamp(1 - spent / earned, 0, 1)`.
- A lost daily: by the waves held of the daily's 12 (`floor(3999 * wave / waves)`), or by their script
  wave if the platform prefers (N6): a daily board holds one battlefield a day, so both rank its losses in
  the same order.
- The endless board: `beyond`, ties by less `sec`.
- One board a difficulty, no multiplier.
What must never move a score: the speed chosen, pauses, the device (every device can build while paused),
the hero's kills, a defender an Aid Post returned, a wave tried again.
What keeps a battle off the Standard boards: `loadout !== "std"`, `legacy`, `aided`, `tutorial`. A resumed
battle is not kept off.

### 6.3 `RULESET`, a battlefield's `rev`, `rulesetData()` and `KITSET`

`rulesetData()` returns the object the platform publishes to its server (its section 2.4), built by the
page from its own tables so it cannot drift from the game. It holds only what a Standard battle is fought
under: for each battlefield its `waves`, its `script` table, its `rev`, and for each difficulty `lives`,
`fast`, `slow` (6.2)
and `earnMax` (the starting purse, every bounty with the plunder mastery, every clear bonus, the interest
cap on every wave, the early bonus on every wave, two Stores at Caravan: an upper bound on `earned`, with
the platform's 10% margin); the score's weights; and the daily's part (6.4). Gameplay also puts in, for its
own checks, `pads + plots` (the most towers there can be) and the tray of each battlefield.

- `RULESET` names the whole object: 1 is today's game (shipped with G1, so boards can open on today's
  rules), 2 the new lengths with the Garrison Post, and it rises with every later change to anything in
  `rulesetData()`. The platform's self-test pin (`RULESET_PIN`, a hash of `rulesetData()`) makes a change
  without a bump fail the suite.
- `rev` is a battlefield's own small whole number (`LEVEL_REV[id]`, 1 at first). It rises when that
  battlefield's rules change: its length, its `hpTune` or tricks, a tower it offers, a par. A change to
  something every battlefield shares (the pay rule, a classic tower's table) raises every `rev`. Asked of
  the platform (N11): boards keyed by the battlefield's `rev`, so that Horse Lines restart three boards and
  not seventeen. A self-test keeps `rev` honest: a hash of each battlefield's part of `rulesetData()` is
  pinned beside its `rev`.
- `KITSET` names the Council's and the heroes' tables (4.7). They are not in `rulesetData()`: a Standard
  battle uses none of them, so changing a Council number restarts no Standard board. Open boards take
  whatever kit a player has and are not restarted for it either.

A server can refuse `sec < fast * 0.8`, `earned > earnMax`, `lives > lives_max`, `spent > earned`, a wave
count that is not the battlefield's (the daily's 12 for a daily). It cannot prove a battle was played.

### 6.4 The standard loadout, the daily, and its twists

The standard loadout (the platform's `std`) is "nothing beyond the standard set": no Council tier in force,
the hero at level 1 without the Call, no gift of gold (the nardi blessing, the town's gift), and a tray that is the
battlefield's whole tray or a part of it. Only what adds power makes a battle `open`.
- A new player's battles are `std` by themselves: he owns no tier, and a tray still short of a tower he has
  not reached is a handicap, not an advantage. So first victories go to the headline board. (The coached
  first stand is never ranked: `tutorial`.)
- A player who owns Council tiers or a hero level on that battlefield gets a switch on the chronicle, in
  `#briefKit`: "Standard battle · no Council, hero at level 1, no Call · for the Standard boards. The battle clock
  runs between waves too. Pause to plan." (off by default, remembered for the visit, 44 px). `standard_set`
  records its use. `openBriefStandard(levelIndex)` opens a chronicle with the switch on, for a "Fight for
  this board" door if the platform wants one.
- The Call is part of the kit, like a hero's level: a Standard battle and a daily are fought with today's
  hero, level 1 and no Call. So the Council and the heroes can ship (R2) without touching a Standard board.

`startDaily(levelIndex, twistId, day)` (the platform chooses the first two from `rulesetData()` and passes
the day, as its review settled, so the battle is the same with the platform off): Normal; a 12-wave stand
on every battlefield (`DAILY_WAVES`, 1.1: `SCRIPT_TABLES[12]`, or the battlefield's `dailyScript`); the
standard loadout with the whole tray for everyone, whether or not the campaign has reached those towers;
the twist applied; `mode: "daily"`. Why 12 everywhere: a daily is one sitting, is not saved, and an
attempt is spent at the first horn; at the campaign's lengths that is up to 40 minutes at 1x on a phone that
may drop the tab. At 12 waves it is 15 to 26 minutes at 1x on sixteen battlefields and about 31 on
Stepanakert 1992 (`gameplay-proto/tables.txt`), half that at 2x. Sis counts its days by script wave
(`DAYS_PER_WAVE * scriptWave(w)`), so its last wave is still day 60.
A daily never writes `hs_best_*` or `hs_records` (it opens no road and gives no stars), may be fought on a
battlefield the campaign has not reached (its chronicle is shown first, as before any battle), leaves
`hs_run` alone, and gives hero experience up to 150 a day. Its chronicle shows the twist's card before
"Begin the Stand".
Randomness: the few draws that move foes (an outflanker's entry point, line 11193; its path over a lake,
line 11210; which side an aircraft circles) come from a small generator seeded from `day` and the
battlefield (`gRnd`), so every player meets the same lines; looks
(particles, sheep) keep `Math.random`.

The pool: all 17 battlefields by id. `DAILY_TWISTS = [{ id, name, line, apply }]`: `line` is the one
sentence of its card, `apply` sets knobs that exist today, so no twist needs new art. Each twist has a
fixed name and is the same for everyone. The first eight:

| id | Name | Card | What it sets |
|---|---|---|---|
| `thin` | Thin purse | "Bounties are a fifth lower today." | bounty x 0.8 (`econ.bounty`) |
| `swift` | Forced march | "Every foe marches 15% faster today." | `spdMult` x 1.15 on every role |
| `iron` | Iron ranks | "The rank and file wear 3 more armor today." | `armorAdd` + 3 on raider, spearman, shield, cavalry |
| `few` | Few defenders | "You have 12 defenders today." | lives 12 |
| `quiet` | No spells | "No spells today." | the three spells off |
| `noballista` | No {ballista slot's name} | "No {name} today." | the ballista slot struck from the tray (`trayBan`) |
| `nocatapult` | No {catapult slot's name} | "No {name} today." | the catapult slot struck |
| `nodrums` | No {drums slot's name} | "No {name} today." | the drums slot struck |

`{name}` is the battlefield's own name for that slot (the platform's share text reads the twist's `name` for
the day's battlefield through `twistName(id, levelIndex)`). The fire slot is never struck (it is the watch
tower on most battlefields).
Held back until the first eight have run a month (each needs its own check, and two need a look by age):
`scouts` (hidden scouts on many waves), `sappers` (tower hunters; their look and name from a table by age,
never men with picks in 1915 or 2023), `pair` (the first commander brings a second), `wary` (the enemy
adapts early), `press` (Auto on and locked).

Pairs the daily must not serve: a (battlefield, twist) the bot's mix cannot win on two of three seeds on the
daily's 12-step table (`DAILY=1 TWIST=id KIT=none`), and `nodrums` on a battlefield whose watch slot is the
drums, go into `rulesetData().daily.skip = { "<lv>": ["twist", ...] }`. The platform's pick, in the page and
in SQL, steps to the next twist in the list while the day's pair is in `skip` (N10). The list is made by
the bot and committed with the balance tables.

`rulesetData().daily` therefore holds: `pool`, `twists`, `diff: 1`, `attempts: 3`, `waves: 12`, `skip`,
`levels: { "<lv>": { script, fast, slow, earnMax } }` (the daily's own 12-step table and its pars), and `t`,
for each twist the multipliers it puts on `fast`, `slow` and `earnMax` and, for Few defenders, the lives it
sets (`livesSet`, the platform's name): Forced march makes a battle shorter; Thin purse makes it poorer.

## 7. Analytics hooks

Gameplay calls `track(name, props)`; it never waits for it and never reads from it. Props are objects of
numbers, booleans and short strings, nested one level at most: no free text, nothing personal, and under
3 KB as JSON (the server drops an event over 4,096 bytes without an error). The platform's spec (7.2)
lists the events it expects from gameplay and their props; those names are the contract and are sent
exactly so. The table gives each call's place in today's code, what gameplay adds to the platform's props
(in brackets), and the events gameplay adds for the new systems. The first block ships with G1, on today's
game; an event of a later package ships with that package.

| Event | Where (function, line today) | Props |
|---|---|---|
| `chapter_story` | `showChapterIntro` | `ch` |
| `brief_open` | `showBrief` 60101 | `lv` [`diff`, `mode`] |
| `tutorial_step` | the coach enters a step (`tutGo`) | `id`, `i` |
| `tutorial_done` | the tutorial ends | `skipped`, `i` |
| `battle_start` | the first wave of a battle is sent (`startWave` 11040 with `waveIdx` 0), and `resumeRun` 10741 | `lv`, `diff`, `mode`, `loadout`, `ruleset`, `ranked`, `resumed`, `tutorial`, `twist` [`rev`, `waves`, `tray` (as `"a,b,c,f,d"`), `power`, `hero`, `legacy`] |
| `wave_end` | `endWaveIfClear` 11342 | `lv`, `diff`, `mode`, `wave`, `lives`, `gold`, `towers`, `sec`, `early` [`sw` (the script wave), `lost`, `ranks`, `masteries`, `spells`, `calls`, `rallies`, `fired` (mines by hand), `repairs`, `idle` (seconds waited before this wave): counts in that wave] |
| `tower_built` | `placeTower` 11908 | `lv`, `wave`, `type`, `pad` |
| `tower_upgraded` | `upgradeTower` 11925, `specializeTower` 11939 | `type`, `level`, `spec` |
| `tower_sold` | `sellTower` 11954 | `type`, `level`, `wave` |
| `plot_bought` | `buyPlot` 10189 | `lv`, `wave` |
| `trick_met` | a trick's first-time card shows | `lv`, `wave`, `trick` |
| `victory` | `victory` 11451 | the contract's props and gameplay's own (6.1) |
| `defeat` | `defeat` 11839 | the same, with `through` and `road` |
| `battle_quit` | Settings, Abandon; Replay tutorial from a battle | the same, with `how: "abandon"` |
| `map_open` (new) | `buildMenu` 55002, when the map is shown | `ch`, `open` (battlefields open), `stars`, `unspent` |
| `star_gain` (new) | `recordWin` 10970, when the tally rises | `lv`, `diff`, `stars`, `hard` (the seal), `total` |
| `endless_start` (new) | Hold Forever | `lv`, `diff` |
| `council_open` (G2) | the Council panel is drawn for a visit | `from` ("map", "brief", "victory", "hall"), `unspent` |
| `council_buy` (G2) | a tier is taken | `branch`, `tier`, `left` |
| `council_reset` (G2) | Reset the Council | `spent` |
| `standard_set` (G2) | the chronicle's Standard battle switch | `lv`, `on` |
| `unlock_seen` (G2 on) | a one-time card of 4.6 is put away | `what` ("post", "horse", ..., "council", "call") |
| `hero_level` (G3) | a chapter's level rises | `ch`, `level` |

Not sent (cut from the first version: the per-visit cap is 600 events and these answer no question the
owner has asked): `foe_card`, `brief_page`, `speed_set`, `auto_set`, `captains_open`. The speeds a battle was
played at are in its facts (`speedS`).
Volume: the tower events are 30 to 60 a battle and the platform keeps 40 a battle; the counts in `wave_end`
and in the battle's facts carry the same story.
The funnel the gate's cost is read from (D3) runs on through these: the platform's gate events, then
`brief_open`, `battle_start` with `tutorial`, `tutorial_step` by step, `wave_end` for waves 1 to 3,
`victory` or `defeat` or `battle_quit`, the second `battle_start`. Under the harness `track` only fills the
page's own queue (`window.__hsEv`), which is what the self-test reads.

What the owner can answer from these, the questions each package must make answerable before the next one
is tuned: where a first visit ends (step by step to the second battle); on each battlefield and difficulty,
how many begin, win, lose and quit, on which wave, and how long a battle takes in real minutes; how long
players wait between waves (`idle`); which towers are built and which never are; whether stars are spent and
on what; how many battles are Standard.

## 8. Tests

### 8.1 The self-test and its budget

Today: 151 checks, 117 s of wall time on this machine (MEASURED, 0.4), of a 125 s budget that no code
enforces. The budget is kept by not adding to that suite, and is now enforced:
- Suite 1 (`?selftest=1`, today's): only edited where it assumes twenty (with G4). The staged waves 12 and
  19 of "render L" become `Math.ceil(N * 0.6)` and `N - 1`; every `TOTAL_WAVES` in lines 77157 to 78325
  becomes `totalWaves()` (they stage a victory, a defeat or an endless stand: same cost); line 77379's check
  that the constant is 20 becomes a check that the endless defeat page names no number; line 78245 keeps
  1 to 20 (the data stays script waves); line 78293's "an ambush does not meet a commander wave" uses
  `isCommanderWave(playedWave(f))`. No check is added. Its time does not grow.
- Suite 2 (`?selftest=2`, new, `runSelftestPlay`): everything below, with its own 125 s budget. It grows
  package by package; if it passes 100 s it is split again.
- `tools/selftest.js` takes `--suite=1|2|all` and fails a suite whose own clock (`res.ms`, new) passes
  125 s. `all` runs the two side by side (MEASURED: two at once cost each about 3%, 120 and 121 s against
  117), unless `--serial` is given or the machine has fewer than four cores, when it runs them one after
  the other.

Suite 2's checks, by the package that brings them:
- G1, numbers and hooks: `battleFacts()` after a staged victory, defeat and endless end has every field of
  6.1 and its sums hold (`lives = held + returned`, `held = lives_max - lost`,
  `left = earned - spent + refunds`); `sec` grows between waves, does not grow while paused, and is the same
  at 1x and 2x for the same battle; a tower can be built while paused; with the page's event queue, a staged
  battle sends the events of section 7 in order; every gameplay event's props are nested one level at most
  and under 3 KB on the worst case (Stepanakert 1992, seven kinds, every counter at six figures); `rulesetData()` has 17 battlefields, `fast < slow` on each difficulty of each, and its pins hold
  (`RULESET_PIN`, each battlefield's `rev` pin).
- G1, resumes: a run saved in the middle of a wave with two defenders lost resumes with the wave to fight
  again, its clock kept, and a debt of 2 when the wave is then cleared without loss, of 0 when it loses 2
  or more again; a run saved between waves resumes with no debt; a run saved with a spell cooling and the
  hero fallen resumes with the spell still cooling and the hero still away.
- G2, Council: stars counted from records with the Hard seal; a tier needs the one under it and its
  chapter; reset returns everything; the merge of two `hs_council` values takes the larger `n` (a
  reset on one side survives), is pure (a device with no records keeps the cloud's tiers: G2 close), and a
  forged value is cut down by `councilSane` when it is read; the panel's numbers equal
  `getStats`; the standard order gives 4.8's rows; `KITSET_PIN`; the loadout tag is `std` with the empty
  kit and any tray that is part of the battlefield's, `open` with a tier in force; the page is staged at
  1600 x 900, 1194 x 834 and in a 560 x 280 box with no element outside it (`?shot=council`).
- G3, heroes: a victory on Normal is 300 (on a 10-wave and on a 20-wave battlefield once G4 is in); the
  thresholds; the derived floor (records without `hs_heroes` give the first-play levels of 4.8); the Call
  is open exactly when Dvin is; a press on the medallion within 0.4 s of choosing the hero does nothing, a
  later one sounds the Call, and with the Call cooling it lets him go; the Call's clock.
- G4, waves: every `L.waves` is 10 to 20 and has a table; every table starts 1, 2, 3, rises, holds 10,
  ends 20; `coveredWaves` and `paidWaves` each split 1 to 20 with no gap or overlap; the clear bonuses of a
  whole battle sum to the 20-wave total (1,130) on every battlefield; on Sis and Sardarapat `wavePlan(w)`
  equals the script's plan for every wave (unchanged battles); Erebuni's coached waves 1 to 3 match a
  fixture taken from master (queue, hit points, bounties, gold after each); on Erebuni no wave brings more
  than two kinds not seen before; the commander waves equal 1.2's table; no commander's wave has
  outflankers outside the drone war and Ani's raiders; no ambush opens or is first told on a commander
  wave, on the campaign's tables and on the daily's; the first waves of 1.3's table; an early call pays
  `earlyBonus() * payStep`; "Wave 3/10" in the HUD; the brief's line; Mari's held lines; the coach's last
  words.
- G4, old saves: an `hs_run` without `script` resumes with 20 waves, five tiles and the kit it saved (or
  none), wins, and records its stars; an old endless record of 34 reads as 14 beyond and is written back
  both ways; an `hs_best` of 15 on a 10-wave battlefield shows 10 and one of 21 still opens the next road.
- G5, Garrison Post: at least ten pads of every battlefield have road within a rank 1 post's reach, and a
  pad without refuses the post; a post built gets a rally point on a road in reach; a staged press moves it
  and a press out of reach does not; a held foe's `dist` does not grow and it is let go when its man
  falls; engines and outflankers are not held; an unseen scout passes and a seen one is held; a hunter at
  a tower in reach stops working when a man reaches it; one post holds a commander 8 s at most; a stone
  aimed at a held foe lands on it; a resumed run keeps the rally point; a wrecked post sends no one; the
  drums quicken the men.
- G5, tray: 5, 6 or 7 tiles as the campaign stands; five in the coached stand; a resumed run's own tray;
  keys 6 and 7; a tile's price is the kit's; a kind at its limit is refused with its sentence.
- G6, daily: `startDaily` gives 12 waves on every battlefield, the standard loadout (the whole tray, the
  empty kit, no Call), applies each twist, and a staged victory leaves `hs_best_*`, `hs_records` and
  `hs_run` as they were; two daily battles of one day draw the same outflanker lines; `daily.skip` holds
  only pairs of the pool and the list.
- G7, the special towers: each is offered only on its battlefields and only once its battlefield is open;
  Horse Lines never throw a foe behind its road's start, nor a held foe, nor one thrown in the last 8 s,
  and a third is refused; Stores pay `pay` times `payStep`, a third is refused, a wrecked one pays nothing;
  a Powder Mine arms, fires by a press on its marker, fires by its trigger at 3 foes, and Twin Fuses holds
  two; an Aid Post never raises a man's strength while he fights, returns a defender only after a wave
  without a loss, stops at its cap, never passes the starting count, and a returned defender changes
  neither `held` nor the stars; an Observation Post's mark multiplies a blow once, by half on a commander,
  shows a marked scout, can mark an outflanker, and a second post is refused.

### 8.2 The regression suite (`tools/regress/`)

- `padplace.js`: the post's tile and the special tower's tile on every pad, by mouse (1600 x 900,
  2000 x 1250) and touch (1194 x 834), and a phone pass (667 x 320) for one battlefield of each group with
  seven tiles.
- `probe.js`: every new kind at every rank and mastery opens its own panel. New: Rally point pressed, then
  the road: the men's rally moved (mouse, iPad touch, phone); Lay the charge the same; a press on an armed
  charge's marker fires it and opens no panel.
- `plots.js`: unchanged, run once more with seven tiles in the tray at 1194 x 834.
- `iphone.js` (all ten sizes): the tray of six and of seven on every battlefield (tiles at least 44 x 44,
  each name whole or absent, never cut: `scrollWidth <= clientWidth`); the post's and the mine's panels as
  sheets (every button inside the sheet and the safe area, the tap that opens the sheet presses nothing);
  the armed rally (ring and toast inside the safe area, the toast not over the wave ribbon); the Council
  panel in the Hall's box and on gameplay's bare page; the chronicle with `#briefKit`, the hero's line and
  the Standard switch (44 px); the victory page with `#ovGrowth`; the one-time cards; the Call's face and
  ring on the medallion.
- `vic.js`: the new buttons obey its rule on every battlefield and size. `doors.js`: the tally opens
  the Council and the map is back in reach; the chronicle's hero line opens its card and closes.
- `live.js`: on every battlefield a post is built and its rally set, the special tower built, three waves.
- `nag.js`: unchanged steps; the last bubble says "ten waves". `dance10.js`: unchanged.
- New `waves.js` (G4): every battlefield played to its victory through the game's own loop at 4x with
  test gold: the HUD counts to N, the commander banners come on the table's waves, the victory page comes
  up after wave N. `--quick`: Erebuni, Avarayr, Mari. About 10 minutes in full.

### 8.3 Balance tables to produce (kept under `docs/specs/balance/`)

Each at SEEDS=3 on Easy, Normal and Hard with the clock, by the package of 5.6: (a) master, as the
baseline and the pars of ruleset 1 (G1); (b) `KIT=par` and `cap` against `none`, with `HERO=hold` (G2, G3);
(c) lengths, before and after retuning, and CMD=probe (G4); (d) with the post (G5); (e) `DAILY=1`: the
daily's pars and, for every twist on every battlefield (Normal, mix), the pairs to skip (G6); (f) with each
special tower (G7); (g) after each, `rulesetData()` as JSON.

### 8.4 Touch playtests

By a person, or with the touch player built for the earlier play review, on an iPad (1194 x 834), an
iPhone SE (667 x 320 in Safari) and an iPhone 15 from the Home Screen (852 x 393). Each belongs to the
package that brings what it plays:
1. (G4) A fresh save: the tutorial to Erebuni's victory. Ten waves, no new tile, the same coach, new kinds
   of foe no more than two a wave. Under 25 minutes at 1x with the reading.
2. (G5) Tushpa: the "new tower" card, a post built, the rally moved five times during waves at 2x. No press
   meant for the road opens a panel, buys land or moves the hero (at most 1 slip in 20 presses).
3. (G7) Avarayr with Horse Lines; Tashir with Stores; Gyumri Road with a Powder Mine fired by hand five
   times on a crowd; Van with an Aid Post; Stepanakert 1992 with an Observation Post retargeted.
4. (G2, G3) The Council on the phone: buy three tiers, reset, buy again. The Call with foes on the hero:
   ten times chosen and sounded, never once sounded by the choosing press.
5. (G4) A family run on Easy that never opens the Council or builds a new tower: it wins the first six.
6. (G5) Sardarapat's 20 waves on a phone at 2x: the frame rate with four posts' men on the field stays
   where it is today (the frame governor does not step in on an iPhone 12 or newer).
7. (G1) A battle left in the middle of a wave on a phone (the app switched away for five minutes) and
   resumed: the wave is fought again, the clock has kept its time, the victory page says the one line
   about the worse attempt only if a defender was lost before leaving.

## 9. Build order, risks, cuts

### 9.1 Work packages

In the owner's order: "start with analytics and the progression system", then the towers and the lengths,
then the daily. Each package ends in a game that plays, is tested and could ship. Each closes with the same
four things: its tuning step (5.6) if it changed a rule; the text audit of its new strings (the house rules;
every CHECK of its sections read against a source or renamed to its generic fallback; every INVENTION said
on its card); `deploy/check-page.js`; and the self-test, `tools/regress/run-all.js` and
`tools/town-isolation.js` green.

| WP | What | Needs | Done when |
|---|---|---|---|
| G1 | Hooks and numbers on today's game, no rule changed: the `track` calls of section 7's first block; the battle's counters, `battleFacts()` and its size test; `redo`, `cd` and the debt of a resumed wave; `rules` on saved runs; `rulesetData()`, `RULESET = 1`, `LEVEL_REV` and their pins for today's 20-wave game; the loadout tag (`std` unless a gift of gold paid); suite 2 and the runner's budget. | the platform's P0 (or a three-line stub of `track`, `CLOUD_KEYS`, `HALL_TABS`) | Suite 1 untouched and green; suite 2's G1 checks; the regression suite green with no edit; the bot's tables equal master's cell for cell; the baseline tables with the clock committed (the pars of ruleset 1); playtest 7. |
| G2 | The War Council (4.1 to 4.3, 4.6 to 4.8): stars with the Hard seal, the kit inside `getStats`, costs, the panel and its doors, the Standard switch, `hs_council`, `KITSET`, `KIT=` in the bot. | G1, the platform's P0 (the Hall's shell) | Suite 2's Council checks; `doors`, `vic`, `iphone` green; the bounds of 5.2 at `KIT=par` and `cap`; with an empty Council the bot's tables equal G1's cell for cell (no battlefield retuned, `RULESET` unchanged, no board restarted); playtest 4. |
| G3 | Heroes (4.4): experience per chapter, levels, the Call (Stand Fast), the captains' lines, the chronicle's hero card, `hs_heroes`, `HERO=hold` in the bot. | G2 | Suite 2's hero checks; the hero's worth measured (`HERO=hold` against `off`) and inside the kit's bounds; playtest 4. |
| G4 | The script map and the 17 lengths (section 1), retuned (5.6): `script` on saved runs, the records' `beyond`, every text, Erebuni's own table, `waves.js`. | G1 | Suite 1 green with its edits; suite 2's waves and old-saves checks; before retuning, the bot's tables for Sis and Sardarapat equal master's cell for cell; after it, the bands of 5.1 on all three difficulties at SEEDS=3 and wave time within 15% of 1.2; `waves.js` green; a 20-wave run saved on master resumes and wins; playtests 1 and 5. |
| G5 | The tray of n tiles and the Garrison Post (sections 2, 3.7, 3.8): numbers, men, rally by mouse and touch, art, the card, `tray` on saved runs, the bot's rule, its tuning. | G4 | Suite 2's post and tray checks; `padplace`, `probe`, `iphone`, `live` green; "mix7" and the post builds meet 5.2; playtests 2 and 6. |
| G6 | The daily's battle (6.4): `startDaily`, the 12-step tables, the first eight twists, the seeded draws, the daily's pars and `daily.skip`. | G1, G4, the platform's P6 | Suite 2's daily checks; tables (e) of 8.3 committed; the platform's daily flow passes. |
| G7a to G7e | The special towers in campaign order: Horse Lines, Stores, Powder Mine, Aid Post, Observation Post. Each: numbers, panel, art, card, bot rule, checks, its tuning on its own battlefields. | G5 | Its suite 2 checks; its rows of 5.2; its playtest of 8.4. |

### 9.2 Releases

| Release | Packages | With the platform's | What a player gets | Boards |
|---|---|---|---|---|
| R1 | G1 | P0 to P5 (sign-in, saves, analytics, boards) | Today's game, measured, saved to the account, ranked | open on ruleset 1 |
| R2 | G2, G3 | | The War Council, hero levels, the Call | untouched: Standard battles use none of it |
| R3 | G4, G5 | | Battles of 10 to 20 waves and the Garrison Post | every board restarts once (ruleset 2) |
| R4 | G6 | P6, P7 (daily, share card) | The daily challenge and the share card | the daily's own |
| R5 to R9 | G7a to G7e, one a release | | A new tower on its battlefields | only those battlefields' boards restart (N11) |

After each release the stats are read (section 7's questions) before the next is tuned: the owner asked for
a loop, and the hooks come first so that there is something to loop on. Until a special tower is built its
battlefields play with the post and six tiles (`ageTower` returns null).
The owner may prefer to keep the boards closed until R3, so that they never restart; then R1 ships sign-in,
saves and analytics only (an open point, 9.6).

### 9.3 Cut first, in this order, if time runs short

1. The Call's second effect at level 5.
2. The captains' lines in the Council panel (the chronicle's hero card shows the level and the bar).
3. The post's sally against hunters (men hold hunters on the road only).
4. Short names for phone tiles (a tile whose name does not fit shows none).
5. The Aid Post's faster recovery of men (it keeps the hero's return and the returning defenders).
6. The twists beyond `thin`, `swift`, `iron`, `few`.
7. The special towers from the last backward.
Already cut by the review, not to be brought back without a reason from the stats: a second Hall tab for
the captains, a Call of its own for each chapter, experience for the hero's kills and for the endless
stand, the events of section 7's "not sent" list, the twists `scouts`, `sappers`, `pair`, `wary`, `press`,
`dusk`.
Never cut: the events' size test; the clock as 6.1 defines it; runs that finish under the
rules they began with; the rally point by touch; the kit's bounds; the tutorial's fixture check and
Erebuni's two-kinds rule; the three design rules of 3.1.

### 9.4 Risks

- Scope. Six new tower kinds with art, a page, a kit, tuning at every step. Held by the packages (each
  ships alone), by reusing painters for every figure (2.7), and by the order: nothing after G1 blocks the
  platform but G6.
- Tuning churn. Held by one reference game (the Standard battle), by 5.3 (the shared knobs are never
  touched; the first six are tuned by their tricks) and by 5.6 (one cause at a time, tables kept). The
  Council and the heroes retune nothing.
- The first battle. Held by Erebuni's own table and its two-kinds rule, the fixture check, and the empty
  kit and five tiles in a coached stand.
- A board play that is dull but best. Held by the clock that counts waiting, the worse attempt of a wave
  fought twice, the three design rules of 3.1 and their losing builds.
- Touch conflicts: rally, charge, hero, spell, plot and tower all take a press on the field. Held by one
  armed state at a time, the settle guard, and `probe.js` and `iphone.js` presses.
- Seven tiles on a 667 px phone. RENDERED (0.4): they fit. Names by measure, and `iphone.js`.
- Saves and the cloud. Held by deriving stars, unlocks and the heroes' floor from records, by never
  rewriting an old key, by a stamped `hs_council`, and by merge rules that otherwise only take the larger
  or the union (4.7).
- History. New names without a source in the repo are marked CHECK with a generic fallback; a tower that
  is the game's idea says so on its card; no age is named to the player; the Aid Post is not the American
  mission's hospital and flies no red cross.
- A tower that does not fight (Stores, Aid Post, Observation Post) may read as dull or as a trap. Held by
  the targets in 5.2, the caps of one or two, and by shipping one tower a release with the stats read
  after each.
- Frame rate on phones with men and riders on the field. Held by the unit sprite cache and playtest 6.
- Two tracks in one 4.5 MB file. Gameplay edits the gameplay regions named in this spec; the platform adds
  its own block and the hooks of 0.1. The shared places are the overlay's HTML and CSS (the tally, the
  victory page, the chronicle): see N4, N7 and N8.

### 9.5 What gameplay needs from the platform

The platform's spec lists what it needs from gameplay (its 0.3); sections 0.1, 6 and 7 here answer each
item in its own names. The platform's own review (`docs/specs/platform-critique.md`, its issue 17) settled
seven seam points against the first version of this spec while this review was being written. Where the two
reviews agree the settlement is simply adopted here. Where they do not, it is marked DIFFERS: those three
points must be settled once more between the two final specs, and since gameplay owns the rules a score is
computed from (the platform's review says so), this spec's rule is the one proposed.

Adopted from the platform's review:
- The server keeps an event up to 4,096 bytes with one level of nesting; gameplay holds
  `JSON.stringify(battleFacts())` under 3 KB (6.1).
- `daily.skip[battlefield]`: the pick walks to the next twist; a twist may set lives outright (`livesSet`).
- `startDaily(levelIndex, twistId, day)`.
- The Hall's shell ships with the platform's P0 and works on `file://` and under the harness, so gameplay
  builds no page of its own (4.6).
- `hs_records` merges every numeric field per difficulty by the larger, so `beyond` needs no rule of its
  own. The platform's own stamp says which saved run is newer. After a merge the page calls
  `onSavesChanged()`, and no merge rewrites gameplay's keys while a battle is on the field.
- The victory page on a phone held sideways has no room for a new row (4.6).

What gameplay asks:
- N1. `track`, `CLOUD_KEYS` and `HALL_TABS` declared before gameplay's code (the platform's P0), and
  `track` sending nothing under `file://`, `?selftest` and `?shot`, so the bot, the self-test and the
  regression suite run as today. The gate and the cloud stay off there too.
- N2. A merge function for each of gameplay's keys, as 4.7 gives them (`hs_council`: the larger change
  count `n`, each value clamped by `councilParse` and no more (the cut, `councilSane`, is made at read time); `hs_heroes`: per chapter the larger; `hs_towers_seen`: union).
- N3 (DIFFERS). The battle clock. The first version of this spec asked for wave time only, and the
  platform's review granted it. This review withdraws that request: the clock is the platform's own first
  definition, all of `dt` from the first horn, waiting between waves included. Reasons (6.1): the spells,
  the hero, the Call, a mine and the men all recover between waves, so a clock that stops there makes
  waiting out every cooldown the best play on every board; and building works while the game is paused
  (TESTED), so thinking is free for everyone. `fast` and `slow` are in that clock, and `slow` is 1.4 times
  par ("0 at 1.4 times par or slower").
- N4. The Hall hosts one gameplay tab, the Council, from `HALL_TABS`, and gives it a content box of at
  least 560 x 280 px on a phone held sideways. The tally's one pip is shared ("stars to spend" or "daily
  unplayed"); the Hall opens on the Council tab while stars are unspent.
- N5 (DIFFERS). Who is ranked. The Standard boards take `loadout: "std"` battles that are not `legacy`,
  `aided` or `tutorial`. The platform's review expects a battle with a wave fought twice to arrive as
  `open`; in this spec it stays `std` and stays ranked, and what it costs is in its numbers:
  `p_stats.lives` is filled from the event's `lives_board` (never more than `lives`), `sec` already holds
  the dropped attempt's time, and the stars shown are the event's `stars`. A new player's short tray is
  also `std` (6.4). The Open boards may show `power` and the hero's level beside a score.
- N6 (DIFFERS, small). A lost daily. The platform's review scores it by script wave, read from the
  battlefield's table in the ruleset. With every daily at 12 waves (6.4) the day's table is the daily's:
  `rulesetData().daily.levels[id].script`. Scoring by `wave / 12` ranks a day's losses in the same order,
  so either will do; the table is there for whichever the platform keeps.
- N7. The victory page: on desktop, iPad and the upright phone one row for gameplay (`#ovGrowth`) between
  `#ovRecord` and the platform's score strip; on a phone held sideways one line of text in place of the
  last line of the page's prose (4.6). The phone's top right corner stays the platform's.
- N8. The chronicle: `#briefKit` under the tricks row (it holds the Standard switch). The platform adds
  nothing to the chronicle's left column.
- N9. The share card may read `battleFacts()` and `renderBriefArt(lvl)`; it needs nothing else from the
  battle.
- N10. The daily: `rulesetData().daily` gains `waves` (12) and `levels` (for each battlefield the daily's
  own `script`, `fast`, `slow`, `earnMax`); a daily run's wave count is checked against `daily.waves`; a
  twist's name for the share text comes from `twistName(id, levelIndex)`.
- N11. A battlefield's `rev` in the board's key (`c:<level>:<diff>:<loadout>:<rev>`), so a change to three
  battlefields restarts three boards. If declined, boards stay per `RULESET` and every tower release
  restarts all of them: the owner should then weigh shipping the five towers in fewer releases.
- N12. The words under the boards and on the score's tooltip: "The battle clock runs between waves too.
  Pause to plan."

### 9.6 What the owner should decide

1. The lengths of 1.2 (245 waves in all, 340 today), above all: Sis and Sardarapat stay at 20; the campaign
   ends on a 12-wave stand; Erebuni is 10 on a table of its own.
2. The tray grows to seven; no loadout.
3. The five special towers. Three of them do not shoot (Stores, Aid Post, Observation Post). Stores, the
   Powder Mine and the Aid Post as battlefield towers are the game's invention and say so.
4. Heroes: the battlefield's own hero always leads; experience is shared inside a chapter; one Call for
   every hero, opened at Dvin. The other ways: a level for each hero alone (growth would not carry to the
   next battlefield), guest heroes (men on fields they never stood on), or a Call of its own for each
   chapter (more to build and to tell).
5. Stars: a Hard victory gives one more (68 in all); three stars on Easy keep counting as three; a
   defender an Aid Post returns does not count toward a star.
6. The Council: free reset; tiers open with chapters; a tier once owned counts on old battlefields too.
7. The campaign is tuned as the Standard battle, and the Council and hero levels make it kinder by at most
   2 defenders for a careful first play and 4 for a player who owns everything. The other way (the first
   version's): tune it for a player who owns half the tree, which costs one more round of tuning and makes
   every Standard battle and every daily harder than the campaign.
8. The boards: a Standard battle has no Council, a level 1 hero and no Call, by a switch on the chronicle; the
   battle clock runs between waves ("Pause to plan"); a resumed battle stays ranked and a wave fought
   again counts its worse attempt.
9. The daily: 12 waves on every battlefield; it gives hero experience and no stars; its pool is all 17
   battlefields, so a newcomer's first daily can be a late one (the other way: the first ten until the
   game has more players).
10. The releases of 9.2: boards open with R1 on today's rules and restart once at R3, or stay closed until
    R3; and one tower a release, or the five in fewer.
11. Names marked CHECK that turn out to have no source: use the generic fallback, or drop the tower's own
    name on that battlefield.

## Appendix A. Changes made after the review

By the issue numbers of `docs/specs/gameplay-critique.md`. The platform's own review
(`docs/specs/platform-critique.md`) was written at the same time against the first version of this spec;
what this spec adopts from it and where the two still differ is 9.5.

| Issue | Severity | What changed in this spec |
|---|---|---|
| 1 | blocker | 0.1, 6.1, 7, 8.1: the platform's review found the same and raised the server's limit to 4,096 bytes with one level of nesting; this spec keeps the battle's numbers in one event and holds them under 3 KB with a self-test. |
| 2 | blocker | 0.1, 6.1, 6.2, N3: the clock is the platform's first definition (waiting between waves counts, pauses do not); the first version's request for wave time is withdrawn, though the platform's review had granted it (DIFFERS in 9.5); the player is told "Pause to plan"; pars measured in this clock. |
| 3 | major | 6.4: `std` is "nothing beyond the standard set"; a short tray is `std`. |
| 4 | major | 6.1, 6.2, 4.7, 8.1, 8.4, N5: resumed battles stay `std` and ranked; `redo`, the debt, `lives_board` (DIFFERS in 9.5: the platform's review expects them as `open`). |
| 5 | major | 4.7: `hs_council` carries a count of its changes and the later change wins; the heroes' floor is derived, not written once. |
| 6 | major | 6.3, 4.7: `KITSET` apart from `RULESET`; a `rev` for each battlefield (N11). |
| 7 | major | 6.4: `daily.skip` with a stepping pick (the platform's review built the same); three fixed "no tower" twists; `dusk` cut. |
| 8 | major | 1.1, 1.2, 6.4: every daily is a 12-wave stand; Avarayr's `dailyScript`; the daily's own pars. |
| 9 | minor | 6.2, N6: `script / 20` is no longer asked for; the daily's table is in the ruleset for whichever way the platform scores a loss. |
| 10 | major | 4.6: the Council panel fits the Hall's box (560 x 280 on a phone), one tab; no page of gameplay's own; one line of text on the phone's victory page. |
| 11 | minor | 6.2: `slow` is 1.4 times par in both specs (N3). |
| 12 | major | 4.8, 5.1, 5.2, 5.6: the Standard battle is the reference; the kit is a bounded bonus; one tuning round fewer. |
| 13 | major | 5.3: the first six are tuned by their tricks and economies first; Mari's own line. |
| 14 | major | 1.2, 1.3: Erebuni's own table and its two-kinds rule; its scouts from script wave 7. |
| 15 | major | 1.1: a commander's wave takes outflankers from its own script wave only. |
| 16 | minor | 1.4: the early bonus is times `payStep`. |
| 17 | major | 3.1, 3.2, 5.2: a thrown foe cannot be thrown again for 8 s; two Horse Lines at most; the `harriers` build must lose. |
| 18 | major | 3.5, 1.6, 4.1, 6.1: the Aid Post (was Dressing Station): no healing in a fight; returned defenders do not count for stars, records or boards; no red cross; not the American mission's hospital. |
| 19 | major | 3.3, 5.2: Stores (was Market): a real stake (6% to 10% more gold) at an early cost; new starting values and name. |
| 20 | major | 3.6, 5.2: the Observation Post marks for 15% to 25%, half on a commander, one on a field. |
| 21 | major | 3.1, 4.4, 4.7, 4.8: experience per chapter; the Call opened once by the campaign at Dvin; ages internal and unnamed. |
| 22 | minor | 4.4: the medallion shows "Call"; a 0.4 s guard. |
| 23 | major | 9.1, 9.2, 1.7: the owner's order (G1 hooks, G2 Council, G3 heroes, G4 lengths, G5 post, G6 daily, G7 towers); runs carry `rules`, `kit`, `script`, `tray` and finish under the rules they began with. |
| 24 | major | 4.4, 4.6, 6.4, 7, 9.3: one Hall tab, one Call, no experience for kills or the endless stand, five events and five twists fewer. |
| 25 | minor | 4.3: `getStats` applies the kit; `rawStats` is the table. |
| 26 | minor | 3.8: names by measure. |
| 27 | minor | 6.4: `sappers` held back, with a look by age when it returns. |
| 28 | minor | 6.1: `power` defined. |
| 29 | minor | Section references corrected. |
| 30 | minor | 4.6, N4: one pip on the tally. |
| 31 | minor | 8.1: the runner enforces each suite's budget; side by side only on four cores. |
| 32 | minor | 3.2, 3.4, 3.5, 2.6: the CHECK and INVENTION marks restated. |
| 34 | minor | 1.2: the total is 245 waves, not 246. |
| 35 | minor | 4.4: a commander's blow on the hero rises with the hero's level; Stand Fast does not halve it. |
| 36 | major | 6.1, 4.7, 8.1: the spells', the Call's and the hero's clocks are saved with the run, so a reload gives nothing back. |
| 33 | minor | Not changed: put to the owner (9.6, item 9; Appendix B). |

## Appendix B. Kept against the review, and why

- The daily's hero experience (the critique would cut every rule that needs a counter). Kept: it is the one
  thing that ties the daily to the campaign, and the owner was already asked about it. Cost: `daily` in
  `hs_heroes`.
- A newcomer's first daily on a late battlefield (issue 33). Left as it is and put to the owner (9.6, 9):
  the daily is the same for everyone, a loss still scores, and at 12 waves it is short.
- The campaign's forgiving resume. The review weighed making a dropped wave's losses stick in the campaign
  too. Rejected: a dropped tab is rarely the player's choice; only the boards count the worse attempt.
- A loadout chosen before battle. Rejected again: with seven kinds at most and a tray that fits, it would
  be a rule made to save space; the choice is on the pads.
- Tying each special tower to a chapter. Rejected: the towers follow how war was fought (a powder mine in
  1041 or an aid post in 1727 would be wrong); the internal table stays, unnamed.
- One hero level for the whole campaign. Simpler, but D5 says the heroes of each era level up; a level a
  chapter is the reading kept.
- Council tiers that are rule changes, not small numbers. Not applied: the tree's worth is bounded at 4
  defenders, and which tiers players feel is a question for the stats after R2.
- The Aid Post and the Observation Post as towers at all. The review doubts both (they are placed once and
  forgotten). Kept, because the owner asked for a mechanically new tower in each age, but they ship last,
  one a release, behind the targets of 5.2; if the stats of R5 to R7 show the earlier towers are not
  built, these two should be redesigned before they are drawn.
