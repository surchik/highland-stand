# Critique of `docs/specs/gameplay.md` (commit 2af988b)

Reviewer's lenses: fun and depth, fairness of progression, feasibility in this codebase, history, the seam
with `platform.md` (commit f7657c8), scope and order. Every issue has a severity (blocker, major, minor), the
evidence, and the exact fix. The revised spec is `docs/specs/gameplay.final.md`; its appendix lists what was
applied and what was rejected.

What was checked, and how:

- The whole spec against `index.html` at master 54207ce (line numbers below are that file's), `tools/balance.js`,
  `tools/selftest.js`, `tools/regress/`, `docs/history/*.json`, the battlefields' own texts in `LEVELS`, the
  prototype files in `docs/specs/gameplay-proto/`, and `platform.md` sections 0.3, 2.4, 4.4 to 4.6, 5, 7.2, 7.4,
  11 with `platform/schema.sql`.
- RENDERED: a scratch copy of the page with seven tiles in the tray, at 667 x 320 with touch (a phone held
  sideways), on Tushpa, Gyumri Road, Stepanakert 1992 and Stepanakert 2023. Each tile is 88.4 x 52 px, as the
  spec computed. The name box is 82 px wide: names up to about 17 characters show whole, longer ones are cut
  with an ellipsis ("Defense Army rif…", "Barricade and m…", "Bread queue shel…").
- MEASURED: the bot plays 4 battles in 10 s with four jobs, so a full table (17 battlefields, 14 builds, 3
  seeds) is about 30 minutes a difficulty. The tuning plan is affordable.
- MEASURED: the self-test alone and two self-tests side by side on this 4-core machine (issue 31).
- TESTED on master with the regression library (`tools/regress/lib.js`): Pause pressed, then a tile, then a
  pad, by mouse at 1600 x 900 and by a finger at 667 x 320: a tower is built and paid for while the game
  stays paused (issue 2 rests on this).
- The scripts and the picture of these runs are in `docs/specs/gameplay-review/`.
- NOT checked: nothing new was built. Every tower, Council and hero number is still a starting value. The
  history items marked CHECK still need a source read in the text audit.

What holds up and is kept as it is: the script map (a battlefield plays N steps of the 20-step script, pay
ahead), the legacy run, the records' `beyond` field, the tray that grows to seven with no loadout (a choice of
five from seven would be a rule made to save space, and the tray fits), the Garrison Post's rules, stars
counted from records, the free Council reset, towers opened by reaching battlefields, a second self-test
suite, the facts a battle keeps.

## Blockers

**1. Blocker. The battle's result never reaches the stats: `victory`, `defeat` and `battle_quit` are too
large for the server and are dropped.**
Evidence: the spec's own example of a battle's numbers (6.1) is 1,063 bytes as JSON (1,089 with a longer
battlefield id and a seventh kind of tower), with short names and small
numbers, and it holds nested objects and arrays (`trickLost`, `speedS`, `from`, `on`, `towers`, `tray`,
`spells`, `council`). `platform/schema.sql` line 584 skips any event whose props are over 1,024 bytes, without
an error, and the platform's 7.2 says props are flat. The spec's own test bound is "under 2 KB". Analytics is
the first thing the owner asked for, and win rate and "where players quit" are read from these three events.
Fix: `victory`, `defeat` and `battle_quit` carry the platform's contract props and a few flat extras only (at
most 500 bytes). The rest goes in one more event, `battle_facts`, sent right after: flat, short keys, numbers
and short strings only (a tray is `"a,b,c,f,d,p"`, a tower count is `n_archer: 4`), at most 900 bytes. A
self-test builds the worst case (Stepanakert 1992, every kind, six-figure gold, every counter in two digits)
and fails over 900 bytes or on any nested value in any gameplay event.
(Superseded: the platform's review fixed the same finding on the server, 4,096 bytes an event and one level
of nesting. The final spec adopts that and keeps one event with a size test under 3 KB. See the cross-check
at the end.)

