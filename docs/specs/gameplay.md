# Highland Stand: the gameplay spec for "the top tower defense game"

Written against master 54207ce (index.html, 78,801 lines). Line numbers below are that file's.
Scope: wave counts (D4), the road-blocking tower and one new tower per age (#3), progression (D5), balance,
what a score is made from, analytics hooks, tests, build order. The platform (sign-in, cloud saves, boards, the
daily's boards, the share card, the stats view) is the other spec: `docs/specs/platform.md`.

Rules of this document: every number is a starting value to be confirmed with `tools/balance.js` unless it is
marked MEASURED. Player-facing strings are quoted exactly and follow the house rules (short sentences, American
spelling, no long dashes). A history claim is either tied to a text the game already carries (LEVELS, CHAPTERS,
`docs/history/*.json`), marked CHECK (a source must be read before it ships, by the text audit of WP9), or
marked INVENTION (the game says so where it tells it).

## 0. The seam with the platform, and what was measured

### 0.1 The seam

Gameplay never talks to the network. It uses three things only:

1. `track(name, props)`: a global the platform defines. Gameplay declares the no-op first, at the top of the
   script: `if (typeof window.track !== "function") window.track = function () {};`. Calls are listed in section 7.
2. localStorage under `hs_*` keys through the game's helpers. The platform owns `CLOUD_KEYS` (a plain array
   declared before gameplay's code); gameplay pushes its new keys onto it (section 4.7) and states a merge
   rule for each.
3. `battleFacts()` (section 6): a plain object a finished battle hands over. Gameplay calls
   `track("battle_end", facts)` and, if the platform defined it, `window.onBattleEnd(facts)`. The platform
   decides what is ranked.

The other way, the platform may call these gameplay functions and nothing else: `startDaily(spec)` (6.4),
`openCouncil()`, `openCaptains()` (4.6), `battleFacts()`, `RULESET`, `rulesetTable()` (6.3).

### 0.2 MEASURED today (master, Normal, 7 builds, 1 seed, 119 battles)

Tool: a copy of `tools/balance.js` that also records each wave's length in game seconds
(`docs/specs/gameplay-proto/balance-time.diff`). Full tables: `docs/specs/gameplay-proto/`.

- A 20-wave battle is 25 to 54 minutes of wave time at 1x (mean 35), before any time spent between waves:
  Erebuni 36, Tushpa 33, Avarayr 44, Dvin 37, Tashir 28, Sevan 36, Ani 32, Mari 26, Sis 40, Gyumri 44,
  Halidzor 36, Van 40, Musa Dagh 28, Sardarapat 35, Stepanakert 1992 54, Shushi 29, Stepanakert 2023 25.
  The whole campaign is 602 minutes of wave time at 1x for a player who wins every battle once.
- Waves 1 to 3 take about 30 s each. From wave 6 (the first siege engine, 27 px/s) a wave takes 110 to 165 s.
  The late waves are the time: waves 11 to 20 are two thirds of a battle.
- The balanced mix ends a battle with 6,700 to 16,500 gold invested (Erebuni 6,790, Stepanakert 2023 16,470):
  14 pads at rank 3, about seven masteries. Masteries start around wave 17.
- Results (lives kept of 20): the mix wins 14 of 17, the best build 17 of 17 with 10 to 17 kept. Table in
  `gameplay-proto/base-normal.table.txt`.
- The tray on a 667 px phone is 655 px of tiles: five tiles are 126 px wide, six 104 px, seven 88 px, all 52 px
  tall (CSS lines 1797 to 1830).

### 0.3 MEASURED: a prototype of the new lengths

`gameplay-proto/proto-patch.js` implements section 1 (the script map and the pay-ahead rule) as a patch on a
copy of the page, with the lengths of section 1.2 and nothing retuned. Same bot, same seeds:

- The campaign's wave time at 1x falls from 602 to 433 minutes. Erebuni 36 to 18, Dvin 37 to 18, Tashir 28 to
  17, Mari 26 to 17, Stepanakert 2023 25 to 16. The two battles left at 20 waves (Sis, Sardarapat) play
  exactly as before, battle for battle.
- The board is as built at the end as today: gold invested by the winning builds moves by 3% or less on 14 of
  17 battlefields (Erebuni 6,702 to 6,958; Dvin 11,763 to 11,575).
- The mix still wins 14 of 17 and the best build 17 of 17. The shortened battlefields come out 3 to 6 lives
  easier (fewer waves, fewer chances to leak), so every one of them needs its `hpTune` raised (section 5.6).
  Mari's mix lets a commander through and needs its commander number looked at.

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
const WON_MARK = 21;                 // hs_best's "won" value stays 21 whatever the length (1.7)
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
function levelScript(L) { return L.script || SCRIPT_TABLES[L.waves || SCRIPT_LEN]; }   // L.script: its own table
function totalWaves() { return legacyRun ? SCRIPT_LEN : levelScript(LEVELS[curLevel]).length; }
// played wave w -> script wave. Beyond the chronicle (endless) the script runs on one step a wave
function scriptWave(w) { const S = curScript(); return w <= 0 ? 0 : w <= S.length ? S[w - 1] : SCRIPT_LEN + (w - S.length); }
// script wave s -> the first played wave that reaches it (for every `from` in the data)
function playedWave(s) { const S = curScript(); for (let k = 0; k < S.length; k++) if (S[k] >= s) return k + 1; return S.length + (s - SCRIPT_LEN); }
// the script waves played wave w stands for when it is FOUGHT: itself and the ones skipped before it
function coveredWaves(w) { const out = []; for (let i = scriptWave(w - 1) + 1; i <= scriptWave(w); i++) out.push(i); return out; }
// the script waves played wave w PAYS for: itself and the ones skipped after it (1.4)
function paidWaves(w) { ... }
```

`curScript()` is `levelScript(LEVELS[curLevel])`, or the identity table for a legacy run (1.8).

Composition of played wave w (replaces the body of `waveGroups`, whose old body becomes `scriptGroups(s)`):
for every script wave in `coveredWaves(w)` take `scriptGroups(s)`; a role that appears in several keeps the
entry with the most foes; order the groups spearman, raider, shield, cavalry, ram, flyer, boss. So a wave that
stands for script waves 6, 7 and 8 brings wave 8's foot and horse, the larger ram count of the three, and
wave 7's outflankers (odd waves bring them: without this rule a table of mostly even steps would lose them).
Strength: every `w` handed to `hpScale`, `commanderClimb`, `levelHpFrom`, `bountyScale`, `trickEcon` is
`scriptWave(w)`. The prototype does exactly this.

Commanders: one on the played wave that covers script wave 10, the pair on the last wave (script 20), as the
script says. `isCommanderWave(w)` is `trickWave(w).some(g => g.type === "boss")` and replaces the two
`waveIdx % 10 === 0 && waveIdx >= 10` tests (lines 11074, 53358). In an endless stand they come every tenth
wave beyond the chronicle (script 30, 40, ...), as today.

### 1.2 The 17 lengths

Time is MEASURED wave time at 1x for that length (winning builds, `gameplay-proto/tables.txt`), today's in
brackets. "Cmd" is the commander's wave and the pair's.

| # | Battlefield | Waves | Cmd | Min at 1x | Why this length |
|---|---|---|---|---|---|
| 1 | Erebuni Rise, 782 BC | 10 | 6, 10 | 17 (36) | The first battle and the tutorial. No siege of Erebuni is recorded (its own text says so), so a short stand is honest. A first victory inside one sitting, also on a phone at 2x (9 min). |
| 2 | Vale of Tushpa, 735 BC | 12 | 7, 12 | 19 (33) | Tiglath-pileser III shut Sarduri in the citadel and withdrew: a siege, a little longer than Erebuni. The first battle with the Garrison Post. |
| 3 | Avarayr Plain, 451 | 14 | 7, 14 | 30 (44) | One day's pitched battle, and the set piece that closes Chapter I. Its own table (below). |
| 4 | Dvin Gates, 640 | 11 | 6, 11 | 19 (37) | The city was stormed in a sudden assault (Sebeos: smoke, arrows, ladders). Short and sharp. Chapter II opens gently. |
| 5 | Tashir Gates, 914 | 12 | 7, 12 | 17 (28) | A gorge fight. Mid length. |
| 6 | Sevan Shores, 921 | 15 | 8, 15 | 27 (36) | The Iron King's stand on the island and his sortie: Chapter II's set piece. |
| 7 | Ani, c. 1041 to 1044 | 18 | 9, 18 | 29 (32) | Three assaults over years ("The Testament", `L.phases`): the long set piece of Chapter III. The phases start on waves 1, 7 and 14. |
| 8 | Mari, August 1266 | 12 | 7, 12 | 15 (26) | One lost battle in the passes. The second road opens on wave 8. Short, so the turn comes fast. |
| 9 | Sis, early 1375 | 20 | 10, 20 | 40 (40) | The last siege of the kingdom. Each wave is three days (`DAYS_PER_WAVE`), 60 days in all: the one battle whose length is part of its telling. Unchanged. |
| 10 | Gyumri Road, 1579 | 13 | 7, 13 | 27 (44) | A road fight (the battle is the game's). Today it is one of the two longest; it should not be. |
| 11 | Halidzor, 1727 | 14 | 8, 14 | 26 (36) | A siege of days ended by a sortie. Mid length. |
| 12 | Van, 1915 | 18 | 9, 18 | 35 (40) | A month in the barricaded quarters until relief came. Long. |
| 13 | Musa Dagh, 1915 | 16 | 8, 16 | 23 (28) | Fifty-three days on the mountain. Long in waves, but its short road keeps it under 25 minutes. |
| 14 | Sardarapat, 1918 | 20 | 10, 20 | 35 (35) | Nine days that decided whether there would be an Armenia: the campaign's great set piece. Unchanged. |
| 15 | Stepanakert, 1991 to 1992 | 14 | 8, 14 | 38 (54) | Months under the guns, but today it is the longest battle by 10 minutes because its road is long. 14 brings it into line. |
| 16 | Shushi, 2020 | 14 | 8, 14 | 20 (29) | The fight for the town was days inside a 44-day war. |
| 17 | Stepanakert, 2023 | 12 | 7, 12 | 15 (25) | The last assault lasted a day. A short, hard stand closes the campaign, as its text does. |

Total 246 waves (340 today). The first six fall from 120 to 74.

Avarayr's own table: `script: [1,2,3,5,6,8,10,11,12,14,15,17,18,20]`. With the default table of 14 the
reserves' road (ambush from script wave 12 on Normal and Hard, 14 on Easy, told one or two waves ahead)
would be told on the commander's wave. With this table the commander comes on wave 7, the tell on wave 8
and the road opens on wave 9 (Easy: told on 8 and 9, opens on 10).
The rule, kept by a self-test: on every battlefield and difficulty, the wave an ambush road opens and the
first wave of its tell are not commander waves (Mari's road is exempt, as it is today: `legacy`).

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
| Erebuni | scouts (6), every wave from (12) | 5, then every wave (today: every second wave until 12; retune their count) |
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
- The early call's bonus (line 10237) and the starting purse are unchanged.

The toast names the sum as now ("Wave 5 repelled! +129 gold · +45 interest"). A coin pop over a fallen foe
shows the multiplied bounty. Nothing else is told: the player sees bigger waves that pay more.
MEASURED with the prototype (pure pay-ahead, without the wave 4 exception): boards within 3% of today's.

### 1.5 The tutorial

Erebuni's waves 1 to 3 are script waves 1 to 3 in every table, pay themselves only, and keep
`tutorialWave`, `tutorialHp` and the trick-free rule (line 9407) untouched: the coached stand is the same to
the foe, the hit point and the coin. Changes: the coach's last bubble (line 60973) says
"**You're ready.** Hold Erebuni through all ten waves: the battle is yours." (built from `numWord(totalWaves())`),
and the reminder at line 61055 tests `totalWaves()`. The tutorial's tray is the five classic tiles whatever
the save owns (section 3.8).

### 1.6 Stars, records, the endless stand

- Stars: unchanged. `victoryStars(kept, max)` is a share of the lives the difficulty began with.
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

### 1.7 Saved runs made under 20 waves

A run in `hs_run` written by today's build has no `rules` field. It resumes as a legacy run, the way a run
from before the tricks does (`trickLegacy`, line 10749): `legacyRun = r.rules !== RULESET`. A legacy run
plays the identity table (20 waves, today's economy), offers the five classic tiles only, applies no
progression (4.8), tells nothing new, and saves again without the mark. Its victory counts in full for the
campaign (stars, the next road) and reports `rules: 1` in its facts, so the platform can keep it off the
boards. `validRun` (line 10726) tests `r.cleared >= (r.rules === RULESET ? levelScript(LEVELS[lvl]).length : 20)`.
New runs carry `rules: RULESET` and the fields of 2.9 and 4.8. `RULESET = 2`.

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
    { men: 2, hp: 130, dmg: 10, rate: 1.0, reach: 115, respawn: 12 },
    { men: 3, hp: 180, dmg: 15, rate: 1.0, reach: 130, respawn: 10, cost: 110 },
    { men: 3, hp: 250, dmg: 22, rate: 0.9, reach: 145, respawn: 9, cost: 190 },
  ],
  specs: {
    a: { name: "Shield Wall", cost: 300, desc: "Four men behind great shields. Each holds two foes.",
         stats: { men: 4, hp: 420, dmg: 20, rate: 1.0, reach: 150, respawn: 8, holds: 2, guard: 0.35 } },
    b: { name: "Sortie", cost: 300, desc: "Three picked fighters who strike hard and give chase.",
         stats: { men: 3, hp: 300, dmg: 48, rate: 0.8, reach: 185, respawn: 8, pierce: true, chase: 60 } },
  },
},
```

`TOWER_HP.post = [300, 380, 480]` (the post itself, for hunters and powers). `men`: soldiers. `hp`, `dmg`,
`rate`: each soldier's strength, blow and seconds between blows (the blow is cut by armor like an arrow,
`armorHit`; Sortie's pierces). `reach`: how far from the pad the rally point may lie (ground range, the
game's ellipse). `respawn`: seconds until a fallen man returns to the post and walks out. `holds`: foes one
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
  walls). A pad with no road in reach (none today within 115 px: a self-test proves it, 8.1) would refuse
  the tower with the toast "No road in reach of this pad."
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
  reach (185). For felling what is held, armored foes above all, and for covering two stretches of road.

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
- Panel stats (`setPanelStats`): Men 3 · Strength 180 · Blow 15 · Holds 3 · Reach 130.
  `statDeltaHtml` gets a branch for `def.post`.

### 2.9 Save

`runRecord` towers gain `rally: [x, y]` (rounded) for a post. The men are not saved: a resumed run starts
the wave again with the garrison whole, as towers reload. `validRun` accepts the new tower kinds only in a
run with `rules: RULESET`.

## 3. One new tower in each age

### 3.1 The ages

`eraAge` orders the nine eras. Five ages group them by how war was fought:

```js
const AGES = [
  { id: "iron",     name: "Bronze and Iron",   upTo: 2 },   // eras 0, 1: Erebuni, Tushpa, Avarayr
  { id: "crowns",   name: "Princes and Kings", upTo: 3 },   // eras 2, 7, 8: Dvin, Tashir, Sevan, Ani, Mari, Sis
  { id: "powder",   name: "Powder",            upTo: 5 },   // eras 3, 4: Gyumri Road, Halidzor
  { id: "greatwar", name: "The Great War",     upTo: 6 },   // era 5: Van, Musa Dagh, Sardarapat
  { id: "artsakh",  name: "Artsakh",           upTo: 99 },  // era 6: Stepanakert 1992, Shushi, Stepanakert 2023
];
function ageOf(era) { const a = eraAge(era); return AGES.findIndex(A => a < A.upTo); }
const AGE_TOWER = ["horse", "market", "mine", "station", "spotter"];   // by age index
```

Each age has one tower with a mechanic none of the five slots or the post has. It is offered only on its
age's battlefields, as a seventh tile, once the campaign has reached the battlefield named below (and from
then on also when earlier battlefields of that age are replayed).

