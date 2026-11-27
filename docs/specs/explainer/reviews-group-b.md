# Independent reviews of the explainer videos, group B

The films of Van, Musa Dagh, Sardarapat, Stepanakert (1991 to 1992), Shushi and Stepanakert (2022 to 2023), made the way the first four were (reviews.md). The goal set for this group: every cut scores 8 or more in every category (history, pacing, picture, sound, subtitles) from two fresh, independent reviewers.

How a round works is as in reviews.md: tools/explainer/review.sh makes each cut's review pack and asks two fresh `claude -p` sessions, given only tools/explainer/review-brief.md, the pack and read access to the repository, to score it. The defects below are theirs, shortened.

What this group adds to the tools, without changing what the first four use: its scripts, sources and pictures sit in files of their own (scripts-b.json, sources-b.json, films-b.js), which tts.py, measure.py, gen-docs.py and films.js add to their own; build.py has each battlefield's music bed (the battlefield's own opening tune in the game, REC_OPEN); film-page.js can draw a flag of three bands on a page (the First Republic's tricolor); tools/regress/film.js reads the page's own list of films, so a film made and not yet wired in is checked for its files without failing the run.

The history of these battlefields is told only from their own texts in index.html (chronicle, tag, hero, date, facts, victory text) and the chapters' stories, in their own words for the Genocide, the wars and the events of 2023: docs/history has nothing on them.

## Round 1

The Van cuts, the first built.

| Cut | Reviewer | History | Pacing | Picture | Sound | Subtitles |
|---|---|---|---|---|---|---|
| van-landscape | a | 9 | 9 | 7 | 9 | 9 |
| van-landscape | b | 9 | 9 | 8 | 9 | 9 |
| van-vertical | a | 9 | 9 | 7 | 9 | 9 |
| van-vertical | b | 9 | 9 | 7 | 9 | 9 |

Lowest score of the round: 7.

What the reviewers found (the points that cost marks):

- Picture: 'the besiegers began to pull back' over foes still marching on the citadel; the shelling of the mission and the hospital spoken over 6.7 s of one painting, the same painting as the walled city, its smoke soft at that zoom; 'until the riders come' over the enemy's riders (the battlefield's Kurdish irregular riders); an arrow for the relief's road, which no source gives; Aram Manukian's plaque in the upright cut, whose voice never names him; map labels cut by the frame's edge; a 0.4 s shot between the map and the last battle.
- History: 'Van's Armenians understood what was coming' follows the demand for 4,000 men alone, where the chronicle also tells of Ishkhan's murder and Vramian's arrest (sound, but compressed; scored 9).
- Sound: Djevdet heard as 'Gevdet', Aygestan as 'Agistan'.
- Subtitles: 'the walled / city' and 'Hold every wall until / the riders come' broken mid-phrase.

What was changed after this round:

- The besiegers' pulling back is a quiet field; the relief is the map closing on Van with its date, no road drawn; the homes under fire a different part of the painting, then the guns firing on the citadel for the mission and the hospital, each with its plaque; the last battle has foot soldiers only; the upright cut opens on the field with the plaque of the two committees and keeps the hero for the fighters; the map framed so no label is cut; the short shot is gone.
- The two line breaks set by hand.

## Round 2

The Musa Dagh cuts. The upright cut passed every score.

| Cut | Reviewer | History | Pacing | Picture | Sound | Subtitles |
|---|---|---|---|---|---|---|
| musadagh-landscape | a | 10 | 9 | 7 | 9 | 10 |
| musadagh-landscape | b | 9 | 9 | 8 | 9 | 9 |
| musadagh-vertical | a | 9 | 9 | 8 | 9 | 9 |
| musadagh-vertical | b | 9 | 9 | 8 | 9 | 9 |

Lowest score of the round: 7.

What the reviewers found (the points that cost marks):

- Picture (landscape): the coast painting, with the rescue banners on the summit and the cruiser offshore, shown for the mountain and for 'Most villagers refused to go', before the banners were sewn; the field's skyline carries the banners too; 'Toward the desert' written over the chart's Euphrates; seven seconds of one banner shot and four of the ship, near still; 'five French ships' over one ship; marching foes in the bottom fifth.
- History: the five ships came from 12 September, a week after the Guichen saw the signals; the line ran the two together. In the upright cut, 'French ships saw the signals' where the sources name the one cruiser (scored 9).
- Subtitles: 'and dug in.' alone as a cue.

