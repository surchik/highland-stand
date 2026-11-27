# Independent reviews of the explainer videos, group A

The battlefields of group A: Tashir, Sevan, Ani, Mari, Sis, Gyumri and Halidzor, each in two cuts (landscape about 60 seconds, upright about 30). The rounds of the first four battlefields are in reviews.md; these films were made with the same tools and the lessons recorded there.

The rule here: two fresh, independent reviewers score every cut on history, pacing, picture, sound and subtitles, each out of 10, and the cut is fixed and reviewed again until every score from both reviewers is 8 or more.

How a round works is as in reviews.md (tools/explainer/review.sh and review-brief.md): for each cut a review pack (the mp4, the .vtt, contact sheets, full frames, subtitle previews, the script with its sources, the measures, the timelines of scenes, sentences and cues), and two new `claude -p` sessions that have seen nothing of the making score it. The defects below are theirs, shortened.

The group's scripts are in tools/explainer/scripts-a.json, their sources in sources-a.json and their pictures in films-a.js, merged by the tools into the main files' (tts.py, measure.py, film.js, build.py, gen-docs.py), so the first four films are built exactly as before.

## Round 1

Tashir, both cuts: the first build, made with the lessons of reviews.md already in it (a title of 2.6 s before the voice, cards under about five seconds with their lines coming with the words, a page of the chronicle where the game has no picture of the place, no claim of a battle in Tashir's gorges, which no record names). Both cuts passed every score.

| Cut | Reviewer | History | Pacing | Picture | Sound | Subtitles |
|---|---|---|---|---|---|---|
| tashir-landscape | a | 9 | 9 | 8 | 8 | 9 |
| tashir-landscape | b | 9 | 9 | 8 | 8 | 9 |
| tashir-vertical | a | 9 | 8 | 9 | 9 | 9 |
| tashir-vertical | b | 9 | 8 | 9 | 8 | 9 |

Lowest score of the round: 8.

What the reviewers found (left as they stand, each scored 8 or 9):

- History: the page gives 914 for Smbat's death while the chronicle says it is usually dated to 914, some say 913.
- Picture: the siege of Kapuyt Berd spoken over the Sajid column on Tashir's road (no fortress shown); a near still chart for 'claimed Armenia in the caliph's name'; the monastery painting with both a plaque and a corner tag; the plaque on Smbat's death ahead of its words (upright).
- Sound: Haghpat heard as 'Hog Pot', Kapuyt Berd as 'Capuit Baird', Adarnase as 'Adar Nasr', the second Ashot as 'Ashok'.
- Pacing: 153 words a minute counting speech only; the upright cut's last long sentence is quick.
- Subtitles: 'they had seized.' alone in a short cue; one line of 38 letters.

## Round 2

Sevan, both cuts, the first build.

| Cut | Reviewer | History | Pacing | Picture | Sound | Subtitles |
|---|---|---|---|---|---|---|
| sevan-landscape | a | 10 | 9 | 7 | 9 | 10 |
| sevan-landscape | b | 9 | 10 | 7 | 9 | 10 |
| sevan-vertical | a | 10 | 9 | 8 | 9 | 10 |
| sevan-vertical | b | 9 | 9 | 8 | 9 | 10 |

Lowest score of the round: 7. The upright cut passed every score; the landscape cut did not (picture 7 from both reviewers).

What the reviewers found (the points that cost marks):

- Picture (landscape): 'The king put seventy of his best archers into boats' over an almost empty lake with two tiny sailboats; 'their arrows fell on the ranks massed at the water's edge, and Beshir's men broke and fled' over foes marching on along the inland road, unharmed; the citadel in the bottom fifth; the page on Smbat's death a little over five seconds; smoke over a tower as the voice says the king died still master of his kingdom; the hero standing idle for 'beat back attack after attack'.
- History (landscape): the chart's arrow brought Beshir to the lake from the south, a route no source gives.
- Sound: Beshir heard as 'Bashir' (the same name in another spelling), Sevanavank as 'Sivanavanc', 'massed' as 'masked'.

What was changed after this round (landscape):

- A painter of the king's boats for the film's page (film-page.js, additive: `boats` on a field scene): dark hulls with the archers standing in them, drawn in the field's own perspective, crossing the lake to the shore, then loosing volleys; an arrow that lands beside a foe strikes it. A column can break and flee (`fleeAt`): it walks back the way it came.
- The archers cross the lake for 'into boats ... made for the shore'; the column stands on the shore road at the water's edge, the volleys fall on it and what is left of it falls back for 'broke and fled'; the citadel is out of these shots.
- No route drawn to the lake; the page on Smbat's death shorter; the hero fights for 'attack after attack'; the last look is over the lake, clear of the smoke.

## Round 3

Ani, both cuts, the first build (the landscape cut's script shortened by its first two sentences and read at 0.97 to keep it near 60 s). Both cuts passed every score.

| Cut | Reviewer | History | Pacing | Picture | Sound | Subtitles |
|---|---|---|---|---|---|---|
| ani-landscape | a | 10 | 10 | 8 | 9 | 9 |
| ani-landscape | b | 9 | 9 | 8 | 9 | 9 |
| ani-vertical | a | 9 | 9 | 8 | 10 | 10 |
| ani-vertical | b | 8 | 9 | 8 | 10 | 10 |

Lowest score of the round: 8.

What the reviewers found (left as they stand, each scored 8 or more):

- History: the rout under the walls and Gagik raised to the throne are said as fact in the upright cut, where the chronicle tells them as what Armenian chroniclers tell (the landscape cut keeps the attribution).
- Picture: the rout shown as the imperial column still advancing; the hero low in the frame in the last shot; the cathedral painting for 'King Hovhannes-Smbat had no son'; the 1045 page readable for about a second in the upright cut.
- Sound: the first Vahram heard as 'Vafram'.
- Subtitles: one line of 38 letters.

## Round 4

Mari, both cuts, the first build.

| Cut | Reviewer | History | Pacing | Picture | Sound | Subtitles |
|---|---|---|---|---|---|---|
| mari-landscape | a | 9 | 9 | 7 | 9 | 10 |
| mari-landscape | b | 9 | 9 | 7 | 9 | 10 |
| mari-vertical | a | 9 | 9 | 8 | 9 | 10 |
| mari-vertical | b | 8 | 9 | 7 | 10 | 10 |

Lowest score of the round: 7.

What the reviewers found (the points that cost marks):

- History: 'and their sultan Baybars' put Baybars on the throne at the defeat of 1260, where the chronicle says he became sultan soon afterwards; 'the princes stood their ground' and 'the forts held' said as fact, where the chronicle gives them as Vahram's account; the upright cut's 'his sons held Cilicia' said the defense succeeded.
- Picture: 'the Mamluks of Egypt defeated the Mongols' over a Mamluk column marching on the Armenian citadel (an attack on Cilicia in 1260 that no one claims); the plaque 'Sultan Baybars' over the column's commander, who was not Baybars; 'The invaders burned Sis' over Sis's painting whole and sunlit; 'Thoros falls' over a near still field with the foe's dead; the princes named over the Mamluk column (upright); the guarded pass over an empty painting; the 'Leo comes home' page over five seconds and its tenses mixed; the scroll cut by the frame's edge (upright).
- Pacing: the upright cut's first sentence carried all of its setting in 9.8 s.
- Sound: Baybars heard once as 'Bybar'.

What was changed after this round:

- Script: 'and soon their new sultan, Baybars'; 'the chronicler Vahram writes' for the princes' stand and 'yet, he says, the forts held'; the upright cut says the king hurried to the Mongols for help and his sons led the defense, in two sentences, and keeps Vahram's attribution.
- Picture: 1260 is a page ('The Mamluks of Egypt defeat the Mongols'), then the Mamluk army seen whole, never one commander; Hethum over the painting of Cilicia's mountains; the princes over Prince Leo on the field, the army on its own road after; Sis burning at dusk (the game's own picture of Sis lost) for 'the invaders burned Sis'; Thoros's fall over the Armenian dead on the road with the Mamluk horse riding past; the page 'Leo came home' shorter and narrower in the upright cut.

## Round 5

Sevan landscape, rebuilt with the boats. It passed every score.

| Cut | Reviewer | History | Pacing | Picture | Sound | Subtitles |
|---|---|---|---|---|---|---|
| sevan-landscape | a | 10 | 9 | 8 | 9 | 10 |
| sevan-landscape | b | 10 | 9 | 8 | 9 | 10 |

Lowest score of the round: 8.

What the reviewers found (left as they stand, each scored 8 or more):

- Picture: the archers drawn as flat red figures without faces, a little large beside the game's units; the arrows long dark strokes; Beshir's host shown on the road by the citadel with no island in sight; the citadel's base in the bottom fifth in two shots.
- Pacing: the first sentence 10.4 s long; speech 153 words a minute.
- Sound: 'massed' heard as 'masked', Beshir as 'Bashir'.

## Round 6

Sis, both cuts, the first build. Both cuts passed every score.

| Cut | Reviewer | History | Pacing | Picture | Sound | Subtitles |
|---|---|---|---|---|---|---|
| sis-landscape | a | 8 | 9 | 8 | 9 | 9 |
| sis-landscape | b | 8 | 9 | 8 | 9 | 9 |
| sis-vertical | a | 9 | 10 | 8 | 10 | 10 |
| sis-vertical | b | 10 | 9 | 8 | 10 | 10 |

Lowest score of the round: 8.

What the reviewers found:

- History (landscape): the page read 'the king promised his life', which turns round who promised what (he was promised his life, by the governor of Aleppo). This is a real error and is fixed in round 8, though the cut passed.
- Picture: the plaque for Leo of Lusignan late and short; the page 'Freed, he died in Paris in 1393' over five seconds; the hero low in the last shot; 'the kingdom came to an end' over the castle still garrisoned, and 'Freed' over Sis's painting (upright).
- Subtitles: two uneven line breaks ('So ended / the Armenian Kingdom of Cilicia').
- Pacing: 157 words a minute counting speech only (landscape).