**2. Blocker. The two specs disagree on the battle clock, and the gameplay spec's clock (wave time only, N3)
makes waiting the best play on every board.**
Evidence: `update()` runs `updateSpells(dt)` and `updateHero(dt)` in every phase (lines 12052 to 12053), so
the three spells (60, 75 and 100 s), the hero's healing and return, and under this spec the Call (60 s), a
mine's arming (22 to 28 s) and the men's return all recover between waves. With a clock that stops between
waves, the best score is to wait out every cooldown before every wave: up to 100 s of doing nothing, ten to
twenty times a battle, at no cost. The gameplay spec's two objections to the platform's clock do not hold:
(a) "a pause is the way to think for free": yes, and that is fair, because building works while paused
(`placeTower`, `upgradeTower` and the field's `pointerdown` handler have no pause test; only `startWave`
refuses), so every player on every device can think and build with the clock stopped; (b) "waiting at 2x costs
double": the cooldowns also recover double, so game seconds are the one honest unit.
Fix: adopt the platform's `simSec` unchanged: the sum of `dt` in `update` from the first horn to the last foe's
fall, waiting between waves included, pauses, menus and cards excluded. Withdraw N3. Say it to the player once,
on the Standard switch's line and under the boards: "The battle clock runs between waves too. Pause to plan."
The pars (`fast`, `slow`) are measured in this clock by the bot, which sends each wave 4 s after the last is
cleared.

## Majors: the seam with the platform

**3. Major. A first play is tagged `open`, so a new player never sees himself on the headline board.**
Evidence: 6.4 says a battle is `std` only "with the whole tray", and "a player who has not yet reached the
age's tower fights `open` there". A short tray is a handicap, not an advantage. Under this rule every first
victory from Tushpa to Stepanakert 1992 (where a tower is still to come) goes to the Open tab, and the first
Erebuni victory is the coached stand, which is never ranked. With sign-in required, the board is the reward a
new player was promised at the gate.
Fix: `std` means "nothing beyond the standard set": a tray that is the battlefield's tray or a part of it, no
Council tier in force, the hero at level 1, no gift of gold. Only what adds power makes a battle `open`.

**4. Major. A resumed battle is kept off the Standard boards, which sets "track where they left off" against
"a leaderboard".**
Evidence: 6.2 and N5 bar `resumed > 0`. The reason is real: `saveRun` writes the run as it stood at the horn
(`run.lives = waveStart.lives`, line 10674), so a reload gives back every defender lost in the wave and the
wave can be tried again. But phones drop a background tab within minutes, and the platform's welcome card
leads with "Resume". Most phone battles would be unranked.
Fix: a resume never improves a battle's numbers, so it can stay ranked. While a wave is on the field the run
also keeps `redo: { w, lost, sec }` (the defenders lost and the clock run in this attempt), written at each
loss and when the page is hidden. On a resume the wave is fought again from the horn exactly as today (the
campaign is as forgiving as it is now), the clock keeps `redo.sec`, and the battle carries a debt: when the
wave is cleared, the debt is what the dropped attempt lost beyond what the new attempt lost. The boards count
`lives - debt` (`lives_board`). Stars and records use `lives` as today. A resume between waves has nothing to
fight again and costs nothing. `resumed` stays in the facts as a count for the stats.

