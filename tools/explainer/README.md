# tools/explainer: the chronicle explainer videos (stage 5)

Everything that makes the films in assets/explainer/. Nothing here is loaded by the game.

| File | What it is |
|---|---|
| scripts.json | The narration of all eight cuts (true spelling), the numbers as spoken, and the lexicon: every name's IPA |
| sources.json | For every line of every script, where it comes from (index.html's own texts, docs/history) |
| voice.json | The voice chosen and its speed |
| films.js | The picture of each cut: scenes and plaques, placed by the narration's sentences |
| tts.py | Narration: one sentence at a time, names as IPA, exact sentence timings beside the wav |
| measure.py | Loudness, peak, pace, pitch, and what a speech recognizer hears (word error rate, names) |
| audition.py | Reads one cut with many voices and measures each (docs/specs/explainer/voice.md) |
| film.js, film-page.js | The picture: the game's own page (index.html in its photo harness) draws every frame |
| build.py | One cut from start to end: narration, subtitles, picture, sound mix, the files, the measures |
| review-pack.sh, subs-preview.js, review-brief.md, review.sh | The independent review of a cut (docs/specs/explainer/reviews.md) |
| gen-docs.py | Writes docs/specs/explainer/<battlefield>.md from scripts.json and sources.json |

## To build

Needs: ffmpeg, node with playwright (as the other tools here), and a Python 3.11 environment with
`pip install kokoro-onnx piper-tts faster-whisper soundfile`. Model files, in a folder named by TTS_MODELS:
`kokoro/kokoro-v1.0.onnx` and `kokoro/voices-v1.0.bin` (github.com/thewh1teagle/kokoro-onnx, release model-files-v1.0);
Piper voices, only for the audition, in `piper/`.

    export TTS_MODELS=/path/to/models
    python tools/explainer/build.py erebuni-landscape --work /some/scratch/dir
    python tools/explainer/build.py erebuni-vertical --work /some/scratch/dir      (and so on: tushpa, avarayr, dvin)

Options: `--narr-only` makes the narration, its cues and the recognizer's hearing and stops (a quick look; with
`node film.js <cut> <work>/<cut>.narr.wav.json <dir>/look --stills <dir> --every 1 --ss 0.5` a still a second);
`--skip-film` keeps the picture already rendered in the work folder (after a change to words that does not move
the timings much, render again); `--no-music` leaves the music bed out; `--webm` also tries a VP9 file and keeps it if it
is smaller. A landscape cut takes about ten minutes, most of it the picture (1,800 frames photographed from the page).

## How the picture is made

film.js opens index.html with `?shot=battle&lv=<id>&nohud` (the photo harness: in-memory storage, a fixed random seed)
and injects film-page.js. That script draws each frame with the game's own painters: the battlefield through `draw()`
with the harness's zoom, the battle moving through `update()`, the campaign chart through `buildWorldTerrain()`, the
chronicle's painting through `briefScene()`. Titles and plaques are drawn in the game's palette and faces; every word
on them is from the battlefield's own texts. The frames are photographed larger than the video and scaled down.
index.html is not changed.

## The rules the scripts keep

History only from the battlefield's own texts in index.html and docs/history/*.json; neutral toward every people; no
invented facts, numbers or quotes; the film never claims a siege or battle that history does not record, and it does
not apologise for the game: the battlefield scenes are the game's staging and carry no label (the owner's rule).
No long dashes.