| Age | Tower (`type`) | The new mechanic in one line | First offered |
|---|---|---|---|
| Bronze and Iron | Horse Lines (`horse`) | Riders charge down the road and throw foes back | Avarayr |
| Princes and Kings | Market (`market`) | Does not fight: pays gold after every wave | Tashir |
| Powder | Powder Mine (`mine`) | A charge under a spot you choose, fired by your tap | Gyumri Road |
| The Great War | Dressing Station (`station`) | Heals your men and hero, and returns fallen defenders | Van |
| Artsakh | Observation Post (`spotter`) | Marks one foe: every blow on it lands 60% harder | Stepanakert 1992 |

A battlefield that comes before the one named gets its age's tower on a replay: Dvin, the first time
through, stays a battle about the ladder parties and the adaptive enemy, and has a Market when it is fought
again after Tashir has opened.

### 3.2 Horse Lines (Bronze and Iron)

Mechanic: displacement. It does not shoot. Every `cd` seconds, if a ground foe is on the road inside its
reach, its riders charge along every stretch of road inside the reach, from the walls' side toward the
enemy, in 0.8 s. Each ground foe on that stretch takes `dmg` once (cut by armor) and is thrown back `push`
px along its own road (`e.dist -= push`, never below 0); siege engines and commanders are thrown a quarter
as far. The riders cannot be hurt or held; they wheel back to the lines. Outflankers are untouched. A foe a
man holds is struck but not thrown (the hold keeps it).