**5. Major. The cloud merge rule for `hs_council` undoes a reset.**
Evidence: 4.7 merges "per branch the larger number, then `councilSane()`", which drops "the highest tiers,
last branch first" when the cost is over the stars earned. A player who resets on the phone and moves his
stars from Bowmen to Stewards has, after the merge with the cloud's older copy, both at once; `councilSane`
then cuts Stewards first. The respec is silently reversed. A reset is free and stars are derived from records,
so nothing is lost if the newer choice simply wins.
Fix: `hs_council = { v: 1, own: {...}, n: <a count of its changes> }`; the merge is the value with the larger
`n` (a count, not a time: a device's clock cannot be trusted), then `councilSane()`. For `hs_heroes`, keep "the larger number" and also make the veteran's floor a
derived value, not a one-time write: `heroXp(ch) = max(stored, 300 x battlefields of that chapter already
won)`, so it is right whatever order the records and the heroes arrive in from the cloud.

**6. Major. A change to a Council or hero number empties the Standard boards, and a new tower on three
battlefields empties all seventeen.**
Evidence: 6.3 says `RULESET` rises "whenever ... a Council or hero number ... changes" and hashes those tables
into the pin, while 4.8 promises "a change to a Council number never moves one [Standard board]". Boards are
per ruleset (platform 5.2). The build order has at least six changes of rules (lengths and post, then five
towers), each on a few battlefields.
Fix: (a) `rulesetData()` holds only what a Standard battle is fought under; the Council's and the heroes'
tables get their own constant, `KITSET`, and their own pin, and a battle's facts carry `kitset`. (b) Ask the
platform for one more field: `levels[id].rev`, a small whole number per battlefield that rises when that
battlefield's rules change, and boards keyed by it (`c:<level>:<diff>:<loadout>:<rev>`), so Horse Lines
restart three boards, not seventeen. If the platform declines (b), every tower release restarts every board,
and the owner should know before choosing the release split.

**7. Major. The daily's twist list cannot leave a pair out, one twist is not the same for everyone, and one
has nowhere to ride.**
Evidence: 6.4 leaves "a (battlefield, twist) the bot's mix cannot win" out of "that battlefield's twist list",
but the platform picks the twist from one list by the day alone (5.6), in the page and in SQL, and the server
refuses a run whose twist is not the day's. `ban` strikes "one of ballista, catapult, fire, drums" without
saying which. `dusk` "may ride with any other twist", and the platform has one twist a day.
Fix: (a) `rulesetData().daily.skip = { "<lv>": ["twist", ...] }`, made by the bot; the pick, in the page and
in SQL, steps to the next twist in the list while the pair is in `skip` (N10). (b) `ban` becomes three twists
with fixed names, `noballista`, `nocatapult`, `nodrums` (a battlefield whose watch slot is the drums skips
`nodrums`; the fire slot is never struck). (c) `dusk` is cut.

**8. Major. A daily is "one sitting, never saved", three attempts, on any of 17 battlefields: up to 40
minutes at 1x on a phone that may drop the tab.**
Evidence: 1.2's own times (Sis 40, Stepanakert 1992 38, Van and Sardarapat 35); the platform spends an attempt
at the first horn and does not save a daily.
Fix: every daily is a 12-wave stand: `startDaily` plays `SCRIPT_TABLES[12]` on every battlefield (Avarayr's
own 12-step table keeps its ambush rule). That is 15 to 26 minutes at 1x on 16 battlefields and 31 on
Stepanakert 1992, half that at 2x, and it comes free with the script map. The ruleset gains `daily.waves: 12`
and the daily's own `fast`, `slow`, `earnMax` per battlefield (bot tables). The daily therefore lands after
the script map in the build order. Sis counts its days by script wave, so its last wave is still day 60.

**9. Minor. N6 is not needed.** A daily board holds one battlefield a day, so `wave / waves` and
`script / 20` rank a day's losses in the same order. Drop N6; the platform's formula stands.

**10. Major. The Council page is laid out for a page it does not have.**
Evidence: 4.6 gives the phone "the left 470 px" for the tree and a 170 px strip (640 px) with "two 44 px
buttons in the header" for tabs. But the page is a tab of the platform's Hall, which on a phone held sideways
keeps a 64 px column of tabs at the left (platform 5.5). On an SE that leaves about 580 px.
Fix: the tree's five columns share what is left after the strip: pitch `(W - 170) / 5`, 78 px at the least (44
px medallions), so it fits a content box of 560 x 280 px. `iphone.js` holds it at the three sideways sizes.
(The platform's review ships the Hall's shell in P0, so gameplay needs no page of its own.)

**11. Minor. `slow` means two things.** The platform's `S` is "0 at par or slower"; 6.2 sets
`slow = 1.4 x parS` so that "a battle at par earns half the speed points". Keep gameplay's numbers (a par
battle earns half) and change the platform's sentence to "0 at 1.4 times par". Both pars are measured with the
standard loadout.

## Majors: balance and fairness

**12. Major. The game should be tuned on the Standard loadout, not on PAR.**
Evidence: 4.8 and 5.2 measure every band "with the PAR kit" and then raise `hpTune` "across the board" so the
bands hold at PAR. Consequences: (a) a fourth full round of tuning; (b) the Standard battle, which is what the
boards and the daily are, is then harder than the owner's bands and was never tuned itself; (c) a player who
wins with one star meets a harder game than today's, which is the opposite of "no grinding"; (d) the Council
could not ship before the lengths, the post and the towers are tuned.
Fix: the owner's bands (5.1) are measured with `KIT=none` and the whole tray: one reference game, the one the
boards, the daily and the pars use. Progression is a bounded bonus on top: with the PAR kit the best build
keeps at most 2 more defenders than with none (mean over the 17 on Normal) and with the CAP kit at most 4, on
no battlefield more than 6; on Hard at CAP the best build still loses some seeds. If a tier breaks a bound the
tier's number is cut. This removes a tuning round and lets the Council ship on today's battles with no retune.