What was changed after this round (landscape):

- The villages and the climb are shot low on the field, under its skyline; 'Most refused to go' is the green slope of the painting without banners or ship; the banners in two shots, the cross and then the lettered one; the ship with a longer push; the line now says 'From 12 September, five French ships' and a page carries it ('Five French ships', about 4,000 carried to Port Said); the desert label clear of the Euphrates; the foes on the upper road.

## Round 3

The Van cuts rebuilt with round 1's fixes. Both passed every score.

| Cut | Reviewer | History | Pacing | Picture | Sound | Subtitles |
|---|---|---|---|---|---|---|
| van-landscape | a | 9 | 9 | 8 | 9 | 10 |
| van-landscape | b | 10 | 9 | 8 | 9 | 10 |
| van-vertical | a | 10 | 9 | 8 | 10 | 10 |
| van-vertical | b | 10 | 9 | 8 | 10 | 10 |

Lowest score of the round: 8.

What the reviewers found (each scored 8 or 9, left as they stand or noted for later):

- Picture: smoke already rises over the city in the field's skyline and the walled-city painting before the voice says the guns opened; the walled-city painting serves twice; the plaque for the mission and the hospital lies over the guns, not over a mission; the besiegers' pulling back is a quiet field with nothing moving away; in the upright cut the relief is a still map.
- History: 'understood what was coming' follows the demand alone (the chronicle also has Ishkhan's murder and Vramian's arrest).
- Sound: Djevdet and Aygestan still heard as 'Gevdet' and 'Agistan'; the pace with pauses 128 words a minute.

## Round 4

The Sardarapat cuts. The upright cut passed every score.

| Cut | Reviewer | History | Pacing | Picture | Sound | Subtitles |
|---|---|---|---|---|---|---|
| sardarapat-landscape | a | 8 | 9 | 7 | 8 | 9 |
| sardarapat-landscape | b | 8 | 9 | 7 | 8 | 9 |
| sardarapat-vertical | a | 10 | 10 | 8 | 9 | 8 |
| sardarapat-vertical | b | 9 | 9 | 8 | 9 | 8 |

Lowest score of the round: 7.

What the reviewers found (the points that cost marks):

- History: the plaque of the bells said they rang, where the voice and the sources say 'tradition holds'; 'drove the Ottoman troops back' on 22 May, where the chronicle says over the next days.
- Picture (landscape): the bells were a small belfry on an empty plain, near still for six seconds; seven seconds of the same Ararat painting under 'refugees from the Genocide'; the gathering of regiments, villagers and Jangir Agha's horsemen over a field of towers; foes advancing while the voice says they were driven back; the Republic's page up 5.8 s; the map naming only Sardarapat of the three May battles.
- Sound: Sardarapat heard as 'Sardar Pot' (its third vowel reduced), Karakilisa as 'Karakilasa'.
- Subtitles: 'On 22 May the Armenians / counterattacked' lopsided; in the upright cut a cue of three lines (scored 8).

What was changed after this round (landscape):

- The line reads 'and over the next days drove the Ottoman troops back', and the map draws the push westward from Sardarapat (the chronicle: back westward); the bells' plaque says 'By tradition'; the belfry is filmed close; the refugees have a page of their own over the painting; the May battles' map writes Bash Abaran and Karakilisa where they lie; the Republic's page gives way to the last battle as its line ends; Sardarapat's full vowels restored; read at 1.1.

## Round 5

Musa Dagh landscape, rebuilt with round 2's fixes. It fell back.

| Cut | Reviewer | History | Pacing | Picture | Sound | Subtitles |
|---|---|---|---|---|---|---|
| musadagh-landscape | a | 10 | 8 | 6 | 9 | 9 |
| musadagh-landscape | b | 10 | 7 | 5 | 9 | 10 |

Lowest score of the round: 5.

What the reviewers found (the points that cost marks):

