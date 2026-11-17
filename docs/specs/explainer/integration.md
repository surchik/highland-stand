# Stage 5, Phase B: how the page should play the explainer videos

Phase A (this branch, s5/work) made the media and touched nothing else: no change to index.html, deploy/update.sh or
the test tools. This page is the brief for Phase B, to be done by the coordinator once stage 6 is merged. The sizes and
lengths of the files are in the table at the end (files.md has the same table with the measures).

## 0. Phase B as built (read this first)

The page plays the films since the "Film" block of index.html (after `briefPage()`), with these departures from the
brief below, by the owner's word ("use the ones already made, we can improve them later"):

- Three films, not four: Erebuni, Tushpa and Avarayr. Dvin has no video yet, so its two .vtt files were taken out of
  assets/explainer/ (tools/explainer builds them again with the film); Dvin shows the text chronicle. To add a film,
  put its six files in assets/explainer/<id>/ and add the id to `IDS` in the Film block and in tools/regress/film.js.
- The film is a layer over the whole page, not a box inside the chronicle's block: when it goes (Skip, Escape, its
  end, a failure) the chronicle stands under it untouched. So "Begin the Stand" and "Campaign Map" are pressed after
  Skip, not during the film.
- Subtitles are the browser's own (`<track kind="subtitles" default>`, styled with `::cue`), not drawn by the page.
- Seen once, a battlefield's film does not play by itself again (`hs_film_seen_<id>`; `next:` before it at /next/):
  the chronicle then shows a "Watch the film" button before Campaign Map. The same button, and no autoplay, when the
  player asks for less data or less motion.