**13. Major. The first tuning step cannot work as written on the first six battlefields.**
Evidence: 5.3 puts `hpTune` first and 5.6 expects "to raise the short battlefields by 5% to 15%". The game's
own record says the opposite (comment over `LEVEL_HP`, line 9265 on; `tools/balance.js` header): "Hit points
alone never made the first six hard for a good build: foes 1.8 times as strong ... did not cost the balanced
mix a life on Tushpa, Avarayr or Sevan"; their pressure is the tricks, the adaptive enemy and their economies.
All six are shortened and come out 3 to 6 lives easier in the prototype.
Fix: for the first six the order of knobs is (1) the tricks' counts and shares (`L.tricks`: the ambush share,
scouts' and hunters' counts, `from`), (2) `L.tricks.econ`, (3) `hpTune` and Erebuni's `hpFrom` as fine tuning.
For the later eleven the spec's order stands. Mari gets its own line: it came out harder (the mix won 1 of 7
and kept 1), because its second road now opens on wave 8 of 12 with the commander still to come; its
commander column and the road's `from` are tuned before anything else there.

**14. Major. The first battle a new player fights brings five new kinds of foe in two waves and a commander
on the next.**
Evidence: Erebuni's table `[1,2,3,5,8,10,13,15,18,20]` with `waveGroups` (line 9224): wave 4 (script 4 and 5)
brings shieldbearers and horsemen for the first time; wave 5 (script 6 to 8) brings rams, outflankers and
hidden scouts for the first time; wave 6 is the commander. Today each comes on its own wave between 4 and 7,
and the commander on wave 10. This is the battle the sign-in funnel ends in.
Fix: Erebuni's own table, `script: [1,2,3,4,6,8,10,13,16,20]`, and its scouts from script wave 7: wave 4
shieldbearers; wave 5 horsemen and rams; wave 6 outflankers and scouts; wave 7 the commander; wave 10 the
pair. A self-test holds the rule on Erebuni: no wave brings more than two kinds not seen before.

