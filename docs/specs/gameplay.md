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
- Winning builds end a battle with 6,700 to 16,500 gold invested (the mix: 6,790 on Erebuni, 13,620 on
  Shushi): every pad at rank 3 and the first masteries from about wave 18 (five on Erebuni's last wave).
  A battle cut off at wave 10 would never see a mastery.
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
- The board is as built at the end as today: gold invested by the winning builds is within 6% of today's on
  14 of 17 battlefields (Erebuni 6,702 to 6,958; Dvin 11,763 to 11,575; Sevan and Gyumri 10% richer,
  Stepanakert 2023 6% poorer; the builds that win are not the same set in the two runs).
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
| 10 | Gyumri Road, 1579 | 13 | 7, 13 | 28 (44) | A road fight (the battle is the game's). Today it is one of the two longest; it should not be. |
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
MEASURED with the prototype (pure pay-ahead, without the wave 4 exception): boards within 6% of today's on
14 of 17 battlefields.

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
  if (legacyRun || tutGentle) return base;                   // an old run and the coached stand: the classic five
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
- A coached stand (`tutGentle`) and a legacy run use the empty kit and a level 1 hero: the tutorial is the
  same battle for everyone, whatever the save owns.

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

## 6. What a score is made from

### 6.1 The facts of a finished battle

`battleFacts()` returns a plain object when a battle ends (victory, defeat, the end of an endless stand).
Everything in it is counted by the battle itself. It is a claim made by a page the player controls: the
platform must treat it as such (6.3).

```js
{
  rules: 2,                    // RULESET; 1 for a legacy run (a 20-wave run begun before the update)
  build: "2026-11-09",         // BUILD_ID
  lvl: "erebuni", age: "iron", diff: 1,
  mode: "campaign",            // "campaign" | "endless" | "daily"
  daily: null,                 // { day, twist } in a daily
  won: true,
  waves: 10,                   // the battle's length
  cleared: 10,                 // waves cleared (lastCleared, at most `waves` outside an endless stand)
  script: 20,                  // scriptWave(cleared): how far through the 20-step script, for comparing lost battles
  beyond: 0,                   // endless: waves held beyond the chronicle
  livesStart: 20, livesKept: 15, lost: 6, returned: 1,      // kept = start - lost + returned
  leaks: { spearman: 2, cavalry: 3, boss: 0 }, cmdMet: 3, cmdFelled: 3,
  trickLost: { ambush: 0, hidden: 1, hunter: 0, adapted: 0 },
  timeS: 1042,                 // game seconds with a wave on the field: what 1x would have taken. Speed does not change it
  realS: 688,                  // real seconds from the first wave's call to the end, pauses left out
  speedS: { x1: 120, x2: 568, x4: 0 },                      // real seconds at each speed
  goldStart: 220, goldEarned: 7410, goldSpent: 7180, goldLeft: 450,   // left = start + earned - spent
  goldFrom: { bounty: 5200, clear: 1500, interest: 480, early: 110, market: 120 },
  spentOn: { build: 2300, rank: 3100, mastery: 1200, land: 275, repair: 305 }, refunds: 0,
  towers: { archer: 4, ballista: 3, catapult: 3, fire: 2, drums: 1, post: 1 },   // standing at the end
  masteries: 6, built: 15, sold: 1, wrecks: 1, plots: 1,
  tray: ["archer", "ballista", "catapult", "fire", "drums", "post"], ban: [],
  spells: { arrows: 6, frost: 7, wrath: 5 }, calls: 4, heroLevel: 2, heroFalls: 1, heroKills: 23,
  kit: { own: { bows: 1, engines: 1, captains: 0, heralds: 0, stewards: 0 }, hero: 2, std: false },
  power: 2,                    // stars' worth of the Council tiers that were active
  early: 3, auto: false, resumed: 0, aided: false, tut: false,
}
```

Counters to add to the battle (none exist today as totals): `timeS` (summed in `update` while
`phase === "wave"`), `realS` and `speedS` (in the frame loop, not while paused or hidden), `goldEarned` and
`goldFrom` (every `gold +=`), `spentOn` and `refunds` (in `spendGold`, which gains a reason), `lost`,
`returned`, `built`, `sold`, spell and Call counts, `early`, `auto`, `resumed`. All of them are saved in
`hs_run` at each wave's horn (`markWaveStart`), so a resumed run does not lose or double them, and a wave
fought again after a reload counts once.

### 6.2 The inputs of a score

The weights are the platform's. Gameplay defines the three inputs so that they mean the same on every
battlefield, and supplies the pars:
- Defenders: `L = livesKept / livesStart` (0 to 1).
- Speed: `S = clamp((2 * parS - timeS) / parS, 0, 1)`: 1 at par or faster, 0 at twice par. `parS` is the
  best build's mean wave time on Normal from the final balance tables (5.6), per battlefield. Early calls
  are how a player beats par; the speed button does nothing to it.
- Thrift: `T = clamp(goldLeft / (0.2 * (goldStart + goldEarned)), 0, 1)`: 1 when a fifth of all gold was
  never needed.
- A lost battle ranks under every victory, by `script` (so a loss on wave 8 of 10 and one on wave 15 of 20
  compare honestly), then by `livesKept` (0) and `timeS`.
- The endless board: `beyond`, ties by less `timeS`.
- Difficulty: one board a difficulty, no multiplier. Easy's foes are weaker by rule, so its scores do not
  compare with Normal's.
What must not move a score: the speed chosen, pauses, the device, the hero's kills, how many towers were
sold. What should keep a run off the standard boards: `rules !== RULESET`, `aided`, `tut`, `resumed > 0`
(a wave fought again after a reload), `kit.std === false`, a non-empty `ban` outside the daily.

### 6.3 `rulesetTable()`: what the platform can check a claim against

One JSON object, built by the page from its own tables (so it cannot drift from the game), for the
platform to publish to its server: for each battlefield its `waves`, `script`, `livesStart` by difficulty,
`pads` and `plots` (the most towers there can be), `parS`, `minS` (the sum over its waves of the time the
last foe of that wave spawns: no battle can clear its waves faster, early calls included), `goldMax` by
difficulty (every bounty with the plunder mastery, every clear bonus, the interest cap on every wave, two
markets at Caravan, the early bonus on every wave: an upper bound), the standard kit, and the tray. With
it a server can refuse `timeS < minS`, `goldEarned > goldMax`, `livesKept > livesStart`,
`goldLeft !== goldStart + goldEarned - goldSpent`, more towers than pads and plots, a tray tile the age does
not have, a kit above the chapter's cap. It cannot prove a battle was played; say so on the board's
small print.

### 6.4 The standard loadout, the daily, and its twists

The standard loadout of a battlefield: the five slots, the Garrison Post and its age's tower, whether or
not the player has reached them, with the standard kit (4.8: the PAR Council in the standard order, the
hero at the table's level). Erebuni's is five slots, the post and the Horse Lines with an empty Council and
a level 1 hero.

`startDaily({ day, lvl, twist })` (the platform chooses the three from gameplay's tables): Normal, the
standard loadout, the twist applied, `mode: "daily"`. A daily never writes `hs_best_*` or `hs_records` (it
opens no road and gives no stars), may be fought on a battlefield the campaign has not reached (its
chronicle is shown first, as before any battle), is not saved as a resumable run (leaving it ends the
attempt: `hs_run` is not written, so the campaign's saved run is left alone), and gives hero experience up
to 150 a day. Its brief shows the twist's card before "Begin the Stand".
Randomness: the few draws that move foes (an outflanker's entry point, its path over a lake, which side an
aircraft circles) come from a small generator seeded from `day` and `lvl` (`gRnd`), so every player meets
the same lines; looks (particles, sheep) keep `Math.random`.

`DAILY_POOL`: all 17 battlefields by id. `DAILY_TWISTS`: each is an id, a name, one sentence for its card,
and a patch made of knobs that exist today, so none needs new art:

| id | Name | Card | What it sets |
|---|---|---|---|
| `thin` | Thin purse | "Bounties are a fifth lower today." | bounty x 0.8 (`econ.bounty`) |
| `swift` | Forced march | "Every foe marches 15% faster today." | `spdMult` x 1.15 on every role |
| `iron` | Iron ranks | "The rank and file wear 3 more armor today." | `armorAdd` + 3 on raider, spearman, shield, cavalry |
| `scouts` | Scouts abroad | "Hidden scouts come on many waves today." | the hidden trick (`from` script 4, `every` 2, n [2, 5]), the battlefield's own scout name if it has one, else "Scouts" |
| `sappers` | Sappers abroad | "Tower hunters come today." | the hunters trick (`from` script 6, look `pick`, n [1, 4, 3], tdps 12) |
| `ban` | Short of hands | "No {tower} today." | one of ballista, catapult, fire, drums struck from the tray (`trayBan`); never the battlefield's watch slot |
| `few` | Few defenders | "You have 12 defenders today." | lives 12 |
| `quiet` | Silent heavens | "No spells today." | the three spells off |
| `pair` | Two commanders | "The first commander brings a second." | the script wave 10 group n = 2 |
| `wary` | A watchful enemy | "The enemy adapts early today." | `adapt.from` script 3 |
| `press` | No rest | "The next wave comes 4 s after the last is cleared." | Auto on and locked |
| `dusk` | Night stand | "The battle begins at dusk." | the sun starts low (looks only; may ride with any other twist) |

`DAILY_SKIP`: the pairs (battlefield, twist) the bot's mix cannot win on two of three seeds with the
standard loadout (`TWIST=id` in the bot); the platform's picker steps past them. The table is made by the
bot and committed with the balance tables.

## 7. Analytics hooks

Gameplay calls `track(name, props)`; it never waits for it and never reads from it. Props are small flat
objects of numbers, booleans and short ids: no free text, nothing personal. To keep the stream thin, what
happens many times a wave is counted and sent once with the wave.

| Event | Where (function, line today) | Props |
|---|---|---|
| `map_open` | `buildMenu` 55002, when the map is shown | `chapter`, `open` (battlefields open), `stars`, `unspent` |
| `chapter_story` | `showChapterIntro`, each page turn | `id`, `page`, `pages` |
| `diff_set` | the difficulty row's handler | `diff` |
| `brief_open` | `showBrief` 60101 | `lvl`, `diff`, `daily` |
| `brief_page` | the chronicle's page turn (`showLeafPage`) | `lvl`, `page`, `pages` (how far the history is read) |
| `foe_card` | opening a foe's card | `lvl`, `role`, `from` ("brief" or "battle") |
| `battle_start` | the Begin the Stand handler (not `resetGame`, which tests call) | `lvl`, `diff`, `mode`, `rules`, `waves`, `tray`, `power`, `heroLevel`, `tut` |
| `battle_resume` | `resumeRun` 10741 | `lvl`, `w`, `rules` |
| `tutorial_step` | each coach step shown (`TUT_STEPS`, about 60880) | `i`, `id` |
| `tutorial_end` | `stopTutorial` | `i`, `how` ("done" or "skip") |
| `wave_start` | `startWave` 11040 | `lvl`, `w`, `sw` (script wave), `early`, `gold`, `lives`, `towers` |
| `wave_end` | `endWaveIfClear` 11342 | `lvl`, `w`, `secs`, `lost`, `gold`, `built`, `ranked`, `mastered`, `sold`, `spells`, `calls`, `rallies`, `fired` (mines by hand), `repairs` (counts in that wave) |
| `trick_card` | a first-time trick card shown (`trickCardsAtStart`) | `lvl`, `key` |
| `unlock_seen` | a one-time card of 4.6 put away | `what` |
| `battle_end` | `victory` 11451, `endFall` 11854 | the facts of 6.1 |
| `battle_abandon` | Settings, Abandon (about 60612) | `lvl`, `w`, `lives`, `timeS` |
| `endless_start` | Hold Forever | `lvl`, `diff` |
| `daily_start` | `startDaily` | `day`, `lvl`, `twist` |
| `star_gain` | `recordWin` 10970, when the tally rises | `lvl`, `diff`, `stars`, `hard` (the seal), `total` |
| `hero_level` | when an age's level rises | `age`, `level` |
| `council_open` | `openCouncil` | `from` ("map", "brief", "victory", "hall"), `unspent` |
| `council_buy` | buying a tier | `branch`, `tier`, `left` |
| `council_reset` | Reset the Council | `spent` |
| `captains_open` | `openCaptains` | `age`, `from` |
| `speed_set`, `auto_set` | `setSpeed` 60400, the Auto button 60423 | `x`; `on` |

The funnel the gate's cost is read from (D3) continues in these: the platform's own gate events, then
`brief_open`, `battle_start` with `tut`, `tutorial_step` by step, `wave_end` for waves 1 to 3,
`battle_end`, the second `battle_start`. Under the harness (`?selftest`, `?shot`) `track` stays the no-op.

## 8. Tests

### 8.1 The self-test and its budget

Today: 151 checks in about 122 s of a 125 s budget. The budget is kept by not adding to that suite:
- Suite 1 (`?selftest=1`, today's): only edited where it assumes twenty. The staged waves 12 and 19 of
  "render L" become `Math.ceil(N * 0.6)` and `N - 1`; every `TOTAL_WAVES` in lines 77157 to 78325 becomes
  `totalWaves()` (they stage a victory, a defeat or an endless stand: same cost); line 77379's check that
  the constant is 20 becomes a check that the endless defeat page names no number; line 78245 keeps
  1 to 20 (the data stays script waves); line 78293's "an ambush does not meet a commander wave" uses
  `isCommanderWave(playedWave(f))`. No check is added. Its time does not grow.
- Suite 2 (`?selftest=2`, new, `runSelftestPlay`): everything below, with its own 125 s budget.
  `tools/selftest.js` takes `--suite=1|2|all` (default all: both suites in two pages side by side, so the
  wall time stays about 125 s) and fails if either suite's own clock passes 125 s (`res.ms`). If suite 2
  passes 100 s it is split again.

Suite 2's checks:
- Waves: every `L.waves` is 10 to 20 and has a table; every table starts 1, 2, 3, rises, holds 10, ends 20;
  `coveredWaves` and `paidWaves` each split 1 to 20 with no gap or overlap; the clear bonuses of a whole
  battle sum to the 20-wave total (1,130) on every battlefield; on Sis and Sardarapat `wavePlan(w)` equals
  the script's plan for every wave (unchanged battles); Erebuni's coached waves 1 to 3 match a fixture
  taken from master (queue, hit points, bounties, gold after each); the commander waves equal 1.2's table;
  no ambush opens or is first told on a commander wave; the first waves of 1.3's table; "Wave 3/10" in the
  HUD; the brief's line; Mari's held lines; the coach's last words.
- Old saves: an `hs_run` without `rules` resumes with 20 waves, five tiles and the empty kit, wins, and
  records its stars; an old endless record of 34 reads as 14 beyond and is written back both ways; an
  `hs_best` of 15 on a 10-wave battlefield shows 10 and one of 21 still opens the next road.
- Garrison Post: at least ten pads of every battlefield have road within a rank 1 post's reach, and a
  pad without refuses the post; a post built gets a rally point
  on a road in reach; a staged press moves it and a press out of reach does not; a held foe's `dist` does
  not grow and it is let go when its man falls; engines and outflankers are not held; an unseen scout
  passes and a seen one is held; a hunter at a tower in reach stops working when a man reaches it; one post
  holds a commander 8 s at most; a stone aimed at a held foe lands on it; a resumed run keeps the rally
  point; a wrecked post sends no one; the drums quicken the men.
- The age's towers: each is offered only in its age and only once its battlefield is open; Horse Lines
  never throw a foe behind its road's start nor throw a held foe; a Market pays `pay` times `payStep`, a
  third is refused, a wrecked one pays nothing; a Powder Mine arms, fires by a press on its marker, fires
  by its trigger at 3 foes, and Twin Fuses holds two; a Dressing Station returns a defender only after a
  wave without a loss, stops at its cap and never passes the starting count; an Observation Post's mark
  multiplies a blow once whatever the number of posts, shows a marked scout, and can mark an outflanker.
- Tray: 5, 6 or 7 tiles as the campaign stands; five in the coached stand; keys 6 and 7; every
  `towerShort` is 13 characters or fewer, or the tile carries `noNm`; a tile's price is the kit's.
- Council: stars counted from records with the Hard seal; a tier needs the one under it and its chapter;
  reset returns everything; a forged `hs_council` is cut down by `councilSane`; the panel's numbers equal
  `towerStats`; the standard order gives 4.8's rows; the page is staged at 1600 x 900, 1194 x 834 and
  667 x 320 with no element outside it (`?shot=council`).
- Heroes: a victory on Normal is 300 on a 10-wave and on a 20-wave battlefield; the thresholds; the
  migration from records; a second press of the medallion sounds the Call at level 2 and only lets go at
  level 1; the Call's clock.
- Facts and hooks: `battleFacts()` after a staged victory, defeat and endless end has every field of 6.1
  and its three sums hold; a legacy run says `rules: 1`; with a spy for `track`, a staged battle sends the
  events of section 7 in order, each JSON-safe and under 2 KB; `rulesetTable()` has 17 rows and
  `minS < parS` on each.
- Daily: `startDaily` gives the standard loadout and kit, applies each twist of 6.4, and a staged victory
  leaves `hs_best_*`, `hs_records` and `hs_run` as they were.

### 8.2 The regression suite (`tools/regress/`)

- `padplace.js`: the post's tile and the age's tile on every pad, by mouse (1600 x 900, 2000 x 1250) and
  touch (1194 x 834), and a phone pass (667 x 320) for one battlefield an age with seven tiles.
- `probe.js`: every new kind at every rank and mastery opens its own panel. New: Rally point pressed, then
  the road: the men's rally moved (mouse, iPad touch, phone); Lay the charge the same; a press on an armed
  charge's marker fires it and opens no panel.
- `plots.js`: unchanged, run once more with seven tiles in the tray at 1194 x 834.
- `iphone.js` (all ten sizes): the tray of six and of seven (tiles at least 44 x 44, names whole and 11 px
  or absent); the post's and the mine's panels as sheets (every button inside the sheet and the safe
  area, the tap that opens the sheet presses nothing); the armed rally (ring and toast inside the safe
  area, the toast not over the wave ribbon); the Council and Captains tabs; the chronicle with `#briefKit`
  and the hero's button (44 px); the victory page with its two new strips; the three one-time cards; the
  Call's ring on the medallion.
- `vic.js`: the two new buttons obey its rule on every battlefield and size. `doors.js`: the tally opens
  the Council and the map is back in reach; the chronicle's hero button opens Captains and returns.
- `live.js`: on every battlefield a post is built and its rally set, the age's tower built, three waves.
- `nag.js`: unchanged steps; the last bubble says "ten waves". `dance10.js`: unchanged.
- New `waves.js`: every battlefield played to its victory through the game's own loop at 4x with test
  gold: the HUD counts to N, the commander banners come on the table's waves, the victory page comes up
  after wave N. `--quick`: Erebuni, Avarayr, Mari. About 10 minutes in full.

### 8.3 Balance tables to produce (kept under `docs/specs/balance/`)

Each at SEEDS=3 on Easy, Normal and Hard with wave time: (a) master, as the baseline; (b) lengths only,
before and after retuning; (c) with the post; (d) with each age's tower; (e) `KIT=floor`, `par`, `cap`;
(f) CMD=probe for (b) and (e); (g) `TWIST=` for every twist on every battlefield (Normal, mix, standard
kit): `DAILY_SKIP`; (h) `rulesetTable()` as JSON.

### 8.4 Touch playtests

By a person, or with the touch player built for the earlier play review, on an iPad (1194 x 834), an
iPhone SE (667 x 320 in Safari) and an iPhone 15 from the Home Screen (852 x 393):
1. A fresh save: the tutorial to Erebuni's victory. Ten waves, no new tile, the same coach. Under 25
   minutes at 1x with the reading.
2. Tushpa: the "new tower" card, a post built, the rally moved five times during waves at 2x. No press
   meant for the road opens a panel, buys land or moves the hero (at most 1 slip in 20 presses).
3. Avarayr with Horse Lines; Gyumri Road with a Powder Mine fired by hand five times on a crowd; Van with a
   Dressing Station; Stepanakert 1992 with an Observation Post retargeted.
4. The Council on the phone: buy three tiers, reset, buy again. The Call by a second press with foes on
   the hero.
5. A family run on Easy that never opens the Council or builds a new tower: it wins the first six.
6. Sardarapat's 20 waves on a phone at 2x: the frame rate with four posts' men and the riders on the
   field stays where it is today (the frame governor does not step in on an iPhone 12 or newer).

## 9. Build order, risks, cuts

### 9.1 Work packages

| WP | What | Done when |
|---|---|---|
| 1 | The script map and the 17 lengths (section 1), with `legacyRun`, the records' `beyond`, every text. No new content. | Suite 1 green with its edits; suite 2's waves and old-saves checks green; the bot's tables for Sis and Sardarapat equal master's cell for cell; `waves.js` green; a 20-wave run saved on master resumes and wins. |
| 2 | Tuning the lengths (5.6 step 1). | The bands of 5.1 on all three difficulties at SEEDS=3 with `KIT=none`; wave time within 15% of 1.2; tables committed. |
| 3 | Facts, hooks, `rulesetTable()`, `startDaily` and the twists (sections 6, 7). Small, and the platform is waiting on it: it may run beside WP2. | Suite 2's facts, hooks and daily checks green; the platform's spec agrees the field list. |
| 4 | The tray of n tiles and the Garrison Post (sections 2, 3.7, 3.8): numbers, men, rally by mouse and touch, art, the card, the bot's rule, tuning step 2. | Suite 2's post and tray checks; `padplace`, `probe`, `iphone`, `live` green; "mix7" and the post builds meet 5.2; playtest 2. |
| 5 | The kit and the War Council (4.1 to 4.3, 4.6 to 4.8). | Suite 2's council checks; `doors`, `vic`, `iphone` green; `KIT=floor|par|cap` in the bot; playtest 4. |
| 6 | Heroes: experience, levels, one Call (Stand Fast in every age), the Captains tab, `HERO=hold`. | Suite 2's hero checks; the hero's worth measured (`HERO=hold` against `off`) and inside the kit's bound. |
| 7a to 7e | The age's towers in campaign order: Horse Lines, Market, Powder Mine, Dressing Station, Observation Post. Each: numbers, panel, art, card, bot rule, checks, its tuning step. | Its suite 2 checks; its rows of 5.2; its playtest of 8.4. |
| 8 | The final balance (5.6 steps 4 to 6), `DAILY_SKIP`, the pars. | Every target of 5.1 and 5.2 at SEEDS=3; tables and `rulesetTable()` committed. |
| 9 | The text audit (every new player-facing string against the house rules; every CHECK of sections 2 and 3 read against a source or renamed to its generic fallback; every INVENTION said on its card), the full regression suite, the playtests, `deploy/check-page.js`. | No CHECK left open; suites, `run-all.js` and `town-isolation.js` green. |

### 9.2 What a first release must contain, and what waits

First release: WP1 to WP6, WP7a and WP7b (the two ages a new player meets in the first evening), WP8 for
what is in, WP9. That is: the new lengths, the Garrison Post, the growing tray, the War Council, hero
levels with one Call, Horse Lines and the Market, the facts and hooks the platform needs for boards and
the daily.
Second release: Powder Mine, Dressing Station, Observation Post (WP7c to 7e), the per-age Calls, the
twists beyond the first six. Until then Chapters III to V play with the post and no age tower, and 3.1's
table hides the rows that are not built (`AGE_TOWER[i] = null`).

### 9.3 Cut first, in this order, if time runs short

1. The per-age Calls (one Call everywhere).
2. Experience for the hero's own kills and for the endless stand.
3. The Captains tab (the chronicle's hero button shows the level and bar in its own small card).
4. The post's sally against hunters (men hold hunters on the road only).
5. Short names for phone tiles (the tiles show no name on a phone when seven are in the tray).
6. The Dressing Station's healing of men and hero (it keeps the returning defenders).
7. The twists beyond `thin`, `swift`, `iron`, `ban`, `few`, `quiet`.
8. The age's towers from the last age backward.
Never cut: the script map with the legacy run; the rally point by touch; the PAR, FLOOR and CAP checks;
the facts; the tutorial's fixture check.

### 9.4 Risks

- Scope. Seven new mechanics with art, two pages, a kit, three rounds of tuning. Held by the release
  split (9.2), by reusing painters for every figure (2.7), and by the order: nothing after WP3 blocks the
  platform.
- Tuning churn. Every battlefield is retuned three times (lengths, towers, kit). Held by 5.3 (the shared
  knobs are never touched) and 5.6 (one cause at a time, tables kept).
- The tutorial drifting. Held by the fixture check and by the empty kit and five tiles in a coached stand.
- Touch conflicts: rally, charge, hero, spell, plot and tower all take a press on the field. Held by one
  armed state at a time, the settle guard, and `probe.js` and `iphone.js` presses.
- Seven tiles on a 667 px phone. Held by short names or none, and `iphone.js`.
- Saves and the cloud. Held by deriving stars and unlocks from records, by never rewriting an old key, and
  by merge rules that only take the larger or the union (4.7).
- History. New names without a source in the repo are marked CHECK with a generic fallback; a tower that
  is the game's idea says so on its card.
- A tower that does not fight (Market, Dressing Station, Observation Post) may read as dull or as a trap.
  Held by the bot's targets in 5.2 and by playtests; the Market is the first to rework if players build
  two and lose.
- Frame rate on phones with men and riders on the field. Held by the unit sprite cache and playtest 6.
- Two tracks in one 4.5 MB file. Gameplay edits the gameplay regions named in this spec; the platform adds
  its own block and the hooks of 0.1. The shared places are the overlay's HTML and CSS (the tally, the
  victory page, the chronicle): see N4 and N8.

### 9.5 What gameplay needs from the platform

- N1. `window.track` defined before the first battle, or not at all. Sampling is the platform's.
- N2. `CLOUD_KEYS` declared before gameplay's block. The merge rules of 4.7 applied (gameplay supplies
  `mergeSave(key, a, b)` for `hs_records`, `hs_council`, `hs_heroes`, `hs_towers_seen`, `hs_run`). After a
  pull that changed any key, a call to `onSavesChanged()` so the map, the tally and the kit are read again.
  A pull never lands while a battle is on the field.
- N3. `window.onBattleEnd(facts)` as the one way a result leaves the battle. Standard boards keyed by
  `rules`, battlefield, difficulty and mode, taking only runs with `kit.std`, `resumed === 0`, not `aided`,
  not `tut` (6.2); open boards may take the rest and show `power` and `heroLevel` beside a score.
- N4. The star tally is the War Council's door. If the Hall uses the tally as its own door on a phone, the
  Hall shows the Council first (a tab that hosts `renderCouncil(el)` or a button that calls `openCouncil()`).
- N5. The daily: the platform picks day, battlefield and twist from `DAILY_POOL`, `DAILY_TWISTS` and
  `DAILY_SKIP`, counts attempts, and calls `startDaily`. Gameplay shows the twist and plays it.
- N6. The gate and the cloud stay off under `file://`, `?selftest` and `?shot`, so the bot, the self-test
  and the regression suite run as they do today.
- N7. The victory page: one row for gameplay (`#ovGrowth`: the hero's bar and the Council button, 44 px on
  a phone) between `#ovRecord` and the platform's score strip.
- N8. Boards are per `RULESET`. Gameplay raises `RULESET` whenever a change moves what a score means (a
  length, the pay rule, a tower's table, a kit number, a par), and says so in the commit.
- N9. The share card may read `battleFacts()` and `renderBriefArt(lvl)`; it needs nothing else from the
  battle.

### 9.6 What the owner should decide

1. The lengths of 1.2, above all: Sis and Sardarapat stay at 20; the campaign ends on a 12-wave stand.
2. The tray grows to seven; no loadout.
3. The five ages and their towers. Three of the five do not shoot (Market, Dressing Station, Observation
   Post). The Dressing Station returns defenders, so gold can buy back a star. The Powder Mine and the
   Market as battlefield towers are the game's invention and say so.
4. Heroes: the battlefield's own hero always leads and experience is shared inside an age. The other
   ways: a level for each hero alone (growth would not carry to the next battlefield), or guest heroes
   from the same age (men on fields they never stood on).
5. Stars: a Hard victory gives one more (68 in all); three stars on Easy keep counting as three.
6. The Council: free reset; tiers open with chapters; a tier once owned counts on old battlefields too.
7. The daily gives hero experience and no stars.
8. The release split of 9.2, or everything in one release.
9. Names marked CHECK that turn out to have no source: use the generic fallback, or drop the tower's own
   name on that battlefield.
