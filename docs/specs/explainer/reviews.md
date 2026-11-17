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