**15. Major. Commanders now arrive with outflankers.**
Evidence: outflankers come on the script's odd waves (`w >= 7 && w % 2 === 1`), never on 10 or 20. With "a
role keeps the entry with the most foes" over the covered waves, a commander's wave that covers script 9 or 19
takes that wave's outflankers: the first commander on the 10, 11, 13 and 16 tables and Avarayr's; the pair on
the 10 to 14 tables (eight outflankers with the two commanders on Erebuni, Tushpa, Avarayr, Dvin, Tashir,
Mari, Gyumri Road, Halidzor and Stepanakert 1992). A commander at the walls costs 10 defenders. The spec
names the outflankers' greater frequency but not this.
Fix: a played wave that brings a commander takes its outflankers from its own script wave only (so none,
outside the drone war and Ani's raiders). `coveredWaves` still gives it the largest ram count.

**16. Minor. An early call gives up two or three waves' pay on a short battlefield.** `startWave` forfeits
the pending clear's bonus, the interest and the mend (line 11052 on); with pay ahead those are multiplied by
`payStep` while the early bonus (60 at most) is not. Fix: the early bonus of a wave is also times
`payStep(w)`.

## Majors: towers and heroes

**17. Major. Horse Lines can pin the rank and file for good.**
Evidence: every Horse Lines throws every ground foe on its stretch, with no limit on how often one foe is
thrown. Six Harriers over one stretch throw 300 px every 7 s, about 43 px a second, against a shieldbearer's
44 and a horseman's 105 x 0.4 under a fire's slow. Nothing in the spec stops it, the adaptive enemy has no
answer, and the endless board on three battlefields would belong to it.
Fix: a foe that has been thrown cannot be thrown again for 8 s (`e.thrownT`; it is still struck); at most two
Horse Lines on a field ("Two horse lines are all this field can stable."); a bot build `harriers` (two Horse
Lines, fires, drums) must lose on Normal on two of three seeds, and an endless stand with it must fall
between waves 8 and 20 beyond the chronicle like any other.

**18. Major. The Dressing Station makes men who cannot fall, and sells stars.**
Evidence: (a) it heals men "even in combat" at up to 44 a second; a Shield Wall man holding two shieldbearers
on the last wave takes 2 x 11 x 1.95 x 0.65 = 28 a second. He never falls, so eight foes a post stand still
for ever. (b) It returns up to 7 of 20 defenders; three stars need 17 kept and the band on these battlefields
is 10 to 15 kept: a passive building turns two stars into three, and stars are the currency of the Council and
the boards' largest term (3,000 points). The spec's own target ("at most 3 more lives") contradicts its
numbers. (c) History and the emblem: the hospital at Van was the American mission's, a neutral house that the
game's own text says was shelled; a tower of the defenders "like" it blurs that. A red cross on a white flag
is a protected emblem; its use on a game building invites a complaint.
Fix: (a) the station never heals in combat: men and hero in its range begin to recover after 1 s out of
combat, not 3, at twice the pace, and fallen men return sooner. (b) Returned defenders keep the walls manned
(they count against defeat) but stars, records and the boards count the defenders never lost
(`lives_max - lost`); the card says "Stars count the defenders you never lost." Caps 2, 3, 4 and 5 (Surgeons).
(c) Its name is "Aid Post" on all three battlefields, `depicts` "A room behind the lines where the wounded are
bandaged", marked INVENTION as a tower; no red cross (a plain white cloth and a lantern); Van's card may add
the sourced sentence about the American hospital as history, not as the player's building.

**19. Major. The Market is too small to be a decision and still large enough to be a trap.**
Evidence: the target is "150 to 250 gold ahead at the end" on boards worth 11,000 to 13,000: under 2%, for a
pad, 120 gold in the first third and the risk of a hunter. A good player will skip it and a new player who
builds two "loses" (5.5).
Fix: make the stake real and the cost early. Target: "greedy" (one market as the third building) ends with 6%
to 10% more gold invested than "mix", loses 1 to 2 more defenders than "mix" by the first commander's wave,
and ends within 2 of it; "bazaar" (two markets first) ends below "mix" on at least four of the six. Starting
values rise to pay 22, 34, 48 and Caravan 62. The family's name becomes "Stores" (Granary, Stores, Royal
Stores): a market trading through the storming of Dvin reads badly, and every fortress had stores.

**20. Major. The Observation Post is an automatic purchase.**
Evidence: 390 gold for "60% of everything the board deals" to both commanders of the last wave (two marks at
rank 3), where a commander at the walls costs 10 defenders. No other 390 gold comes near it, so tuning must
either make it required or cut it to nothing.
Fix: start at 15%, 20%, 25% (masteries 25%); a mark on a commander counts half; one post on a field. Target:
with it the best build keeps at most 2 more defenders; it is in the best build on at most two of the three
battlefields.

