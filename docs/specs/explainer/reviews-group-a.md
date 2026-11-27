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

- History (landscape): the page read 'the king promised his life', which turns round who promised what (he was promised his life, by the governor of Aleppo). This is a real error and was fixed (round 11), though the cut passed.
- Picture: the plaque for Leo of Lusignan late and short; the page 'Freed, he died in Paris in 1393' over five seconds; the hero low in the last shot; 'the kingdom came to an end' over the castle still garrisoned, and 'Freed' over Sis's painting (upright).
- Subtitles: two uneven line breaks ('So ended / the Armenian Kingdom of Cilicia').
- Pacing: 157 words a minute counting speech only (landscape).

## Round 7

Gyumri, both cuts, the first build. The upright cut passed every score.

| Cut | Reviewer | History | Pacing | Picture | Sound | Subtitles |
|---|---|---|---|---|---|---|
| gyumri-landscape | a | 8 | 9 | 8 | 9 | 10 |
| gyumri-landscape | b | 9 | 9 | 7 | 8 | 9 |
| gyumri-vertical | a | 10 | 9 | 8 | 8 | 9 |
| gyumri-vertical | b | 10 | 9 | 8 | 9 | 9 |

Lowest score of the round: 7.

What the reviewers found (the points that cost marks):

- History (landscape): an arrow drawn from Kars to Erivan for the raid of October 1579, a route no source gives; 'No fighting at Kumayri itself is recorded' without the chronicle's 'that year'.
- Picture (landscape): the plaque for Lala Mustafa Pasha over the game's commander marching down Kumayri's road, as if he led a column there; the Kumayri plaque on top of the chart's Mt. Ararat, just before the voice says Mount Aragats; the 'Shah Abbas' page 6.4 s; the chart of Kars, Kumayri and Erivan near still for 5.5 s; 'Shirak was among the lands emptied' over the village with a lit window and chimney smoke.
- Sound: 'Lala' lost from the commander's name; one Shirak heard as 'Chirac'.
- Pacing (landscape): 121 words a minute with pauses.
- Subtitles: 'the highlands became the battlefield / of two empires' split across two cues.

What was changed after this round (landscape):

- Script: 'is recorded that year'; read at 0.98; the cue break moved to 'the highlands became / the battlefield of two empires'.
- Picture: Lala Mustafa Pasha on a page of his own; Kars, Kumayri and Erivan come up on the chart one after another as they are named, with no route drawn; Kumayri's plaque set clear of Mt. Ararat; the village painting for 'No fighting at Kumayri itself is recorded that year'; Shah Abbas's deportations as an arrow on the chart pointing the way to Persia; 'the lands emptied' over the deserted snow plain below the village.

## Round 8

Mari, both cuts, rebuilt with round 4's fixes. Both cuts passed every score.

| Cut | Reviewer | History | Pacing | Picture | Sound | Subtitles |
|---|---|---|---|---|---|---|
| mari-landscape | a | 9 | 9 | 8 | 9 | 9 |
| mari-landscape | b | 10 | 9 | 8 | 9 | 9 |
| mari-vertical | a | 10 | 9 | 8 | 9 | 10 |
| mari-vertical | b | 10 | 9 | 8 | 9 | 10 |

Lowest score of the round: 8.

What the reviewers found (left as they stand, each scored 8 or more):

- Picture: the painting of Cilicia's mountains used twice and nearly still the second time ('it went around the guarded pass'); the arrow 'To the Mongols' ending near Lake Van; two similar shots of the Mamluk column; the upright cut's opening chart without Cilicia in frame and one hero for the two princes.
- Pacing: speech 151 to 153 words a minute; the 1260 sentence 10 s in one breath.
- Sound: Baybars heard as 'Baibars' (the common English spelling); Vahram once as 'Vaphram'.
- Subtitles: 'Baybars sent / a Mamluk army against them.' unbalanced.

