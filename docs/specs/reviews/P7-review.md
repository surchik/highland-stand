# P7 review: the share card

Reviewer: an independent agent. It reran the builder's acceptance list on pf/work at 84eaead (tag p7-done) and
read the change from e3a346b line by line. It changed no code of the package. Probes and mutants are under
`scratchpad/top/build/review/P7/` (probe.js, off.js, m1, m2, m3, logs/).

REVIEW P7: 0 blockers, 2 majors, 4 minors.

## Findings

### 1. MAJOR: Save picture breaks when the rank arrives while the sheet is open, and the toast still says "Picture saved."

`shSync()` (index.html 83677) finishes a new picture whenever the card's words change, and then calls
`shUrlDrop()` (line 83688). That revokes `SH.url`, the object URL that the open sheet's picture and its
**Save picture** link (`save.href`, line 83868) still hold. It also blanks `SH.url`, so `shClose()` cannot drop
it later. The usual case is real: a player who taps Share quickly, before the post's answer comes (Copy picture
and Copy text keep working, so the player sees nothing wrong until the download fails).

Evidence: probe.js (a copy of platform.js flow 9 with one more step: open the sheet, then let the rank arrive),
`--flows=9 --sizes=desk,ses`:

```
PROBE sheet before {"href":"blob:http://127.0.0.1:40005/7f4d...","url":"blob:http://127.0.0.1:40005/7f4d..."}
PROBE sheet after rank {"href":"blob:.../7f4d...","url":"","up":true,"fetched":"fetch failed: Failed to fetch",...}
PROBE Save after rank: failure=canceled size=null
PROBE toasts ["Copied.","Picture saved."]
FAIL flow 9 mouse 1600x900 (a guest): console.error: Failed to load resource: net::ERR_FILE_NOT_FOUND
FAIL flow 9 iPhone SE Safari 667x320 (a guest): console.error: Failed to load resource: net::ERR_FILE_NOT_FOUND
```

Flow 9 does not catch it: it opens the sheet only after `f7settled` (the rank is already there).

Fix: in `shSync`'s success branch, when `SH.up` is true, do not drop the URL under the sheet. Make a new URL for
the new picture and swap it into the open sheet: `const old = SH.url; SH.url = URL.createObjectURL(r.blob);
shSheetEl.querySelector(".shPic").src = SH.url; shSheetEl.querySelector(".shSave").href = SH.url;` and then
revoke `old`. Keep `shUrlDrop()` as it is when the sheet is closed. Add a step to flow 9 that opens the sheet
before the rank arrives (hold the post's answer back, or call `shSync()` after changing `SC.page.rank` as the
staged daily already does), then presses Save and checks the download's bytes.

### 2. MAJOR: no share card for a victory the boards do not rank (the coached Erebuni stand, the owner's boards switch off, test mode, endless, aided)