**21. Major. A hero's level starts again four times in a campaign and takes the Call with it; and three new
systems land on the second battlefield.**
Evidence: 4.4 and 4.8: the Call comes at level 2 and experience is per age, so the Call is lost at Dvin,
Gyumri Road, Van and Stepanakert 1992. After Erebuni a player meets the Council (first stars), the Garrison
Post (Tushpa) and the Call (level 2 at Tushpa) at once. Ages are a second grouping beside the five chapters
the map, the stories and the Council's tiers already use; their ids collide with the chapters' (`crowns`,
`artsakh`); and "Bronze and Iron" names the age of Avarayr, AD 451, which is neither.
Fix: (a) experience is kept per chapter (the grouping players know; D5's "heroes from each era"). First-play
levels become 1, 2, 3 in Chapters I, II and V and 1, 2, 3, 4 in III and IV. (b) The Call is opened by the
campaign, once, for every hero at every level: when Dvin opens (Chapter II). Levels make it stronger. New
things then come one a battlefield: Council, post, Horse Lines, the Call, Stores. (c) Ages stay an internal
table that says which battlefields offer which tower; no age is named to the player and the internal ids are
`a1` to `a5`. (d) The Call belongs to the kit, like a level: a Standard battle and a daily are fought with
today's hero (level 1, no Call), so shipping the heroes changes no Standard board.

**22. Minor. The Call by "a second press of the medallion" will be sounded by accident,** since today a
second press lets the hero go. Fix: while the hero is chosen and the Call is ready the medallion shows a horn
and the word "Call"; a press within 0.4 s of the choosing press does nothing; when the Call is not ready a
second press lets him go as today.

## Majors: scope and order

**23. Major. The build order is not the owner's, and the platform waits on the largest tuning job.**
Evidence: the owner's words: "start with analytics and the progression system". 9.1 starts with the lengths
and their retuning (17 battlefields, three difficulties), puts the hooks third and the Council fifth. The
platform's analytics (its P4) needs gameplay's `track` calls for the funnel.
Fix: (G1) the hooks, the battle's numbers and `rulesetData()` on today's game, no rule changed; (G2) the War
Council; (G3) hero levels and the Call; (G4) the script map and lengths, retuned; (G5) the tray and the
Garrison Post; (G6) the daily; (G7a to e) one tower at a time. Each ends playable, tested and shippable.
Issue 12 is what makes G2 and G3 possible before G4. Releases: R1 = G1, R2 = G2 and G3, R3 = G4 and G5
together (one change of rules), R4 = G6, then a tower a release. Because three releases now come before the
lengths change, the "legacy run" of 1.7 becomes a general rule: a saved run carries `rules`, `kit`, `script`
and `tray` and finishes under what it began with.

**24. Major. Cut from the first releases.** The Captains tab (the hero's level, bar and Call are a strip at
the foot of the Council page and a line on the chronicle: one gameplay tab in the Hall, not two); the five
per-chapter Calls (one Call, Stand Fast, until players ask for more); experience for the hero's own kills and
for the endless stand (two more rules for a few points); the events `foe_card`, `brief_page`, `speed_set`,
`auto_set` (the speeds are in the facts); the twists `pair`, `wary`, `press`, `sappers`, `scouts` until the
first six have run a month.

## Minors

**25. Minor. `getStats` should apply the kit itself.** 4.3 adds `towerStats(t)` that "every reader" must
call; there are 24 call sites of `getStats(`. Keep one name: `getStats(t)` returns the kit's numbers (cached
per kind, rank and mastery, dropped in `resetGame`), and the raw table is `rawStats(t)` for the few places
that need it. No reader can be missed.

**26. Minor. Short names by measure, not by count.** The rendered tray shows the limit is the 82 px name box,
about 17 characters, not 13. Rule: a tile shows the full name if it fits (`scrollWidth <= clientWidth`), else
`short`, else no name. Fewer short names to write and to audit.

**27. Minor. The twist `sappers` with the look `pick` puts men with picks on the fields of 1915 to 2023.**
When it returns (issue 24), the hunters' look and name come from a table by age.

**28. Minor. `power` in the facts is not defined.** It is the stars' worth of Council tiers in force.

**29. Minor. Section numbers.** 1.6 to 1.8 are referred to as 1.7 and 1.8 in several places. Fixed in the
final.

**30. Minor. One control, two pips.** The tally carries gameplay's "stars unspent" pip and the platform's
"daily unplayed" dot. One dot; the title says which; the Hall opens on the Council tab when stars are unspent,
else on Daily.

**31. Minor. Two suites side by side.** See the measurement at the end of this file. The rule in the final:
each suite's budget is its own clock when run alone; `--suite=all` runs them side by side only if that was
measured not to slow suite 1 past its budget, else one after the other.

**32. Minor. History notes for the text audit.** "Horsemen of Biainili": Urartian horse and chariots are in
the kings' annals but not yet in the repo's dossier: a source line must be added or the name becomes
"Horsemen". Musa Dagh's aid post: INVENTION unless sourced. "Bayonet Charge" at Sardarapat: CHECK stays. The
Powder Mine's card sentence ("Mines of powder were the siege craft of the age") needs one source. No new foe
unit is added, and no new name speaks of a people.

**33. Minor. A newcomer's first daily can be a late battlefield** (the pool is all 17, open to anyone who
has fought Erebuni). It is the same for everyone and a loss still scores, so it is left as it is; the owner
may prefer a pool of the first ten until the game has more players (an open point).

**34. Minor. The lengths of 1.2 sum to 245, not 246.**

