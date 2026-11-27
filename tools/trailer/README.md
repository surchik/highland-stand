# tools/trailer: the first-visit trailer (trailer.mp4, trailer.webm, trailer-poster.jpg at the repository root)

30 seconds, 1920x1080, 30 fps. Two kinds of picture: the owner's cinematic clip (a Gemini video, kept outside the
repository; its burned-in words and wave counter are cropped away) and the game itself, filmed through
tools/explainer/film-page.js (the game's own painters, interface off). The voice is Kokoro am_michael; the music is
the owner's Sheyk Sar (assets/music/sheyk-sar.mp3), dipped under the voice.

| File | What it is |
|---|---|
| shots.json | The game shots: battlefield, camera (a to b), stage (crowds, the hero sent into a column, a tower going up) |
| shots.js | Renders them: `node tools/trailer/shots.js tools/trailer/shots.json <clips dir> [--only id,id] [--stills]` |
| captions.js | The words, as transparent PNGs in the game's faces: `node tools/trailer/captions.js <dir>` |
| edit.json | The edit: segments (clip, in point, length, speed, dissolve, push), captions and voice lines with their times |
| build.py | Cuts it all together: `python3 tools/trailer/build.py <clips> <captions> <voice> <gemini.mp4> <out>` |
| review-brief.md, review.sh | Independent review: two fresh `claude -p` reviewers score hook, picture, pacing, sound, words |

build.py refuses a game clip shorter than its segment (a short clip would shift every later cut). The voice lines
are l0 to l4b in the voice folder, made with tools/tts-kokoro.py or tools/explainer/tts.py (for Erebuni's IPA).