Section 6 says the picture is drawn "when a victory page (or a daily's result) opens". It does not tie the card
to the leaderboard. The build ties it to the score strip: `scEnd` sets `SC.page = null` for `why` "unranked" or
"off", for aided runs and for endless (line 83341). `scRender` then sets no `pfShare`, and `shInfo()` returns
null without `SC.page` (line 83661). The builder lists this as difference 5. It costs two cases the owner will
care about:
- A new player's first victory is the coached Erebuni stand, which `battle_start` marks `ranked: false`
  (line 83240's comment: "never ranked: the coached stand"). This is the moment most likely to be shared.
- With the owner's boards switch off, nobody can share anything. The switch is about boards, not sharing.

No ruling allows this. The builder's report names it as a choice, not as something the spec asked for.

Fix: give the card its own record. In `scEnd`, for a won battle that has no strip (the same `return` on line
83341), keep a share-only record `SH.rec = { lv, diff, stars, lives, livesMax, sec, score: null, at }` from the
event's props (`p.lives` and `p.lives_board` as now, and `lives_max`). Have `shInfo` use `SC.page || SH.rec`. Omit
the score and rank rows when `score` is null, which `shareRows` does for the rank already. Show the Share
control without the strip: on desktop, iPad and upright, a `.scShare` button alone in `#ovScore`'s button row; held
sideways, the round `#shareBtn` and the Settings row. Exclude test mode and aided runs if the owner wants a
card only for a real victory, but say so in a ruling. In flow 9, add the coached Erebuni stand and a board-off
victory, each with a picture and no score row.

### 3. MINOR: flow 9 passes when the card has no words on it

Lens 5. Three mutants of index.html, each tested with the real flow 9 at desk:
- m1, `shRow` with its `fillText` calls removed (a card with the field, the veil and the stars, and no words):
  **PASS**, `RESULT platform PASS {"fails":0,... "9@desk":"pass 46s"}`.
- m2, `shSnap` returning at once (no field): FAIL, "the field was not copied (the gradient stood in)". Good.
- m3, `shLeave` not called: FAIL, "the card stays after the page". Good.

Flow 9 checks `shInfo()`'s object, `SH.text`, the JPEG's size and the download's bytes. It never checks that the
words reach the pixels. The "long title shrunk" check (platform.js, the `fit` line after Sis) measures the
title with its own canvas in the test, not on the card. So a wrong font, a row drawn off the canvas or a
transparent color would all pass.

Fix: in `f9ready`, draw the same info with `shareRows` and check pixels of the card itself. In the box of each
row (from x 64 to x 64 + w, the row's y minus its px to y), at least some pixels must be near the row's color
(#fff3d6 or #f0cf85) where the field alone (`SH.bg`, or a card drawn with `shareRows` returning []) has none. Or
export the shrunk size from `shRow` (`r.drawnPx`) and assert it in the test instead of measuring again.

### 4. MINOR: a picture that cannot be made leaves a Share button greyed for good

`shDraw` returns null when `toBlob` gives no blob (line 83798; this happens on a canvas the device cannot fit in
memory, an old iPhone under pressure). `shSync` then clears `SH.drawing` and returns. The strip's Share, the round
button and the Settings row stay `disabled` at 55% opacity for as long as the page is up, with nothing said.
There is no retry.

Fix: on a null result, hide the Share controls (or leave them live and have the tap fall back to the sheet's
**Copy text** and **Share link**, which need no picture). One retry after a second is cheap too.

### 5. MINOR: the copy reads the game's canvas geometry, beyond the seam of 0.3 (9)

Section 0.3 item 9 (platform.final.md line 236): "`battleFacts()` and `renderBriefArt(lvl)` may be read by the
share card (N9). Nothing else of the battle is." `shSnap` (line 83634) reads `offX`, `offY`, `scale`, `DPR`,
`VW`, `VH` and `canvas`. Section 6's own table asks for "the game canvas's field box", so the spec contradicts
itself and the builder named the reads under "others must know". But nothing in the seam protects them: a
gameplay change to how the field box is named or scaled breaks the copy without a test on gameplay's side.
`renderBriefArt(lvl)` is the sanctioned way to get the battlefield's art without the Victory plaque, the "Wave 1"
banner seen on every test card, or flying arrows.

Fix: ask for a ruling. Either add the six names to 0.3 (9) as read-only, so gameplay knows, or draw the card's
field from `renderBriefArt(lvl)` and keep the canvas copy out. At least use `renderBriefArt` before the gradient
when the copy fails.

### 6. MINOR: "Picture saved." is said on the tap, not when anything was saved

Line 83869: the toast and `share_done {method: "save"}` fire on the link's click whether a download happens or
not (finding 1's probe shows the toast after a canceled download). On iOS Safari, a `download` link to a blob
opens a preview page and saves nothing until the player acts, so the words are not true there either (that
path is reached only when `canShare` refuses files, which is rare on iOS).

Fix: say "Picture ready." or "Downloading the picture." and keep the event, or keep the words but only after
finding 1's fix makes the link always valid.

## The pictures, looked at by eye

The reviewer's own run of flow 9 with `--photos` (review/P7/photos/p7/, 46 files) and the builder's 46 in
shots/p7/:
- card-long-desk.jpg: "The King Yields on Terms" fills the 640 px column without clipping, with Սիս, "Nov 16, 2026 ·
  Normal", two gold stars and one hollow, "12 of 20 defenders kept", "Held in 25:00 · Score 8,260" (1,500 s is
  25:00, true), "#1 this week" in gold, "Held by Ninedesk", and the foot on the right. The crest is the page's
  own. Every line reads over the veil. The test's "Wave 1" banner shows faintly behind the title.
- card-guest-ses.jpg (phone): "Erebuni Rise Stands!", Էրեբունի, three stars, "18 of 20", "Held in 11:40 · Score
  9,460". There is no rank line and no "Held by" line, as a guest's card should be. The field is softer and the
  "150" pad signs are larger (the phone's small canvas). The words are sharp.
- sheet-short-i15u.png (upright): the sheet is one column, with the picture, Save picture and Copy picture side by side, and Copy
  text. Nothing is clipped and the X is 44 px.
- probe ages 1, 2, 9, 10, 12 and 16 (Tushpa, Avarayr, Gyumri Road, Halidzor, Van, Musa Dagh): every card has the
  field copied and its title. Sizes are 164 to 184 KB, inside the spec's 150 to 250.
- Settings held sideways (settings-ses.png): Account, Share and the tutorial row do not overlap.

## Reran, each to its end (pf/work at 84eaead)

| command | result |
| --- | --- |
| `node deploy/check-page.js index.html` | OK, exit 0 |
| `node tools/platform/unit.js` | PASS, 401 checks, 0 failed |
| `node tools/town-isolation.js` | PASS, 9 cases |
| `node tools/run-fixtures.js check` | PASS, 8 fixtures |
| `timeout 900 node tools/selftest.js --suite=all` | suite 1 PASS, 151 checks, 117.2 s of 125; suite 2 PASS, 39 checks, 72.5 s |
| `node tools/regress/platform.js index.html --flows=9` (all five sizes) | PASS, 0 fails, 231.3 s, 22 states |
| `node tools/regress/run-all.js index.html --quick` | 11 of 11 PASS, 1837 s (dance10 passed) |
| `node tools/regress/vic.js index.html` (full) | PASS, 17 levels, 249 presses, 0 fails, 1053.6 s |
| `node tools/regress/iphone.js index.html` (full) | PASS, 10 sizes, 737 states, 0 fails, 652.7 s |
| `node tools/regress/platform.js index.html` (every flow, every size) | PASS, 65 of 65 flow runs (flow 9 passed at desk, ipad, ses, i15h and i15u), 0 fails, 2093.7 s, 139 states |
| off.js: the committed page over http and over file:// | `PF_ON` false, no `#shareSheet`, `#shareBtn`, `i-share`, `#setShare` or `pfShare`, 0 requests besides the page, both times |
| probe.js `--flows=9 --sizes=desk,ses` | FAIL as finding 1 says (the probe's own step), every age's card drawn with its field |
| mutants m1, m2, m3 with flow 9 at desk | m1 PASS (finding 3), m2 FAIL, m3 FAIL |
| `git diff e3a346b 84eaead \| grep -c` for long dashes | 0 |
| the two Supabase constants in the committed page | both `""` |

Lens 3, privacy: between the page opening and the tap, flow 9's `f9quiet` allows only the stack's `hs_*`
calls and Auth. The probe saw nothing else. The picture and its words go nowhere unless the player shares. The
two events carry only `from` and `method`.

Lens 4, off means off: see off.js above. Every part is made behind `PF_ON`.

Lens 2, sharing: the native path (`canShare` with files, share ok, AbortError, another refusal opening the
sheet) and the sheet (Web Share absent: Save, Copy picture, Copy text; Share link where `share` exists) are
covered by flow 9 at every size with stubs, and they passed.

## Could not check

- A real iPhone or iPad Safari share sheet, and Safari's handling of a `ClipboardItem` built from a promise.
  Only Chromium with stubs was used.
- A real Supabase. Everything ran on tools/platform/stack.js.
- A daily's real card and a lost daily's card (P6 has not been built). Only the staged daily card was seen.
- Whether a real last wave leaves a banner or arrows on the copied field. The tests jump from wave 1 to victory.

## Close-out (the package closed on pf/work)

1. MAJOR, Save broken under a redraw: fixed. A new picture while the sheet is open fills the sheet again (`shFill`):
   a new object URL on the picture, Save picture and Copy picture, the old one let go after, the focus kept on its
   button. Flow 9 now opens the sheet, lets a new rank arrive, and checks the link's bytes and the download.
2. MAJOR, no card for an unranked victory: fixed. `scEnd` keeps `SH.rec` (the strip's shape, `score: null`) for a
   victory that has no strip: never ranked (the coached stand), the boards switched off, no bounds, no battle heard.
   The card then has no score and no rank, and its words no score. Share stands alone in `#ovScore` (desktop, iPad,
   upright) or as the round button and Settings' row held sideways. Aided victories (the test purse, test mode's
   unlock-all) and endless still get none: the player did not win them alone. Flow 9 wins a coached Tushpa; flow 7's
   boards-off victory now checks Share alone, and test mode checks there is no card.
3. MINOR, words not checked: fixed. `f9ready` finds each row's own color in its box on the card's canvas, far more
   than on the field alone. The no-words mutant now fails.
4. MINOR, Share grey for good: fixed. One more try, then Share is taken away (`SH.failed`). Checked at desk in flow 9.
5. MINOR, `shSnap` reads the field box: not changed. Section 6's own table names the game canvas's field box, which
   0.3 (9) does not list; this needs a ruling. `renderBriefArt` draws a framed picture into `#briefArt`, not a field.
6. MINOR, "Picture saved." on the tap: kept. These are section 6's words, and with finding 1 fixed the link always
   holds a live picture. Browsers that can share a file (iPhone, iPad) take the file path, not the sheet.
7. Found in the close-out's own runs (run-all --quick, flow 7 at 1600x900 under load): two tabs posting at once,
   the second tab's strip read "refused". The other tab's outbox had sent this tab's result while its own call was
   out, so the server answered `run_finished`. `scPost` now takes `run_finished` as posted (the result is on the
   board). Flow 7 posts again from tab 2 and checks the strip stays posted; the page without the fix fails it.