**35. Minor. A hero's level lengthens his hold on a commander.** Today the hero holds any ground foe within
32 px, a commander included, until he falls (`hero.engaged`, line 10535; `HERO_DPS.boss` is 34 a second, so
about 12 s of 400 strength, then 20 s away). At level 5 (700 strength, back in 14 s) and with Stand Fast's
half damage that hold nearly doubles, on the foe that costs 10 defenders. Fix: a commander's blow on the
hero rises with the hero's level (34, 39, 44, 51, 60) and Stand Fast does not halve it.

**36. Major (it completes issues 2 and 4). A reload makes every spell ready.** `runRecord` (line 10641) saves
no cooldown, and `resumeRun` begins from `resetGame`, so after a reload the three spells are ready and a
fallen hero is back. With a clock that counts waiting, a reload between waves is then the free way to wait
out the cooldowns. Fix: the run keeps `cd` (the spells' clocks, the Call's, the hero's strength and seconds
to return, a mine's arming) as they stood at the save, and a resume restores them.

## Cross-check with the platform's review

`docs/specs/platform-critique.md` was written at the same time, against the same first version of the
gameplay spec, and its issue 17 settles seven seam points. Read against this critique:

| Point | The platform's review | This review | In `gameplay.final.md` |
|---|---|---|---|
| Event size (issue 1 here, 6 there) | The same finding; fixed on the server: 4,096 bytes an event, one level of nesting, `battleFacts()` under 3 KB | A split into two flat events under 900 bytes | The platform's fix is adopted: one event, a size test under 3 KB. The split is dropped. |
| The battle clock (issue 2 here, 17a there) | Grants gameplay's first request: wave time only | The request was wrong; waiting must count | DIFFERS. The final withdraws the request (N3). Must be settled again. |
| A lost daily (issue 9 here, 17b there) | By script wave, read from the table in the ruleset | `wave / waves` is enough for one battlefield a day | Either; the daily's table is in the ruleset (N6). |
| Twists a battlefield may get (issue 7 here, 17c there) | `daily.skip`, the pick walks on | The same | Agreed. |
| Who is ranked (issue 4 here, 17e there) | A run with a wave fought twice arrives `open` | It stays `std`; the worse attempt counts | DIFFERS (N5). Must be settled again. |
| The Hall (issue 10 here, 17f there) | Its shell ships in P0 and works under the harness: one page | The Council panel must fit the Hall's box | Agreed; gameplay builds no page of its own. |
| The daily's dice (17g there) | `startDaily(levelIndex, twistId, day)` | Not raised | Adopted. |
| The newer of two saves | The platform's stamp, not a device clock | `hs_council` stamped with a time | The final uses a count of changes (`n`), not a time (issue 5). |
| The phone's victory page | Full to the pixel: no new row | Not measured | Adopted: one line of text there. |

New asks the platform's review has not seen: a battlefield's `rev` in the board key (issue 6), the daily's
12 waves and its own pars (issue 8), `lives_board` for the boards (issue 4), saved cooldowns (issue 36, a
gameplay change with no platform part).

## Rejected on reflection (not issues)

- A loadout chosen before battle. With seven kinds at most and a tray that fits, it would be a rule made to
  save space. The decision is on the pads: 14 pads, seven kinds, two of which are capped.
- Tying each new tower to a chapter. The towers follow how war was fought (a powder mine in 1041 or an aid
  post in 1727 would be wrong), so the internal table by age stays.
- A single hero level for the whole campaign. Simpler, but D5 says heroes of each era level up.
- Making the campaign forbid a wave to be fought again. The campaign stays as forgiving as it is; only the
  boards count the worse attempt (issue 4).

## Measurement for issue 31

`node tools/selftest.js` on master, this machine (4 cores), wall time from launch to result:

| Run | Wall time | Result |
|---|---|---|
| One self-test alone | 117 s | 151 checks pass |
| Two at once, first | 121 s | 151 checks pass |
| Two at once, second | 120 s | 151 checks pass |

Two pages side by side cost each about 3% (3 to 4 s). So the spec's plan works here, with 4 s to spare under
125 s, and no more than that: a machine with two cores, or a suite 2 that draws more than suite 1, would push
suite 1 over. The budget is not enforced anywhere today (`tools/selftest.js` only has a 180 s page timeout),
so the final spec adds the check to the runner and keeps the fallback of running the suites one after the
other.
