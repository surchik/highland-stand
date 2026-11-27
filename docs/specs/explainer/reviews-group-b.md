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