- No setting to turn the films off, no pause of other sound (the chronicle's horn is not played when a film starts).
- A browser driven by a test (`navigator.webdriver`) gets the text chronicle alone, as under the harness, unless the
  test sets `window.__hsFilmTest` (tools/regress/film.js).
- deploy/update.sh publishes assets/explainer/*/*.{mp4,vtt,jpg} at / and at /next/ (tools/platform/test-update.sh,
  part F).

## 1. What there is

For each of the first four battlefields of the campaign (LEVELS ids `erebuni`, `tushpa`, `avarayr`, `dvin`):

    assets/explainer/<id>/landscape.mp4          1280 x 720, 30 fps, H.264 High + AAC stereo, about 60 s, faststart
    assets/explainer/<id>/landscape.vtt          its subtitles (WebVTT, English, true spelling)
    assets/explainer/<id>/landscape-poster.jpg   its title frame
    assets/explainer/<id>/vertical.mp4           720 x 1280, 30 fps, about 30 s (its own shorter script)
    assets/explainer/<id>/vertical.vtt
    assets/explainer/<id>/vertical-poster.jpg

No .webm is shipped: VP9 at the same quality came out no smaller than the H.264 file, and every browser the game runs on
plays H.264 in mp4. The videos carry no burned-in subtitles; the bottom fifth of the picture is kept free of plaques so
the page's subtitles can sit there. Each film opens on a title card (the battlefield's name, its Armenian name, its
date) and ends, held, on a closing card ("Begin the Stand" over the same name).

## 2. Where it plays

On the chronicle page (`briefPage()`), for a campaign battle on one of the four battlefields, the film takes the place
of the chronicle's text before the battle. Keep a table in the page keyed by battlefield id (never by index: ids do not
move when a battlefield is inserted):

    const EXPLAINERS = { erebuni: 1, tushpa: 1, avarayr: 1, dvin: 1 };   // assets/explainer/<id>/

Paths must be relative to the page (`assets/explainer/...`), not rooted at `/`: the same page is served at `/` and at
`/next/`, and the trailer's rooted `/trailer.mp4` is why staging plays the live site's trailer.

The film does not play:

- in the harness (`HARNESS_ON`): no video element is made, nothing is fetched, no test waits on a file;
- on a daily challenge's chronicle or a ranked Standard battle's page (they are not the campaign's story page);
- when the player has asked for less data (`navigator.connection && navigator.connection.saveData`, or an
  `effectiveType` of `2g` or `slow-2g`) or the browser reports `prefers-reduced-data: reduce`;
- when a setting turns it off. Suggested: Settings, "Chronicle films", on by default.

In each of those cases the text chronicle shows as it does today.

## 3. Starting it

1. When the chronicle opens, build the player (section 6) and choose the cut once: `vertical` when the viewport is
   taller than it is wide (`matchMedia("(orientation: portrait)")`), else `landscape`. Do not switch cut while it plays:
   the two cuts have different scripts and lengths. If the phone is turned, keep playing the cut that started,
   letterboxed.
2. Set `poster`, `playsinline`, `preload="auto"` and the `src` only now (lazy: nothing of a film is requested before
   its own chronicle opens; the map and the other battlefields cost nothing).
3. Try sound first: the tap that opened the battlefield is a user gesture, so most browsers allow it.

       v.muted = false; v.volume = <the game's sound volume>;
       v.play().catch(() => { v.muted = true; showSoundOn(); return v.play(); }).catch(showTextChronicle);

   If the game's sound is switched off in Settings, start muted at once and do not show "Sound on" as a nag: show it as
   an ordinary button the player may press.
4. Muted or not, subtitles are on (the owner: the narration's text is shown as subtitles at the bottom).
5. "Sound on" (shown whenever the film is muted): one press sets `v.muted = false`, hides the button and remembers
   nothing (the next film tries sound again). It is a real button, at least 44 px, labelled with words, not only an icon:
   the trailer's lesson is that a silent video with no clear way to hear it reads as broken.
6. "Skip" is always there from the first frame (Esc does the same): it stops the film, releases it
   (`v.pause(); v.removeAttribute("src"); v.load()`) and shows the text chronicle exactly as today.
7. "Begin the Stand" and "Campaign Map" stay where they are and work at any moment; either one stops and releases the
   film first.
8. When the film ends, leave its closing card for about a second, then show the text chronicle with a small
   "Watch again" button beside the page dots. The player can still read the full four-page chronicle: the film is the
   short telling, the text the long one.

## 4. Falling back to the text chronicle

The text chronicle is the fallback and must appear without the player doing anything when:

- the video element fires `error`, or its source cannot be fetched;
- nothing has started within 4 seconds of opening (`playing` not seen): stop the load and show the text (a slow
  connection must not leave the player looking at a poster);
- playback stalls for more than 5 seconds in a row (`waiting` with no `playing` after it);
- both `play()` calls are refused.

`prefers-reduced-motion: reduce`: do not autoplay. Show the poster with a "Play the film" button over the text
chronicle's page, and the text beside or under it as today.

The film never blocks the game: a failure of any kind is silent and leaves today's page.

## 5. Subtitles

Fetch the cut's `.vtt` with `fetch()` when the film starts and draw the cues in the page's own element over the bottom
of the video, timed from `timeupdate` (or `requestVideoFrameCallback` where there is one). Reasons: the built-in `::cue`
styling differs between browsers and cannot be given the game's face; iOS moves native captions about; and a `.vtt`
served with the wrong MIME type (older nginx `mime.types` has no `text/vtt`) is refused by `<track>` in some browsers
but not by `fetch()`. The parser needed is small: blocks separated by blank lines, a line `hh:mm:ss.mmm --> hh:mm:ss.mmm`,
then one or two lines of text; there are no cue settings, tags or notes in these files.

Also add `<track kind="captions" srclang="en" label="English" src="...vtt">` with `mode = "hidden"` so assistive
technology can find the text; do not let the browser draw it too.

Look: the game's serif face, about 4.4% of the video's shorter side in size, cream (#f6ecd2) on a dark plate
(rgba(18, 12, 6, .78)), centred, 5% above the video's bottom edge, at most two lines (the cues are cut to two lines of
about 37 letters). tools/explainer/subs-preview.js draws exactly this for the reviewers. If the subtitles fail to load,
the film still plays.

## 6. The player on the page

- One `<video>` inside the chronicle's content block, in place of the miniature and the text (landscape: as wide as the
  block, 16:9; upright phone: as tall as the block allows, 9:16, centred). `object-fit: contain`, background the page's
  dark tone. No native controls; the page's own three buttons (Sound on, Skip, and a pause on tap of the picture).
- `aria-label`: "Film: the history of <battlefield name>, <n> seconds". The Skip button takes focus when the film
  starts, so Enter or Space skips.
- Battle music: stage 6 rules that it never plays on the chronicle. Nothing else may sound while the film plays (pause
  the map's ambience, if any). The film's own sound follows the game's master sound switch and volume.
- When the page is hidden (`visibilitychange`) pause; resume when it shows again.
- Leaving the chronicle by any road (map, begin, back, the Hall) releases the video so its download stops.
- Remember nothing by default. Open question for the owner: should the film autoplay every time the chronicle of
  that battlefield opens (his words: "plays by itself when the chronicle opens"), or only the first time, with
  "Watch again" after that? The brief above does the first; the second is one saved flag per battlefield
  (`hs_film_seen_<id>`, under HS_KEY_PREFIX).

## 7. Publishing (deploy/update.sh)

Today update.sh publishes only named files beside the page (og.jpg, the trailer). The films need:

- live: every file under `assets/explainer/` copied to `<web root>/assets/explainer/` the way `publish_og` copies its
  list (compare, install to `.new`, rename), on every run. Stage 6 adds `assets/music/` and `assets/victory/` the same
  way: one loop over the three folders is enough.
- staging: `publish_next` reads files straight from the branch with `git show` and today takes only index.html and
  og.jpg. It needs the same folders (`git ls-tree -r --name-only <rev> assets/explainer` and a `git show` for each), or
  the films will 404 at `/next/` and every chronicle there will fall back to text (which is safe, but hides the feature
  from the very place it is to be tested).
- the run-after gap: the run that pulls a commit is still the old script, so new files go out one run (two minutes)
  after the page. The fallback in section 4 covers those two minutes.
- web server: mp4 must be served with byte ranges (nginx does by default) so the film starts before it has all
  arrived and so iOS plays it at all; `Cache-Control` of a day or more is fine, the names are stable and a changed film
  can be given a `?v=` from the page.
- deploy/check-page.js needs no change. The page has no Content-Security-Policy that would stop same-origin media.

## 8. Tests to add in Phase B

- Harness and selftest: no `<video>` exists on a chronicle page; `?shot=brief` screenshots are unchanged.
- Unit: the choice of cut by orientation; the VTT parser on the eight shipped files (each cue's end after its start, no
  overlap, text not empty); the fallback timers (with a fake clock); Skip, Begin and Map release the video.
- A check that every id in EXPLAINERS has its six files in the repository, and that every file under assets/explainer
  belongs to an id in LEVELS.

## 9. Rebuilding a film

tools/explainer/README.md has the steps. In short: `build.py <id>-<landscape|vertical>` makes narration, subtitles,
picture, sound and the files from scripts.json (the words), films.js (the picture) and voice.json (the voice). The music
bed under the voice is one of the owner's recordings in assets/music (quiet, and lowered further while the voice
speaks); `--no-music` builds a film with the voice alone if the owner prefers the chronicle without music.

## 10. The files