## Round 9

Halidzor, both cuts, the first build. Both cuts passed every score.

| Cut | Reviewer | History | Pacing | Picture | Sound | Subtitles |
|---|---|---|---|---|---|---|
| halidzor-landscape | a | 10 | 9 | 8 | 9 | 10 |
| halidzor-landscape | b | 10 | 9 | 8 | 9 | 10 |
| halidzor-vertical | a | 10 | 10 | 8 | 9 | 10 |
| halidzor-vertical | b | 10 | 9 | 8 | 9 | 10 |

Lowest score of the round: 8.

What the reviewers found (left as they stand, each scored 8 or more):

- Picture: 'His men drove the Ottomans from Ghapan' over the Ottoman column still marching on; 'it is said to have kept them in water' over the dim citadel, with no river or tunnel; the Voghji only a pale band in the painting; the sortie with the hero standing still (upright); the citadel's gate in the bottom fifth in some shots.
- Pacing: the opening chart held for 11.6 s across the title and two sentences; speech 157 words a minute.
- Sound: Syunik heard as 'Suneik', Voghji as 'Voji', Ghapan as 'Gapan', Davit Bek as 'David Bek'.

## Round 10

Gyumri landscape, rebuilt with round 7's fixes. It passed every score.

| Cut | Reviewer | History | Pacing | Picture | Sound | Subtitles |
|---|---|---|---|---|---|---|
| gyumri-landscape | a | 9 | 9 | 8 | 8 | 9 |
| gyumri-landscape | b | 10 | 9 | 8 | 9 | 10 |

Lowest score of the round: 8.

What the reviewers found (left as they stand, each scored 8 or more):

- Picture: Mount Aragats is not marked on the chart, which marks only Mt. Ararat; the plaque 'From 1604' covers the first letter of the Shirak marker; 'To Persia' set in the chart's blue hand beside Lake Urmia; foes and road in the bottom fifth in the field shots.
- Sound: 'Lala' lost from the commander's name; Erivan heard once as 'Aravan'.
- Pacing: 125 words a minute with pauses.
- Subtitles: 'the highlands became' leaves its object to the next cue.

What was changed after round 6 (Sis landscape, though it had passed): the page reads 'on the promise of his life'; Sis is no longer marked before it is named; the plaque for Leo of Lusignan comes with his name; the page 'Freed' is shorter; the last shot follows the king; 'So ended the Armenian / Kingdom of Cilicia.'

## Round 11

Sis landscape, rebuilt with the fixes after round 6. It passed every score.

| Cut | Reviewer | History | Pacing | Picture | Sound | Subtitles |
|---|---|---|---|---|---|---|
| sis-landscape | a | 9 | 9 | 8 | 9 | 9 |
| sis-landscape | b | 9 | 9 | 8 | 10 | 9 |

Lowest score of the round: 8.

What the reviewers found (left as they stand, each scored 8 or more):

- History: 'a prince from Cyprus' for 'a prince who lived in Cyprus'; 'the crown went to' folds the offer of 1373 into 1374; 'behind the castle walls' names one castle where the chronicle says castle walls.
- Picture: the 'Terms accepted' page still unrolling as its date is said; the painting of Sis's walls used twice; 'taken to Cairo' over the empty castle; the arrow from Cyprus through the chart's 'Cilicia'.
- Sound: speech 157 words a minute.
- Subtitles: 'the Mamluk armies were / in Cilicia' split over two lines.

## Where it stands

All fourteen cuts of group A have every score at 8 or more from two fresh reviewers in their last round: Tashir (round 1), Ani (3), Sevan upright (2) and landscape (5), Halidzor (9), Mari (8), Gyumri upright (7) and landscape (10), Sis upright (6) and landscape (11). The films are not yet in the page's `const IDS` (the owner wires them in), so tools/regress/film.js reports the seven new folders under assets/explainer as not on the page; its other checks pass.