- Picture and pacing: the page of the five ships stayed up for 12 s, over the mountain's last line and the closing call, and the shots meant to follow it never came: they were placed at a part of the sentence that does not exist (the sentence has three subtitle parts, the picture asked for a fourth), so the build put them after the film's end, and the '53 days' plaque with them.
- Picture: the order for deportation, a still page for 5.2 s.

What was changed after this round:

- The shots and the plaque are placed at the sentence's real third part; the page's lines come with 'carried about 4,000 Armenians to Port Said'; the deportation page comes up a second into its sentence. A check now runs over every film of the group before a build: every place a scene, a plaque or a page line is pinned to must be a part its sentence has. The same check found that a mark drawn on a chart part way through a film (an arrow, a label) was timed from the film's first sentence, so it was drawn at once instead of growing with the words: every such mark is now timed from its own scene's words.

## Round 6

The Stepanakert (1991 to 1992) cuts.

| Cut | Reviewer | History | Pacing | Picture | Sound | Subtitles |
|---|---|---|---|---|---|---|
| stepanakert92-landscape | a | 9 | 9 | 7 | 9 | 9 |
| stepanakert92-landscape | b | 9 | 9 | 7 | 9 | 9 |
| stepanakert92-vertical | a | 10 | 9 | 7 | 9 | 10 |
| stepanakert92-vertical | b | 10 | 9 | 8 | 9 | 10 |

Lowest score of the round: 7.

What the reviewers found (the points that cost marks):

- Picture: 'attacked Shushi up the cliffs and roads' over the game's battle, in which the foe marches on Stepanakert: the staging ran the wrong way (both cuts); in the upright cut 'the town was taken' over the plateau still firing; Shushi's plate on the map in the bottom fifth, and Stepanakert's plate jumping from below its pin to above it between two shots; the 1988 page up 7.6 s; the opening plaque of the upright cut three seconds after its words; half the upright frame empty snow.
- History: '1988' set over 'Every side lost civilians', as if the losses were of 1988 (they are of the war that grew from it); the chart's 'Lachin corridor' label on a map of 1991, before the corridor was opened.
- Sound: Stepanakert heard as 'Stepan Akert', a break inside the name.
- Subtitles: 'Families moved into basements, and / the city lived' (the build joined two parts too short to read and the only break left was after 'and').

What was changed after this round:

- The night of 8 May is the field at night and then the hero, Arkady Ter-Tadevosyan, walking out from the city; 'up the cliffs and roads' climbs the painting from the forest to the cliffs and the cathedral; 9 May is the field by day; the upright cut names Shushi on the map for 'the town was taken'; Shushi's plate stands above its pin and to the side; the map is framed close enough to leave the corridor's label out; the 1988 page carries only the movement, and 'every side lost civilians' has its own plaque over the quiet field at night; the opening plaque comes with its words; the rockets on the houses filmed close.
- Stepanakert given with its middle vowels reduced, so the name runs as one word.

## Round 7

Sardarapat landscape, rebuilt with round 4's fixes.

| Cut | Reviewer | History | Pacing | Picture | Sound | Subtitles |
|---|---|---|---|---|---|---|
| sardarapat-landscape | a | 9 | 9 | 8 | 9 | 9 |
| sardarapat-landscape | b | 9 | 9 | 7 | 9 | 9 |

Lowest score of the round: 7.

What the reviewers found (the points that cost marks):

- Picture and history: on the chart the Sardarapat pin sits on the peak of the chart's Mt. Ararat, so the field reads as on the mountain, where the sources put it on the plain beneath it; its plate covers the mountain's label.
- Picture: the belfry shot still near still, its lower half in the bottom fifth; Yerevan, named twice, never marked.
- Subtitles: 'beneath Ararat,' alone for 0.9 s between two longer cues.
- Sound: 'pushed' heard as 'push', 'battles' as 'battle', at speed 1.1.

What was changed after this round:

- No chart after the opening: 'drove the Ottoman troops back' is the hero carrying the line west across the field, and the May battles are named on a plaque over the painting of the plain under Ararat; the belfry shot travels from the plain to the bell and sits above the subtitles; the line reads 'On 22 May the Armenians counterattacked beneath Ararat', in two cues.