```js
horse: { name: "Horse Lines", cost: 110, proj: null, charge: true,
  levels: [ { dmg: 40, range: 150, cd: 18, push: 40 },
            { dmg: 70, range: 170, cd: 16, push: 55, cost: 130 },
            { dmg: 115, range: 190, cd: 14, push: 70, cost: 220 } ],
  specs: { a: { name: "Lancers", cost: 340, desc: "One heavy charge that splits armor",
                stats: { dmg: 260, range: 200, cd: 14, push: 60, pierce: true } },
           b: { name: "Harriers", cost: 340, desc: "Charge twice as often and scatter the foe",
                stats: { dmg: 100, range: 200, cd: 7, push: 50, slow: 0.4, slowS: 3 } } } },
```

Counters and limits: nothing against outflankers; engines barely move; a charge that throws a crowd back
out of a fire's reach can cost more than it gains, so placement matters (best just past a kill zone, to
throw foes back into it). The adaptive enemy has no answer in the first release.
Names: era 0 "Horsemen of Biainili" ("Urartian horsemen riding out from the lines below the fortress";
Urartian cavalry and chariots in the kings' annals: CHECK against `era-dossier.json`, which so far documents
the Assyrian side); era 1 "Nakharar Horse" ("The mounted contingents of the noble houses"; Yeghishe's
"cavalry and infantry" in `text-audit.json`; the cavalry of the houses is also in Dvin's text: "Armenia kept
15,000 horsemen"). Masteries as above in both eras.
Art: the riders are the cavalry painter (`unitPaintCavalry(style, pal)`, line 47790) in the defenders'
palette, three sprites that run the stretch; dust from the walking-dust particles; the building is a rail,
a trough and one standing horse (`unitPaintHorse`) on the common footing. Sound: `ridersIn` (exists) at a
charge. New: the building's painter, a tile portrait.

### 3.3 Market (Princes and Kings)

Mechanic: income. It never fights and holds a pad. After every cleared wave it pays `pay` gold for each
script wave that wave paid for (`payStep`, 1.4), so its yield does not depend on the battle's length.

```js
market: { name: "Market", cost: 120, proj: null, income: true,
  levels: [ { pay: 16 }, { pay: 26, cost: 120 }, { pay: 38, cost: 180 } ],
  specs: { a: { name: "Caravan Trade", cost: 260, desc: "Richer trade, and every kill pays a tenth more",
                stats: { pay: 50, bounty: 0.1 } },
           b: { name: "Granary", cost: 260, desc: "Feeds the works: towers mend more and repairs cost less",
                stats: { pay: 38, mend: 0.1, repair: 0.25, range: 220 } } } },
```

Rules: at most two markets on a field (a third is refused: "Two markets are all this road can feed.").
`TOWER_HP.market = [240, 300, 380]`: hunters choose by worth and will come for it; the enemy's stones and
guns stun it to no effect. A market wrecked at a clear pays nothing. Caravan's bounty share does not stack
with a second Caravan nor with the Standards' plunder (the larger applies). Granary: towers in its range
mend 10 points more at each clear and cost a quarter less to repair or rebuild.
Counter-play is the enemy's pace: gold spent on a market in the first third is a tower not built. Target
for tuning: one market built by wave 3 pays for itself by the middle of the battle and leaves the mix about
150 to 250 gold ahead at the end; a board with two markets and too few towers loses (5.5).
Names (each battlefield's own, `L.towers.market`): Dvin "Dvin Market", Tashir "Village Stores", Sevan
"Monastery Stores", Ani "Merchants' Row", Mari "Toll Post", Sis "Royal Stores". `depicts` lines say what is
shown, for example "Stalls and pack animals inside the gate"; the trade of Dvin and Ani is history (CHECK:
one sourced sentence each for the tile's line), the tower as a battlefield structure is the game's and the
card says "The market as a tower is the game's invention."
Art: an awning on poles, sacks and jars, a tethered pack animal (the camel or horse painter, standing), on
the common footing; coins rising at a clear (the bounty pop's particle). Sound: `coin`.

### 3.4 Powder Mine (Powder)

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
mine: { name: "Powder Mine", cost: 120, proj: null, charge: true, manual: true,
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
Timing is the skill. Its partners are the Garrison Post (hold them on the charge) and the hero's Call in
this age (4.4).
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

### 3.5 Dressing Station (The Great War)

Mechanic: it gives back what was lost. Three effects, none of them damage:
1. Men of Garrison Posts and the hero inside its `range` regain strength at `heal` a second even in combat.
2. Fallen men of posts in range return `haste` sooner; the hero returns `heroBack` seconds sooner.
3. Defenders: after a cleared wave in which no defender was lost, one lost defender returns, up to
   `restore` in a battle and never above the number the difficulty began with. The toast says
   "A defender returns from the dressing station."

```js
station: { name: "Dressing Station", cost: 110, proj: null, aid: true,
  levels: [ { range: 170, heal: 12, haste: 0.2, heroBack: 3, restore: 2 },
            { range: 190, heal: 18, haste: 0.3, heroBack: 5, restore: 3, cost: 130 },
            { range: 215, heal: 26, haste: 0.4, heroBack: 7, restore: 4, cost: 210 } ],
  specs: { a: { name: "Surgeons", cost: 320, desc: "More defenders come back to the walls",
                stats: { range: 230, heal: 30, haste: 0.4, heroBack: 7, restore: 7 } },
           b: { name: "Stretcher Bearers", cost: 320, desc: "Your men and your hero are back in half the time",
                stats: { range: 260, heal: 44, haste: 0.6, heroBack: 12, restore: 4 } } } },
```

One station on a field (a second is refused: "One dressing station serves this field."). Stars count the
defenders kept at the end, so a station is a way to buy back a star with gold and a pad: rank 3 returns at
most 4 of 20. The facts of the battle report defenders lost and defenders returned apart (6.1).
Counters: it does nothing against the foe; a board that buys it instead of a tower leaks more than it
returns (5.5). Hunters and drones can wreck it: a wrecked station returns no one.
Names: Van "Dressing Station" (`depicts`: "A dressing station for the wounded, like the American mission
hospital inside the Armenian lines"; Van's text: "Dr Clarence Ussher's American hospital lay inside the
Armenian lines and was shelled during the siege"); Musa Dagh "Field Infirmary" (CHECK; else INVENTION and
said so); Sardarapat "Dressing Station" (generic of the war). Masteries as above.
Art: a tent or a house corner with a white flag bearing a red cross at Van and Sardarapat (Musa Dagh's
"Rescue Banners" already paint the red cross banner), two stretchers, a seated figure from the crew
painter (`unitPaintCrew`). A returning defender: a small figure walks from the station to the fortress
(the hero figure at 0.6). Sound: the bells' single stroke or `uiTick`. New: the painter, a tile portrait.

### 3.6 Observation Post (Artsakh)

Mechanic: it marks. It deals no damage. It keeps a mark on `marks` foes inside its `range` (the strongest
by default; its Target button cycles First, Last, Strongest, Weakest like a shooting tower). A marked foe
takes `amp` more from every source (towers, men, hero, spells, burns): one multiplier applied in
`damageEnemy` and in the burn ticks, never stacked by a second post. A marked hidden foe is seen (the post
is a watch tower in this age beside the drums' lookouts) and stays seen while marked. Outflankers can be
marked: it is the one new tower that helps against drones. A mark moves when its foe falls or leaves the
range.

```js
spotter: { name: "Observation Post", cost: 90, proj: null, mark: true, air: true,
  levels: [ { range: 230, marks: 1, amp: 0.4 },
            { range: 270, marks: 1, amp: 0.5, cost: 110 },
            { range: 310, marks: 2, amp: 0.6, cost: 190 } ],
  specs: { a: { name: "Fire Direction", cost: 300, desc: "The marked foe is shelled every 4 s",
                stats: { range: 340, marks: 2, amp: 0.6, shell: 150, every: 4, pierce: true } },
           b: { name: "Night Sights", cost: 300, desc: "Three marks, and nothing in reach stays hidden",
                stats: { range: 360, marks: 3, amp: 0.6, revealAll: true } } } },
```

Reading: a mark on a commander with 0.6 is worth 60% of everything the board deals to him: the tower that
answers T-72s (armor 28), the brigade commander and the drones. It is worth nothing where no one shoots.
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
  has its own short block in `update()` beside the fire altars'. `getStats`, `towerInvested`, `towerWorth`,
  `towerMaxHp`, repair, rebuild, sale, wreck and the drums' aura work as for any tower.
- `TRICK_SLOTS` is unchanged. `bookAdapt` gains a second tally, `adapt.other`, for damage dealt by the
  post, the horse, the mine and the spotter's shells; `adaptStep` adds it to `total` only.
- `towerName`, `levelTower`, `applyEraLabels`, `renderShopPortraits`, `SKIN_ART`, `SKIN_BLURB`,
  `SLOT_BLURB`, `SKIN_SPECS` take the new kinds through the same tables.
- The balance bot and the self-test read the same tables (5.4, 8).

### 3.8 The tray: it grows to seven, and how it fits

The decision asked for: a loadout chosen before the battle, or a tray that grows. It grows. Reasons:
1. In any one battle the roster is at most seven (five slots, the post, the age's tower). Choosing five or
   six of seven before the battle would be a rule made only to save space, and every way of dropping one of
   the five classic slots is a trap a new player cannot see (no fire slot: scouts walk in unseen).
2. A new tower that simply appears in the tray is the reward the owner asked for. One that must push
   another out is a chore.
3. It fits (below), and the phone's tiles stay 88 px wide and 52 px tall, twice the 44 px a finger needs.
4. Nothing is closed off: the tray is built from one function, `trayTypes()`, and a daily twist can strike
   a tile out through it (6.4). If a later release adds a second tower to an age, a loadout becomes a filter
   in that one function.

```js
function trayTypes() {
  const base = ["archer", "ballista", "catapult", "fire", "drums"];
  if (legacyRun || tut) return base;                         // an old run and the coached stand: the classic five
  const out = base.filter(k => !trayBan.includes(k));        // trayBan: the daily's struck tile, else []
  if (towerUnlocked("post") && !trayBan.includes("post")) out.push("post");
  const a = AGE_TOWER[ageOf(curEra)];
  if (towerUnlocked(a) && !trayBan.includes(a)) out.push(a);
  return out;
}
```

`towerUnlocked(kind)` is derived from the campaign, never stored: the battlefield named in 3.1 is open
(`levelOpen`), or the run is a daily (everyone has every tower there, 6.4). The tiles are built from
`trayTypes()` in `applyEraLabels()` (today they are five fixed `div.card` elements, lines 2912 to 2946: the
two new ones are created once and shown or hidden; `#shop` carries `data-n="5|6|7"` for the stylesheet).
Hotkeys 6 and 7. Every `#shop .card` loop already reads `dataset.type`.

Layouts:

- Desktop: tiles are 148 px with 7 px gaps. Seven are 1,078 px. With `data-n="7"` the left end-cap (an
  ornament) hides under 1,640 px of window instead of 1,100 px, and tiles may shrink to 112 px
  (`flex: 0 1 148px; min-width: 112px`) before the right cap gives ground. At 1,280 px: seven tiles of
  about 140 px and the wave cap at 250 px.
- iPad (1194 x 834 and 1024 x 768, touch): the same rule gives tiles of 118 px and 104 px, 82 px tall.
  No change to the wave cap. `padplace.js`'s first press on a tile and the tile's line over it work as now.
- Phone held sideways (667 x 320 and up): the tiles share the whole width as now (`flex: 1 1 0`, 6 px
  gaps): seven are 88 px on an SE, 98 px on an iPhone 15 from the Home Screen (852 px less 59 px insets
  each side). Height stays 52 px. To keep the bar "text at least 11 px, never cut off": on a phone a tile
  shows `towerShort(type)`, at most 13 letters and spaces: the battlefield's `L.towers[k].short`, else
  `SLOT_SHORT[k][era]`, else the full name if it is short enough, else no name at all on the tile (class
  `noNm`: the picture takes the row). The full name always stands in the line over a chosen tile, which a
  phone already shows. Short names to write (the long ones today): "Modern Rifle Marksmen" → "Marksmen",
  "Self-defense riflemen" → "Riflemen", "Defense Army riflemen" → "Riflemen", "82 mm mortar crew" →
  "82 mm mortar", "Basement radio post" → "Radio post", "Barricade and Trench" → "Barricade",
  "Barricade and mines" → "Barricade", "Bread queue shelter" → "Bread shelter", "Ghevond's Exhortation" →
  "Exhortation", "Ter Avetis' Blessing" → "Blessing", "Cartridge Workshop" → "Workshop", "Traction
  Trebuchet" → "Trebuchet", "Standard of Haldi" → "Standard", "Castle Stone-Thrower" → "Stone-Thrower",
  "Wall Stone-Thrower" → "Stone-Thrower", "Tower Crossbowmen" → "Crossbowmen", "Burning Brushwood" →
  "Brushwood", "BM-21 Grad battery" → "Grad battery", "Osa SAM launcher" → "Osa launcher", "Etchmiadzin
  Bells" → "Bells", "Spearmen of Biainili" → "Spearmen", "Footmen of the Houses" → "Footmen", "Horsemen of
  Biainili" → "Horsemen", "Barricade Fighters" → "Fighters", "Self-defense squad" → "Squad", "Defense Army
  squad" → "Squad", "Dressing Station" → "Dressing", "Observation post" → "Lookout". The hotkey badge
  (`.card .key`) is hidden on touch, which frees the tile's top left corner.
- Phone held upright (best effort, as today): seven tiles of 49 px share 375 px; no names (`noNm`), the
  picture and the price only; the line over a chosen tile names it.
- The tower panel: the post's and the mine's panels have one more button than a shooting tower's (Rally
  point; Lay the charge and the trigger). On a phone's sheet (`#panel.sheet`, two columns) the action
  column holds five buttons of 44 px at most in 320 px of height less the header: the trigger button takes
  the Target button's 36 px class, and `fitPanelActs` squeezes as it does today for a mastery choice
  (`squeeze`, `squeeze2`). `iphone.js` proves it (8.2).

## 4. Progression (D5)

Two things grow: the War Council (stars spent on a tree, the same for every battlefield) and the heroes
(experience kept per age). Towers are unlocked by reaching battlefields (3.1), never bought.

### 4.1 Stars

- Campaign stars, as today: a battlefield's stars are the most any of its victories earned on any
  difficulty (1 to 3, by defenders kept). 17 x 3 = 51.
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
| Bowmen (`bows`): archer and ballista slots | Archer slot: 5% more damage | Ballista slot: 5% more damage | Both: 6% more range | Both: reload 6% faster | Both: masteries cost 15% less |
| Engineers (`engines`): catapult and fire slots | Catapult slot: 6% wider blast | Fire slot: 8% more burn | Catapult slot: stagger lasts 0.15 s longer | Fire slot: slows 4 points more | Both: masteries cost 15% less |
| Captains (`captains`): drums, Garrison Post, the age's tower | Drums slot: 8% more reach | Garrison Post: men 10% stronger | Men return 15% sooner; the age's tower costs 10% less to build | Drums slot: 3 points more might | Their masteries cost 15% less |
| Heralds (`heralds`): hero and spells | Hero 12% stronger (strength) | Spells ready 6% sooner | Hero returns in 16 s, not 20 | Spells ready another 6% sooner | The hero's Call ready 20% sooner |
| Stewards (`stewards`): gold and walls | 20 more gold at the start | Repairs and rebuilds cost 20% less | The war chest's interest may reach 80 a wave, not 60 | Towers 12% stronger; they mend 5 points more at a clear | A sale returns 85%, not 70%; land costs 15% less |

Each tier is one sentence and one number, shown exactly so on its card. Design bound, to be held by tuning
(5.2): the whole tree is worth less than one step of difficulty to a good build (Easy's foes are 15% weaker
than Normal's), and the stars a careful first play earns (PAR, 4.8) are worth about half of what can be owned
at that point.

### 4.3 How the Council and the hero's level reach the battle

One object, the kit, is fixed when a battle begins (`resetGame`) and saved with the run:

```js
// kit = { own: { bows: 2, engines: 1, captains: 0, heralds: 0, stewards: 1 }, hero: 2, std: false }
function battleKit() { ... }       // the player's Council and the age's hero level; the standard kit in a daily; NONE in a legacy run
function kitHas(branch, tier) { return (kit.own[branch] || 0) >= tier; }
```

- `getStats(t)` (line 11894) stays the raw table. A new `towerStats(t)` returns the stats with the kit
  applied (a copy cached per kind, rank and mastery; the cache is dropped in `resetGame`). Every reader of
  a tower's numbers in battle (the shooting loop, fire, drums, the post, `watchReach`, the range rings,
  `setPanelStats`, `statDeltaHtml`, the foe card's "blows to fell", `statDps`) calls `towerStats`. The panel
  therefore shows the numbers that are fought with.
- Costs go through `towerCost(type)`, `rankCost(type, level)`, `specCost(type, key)`; `towerInvested` and
  `towerWorth` sum what was actually paid, kept on the tower (`t.paid`).
- Hero: `heroSpawn` reads `HERO_LEVELS[kit.hero]` and the Heralds' tiers. Spells: `SPELLS[k].cd * kitCd()`.
- Stewards: `resetGame`'s purse, `repairCost`, `rebuildCost`, the interest cap, `towerMaxHp`, `mendTowers`,
  `sellRefund`, `plotPrice`.
- The kit of a run in progress never changes: a reset or a purchase made on the map while a run is saved
  applies from the next battle. A resumed run uses `r.kit`.

### 4.4 Heroes

Who leads: always the battlefield's own hero (`L.hero`), as today. A man is never put on a field he did
not stand on, so there is nothing to choose before a battle. What grows is kept per age: the heroes of one
age share one experience total and one level ("the captains of an age learn from each other's stands": a
rule of the game, said as such on the Captains page). The level a hero stands at is his age's.

Experience from one battle, added to the battlefield's age when the battle ends, won or lost:
`xp = round(D * (10 * scriptWave(lastCleared) + (won ? 100 : 0))) + min(40, hero.kills)`, D = 0.75 on Easy,
1 on Normal, 1.5 on Hard. A full victory on Normal is 300 whatever the battlefield's length. An endless
stand adds 10 a wave beyond the chronicle, at most 200 a stand. A daily counts as its battlefield's age, at
most 150 a day. A legacy run gives the same. Test mode (`recordsBarred()`) gives none.

Levels: 2 at 150, 3 at 450, 4 at 900, 5 at 1,500.

| Level | Strength | Blow (every 0.7 s) | Holds | Heals out of combat | Returns after | New |
|---|---|---|---|---|---|---|
| 1 | 400 | 34 | 3 | 10 /s | 20 s | (today's hero) |
| 2 | 460 | 40 | 3 | 10 /s | 20 s | The Call |
| 3 | 520 | 46 | 3 | 14 /s | 20 s | Reveals scouts within 110 px (80 today) |
| 4 | 600 | 54 | 4 | 14 /s | 17 s | The Call lasts 2 s longer |
| 5 | 700 | 62 | 4 | 18 /s | 14 s | The Call's second effect (below) |

The Call: one ability, the age's, on a 60 s clock. How it is given, with no new button (a phone's left
column has room for four medallions and no more): the hero's medallion, pressed while the hero is already
chosen, sounds the Call where he stands (today a second press only lets him go; it still does when the
Call is not ready or not yet earned). The medallion wears a bright ring when the Call is ready and a thin
outer arc while it cools. Keyboard: `T`. The tooltip and the touch toast add "Press again for his Call."

| Age | The Call | Effect (radius 120 px around the hero) | At level 5 also |
|---|---|---|---|
| Bronze and Iron | Stand Fast | For 6 s the hero and the men of posts near him take half damage and each holds one more foe | Foes held near him burn for 20 a second |
| Princes and Kings | Charge | The hero rides 160 px up his road: 120 to every ground foe he passes, each thrown back 30 px | The foes he passed are staggered 2 s |
| Powder | Sortie | For 8 s the hero and every post's men on the field strike twice as hard | They also strike through armor |
| The Great War | To Arms | For 8 s towers within 200 px of the hero reload 30% faster (a drum that walks) | And strike 20% harder |
| Artsakh | Call Fire | After 1.5 s five mortar bombs fall around him: 90 each, blast 70 | Seven bombs |

Basis for the names: Stand Fast is Avarayr's own words in the game ("Stand as Vardan stood"); Charge is the
Iron King's sortie in Sevan's text; Sortie is Halidzor's; To Arms is Sardarapat's bells calling everyone to
the field; Call Fire is generic. None claims a deed of a named hero on a field where he leads: the Call is a
game ability and its card says "The Call is a game ability."
Art: no new figure. A ring that spreads from the hero (the frost ring's painter in gold), the hero's swing,
the age's horn (`horn`, exists). Charge reuses the hero's walk at four times the pace with dust.

### 4.5 What is earned where

| Source | Stars | Hero experience | Towers |
|---|---|---|---|
| A victory | 1 to 3 by defenders kept (the best across difficulties counts) | 300 on Normal, 225 on Easy, 450 on Hard, and up to 40 for the hero's own kills | Reaching a battlefield opens the tower named for it (3.1) |
| A first victory on Hard | 1 more (the Hard seal) | as above | |
| A lost battle | none | 10 for each script wave cleared, by difficulty | |
| The endless stand | none (its record only) | 10 a wave, at most 200 a stand | |
| The daily challenge | none (its board and its streak are the platform's) | as a battle, at most 150 a day | |

### 4.6 The pages and their doors

Two panels, one page. The page is gameplay's own (`menuMode = "council"`, a parchment page in the overlay
like the chapter story), so it works with the platform off. It has two tabs, Council and Captains.
`openCouncil()` and `openCaptains(age)` open it.

Doors:
- The map: the star tally becomes a button (`#ovStars`: `role="button"`, 44 px to a finger, title "War
  Council: 3 stars to spend"). A red pip shows the stars unspent. If the platform's Hall takes the tally as
  its own door on a phone, the Hall must show the Council as its first tab or as a first button calling
  `openCouncil()` (need N4 in 9.4).
- The chronicle: (1) the hero's line under the miniature (`#briefHero`, line 60132) becomes a button,
  "Your hero · Argishti I · Level 2", that opens the Captains tab at his age. (2) A new row `#briefKit`
  under the tricks row: the towers this battle offers as small medallions (5 to 7; a new one wears "New"),
  and a chip "Council · 3 to spend" (shown only when stars are unspent) that opens the Council.
- The victory page: under the stars, when the victory earned new stars and one of them can buy something,
  a button "Spend 2 stars at the War Council"; and a strip with the hero's name, his level and the
  experience bar filling to its new place. Both go under `#ovRecord` and must keep `vic.js`'s rule for
  every button (wholly on screen, 40 px, apart from the others).
- One-time cards (frame and behavior of the trick cards, `hs_towers_seen`): "The War Council opens."
  (the first time stars are unspent, on the map), "A new tower" (2.8, and one for each age's tower),
  "The Call" (first battle at level 2, a coach bubble on the hero's medallion).

Layouts:
- Desktop and iPad: the Council tab is five columns (one a branch, its name over it) of five medallions
  56 px across, tier 1 at the top. A medallion is owned (gold), open (lit, with its cost in stars), closed
  by its branch (dim) or closed by its chapter (dim, a small lock, "Opens with Chapter III"). A press
  chooses it and shows its one sentence, its cost and the "Take it · 2 stars" button (44 px tall) in a strip
  under the tree; a second press on the button buys. Header: "War Council", "4 stars to spend of 9", and
  "Reset the Council" (a second press confirms on touch, as Sell does). The Captains tab is five rows, one
  an age: the names of that age's heroes the player has met, the level, the bar, what the next level
  brings, the Call's line.
- Phone held sideways (667 x 320 and up): the tree takes the left 470 px: five columns 94 px apart, five
  rows of 44 px medallions 6 px apart (244 px) under a 36 px header. The strip with the sentence and the
  button is a column on the right, 170 px wide, text at 12 px, button 44 px. The tabs are two 44 px
  buttons in the header. Nothing scrolls on the Council tab; the Captains tab scrolls inside its frame.
- Phone held upright (best effort): the tree's five columns share the width (62 px each at 375), the
  strip is under it, the page scrolls.
- On the chronicle held sideways on a phone the left column is full: `#briefKit` shows the Council chip
  and, if there is one, the new tower's medallion only.

### 4.7 Saves, and CLOUD_KEYS

Three new keys, all pushed onto `CLOUD_KEYS`:

| Key | Shape | Merge rule for the cloud |
|---|---|---|
| `hs_council` | `{ v: 1, own: { bows: 0..5, engines, captains, heralds, stewards } }` | Per branch the larger number, then `councilSane()`: tiers above the chapter reached are dropped, and if the cost is more than the stars earned, the highest tiers are dropped (last branch first) until it fits. |
| `hs_heroes` | `{ v: 1, xp: { iron, crowns, powder, greatwar, artsakh } }` | Per age the larger number. |
| `hs_towers_seen` | `["post", "horse", ..., "council", "call"]` | Union. |

Existing keys that change shape: `hs_records` rows gain `beyond` (1.6; merge: per field and difficulty the
larger, as for stars and lives). `hs_run` gains `rules`, `kit`, `daily` (the daily's spec, else absent),
tower fields `rally`, `spot`, `trigger`, `paid`, and `t` (the time it was written, ms): the platform keeps
the newer of two runs by `t`.

Today's players (migration, no rewrite of anything they own):
- Stars: counted from `hs_records` as it is. A player with 30 stars opens the game to "30 stars to spend".
- Heroes: when `hs_heroes` is absent it is created once from the campaign: 300 for each battlefield of the
  age already won (so a veteran's heroes stand at the levels a first play would have given). Safe to merge.
- Towers: derived from the campaign, so everything a player has reached is open at once.
- Runs: 1.7. Records: 1.6. Nothing in `hs_best_*`, `hs_settings`, `hs_tutorial_done`, `hs_tricks_seen`,
  `hs_chapters_seen`, `hs_unlocked_seen`, `hs_nardi*`, `hs_home_tip` changes.
- `validRun`, `councilSane`, `heroLevelOf` treat every stored value as untrusted: whole numbers in range,
  else the default.

### 4.8 Fairness: the power a player is expected to have

The difficulty a new player meets must not depend on grinding. Three things make that true:
1. Towers come from reaching a battlefield, never from stars or replays.
2. Hero experience is per age and a victory gives the same 300 whatever the battlefield's length, so the
   level a first play arrives with is known. A lost battle gives experience too, so a player who is stuck
   grows without leaving the battlefield.
3. Council tiers open with chapters, so what can be owned on first arrival is bounded, and the balance
   targets are set for what a careful first play actually has (PAR), then checked at the least any player
   can have (FLOOR).

Definitions, for a player arriving at a battlefield having won every one before it once:
- FLOOR: one star a battlefield (every victory earns one). PAR: two (what the best build inside the Normal
  band earns: it keeps 12 to 16 of 20, and three stars need 17). CAP: everything the chapter lets be owned,
  for a player who went back for three stars and Hard seals.
- The standard order of buying, used for FLOOR, PAR, the daily and the bot: tier by tier, and inside a
  tier Bowmen, Engineers, Captains, Heralds, Stewards (`councilStandard(stars, chapter)`).
- Hero level: the age's level after one Normal victory on each earlier battlefield of the age.

| # | Battlefield | Chapter (tiers open) | FLOOR stars | PAR stars spent | CAP stars | Hero level, first play |
|---|---|---|---|---|---|---|
| 1 | Erebuni | I (1) | 0 | 0 | 0 | 1 |
| 2 | Tushpa | I (1) | 1 | 2 | 4 | 2 |
| 3 | Avarayr | I (1) | 2 | 4 | 5 | 3 |
| 4 | Dvin | II (1 to 2) | 3 | 6 | 10 | 1 |
| 5 | Tashir | II | 4 | 8 | 10 | 2 |
| 6 | Sevan | II | 5 | 10 | 10 | 3 |
| 7 | Ani | III (1 to 3) | 6 | 12 | 20 | 4 |
| 8 | Mari | III | 7 | 14 | 20 | 4 |
| 9 | Sis | III | 8 | 16 | 20 | 5 |
| 10 | Gyumri Road | III | 9 | 18 | 20 | 1 |
| 11 | Halidzor | IV (1 to 4) | 10 | 20 | 30 | 2 |
| 12 | Van | IV | 11 | 22 | 30 | 1 |
| 13 | Musa Dagh | IV | 12 | 24 | 30 | 2 |
| 14 | Sardarapat | IV | 13 | 26 | 30 | 3 |
| 15 | Stepanakert 1992 | V (all) | 14 | 28 | 45 | 1 |
| 16 | Shushi | V | 15 | 30 | 45 | 2 |
| 17 | Stepanakert 2023 | V | 16 | 32 | 45 | 3 |

Erebuni is always fought first with nothing: the tutorial is the same for everyone.
How the balance targets account for it (5.2): every band is measured with the PAR kit. With the FLOOR kit
the bands may be up to 2 lives worse, and the mix must still win everything it must win. With the CAP kit
they may be up to 3 lives better, and Hard's best build must still lose some seeds. If a tier breaks one
of these, the tier's number is cut, not the battlefield retuned.
The standard kit of a battlefield is its PAR row: `councilStandard(PAR stars, chapter)` and the hero level
of the table. The daily and the platform's standard boards use it for everyone (6.4).

## 5. Balance

### 5.1 The owner's rulings, carried over

With `tools/balance.js`, SEEDS=3, lives 30 / 20 / 14 as today:
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

### 5.2 What is added for the new lengths, towers and progression

- Kit: all of 5.1 is measured with the PAR kit of 4.8 (`KIT=par`, the default once progression lands).
  `KIT=floor`: bands up to 2 lives worse; the mix still wins every seed on Easy everywhere and on Normal's
  first six. `KIT=cap`: bands up to 3 lives better; on Hard the best build still loses some seeds.
  `KIT=none` is kept for comparing with today's game.
- Lengths: a battlefield's band does not move with its length. A 10-wave Erebuni still costs the best
  build 4 to 8. (The prototype shows what moves: 3 to 6 lives easier before retuning.)
- Time, a new target: wave time at 1x for the best build on Normal within 15% of the table in 1.2. The
  bot prints it (5.4).
- The classic five stay a whole game: "mix" (no new towers) meets every target above that it meets today.
- The new towers are worth their pad and never required: "mix7" (the mix with the post and the age's
  tower in its order) keeps on average 1 to 3 lives more than "mix" over the 17 on Normal, and on no
  battlefield more than 5 more. On at least a third of its battlefields each new tower is in the best
  build.
- New one-recipe builds lose on Normal on at least two of three seeds wherever they can be built:
  "posts" (posts only), "postdrum" (posts and drums), "agemix" (the age's tower on every second pad, posts
  between), "bazaar" (two markets first, then the mix, on the Princes and Kings battlefields: it must end
  below "mix" in lives on at least four of the six).
- A commander is never stopped by posts: with CMD=probe a board of posts alone leaves both commanders
  above 60% of their strength at the walls.
- The Market: "greedy" (the mix with one market as its third building) ends with 150 to 250 more gold
  invested than "mix" and within 2 lives of it.
- The Dressing Station: "mix" plus a station as its sixth building keeps at most 3 more lives than "mix"
  on Van, Musa Dagh and Sardarapat.
- Easy and the new towers: the mix alone still meets Easy's band; a family that never touches a new tower
  loses nothing.

### 5.3 Knobs, in the order they should be reached for

1. `hpTune` and `LEVEL_HP`'s rank and file column (a battlefield's own strength), as today.
2. `LEVEL_HP`'s commander column, with CMD=probe.
3. The tricks' counts where the script map made them denser or thinner (Erebuni's scouts, 1.3).
4. The new towers' own numbers (2.1, 3.2 to 3.6).
5. The Council's numbers (4.2) and the hero's levels (4.4).
Never `DIFFS`, `hpScale`, `TOWER_DEFS` of the five slots, the star thresholds or the pay rule of 1.4: they
are shared by everything already tuned.

### 5.4 How the bot learns all this (`tools/balance.js`)

- Lengths: the loop reads `totalWaves()` (it names `TOTAL_WAVES` at lines 202, 308, 323, 349). `trickWave`
  and the tell are already read through the game.
- Time: each battle returns `secs` (game seconds per wave) and the table gains a column "min" for the best
  build (the patch is `gameplay-proto/balance-time.diff`).
- Kit: `KIT=none|floor|par|cap` calls a test hook `setKitForTest(kit)` before `resetGame()`; the hook builds
  the kit from 4.8's table for the battlefield played.
- New kinds in a build's order: `post`, and `age` (the age's tower of the battlefield played; skipped where
  it is not offered). New builds in `BUILDS`: mix7, posts, postdrum, agemix, greedy, bazaar, station
  (5.2). `BAN=fire` strikes a tile (for the daily's twist).
- The bot's rules for the new towers, the same for every build:
  - Post: the pad that reaches the most road (the existing ranking, radius the post's reach). Rally point:
    the road point in its reach that lies in the range of the most standing shooting towers, on a tie the
    one nearest the walls; set again after each purchase. Where an ambush road is told, a post that
    reaches it moves its rally there for those waves if no other tower covers it.
  - Horse Lines: the pad whose reach holds the most road within 120 px downstream of a fire or catapult.
  - Market: the free pad that reaches the least road (the worst pad for a tower), bought as the order
    says, never after two thirds of the battle.
  - Powder Mine: pad by road reached; the charge at the road point in reach covered by the most towers;
    trigger "at 3 foes".
  - Dressing Station: the free pad nearest the fortress.
  - Observation Post: pad by road and sky reached (`rankAir`); target Strongest.
  - Hero: `HERO=hold` parks the hero at the road point nearest the fortress that the most towers cover
    (today the bot never moves him, so his level could not be measured), and sounds the Call when three
    or more foes are within its radius. `HERO=off` is today's behavior, for comparing.
- Report: lives returned by a station apart from lives kept; gold paid by markets; per new tower, damage
  per 100 gold as for the others, and for the post "seconds of hold per 100 gold".
- Seeds: `BOT_SLOT` is untouched, so every battlefield keeps its seeds.

### 5.5 Builds that must lose, and why they do

- Posts alone: men deal 20 to 73 a second a post and hold two to four; engines and outflankers walk past;
  a commander is held 8 s a post. Nothing kills the column.
- The age's tower alone: a market kills nothing; a station kills nothing; an observation post kills
  nothing; a powder mine fires once in 22 to 28 s; horse lines strike once in 14 to 18 s.
- Two markets and a thin board: income arrives after the waves that needed it.
The adaptive enemy has no guard against the new kinds in the first release. If tuning shows a board of
one new kind and drums winning, the fix is that kind's numbers. A guard against the post ("Wedge": held
foes break free after 4 s) is specified as the fallback and built only if needed.

### 5.6 The order of tuning

1. Lengths only (`KIT=none`, classic builds): set every `hpTune` so the bands of 5.1 hold again. Expect to
   raise the short battlefields by 5% to 15%. Then commanders with CMD=probe. Tables for all three
   difficulties, SEEDS=3, saved under `docs/specs/balance/` (before and after).
2. The Garrison Post (still `KIT=none`): its numbers, until "mix7" is 1 to 3 lives above "mix" and the
   post builds lose.
3. The age's towers, one age at a time, in campaign order.
4. The kit: turn on `KIT=par`; the game is now easier by the kit's worth; raise `hpTune` across the board
   by that much (expected 3% to 8%, more in later chapters) so the bands hold at PAR. Check FLOOR and CAP.
5. Easy, then Hard (their own `hpTune` entries), then the endless stand's first ten waves on three
   battlefields (it must not have become trivial with posts: a mix7 board should fall between waves 8 and
   20 beyond the chronicle).
6. Three seeds, all three difficulties, all builds: the final tables, with wave time.
7. A person plays: 8.4.
After any later change to a number in 5.3, rerun step 6.

