# Independent reviews of the explainer videos

The owner's rule: independent reviewers score every cut on history, pacing, picture, sound and subtitles, each out of 10, and the cut is fixed and reviewed again until every score is 9 or more.

How a round works (tools/explainer/review.sh): for each cut a review pack is made (the mp4, the .vtt, contact sheets with a frame every two seconds, full frames of the title, every plaque and the closing card, frames with the subtitle drawn as the page will draw it, the script with its sources, the measures, the timeline of scenes and of sentences, every cue's timing). Two fresh reviewers per cut, each a new `claude -p` session that has seen nothing of the making and is given only tools/explainer/review-brief.md, the pack and read access to the repository, score it and list every defect. They cannot hear or watch: sound is judged from what a speech recognizer wrote down, the loudness and peak numbers and their own measurements of the track; picture from the frames. The reviewers' full replies are kept in the build's scratch folder; the defects below are theirs, shortened.

## Round 1

The first build. Three cuts were reviewed (Erebuni landscape and vertical, Tushpa vertical); the same faults were in the other five, which were stopped and rebuilt with the fixes instead of being reviewed as they stood.

| Cut | Reviewer | History | Pacing | Picture | Sound | Subtitles |
|---|---|---|---|---|---|---|
| erebuni-landscape | a | 9 | 8 | 7 | 7 | 8 |
| erebuni-landscape | b | 9 | 8 | 7 | 8 | 9 |
| erebuni-vertical | a | 9 | 8 | 7 | 8 | 8 |
| erebuni-vertical | b | 9 | 8 | 7 | 7 | 8 |
| tushpa-vertical | a | 9 | 9 | 6 | 7 | 9 |
| tushpa-vertical | b | 10 | 8 | 7 | 7 | 9 |

Lowest score of the round: 6.

What the reviewers found (the points that cost marks):

- Sound: the music bed was close to inaudible (25 dB and more under the voice), the track opened in half a second of digital silence with no music under the title, and the bed faded out before the last line, leaving the closing card silent.
- Picture: the game's interface showed in every battlefield scene (the 150 build-price signs, health bars, coin counts, a range ring, the flank road's dashed line).
- Picture: plaque sub-lines and map plaques were too small for a phone; the Mt. Ararat label of the chart was cut by the frame's lower edge; long stretches of nearly empty map; one plaque held for 15 to 19 seconds.
- Picture and history: Tushpa was marked at the campaign's node, a lake's width inland, under the words 'Rock citadel on Lake Van'; a battle was shown at Erebuni's walls while the voice said those wars were fought far away; nothing showed the founding inscription while it was spoken of; the palace and temple were spoken over the game's grey stone fort.
- Picture: battle scenes carried nothing to say they are the game's own staging.
- Pacing: the voice began on top of the title card; the closing card was up for about two seconds; the vertical Erebuni cut opened on a 12.7 second sentence at 127 words a minute.
- Subtitles: line breaks split phrases ('cut / in cuneiform', 'Assyrian / king', 'up / in Tushpa'); some cues came 0.2 to 0.3 s late; one cue was on screen 1.57 s; the pack lacked the per-cue timing.
- History: '782 BC' printed on the map without the script's 'by the date most often given'.
- Files: 5.84 MB and 2.95 MB against aims of 6 and 3 MB; SSIM 0.93 to 0.95.

What was changed after this round:

- Sound: the bed is evened out and set about 9 dB under the voice, begins under the title (the voice now starts at 1.7 s) and ends with the film under the closing card (2.8 s after the last word).
- Picture: the interface's painters are switched off in the film's page (price signs, health bars, rings, flank dashes, coin counts). index.html is untouched.
- Picture: larger plaques (larger again on the vertical cuts); map cameras keep clear of the Mt. Ararat label; maps are shorter and less zoomed; every sentence that names something new has its own plaque.
- Tushpa is marked on Lake Van's eastern shore (text-audit entry 1, claim 11), with the words 'By Lake Van'.
- Erebuni: the calm garrison is shown while the voice says the wars were far away, and the battle only with the plaque 'This battle is the game's invention'; the founding inscription is shown as a plainly labelled illustration (a stone with wedge marks, no real text copied); the palace and temple are spoken over the chronicle's own painting of the mudbrick fortress.
- A small 'Battle scenes from the game' stands in the corner over every battle in motion; an army on the march is shown as a column on the road with no towers.
- The map plaque reads '782 BC, by the usual date'.
- Pacing: speed 0.96 (1.0 for Avarayr's long names); the title has the first seconds to itself; the closing card holds about four seconds; the vertical Erebuni's first sentence is two.
- Subtitles: every cue and line break is now set by hand in scripts.json; a cue inside a sentence starts at the pause before its words (found in the narration's own level, near the recognizer's time); no cue under 1.6 s or over 17 letters a second; cues.json is in the pack.
- Files: 24 frames a second and 80 kbit/s sound leave more bits for the picture; the size aim is filled to 93%.

## Round 2

The rebuilt Erebuni cuts were reviewed first (two cuts), so their lessons could go into all eight before the long render.

| Cut | Reviewer | History | Pacing | Picture | Sound | Subtitles |
|---|---|---|---|---|---|---|
| erebuni-landscape | a | 9 | 8 | 8 | 7 | 9 |
| erebuni-landscape | b | 9 | 8 | 8 | 8 | 9 |
| erebuni-vertical | a | 10 | 9 | 8 | 8 | 9 |
| erebuni-vertical | b | 9 | 9 | 8 | 9 | 8 |

Lowest score of the round: 7.

What the reviewers found (the points that cost marks):

- Sound: the music bed still fell silent with the last word (a fault in the mix's filter chain), and was low under the title; the recognizer dropped the word "game's" from the line that says the battle is invented.
- Pacing: 160 words a minute while speaking, with pauses of a third of a second between sentences: brisk, not calm. One 12 second sentence carried five facts.
- Picture: the fortress was shown a sentence before the film says it was built; the Araxes was named but not labelled on the map; the title and the map plaque crossed on the vertical cut; the calm garrison scene still had arrows in the air; the palace and temple were spoken over a second look at the same wall; the game's grey fort closed a film about a mudbrick fortress.
- Subtitles: cues timed from a pause came 0.15 to 0.3 s after the recognizer heard the word; the script page in the pack was out of date.

What was changed after this round:

- Sound: the bed's chain was rebuilt and measured (about -26 dB in the pauses against a voice at -17, steady to the last frame, a short fade at the very end). The line now reads "is an invention of the game", which the recognizer hears whole.
- Pacing: speed 0.94, pauses of 0.46 s between sentences and 0.82 s between beats, a 2 second title before the voice. To keep the lengths, the scripts lost a sentence each where the picture was weakest (Erebuni's palace and temple, Tushpa's 'height of its power', Dvin's cathedral), and Erebuni's long sentence became two.
- Picture: the plain is shown before the fortress is founded; the map names the Araxes in the chart's own hand; markers wait for the title; the garrison scene is cleared of arrows; both Erebuni cuts close on the hill citadel, not the game's fort; larger sub-lines.
- Subtitles: a cue never starts later than the recognizer heard its first word; the script pages are regenerated before every pack.
- Arin Berd is kept as it is said (the short e of 'bed'): a recognizer spells that sound 'Baird'; said as 'bird' it would be spelled right and sound wrong. The note is in the names table.

## Round 3

Six cuts were reviewed (Erebuni, Tushpa and Avarayr, both shapes); the Dvin cuts were rebuilt with the round's lessons before their first review.

| Cut | Reviewer | History | Pacing | Picture | Sound | Subtitles |
|---|---|---|---|---|---|---|
| avarayr-landscape | a | 9 | 8 | 7 | 9 | 9 |
| avarayr-landscape | b | 9 | 8 | 8 | 9 | 9 |
| avarayr-vertical | a | 9 | 8 | 7 | 9 | 8 |
| avarayr-vertical | b | 10 | 8 | 7 | 9 | 8 |
| erebuni-landscape | a | 10 | 9 | 8 | 8 | 9 |
| erebuni-landscape | b | 9 | 9 | 8 | 9 | 9 |
| erebuni-vertical | a | 10 | 8 | 9 | 9 | 10 |
| erebuni-vertical | b | 10 | 8 | 8 | 9 | 9 |
| tushpa-landscape | a | 9 | 9 | 8 | 9 | 10 |
| tushpa-landscape | b | 9 | 9 | 8 | 8 | 10 |
| tushpa-vertical | a | 10 | 9 | 8 | 8 | 9 |
| tushpa-vertical | b | 10 | 9 | 8 | 8 | 8 |

Lowest score of the round: 7.

What the reviewers found (the points that cost marks):

- Picture against the words: the 743 BC battle by the Euphrates was spoken over an army marching below Tushpa; 'Vardan fell there' over a hero still standing; the Persian command of 449 over eleven seconds of mountain; the Treaty of Nvarsak over ten seconds of empty field; 'the kingdom at the height of its power' and 'wars fought far from Erebuni' over Erebuni's own field.
- Picture: the empty tower pads with their flags and a tower's reach ring read as interface; marches and garrison scenes carried no word that they are the game's; the Avarayr pin sat on the Araxes; map sub-lines too small; action in the lower fifth under the subtitles; the 'Rock of Van' shot had the game's keep cut by the frame.
- Pacing: the upright cuts ran 33 to 34.5 s; Avarayr read at 118 to 123 words a minute.
- Sound: 'Araxes' lost its first vowel after 'the' ('the Raxes'); 'royal' was heard as one syllable; a break fell between 'Tiglath-pileser' and 'the Third'; reviewers disagreed on the bed (a little forward for two, too low for two).
- Subtitles: two cues ran at 18.5 to 19.2 letters a second; cues timed from a pause came up to half a second before their words; 'Yet the faith held:' flashed for one second.

What was changed after this round:

- Where the game has no picture of the place, the film now shows a page of the chronicle instead of the wrong place: a parchment card with the date and the line (Tiglath-pileser III and 743 BC by the Euphrates; the command of 449; the Treaty of Nvarsak; the rise of the caliphate).
- A lost field is shown with the game's own picture of a lost stand (its defeat beat, the citadel burning at dusk) for Avarayr and for the sack of Dvin; the hero is no longer on screen when the voice says he fell.
- Erebuni's film shows Tushpa's rock while it speaks of the rock citadel at Tushpa, and the chart (Lake Van, far to the south) while it speaks of the wars with Assyria.
- Empty tower pads and the reach ring are switched off; every look at the battlefield carries 'Scenes from the game'; Avarayr is marked off the Araxes (text-audit entry 2, claim 0); larger map plaques; the lower fifth of every frame is dimmed as the subtitles' ground; the Rock of Van is framed without the keep.
- Pacing: the upright cuts have their own shorter pauses and leads; Avarayr is read at 1.04 and 1.06.
- Sound: Araxes begins with a full 'ah'; 'royal' and Tiglath-pileser are given as IPA; Tghmut has the Armenian gh; the bed is ducked less deeply and set a little lower overall.
- Subtitles: a cue that would run over 17 letters a second joins its neighbour; a cue inside a sentence starts a little before its words begin (the end of the pause), never in the middle of the pause; no cue under 1.8 s where the sentence allows.
- Files: the size aim is filled to 90%.

## Round 4

Three of the rebuilt cuts were reviewed while the rest rendered (Erebuni landscape, Tushpa landscape and vertical). History and pacing reached 9 and 10; picture stayed at 8.

| Cut | Reviewer | History | Pacing | Picture | Sound | Subtitles |
|---|---|---|---|---|---|---|
| erebuni-landscape | a | 9 | 9 | 9 | 9 | 10 |
| erebuni-landscape | b | 10 | 9 | 8 | 9 | 9 |
| tushpa-landscape | a | 10 | 9 | 8 | 8 | 10 |
| tushpa-landscape | b | 10 | 9 | 8 | 9 | 9 |
| tushpa-vertical | a | 10 | 9 | 8 | 8 | 8 |
| tushpa-vertical | b | 10 | 9 | 8 | 8 | 8 |

Lowest score of the round: 8.

What the reviewers found (the points that cost marks):

- Picture: two parchment cards back to back held still for ten seconds (Tushpa); fourteen seconds of map in a row with nothing drawn north of the Araxes (Erebuni); the inscription stone was a flat grey slab; the Mt. Ararat and Lake Van labels were cut by the frame during a pan; the Erebuni plaque came seven seconds before the name was spoken; plaque second lines still small.
- Sound: over the whole narration the recognizer misheard the short last line ('Hold the royal road') and lost the last syllable of a second 'Biainili'; three reviewers found the bed a little forward at 10 to 11 dB under the voice.
- Subtitles: cues placed at a pause came up to half a second before their words; one closing cue cleared two seconds before the film's end.

What was changed after this round:

- Picture: a card now lies over the dimmed, drifting chart and its lines come in one after another; Tushpa keeps one card (743 BC) and shows the Assyrian column on the road for the sentence before it; Erebuni shows the chronicle's painting of the royal seat for Argishti and the kingdom, draws the push north as an arrow across the labelled Araxes, names the hill (Arin Berd) on the map and the fortress (Erebuni) only when the voice does; a raking light crosses the stone; an arrow marked 'To Assyria' points off the chart's southern edge (text-audit entry 0, claim 6: Assyria lay far to the south, beyond Lake Van and Tushpa); cameras keep the chart's labels whole; larger plaque lines, dates and Armenian names.
- Sound: the bed is 3 dB lower. The recognizer now hears one sentence at a time (the sentences' own times are known), which removes its drift over a minute of audio: heard alone, the last line and both 'Biainili' come back whole at every speed tried. 'royal' is left to the engine's own dictionary again.
- Subtitles: a cue inside a sentence starts a tenth of a second before the recognizer's time for its first word (heard sentence by sentence); the last cue stays up under the closing card.

## Round 5

Six cuts were reviewed (Erebuni, Tushpa and Avarayr, both shapes), built with round 4's fixes. The Dvin cuts were not reviewed in this round. History and subtitles reached 9 and 10; picture was the weak score (7 to 9), Avarayr the weakest cut.

| Cut | Reviewer | History | Pacing | Picture | Sound | Subtitles |
|---|---|---|---|---|---|---|
| avarayr-landscape | a | 9 | 8 | 7 | 8 | 9 |
| avarayr-landscape | b | 9 | 8 | 8 | 9 | 9 |
| avarayr-vertical | a | 9 | 9 | 7 | 9 | 10 |
| avarayr-vertical | b | 9 | 9 | 8 | 9 | 10 |
| erebuni-landscape | a | 10 | 9 | 8 | 9 | 10 |
| erebuni-landscape | b | 10 | 9 | 8 | 9 | 10 |
| erebuni-vertical | a | 10 | 9 | 8 | 8 | 10 |
| erebuni-vertical | b | 10 | 9 | 9 | 9 | 10 |
| tushpa-landscape | a | 10 | 9 | 9 | 9 | 10 |
| tushpa-landscape | b | 10 | 9 | 9 | 9 | 10 |
| tushpa-vertical | a | 10 | 9 | 9 | 10 | 10 |
| tushpa-vertical | b | 10 | 9 | 8 | 9 | 10 |

Lowest score of the round: 7.

What the reviewers found (the points that cost marks):

- Picture against the words (Avarayr): 'The field was lost' over a burning stone castle, though no fortress stood at Avarayr; Vardan never shown falling (he stood unharmed until the cut); five seconds of an empty mountain for Yazdegerd's command; the Tghmut river named while it lay in the bottom fifth, under the subtitles; Persian units marching through the bottom fifth of the upright cut.
- Picture (all): near-still shots of four to eight seconds (Vardan between two towers, the citadel painting under Sarduri II, the 743 BC card); the 743 BC Euphrates card over the Lake Van chart; 23 seconds of one battlefield in a row (Tushpa); the Rock of Van shown as empty ground and a distant town (upright Tushpa); the citadel cut out of frame under 'The citadel did not fall'; Erebuni's 'To Assyria' arrow in the bottom fifth and cut by the frame; Tushpa's art shown without a name in a film about Erebuni; no plaque for Yerevan; plaques ahead of their words (Arin Berd, The field was lost).
- Pacing: Avarayr at 128 words a minute and 61.8 s; the title readable for under two seconds before the voice (Tushpa); the closing card dissolving in over the last spoken line; the Persian reserves' plaque cut before its sentence ended.
- Sound: the recognizer wrote Biainili as 'B.I. Neeley', Erebuni as 'Arabuni' in its short sentence, Tghmut as 'Tigmut', Nvarsak as 'Navar Sak'; reviewers again split on the music bed (some found it close to inaudible on a phone, 14 to 20 dB under the voice).
- Subtitles: the last cue stayed 1.7 s past its speech over the closing card; two cues near 16.5 letters a second.

What was changed after this round:

- The owner's new direction: the film no longer apologises for the game. Every disclaimer is gone from narration, plaques and overlays ('an invention of the game', 'by the date most often given', '(an illustration)', the 'Scenes from the game' note), and the lines are replaced with storytelling from the game's own texts: Erebuni's victory text (from its walls Urartu's kings struck north toward Lake Sevan) and its chronicle (Yerevan counts its birth from Argishti's stone). The review brief now tells reviewers that the game's battle scenes are its staging and need no label.
- Picture: positions can name a subtitle part ('4/1'), so scenes and plaques change with the words; Avarayr's lost field is the open plain at dusk with its dead on the road (no fortress), Vardan walks, then falls where he stands under the reserves; Yazdegerd's command is a page with his crown, then an unrolling decree sealed in wax; the Tghmut is filmed close so it sits mid-frame; the Treaty of Nvarsak is sealed with a cross; Armenia's faith is the church on the plain's horizon, and 'yet the faith held' the same church at dusk.
- Picture: Tushpa splits its long shots (the ridge, then the climb from the plain; the painting, then Sarduri II on the field; Tiglath-pileser III's chariot leading the column), puts the 743 BC card on a plain dark ground, draws the 735 BC march into Biainili on the chart, shows the Assyrian inscriptions on a pale slab, and keeps the rock citadel in shot for 'the citadel did not fall'. Erebuni names Tushpa when its pictures are shown, writes BIAINILI on the chart, lifts 'To Assyria' out of the bottom fifth, draws the march north to Lake Sevan, gives Yerevan its plaque (2,800 years in 2018, counted from the stone).
- Pacing: the title holds 2.6 s before the voice (2.1 s upright); the closing card comes up only after the last line; Avarayr is read at 1.08 to bring it near 60 s.
- Sound: new IPA for Erebuni (the stress on the last syllable, as in Armenian), Biainili (the first vowels run together), Nvarsak (no vowel between n and v), Ayrarat; the bed is 1.5 dB louder and ducked a little more gently.

## Round 6

All eight cuts rebuilt with the owner's new direction (no disclaimers, storytelling from the game's own texts) and round 5's fixes, and all eight reviewed, the Dvin cuts for the first time. Erebuni's landscape cut passed every score.

| Cut | Reviewer | History | Pacing | Picture | Sound | Subtitles |
|---|---|---|---|---|---|---|
| avarayr-landscape | a | 10 | 10 | 8 | 9 | 10 |
| avarayr-landscape | b | 10 | 9 | 8 | 9 | 10 |
| avarayr-vertical | a | 10 | 10 | 8 | 10 | 10 |
| avarayr-vertical | b | 10 | 10 | 8 | 9 | 10 |
| dvin-landscape | a | 10 | 10 | 8 | 8 | 10 |
| dvin-landscape | b | 9 | 9 | 7 | 8 | 10 |
| dvin-vertical | a | 9 | 9 | 8 | 9 | 10 |
| dvin-vertical | b | 10 | 9 | 8 | 8 | 9 |
| erebuni-landscape | a | 9 | 10 | 9 | 9 | 10 |
| erebuni-landscape | b | 9 | 9 | 9 | 9 | 10 |
| erebuni-vertical | a | 9 | 9 | 8 | 9 | 10 |
| erebuni-vertical | b | 9 | 9 | 8 | 9 | 9 |
| tushpa-landscape | a | 10 | 9 | 8 | 9 | 10 |
| tushpa-landscape | b | 9 | 9 | 8 | 9 | 10 |
| tushpa-vertical | a | 10 | 10 | 9 | 10 | 10 |
| tushpa-vertical | b | 10 | 9 | 8 | 9 | 10 |

Lowest score of the round: 7.

What the reviewers found (the points that cost marks):

- History (Erebuni): reviewers noted that '782 BC' now stands without the chronicle's 'by the date most often given'. The owner asked for the caveat to go; it cost a point (9) and no cut fell under 9 for it.
- Picture: cards still over five seconds (743 BC, The command, the Treaty of Nvarsak, A new power); two cards back to back with a ghosted dissolve; empty build plots and their stone piles in a march (interface); a long, muddy dissolve between two looks at the same battle; units and the river edge in the bottom fifth; the Rock of Van not seen as a rock; Tushpa's painting with its name in a film where the voice never says Tushpa (upright Erebuni); a plaque that flashed for a sixth of a second; the hero left out of the last line 'Stand where Vardan stood'.
- Sound: the recognizer heard 'reached Veen' and 'Veen rose again' for Dvin; Ayrarat as 'Irirat'; Tghmut as 'Tigmut'.
- Pacing: Tushpa's speech near 153 words a minute; the line 'and it did not' with no beat after it.

What was changed after this round:

- Cards are cut to the words they carry (under five seconds), and dissolve quickly; two looks at one field cut in 0.3 s; empty build plots are switched off like the empty pads; a plaque that could not be read for 1.2 s is left out; a plaque gives way to a page that comes up under it; the title clears as the voice begins and first markers wait for it.
- Avarayr: the priest Ghevond with his processional cross (the game's own tower) for the command to renounce Christianity and the faith that held; Vardan at his post for the last line; the reserves close round him nearer. Dvin: Theodoros takes the field among the raiders; the city rising again is the walls on the horizon, not a second look at the same painting.
- Tushpa: Tiglath-pileser III alone in his chariot for his coming to the throne; a longer beat after 'and it did not'; read at 0.92.
- Dvin's v given as the soft labiodental v, so its d is kept after a consonant.

## Round 7

The cuts changed after round 6 were rebuilt and reviewed as they finished.

| Cut | Reviewer | History | Pacing | Picture | Sound | Subtitles |
|---|---|---|---|---|---|---|
| avarayr-landscape | a | 10 | 9 | 9 | 9 | 10 |
| avarayr-landscape | b | 10 | 9 | 8 | 9 | 10 |
| dvin-landscape | a | 10 | 9 | 8 | 8 | 10 |
| dvin-landscape | b | 9 | 9 | 9 | 9 | 9 |
| erebuni-vertical | a | 10 | 10 | 7 | 9 | 10 |
| erebuni-vertical | b | 9 | 9 | 7 | 9 | 10 |
| tushpa-landscape | a | 8 | 9 | 8 | 9 | 10 |
| tushpa-landscape | b | 9 | 10 | 8 | 10 | 10 |
| tushpa-vertical | a | 9 | 9 | 8 | 9 | 10 |
| tushpa-vertical | b | 10 | 9 | 8 | 9 | 10 |

Lowest score of the round: 7.

What the reviewers found (the points that cost marks):

- History (Tushpa): the 735 BC arrow into Tushpa started at the chart's Mt. Ararat, which the game's chart draws south-east of Lake Van; the reviewers read it as a march from Ararat, and Ararat's label was cut by the frame.
- Picture: the 743 BC card cut away before its second line could be read and before the voice said it; Erebuni upright showed Tushpa while its voice never names it, the Lake Sevan arrow started away from Erebuni and ran off the frame with no lake, and the Yerevan label was clipped; Dvin upright opened on bare parchment; plaque sub-lines too small for a landscape film watched in an upright page.
- Sound: 'Urartu's kings struck' heard as 'king struck' (the s runs into the s).

What was changed after this round:

- Tushpa's march is drawn on a close chart of Lake Van alone, from due south; Erebuni upright shows Argishti I himself (the game's hero) for his name, the arrow grows with the pan to Lake Sevan, and Yerevan is marked on the chart where Erebuni's hill stands, at its southeastern edge; the upright line reads 'the kings of Urartu'.
- Plaques are set larger (a third larger on the landscape cuts); card lines come with their words.
- Dvin upright is told in two sentences for its fall (Theodoros took the field; the raiders reached Dvin and took it), read slower.

## Round 8

Tushpa and Avarayr landscape, then Avarayr and Dvin upright. Avarayr's upright cut passed every score.

| Cut | Reviewer | History | Pacing | Picture | Sound | Subtitles |
|---|---|---|---|---|---|---|
| avarayr-landscape | a | 10 | 10 | 9 | 9 | 10 |
| avarayr-landscape | b | 8 | 9 | 8 | 9 | 10 |
| avarayr-vertical | a | 10 | 10 | 9 | 10 | 10 |
| avarayr-vertical | b | 10 | 9 | 9 | 10 | 10 |
| dvin-vertical | a | 10 | 9 | 8 | 8 | 9 |
| dvin-vertical | b | 10 | 9 | 8 | 8 | 9 |
| tushpa-landscape | a | 10 | 10 | 8 | 10 | 10 |
| tushpa-landscape | b | 10 | 10 | 8 | 10 | 10 |

Lowest score of the round: 8.

What the reviewers found (the points that cost marks):

- Picture: cards still a little over five seconds (743 BC, Freedom of worship); 'SASANIAN PERSIA' written north of the Araxes, inside Armenia; one column marching past Vardan read as no encirclement; the Rock of Van (upright Tushpa) still a low mound; foes and the river edge in the bottom fifth.
- History: the plaque named Mushkan Niusalavurt while the voice did not (it is sourced, but two texts at once).

What was changed after this round:

- The Rock of Van is taken from the chronicle's own painting of it (the long limestone ridge crowned by its walls, framed close so nothing of a later town shows); Persia is no longer written on the chart but pointed to, from off its south-eastern edge; the plaque for 451 follows the voice (the Persian army, with its war elephants); the cards end with their sentence's words.

## Round 9

Erebuni and Tushpa upright, then Dvin landscape. Both upright cuts passed every score.

| Cut | Reviewer | History | Pacing | Picture | Sound | Subtitles |
|---|---|---|---|---|---|---|
| dvin-landscape | a | 10 | 10 | 8 | 9 | 10 |
| dvin-landscape | b | 10 | 9 | 8 | 9 | 10 |
| erebuni-vertical | a | 9 | 9 | 9 | 9 | 10 |
| erebuni-vertical | b | 9 | 10 | 9 | 9 | 10 |
| tushpa-vertical | a | 10 | 9 | 9 | 10 | 10 |
| tushpa-vertical | b | 10 | 9 | 9 | 9 | 10 |

Lowest score of the round: 8.

What the reviewers found (the points that cost marks):

- Picture (Dvin): the southern arrow's head covered the 'v' of Dvin's label; the hero stood in the bottom fifth of the 'raid, not yet a conquest' shot; the 'A new power' card near still.
- Sound: the first Dvin of the film heard as 'Dwein' or 'Duin'.

What was changed after this round:

- Dvin's label sits above its pin, clear of the arrow; the city's rising again is shot without the hero; cards drift and come nearer as they are read.

## Round 10

Tushpa and Avarayr landscape and Dvin upright.

| Cut | Reviewer | History | Pacing | Picture | Sound | Subtitles |
|---|---|---|---|---|---|---|
| avarayr-landscape | a | 8 | 9 | 8 | 9 | 9 |
| avarayr-landscape | b | 9 | 9 | 8 | 9 | 10 |
| dvin-vertical | a | 10 | 9 | 8 | 8 | 10 |
| dvin-vertical | b | 10 | 9 | 8 | 8 | 10 |
| tushpa-landscape | a | 10 | 9 | 8 | 10 | 10 |
| tushpa-landscape | b | 10 | 10 | 9 | 10 | 10 |

Lowest score of the round: 8.

What the reviewers found (the points that cost marks):

- History (Avarayr): the chart's pin for Avarayr sat on the river the game's chart calls the Araxes, east of Ararat, while the chronicle puts the field by the Tghmut near Maku, south of Ararat.
- Picture: the treaty of Nvarsak spoken over the priest's tower (Ghevond died in Persia long before 484); the third line of the decree up for under a second; the 743 BC card's lines still late; the Assyrian inscription read as a blurred paper sheet; Dvin upright's chart nearly empty.
- Sound: the first word of Dvin's films, 'Dvin', heard as 'Duin'; Ayrarat as 'Irarat'.

What was changed after this round:

- Avarayr opens on the plain and its church, with no pin on the chart; the treaty is spoken over that church at day, the faith restored; the decree's lines and the 743 BC card's lines come in with their words and the cards stay to the end of them; the Assyrian slab is carved stone with a lit edge and a shadowed one; Dvin upright names the plain of Ayrarat on a close chart; a name can carry its own IPA in one sentence (Dvin opening a sentence keeps the plain v, heard 'Dveen').

## Round 11

Tushpa and Avarayr landscape, then the Dvin cuts. Dvin's landscape cut passed every score.

| Cut | Reviewer | History | Pacing | Picture | Sound | Subtitles |
|---|---|---|---|---|---|---|
| avarayr-landscape | a | 10 | 10 | 9 | 9 | 10 |
| avarayr-landscape | b | 10 | 9 | 8 | 9 | 10 |
| dvin-landscape | a | 10 | 9 | 9 | 9 | 9 |
| dvin-landscape | b | 10 | 10 | 9 | 9 | 10 |
| dvin-vertical | a | 10 | 9 | 5 | 8 | 10 |
| dvin-vertical | b | 10 | 9 | 7 | 8 | 10 |
| tushpa-landscape | a | 9 | 9 | 8 | 10 | 10 |
| tushpa-landscape | b | 10 | 9 | 9 | 10 | 10 |

Lowest score of the round: 5.

What the reviewers found (the points that cost marks):

- Picture (Tushpa): the Rock of Van shown as the flat field with a town far off, no ridge; the 743 BC page cut while its line was still being said; the Sarduri plaque over an empty painting before the king appears; 'Tiglath-pileser's inscriptions' over made-up signs read as his own text.
- Picture (Avarayr): a column marching past Vardan still read as no encirclement; the church shots upscaled and soft; Ararat's label in the bottom fifth of the map.
- Picture (Dvin upright): its pin never came up (a marker's time was read as a fraction of the first sentence), so the chart showed bare parchment under 'Dvin'.
- Sound: 'and Dvin rose again' heard as 'Dreen'; the reviewers' own level checks put the bed at voice level at the end of Dvin upright, which the files do not bear out (the mix there falls from -34 dB to -57 dB over its last second).

What was changed after this round:

- Tushpa: the Rock of Van from the van painting framed close; the 743 BC page for its first half, then the Assyrian army on the move; the plaque 'The Assyrian inscriptions'; Sarduri's plaque with his figure. Avarayr: Vardan stands in the bend of the road, ringed by the reserves on three sides; church shots kept under 2.3 times. Dvin upright: the pin and the name of Ayrarat timed by the voice.

## Round 12

Tushpa and Avarayr landscape and Dvin upright again.

| Cut | Reviewer | History | Pacing | Picture | Sound | Subtitles |
|---|---|---|---|---|---|---|
| avarayr-landscape | a | 9 | 10 | 8 | 9 | 9 |
| avarayr-landscape | b | 10 | 9 | 8 | 9 | 10 |
| dvin-vertical | a | 10 | 9 | 8 | 8 | 10 |
| dvin-vertical | b | 10 | 10 | 9 | 8 | 10 |
| tushpa-landscape | a | 8 | 9 | 7 | 10 | 10 |
| tushpa-landscape | b | 9 | 10 | 8 | 9 | 9 |

Lowest score of the round: 7.

What the reviewers found (the points that cost marks):

- History (Tushpa): the battle of 743 BC by the Euphrates shown as the game's battle round the walled citadel, which suggests a siege history does not record.
- Picture (Tushpa): the van painting at almost five times its size went soft and blocky, a wall face and no ridge. Avarayr: the camera kept Vardan at the top edge under the plaque as he fell; the reserves still read as a column; an arrow from Persia read as an army on the march in 449, when the sources record only the edict.
- Sound (Dvin upright): inside a sentence the name came out 'Dween', a w and not a v.
- Subtitles: 'Now Assyrian spears fill / the vale below the rock' split the verb from its object.

What was changed after this round:

- A painter of its own for the Rock of Van (film-page.js): a long, narrow limestone ridge rising steeply from the plain, its walls and towers along the crest, Lake Van to the west and the snow peaks beyond, in the chronicle's flat colours and sharp at any zoom.
- Tushpa's 743 BC is a page and then the Assyrian army on the move, with no citadel in sight. Avarayr: Vardan stands inside the bend of the road and the reserves come on three sides; he falls in the middle of the frame; the chart's arrow points the way to Sasanian Persia ('To Sasanian Persia'), a direction and not an army; a longer beat after his fall.
- Dvin upright says 'the capital' where the name would be swallowed after a consonant, and 'not yet a conquest; Dvin rose again', where the name opens a phrase and is heard whole; its city standing again on its own field.

## Round 13

Tushpa and Avarayr landscape, then Dvin upright. Avarayr's landscape cut passed every score.

| Cut | Reviewer | History | Pacing | Picture | Sound | Subtitles |
|---|---|---|---|---|---|---|
| avarayr-landscape | a | 10 | 10 | 9 | 9 | 10 |
| avarayr-landscape | b | 10 | 10 | 9 | 9 | 10 |
| dvin-vertical | a | 10 | 9 | 8 | 9 | 9 |
| dvin-vertical | b | 10 | 9 | 9 | 9 | 10 |
| tushpa-landscape | a | 9 | 9 | 8 | 9 | 10 |
| tushpa-landscape | b | 9 | 10 | 9 | 10 | 10 |

Lowest score of the round: 8.

What the reviewers found (the points that cost marks):

- History (Tushpa): the 735 BC arrow drew a route into Tushpa that no source gives.
- Picture (Tushpa): the 743 BC defeat shown as the Assyrian column on Tushpa's own road, as if the battle were fought there; the same date and place twice (page, then plaque); the gates' battle framed into the bottom fifth. Dvin upright: its chart zoomed in on bare parchment; compression softening the art (SSIM 0.945 with room under the size aim).

What was changed after this round:

- Tushpa: no route drawn for 735 BC (the army is kept in shot below the rock); 743 BC marked as a place off the chart's western edge; the gates framed above the subtitles; the inscription a soft dark slab. Dvin upright: the chart wide enough to place Dvin by Lake Sevan; the size aim filled to 94%.

## Round 14

Tushpa landscape, then Dvin upright. Dvin's upright cut passed every score.

| Cut | Reviewer | History | Pacing | Picture | Sound | Subtitles |
|---|---|---|---|---|---|---|
| dvin-vertical | a | 10 | 9 | 9 | 9 | 9 |
| dvin-vertical | b | 10 | 9 | 9 | 9 | 10 |
| tushpa-landscape | a | 10 | 10 | 9 | 10 | 10 |
| tushpa-landscape | b | 9 | 9 | 8 | 10 | 10 |

Lowest score of the round: 8.

What the reviewers found (the points that cost marks):

- Picture (Tushpa): the arrow west to the Euphrates read as Sarduri marching out of Tushpa; the Rock of Van shown empty while the voice and plaque spoke of the army in Biainili.

What was changed after this round:

- The arrow starts at the chart's western edge, not at Tushpa; the army stays on screen, under the rock, to the end of its sentence.

## Round 15

Tushpa landscape.

| Cut | Reviewer | History | Pacing | Picture | Sound | Subtitles |
|---|---|---|---|---|---|---|
| tushpa-landscape | a | 10 | 10 | 8 | 10 | 10 |
| tushpa-landscape | b | 10 | 10 | 8 | 10 | 10 |

Lowest score of the round: 8.

What the reviewers found (the points that cost marks):

- Picture: 'Kummuh, by the Euphrates' floated over a river beside Lake Van, so the wrong river read as the Euphrates; 'The citadel did not fall' over the game's keep cut by the frame's edge; the inscription slab too soft.

What was changed after this round:

- The chart is gone from 743 BC; 'The citadel did not fall' is spoken over the painted Rock of Van with its walls whole; the slab a little sharper.

## Round 16

Tushpa landscape.

| Cut | Reviewer | History | Pacing | Picture | Sound | Subtitles |
|---|---|---|---|---|---|---|
| tushpa-landscape | a | 9 | 9 | 8 | 9 | 10 |
| tushpa-landscape | b | 10 | 10 | 9 | 10 | 10 |

Lowest score of the round: 8.

What the reviewers found (the points that cost marks):

- Picture: a plaque telling of Sarduri's flight by night (sourced, but never spoken) over the king standing in daylight; the gates' battle on the road, away from the gate.

What was changed after this round:

- The line is shortened to 'In 743 BC, by the Euphrates, he broke Sarduri.' and spoken whole over its page (under five seconds), the page naming the allies; the gates' battle is staged at the gate itself.

## Round 17

Tushpa landscape.

| Cut | Reviewer | History | Pacing | Picture | Sound | Subtitles |
|---|---|---|---|---|---|---|
| tushpa-landscape | a | 10 | 10 | 9 | 9 | 10 |
| tushpa-landscape | b | 10 | 9 | 8 | 9 | 10 |

Lowest score of the round: 8.

What the reviewers found (the points that cost marks):

- Picture: 'The citadel did not fall' came up three seconds before 'and it did not'; the column at the gate ran into the bottom fifth; a long dissolve from the painted rock into the field.

What was changed after this round:

- The plaque comes with 'and it did not'; the gate is framed higher; the rock cuts quickly into the field.

## Round 18

Tushpa landscape. It passed every score, so every one of the eight cuts has now had all five scores at 9 or more from two fresh reviewers (Erebuni landscape in round 6, Avarayr upright in 8, Erebuni and Tushpa upright in 9, Dvin landscape in 11, Avarayr landscape in 13, Dvin upright in 14, Tushpa landscape in 18).

| Cut | Reviewer | History | Pacing | Picture | Sound | Subtitles |
|---|---|---|---|---|---|---|
| tushpa-landscape | a | 10 | 10 | 9 | 10 | 10 |
| tushpa-landscape | b | 10 | 9 | 9 | 9 | 10 |

Lowest score of the round: 9.

What the reviewers found (the points that cost marks):

- Left as they stand (each scored 9): the last plaque runs 0.65 s into the next shot; the painted Rock of Van serves three shots; the 743 BC page is near still for 4.9 s; the recognizer heard the second Biainili as 'Biaini'.

## Where it stands

All eight cuts passed, each with every score at 9 or more from two fresh reviewers, in the round named above. The Dvin cuts are wired into the page with the other three (index.html, Film block).