## Round 8

Shushi landscape. It passed every score.

| Cut | Reviewer | History | Pacing | Picture | Sound | Subtitles |
|---|---|---|---|---|---|---|
| shushi-landscape | a | 9 | 10 | 8 | 8 | 10 |
| shushi-landscape | b | 9 | 9 | 8 | 9 | 9 |

Lowest score of the round: 8.

What the reviewers found (each scored 8 or 9; left as they stand):

- History: the opening pin on Shushi carries the war's first date, 27 September 2020, though the offensive ran along the whole line of contact and Shushi's own fighting came in November; 'On 9 November a statement ended the fighting' (signed on 9 November, the fighting ended from 10 November).
- Picture: the page of the statement up 5.9 s; the cathedral is the chronicle's painting, not a likeness of Ghazanchetsots.
- Sound: Bayraktar heard as 'Biroc tar'.
- Subtitles: 'loitering / munitions' broken mid-phrase.

## Round 9

Stepanakert 2023 landscape.

| Cut | Reviewer | History | Pacing | Picture | Sound | Subtitles |
|---|---|---|---|---|---|---|
| stepanakert23-landscape | a | 10 | 8 | 7 | 10 | 9 |
| stepanakert23-landscape | b | 10 | 9 | 8 | 10 | 10 |

Lowest score of the round: 7.

What the reviewers found (the points that cost marks):

- Picture: the page of the International Court of Justice up 9.5 s; 'BLOCKED' written on the corridor inside the bottom fifth as the voice names it; the exodus shows cars where the plaque said 'cars, trucks and buses'; the volunteer's shot cut after 1.5 s while his plaque stayed on over the city.
- Pacing: 121 words a minute with pauses, below the documentary pace.
- Picture (scored 8 by the other reviewer): field shots of towers for the Red Cross and the bread queues.

What was changed after this round:

- The court's line opens on the painting of the city with its date, and the page comes with 'ordered Azerbaijan' (about 5 s); the corridor is framed so 'Blocked' stands clear of the subtitles; the exodus plaque reads 'The open corridor to Armenia'; the volunteer stays on screen into the last line; read at 1.08.

## Round 10

Musa Dagh landscape, rebuilt after round 5. It passed every score, so both Musa Dagh cuts have passed.

| Cut | Reviewer | History | Pacing | Picture | Sound | Subtitles |
|---|---|---|---|---|---|---|
| musadagh-landscape | a | 10 | 9 | 9 | 9 | 10 |
| musadagh-landscape | b | 10 | 10 | 8 | 9 | 10 |

Lowest score of the round: 8.

What the reviewers found (each scored 8 or more; left as they stand):

- Picture: the five ships' page up 5.9 s (its lines keep it moving until 51.6 s); a tent of the painting's camp cut by the frame's edge in the banner shots; the cruiser drawn as a liner; the villages and the climb shown on the field without people or flocks; three short shots in a row around 'Most villagers refused to go'.
- Sound: 'refused' heard as 'refuse'; the last 'Musa Dagh' heard as 'Musa Dagg'.

## Round 11

Stepanakert 2023 upright. It passed every score. (A first attempt at this round, for Shushi upright, found no film to review: its render had failed under the machine's load and the build had gone on. The build now tries a failed render once more, and that cut was rebuilt.)

| Cut | Reviewer | History | Pacing | Picture | Sound | Subtitles |
|---|---|---|---|---|---|---|
| stepanakert23-vertical | a | 10 | 9 | 8 | 10 | 10 |
| stepanakert23-vertical | b | 10 | 9 | 8 | 10 | 9 |

Lowest score of the round: 8.

What the reviewers found (each scored 8 or more; left as they stand):

- Picture: Stepanakert's plate cut by the frame's edge as the map pans to the corridor; 'Food, medicine and fuel ran short' over the citadel and its armed volunteer, nothing showing the shortage; the convoy running into the bottom fifth, and a 1.9 s look at it between two maps.
- Pacing: 126 words a minute with pauses.
- Subtitles: 'In September 2023, / a final offensive' | 'forced the surrender of Artsakh.' parts subject from verb.
