# Review of package P0, the platform's seam

Reviewed: branch `pf/work` at `481d7a4` against its base `3714b0d` (branch `next`). The reviewer did not build
the package, changed none of its code, and reran what the builder's report claims. Probe scripts and logs are
in `/tmp/claude-0/-home-user/169f7cc7-9178-569c-b36f-88a849db13cf/scratchpad/top/build/review/P0/`
(`cmp.js`, `probe2.js`, `probe3.js`, `probe4.js`, `probe5.js`, `probe5b.js`, `mut.js`, `logs/`, `shots/`).

**REVIEW P0: 0 blockers, 3 majors, 9 minors.**

The package does what its "done when" asks. With the constants empty the pages are the pages of before, pixel
for pixel, in every staged scene; the selftest keeps its 151 checks; the Hall opens under the harness, on
`file://` and under `?selftest`; `/next/` keeps its keys under `next:`; `tools/platform/p0.js` is a strong
suite (18 of the reviewer's 18 mutants were caught). The three majors are things the shell must hold before the
packages that fill it: the five tabs the two specs name do not fit it, two addresses serve the staging build
on the live game's saves, and a field in a tab is thrown away when a phone's keyboard comes up.

## Findings

### 1. MAJOR. The five tabs the two specs name do not fit the tab row on any layout

The Hall will hold five tabs once both tracks land (5.5: the War Council, the Captains, Daily, Leaderboards,
Account). The row scrolls (`overflow: auto`) with its scrollbar hidden and no mark that more lies past its
edge. `p0.js` only ever tries four tabs ("four tabs do not fit beside the close button" is its bar).

Evidence (`probe3.js` part A: a plain page, five tabs pushed with the specs' names and short names):

```
A five real tabs 1600x900: {"scrollW":673,"clientW":626,...,"cut":["account shows 73x44 of 116x44"]}
A five real tabs 1194x834: {"scrollW":673,"clientW":626,...,"cut":["account shows 73x44 of 116x44"]}
A five real tabs 667x320:  {"scrollH":309,"clientH":256,...,"cut":["account shows 64x8 of 64x59"]}
```

`probe2.js` (the harness's `&testtab=5`) at the ten iPhone sizes of `tools/regress/iphone.js`: the fifth tab
is cut at 667x320, 734x343, 852x343 and 932x380 held sideways (column 309 px of content in 256 to 295 px) and
at both upright sizes (row 328 px in 309 and 327 px). Photos: `shots/hall-ses-5.png` (the fifth medallion is a
6 px sliver at the bottom edge), `shots/hall-desk-5.png` ("Test ta" cut by the close button),
`shots/hall-seu-5.png`. On a desktop the row cannot be scrolled by a mouse wheel at all; the Account tab is
reached there only by the arrow keys.

Fix (PF-CSS and PF-HTML, the shell only):
- Sideways phone: take the close button out of the 64 px column (put it at the top right corner of the tab's
  box, 44 px, inside the safe area) so the column holds five medallions: 5 x 58 px + 4 x 2 px = 298 px in the
  304 px there are at 667x320. Keep the box at 560 x 280 or more.
- Upright phone: tabs 58 px wide instead of 64 (5 x 58 + 4 x 2 = 298 px beside the 44 px close button in 359 px).
- Desktop and iPad: let the row wrap to a second line (`flex-wrap: wrap`) or tighten it (padding `0 12px 0 10px`,
  gap 6 px, 15 px type) until the five names fit in 626 px; measure with the real names.
- For a sixth tab and beyond: a fade at the row's cut edge (as `phoneFold` gives the box).
- `p0.js`: walk the Hall with five tabs named as the specs name them at 1600x900, 1194x834, 667x320, 852x343
  with the safe areas, and 375x553, and fail when any tab is not whole inside the row without scrolling.

### 2. MAJOR. Two kinds of address serve the staging build while the page reads its channel as "live"

`const HS_CHANNEL = /^\/next(\/|$)/.test(location.pathname) ? "next" : "live";` (index.html line 3254) reads the
path as the browser spells it. The owner's nginx (`deploy/setup-server.sh` line 76: `try_files $uri $uri/
/index.html`) matches on the normalized `$uri`: doubled slashes merged (`merge_slashes` is on by default) and
percent codes decoded. So `https://highland.avunjian.com//next/` and `/%6Eext/` are answered with
`$WEB/next/index.html`, the browser keeps the path as typed, the page calls itself "live", and a build under
trial reads, migrates and writes the real save.

Evidence (`probe4.js`: a static server that normalizes the path as nginx does, the pf page, a fresh browser):

```
/next/     served 200 next | pathname /next/    | HS_CHANNEL next
//next/    served 200 next | pathname //next/   | HS_CHANNEL live | real keys: hs_chapters_seen hs_mig_7lv hs_mig_ids hs_mig_rec hs_records hs_settings hs_unlocked_seen
/%6Eext/   served 200 next | pathname /%6Eext/  | HS_CHANNEL live | real keys: hs_chapters_seen hs_mig_7lv ... hs_unlocked_seen
```

Not tried against a real nginx (none on this machine): the server's behavior is taken from nginx's documented
defaults. `p0.js` tries `/next`, `/next/index.html`, `/nextish/` and `/index.html` only.

Fix (the one line, still beginning `const HS_CHANNEL = ` so the publishing script's check holds):

```js
const HS_CHANNEL = (() => {
  let p = location.pathname;
  try { p = decodeURIComponent(p); } catch (e) {}
  return /^\/next(\/|$)/i.test(p.replace(/\/{2,}/g, "/")) ? "next" : "live";
})();
```

and in `p0.js` let the test server merge slashes and decode, and add `//next/`, `/%6Eext/` and `/NEXT/` to the
paths that must read "next" and write no key without the prefix.

### 3. MAJOR. A field inside a tab is destroyed when a phone's on-screen keyboard shrinks the window

The Hall's `resize` listener (index.html, the platform section: "the page changed layout under an open tab")
calls `showHallTab(hallTab, false)` whenever `hallLayout()` changes, which empties the box and draws the tab
again. On Android Chrome the keyboard shrinks the window: an upright phone 393 px wide drops under 500 px of
height, `PHONE_WIDE_MQ` matches, the layout turns from "tall" to "side", and the field being typed in is thrown
away with what was typed; the keyboard then closes and the tab is drawn a third time. iOS Safari does not
resize the window for its keyboard, so iPhones are spared. The Account tab's name field (5.5) and any field of
gameplay's sit in this box.

Evidence (`probe5.js`, 393x780 by touch, `&testtab=2`, "Ar" typed, then the window set to 393x440):

```
before keyboard:     {"layout":"tall","value":"Ar","focused":"hallTestInput"}
keyboard up 393x440: {"layout":"side","sameField":false,"value":"","focused":"hlTab"}
```

Fix: in that listener, do not draw again while the focus is in a field of the tab, and leave `hallLayoutWas`
as it was so the draw is made up at the next change:

```js
const a = document.activeElement;
if (hallBodyEl.contains(a) && a.matches("input, textarea, select, [contenteditable]")) return;
```

and a check in `p0.js` (type in the test tab's field, shrink the window's height, the same field still holds
the text and the focus).

### 4. MINOR. Off is not quite off: the plaque with no tab takes the focus and shows a ring

With no tab the tally is `<button role="img" tabindex="-1">`: no Tab stop, but a mouse click still focuses it
(as any button), and the next key press (an arrow that turns the map's chapter) draws the browser's focus ring
around it. On the base the same click and key change nothing.

Evidence (`probe3.js` part B, `?shot=menu&unlock`, a click on the tally, ArrowRight, ArrowLeft, both pages):

```
B click+arrow base active: BODY fv=false outline=none 3px
B click+arrow pf active: ovStars fv=true outline=auto 1px
B click+arrow pixels: DIFFER
```

Photo: `shots/crop-pf.png` (a white ring around CAMPAIGN 6/51). `cmp.js`'s three "map focus tally" pairs differ
for the same reason. By touch the pages stay the same ("B tap pixels: same").

Fix (PF-CSS): `#ovStars:not(.door) { outline: none; }`, and in PF-MAIN keep the click from taking the focus
while it is no door: `$("ovStars").addEventListener("mousedown", (e) => { if (!hallTabs().length) e.preventDefault(); });`.
Add the click-then-key pair to `compare-shots.js`.

### 5. MINOR. After a crash under the Hall, "Return to map" leaves the Hall over the map

`recoverToMap()` closes the nardi board and the town but knows nothing of the Hall. Evidence (`probe3.js` part C):

```
C after Return to map: {"hallOpen":true,"blocking":true,"inert":true,"mode":"map","focus":"BODY","focusInHall":false}
```

The player pressed "Return to map" and sees the Hall, with the focus outside it; Escape or the close button
still works, so nobody is stuck. Fix: `recoverToMap` is the game's function, so by ruling S7 the line is named
here and not changed in silence: add `try { closeHall(); } catch (e) {}` beside its two `close()` lines (a
line for table 0.4), or have the Hall close itself in `showCrashCard`'s platform line.

### 6. MINOR. Opened from Settings' row, the Hall gives the focus back to nothing

`openHall` reads `document.activeElement` after `closeSettings()` has already hidden the row that was pressed,
so on close the focus falls to `<body>`. Evidence (`probe3.js` part Q, at 1600x900, 1194x834 and 667x320):
`Q focus after Settings row -> Hall -> Escape: BODY settings=none`. Fix: in `#setAcct`'s click handler pass the
gear as the place to return to (set `hallFocus = isPhone() || !overlayEl.classList.contains("hidden") ?
$("ovGear") : null` after `openHall`), or let `closeHall` fall back to `#ovGear` when what held the focus is
no longer shown.

### 7. MINOR. A second tap on the tally's spot presses what the Hall puts under it

The Hall comes up on the tap's click, and takes presses at once. Held upright the tally's spot is over the
tab row (`probe2.js`: `"underTap":"span.hlIc"`), so a double tap on the tally opens the Hall on the Council
and then turns it to the first tab; held sideways the spot (x 425 to 497, y 8 to 52 at 667x320) is over the
tab's own content, where a tab may have a button. The game guards its own pages against this
(`settleOverlay`). Fix: `#hall.hlSettling { pointer-events: none; }` for 300 ms after `openHall` shows it.

### 8. MINOR. With the platform off the tally is the Hall's only door

`#setAcct` shows only under `body.pfOn`, so on `file://`, with the constants empty, or with the switch off,
gameplay's War Council and Captains are reached through the tally alone. The tally gives way to a long title
(`fitCampaignStars` sets `visibility: hidden`) and the chronicle and the stories leave it out. The spec asks
for exactly this (0.4: the row "when the platform is on"), so it is not the builder's fault; it is named for
the two tracks: either the row shows whenever the Hall has a tab (labeled for what the Hall then holds), or
gameplay keeps a door of its own on the pages where the tally is away.

### 9. MINOR. The door says nothing of where it leads

As a door the tally keeps `title` and `aria-label` "Stars won across the campaign: 6 of 51"; only
`aria-haspopup="dialog"` tells a screen reader more, and a mouse's tooltip tells nothing. 5.5 gives the round
button the title "Daily challenge and leaderboards". Fix in `syncHallDoors`: while it is a door, append
". Open the Hall" to both (and take it off again when it is not), without touching `syncChapterBar`.

### 10. MINOR. What `p0.js` does not hold

- five tabs (finding 1), the normalized staging paths (finding 2), a field under a resize (finding 3);
- the ten iPhone sizes: it walks 667x320, 852x393 and 375x553 only. `probe2.js` walked all ten, 1194x834,
  834x1194, 1024x768, 1600x900 and 1280x560 with four and five tabs: the box is never under 577 x 302 held
  sideways, every button is 44 px, nothing but the cut fifth tab lies outside the safe area, the Tab key never
  leaves the Hall for the page under it. Worth adding the eight sideways sizes for the box alone (cheap);
- `?selftest`: the package says the Hall works there; nothing tries it (`probe5b.js` did: it opens);
- the mutant "getItem without the prefix" is caught only as "the walk stopped: Timeout 15000ms", not by a
  check that names the fault. A direct check: seed `hs_records` (no prefix) with a won save before opening
  `/next/` and assert the page sees no star.
- README: "About 70 s"; it took 107 s here beside the other track.

### 11. MINOR. The town under `/next/` (confirming the builder's own note)

`sessionStorage` keys `hs_town_open` and `hs_town_lowmem` (index.html lines 67691 to 67695) are not under the
prefix, and the town's own memory check (line 72736, `window.localStorage instanceof Storage`) reads the
`/next/` wrapper as "memory only". The town is hidden and out of scope; when it is shown, line 72736 should
read `HS_STORE_MEM` and the two marks should wear `HS_KEY_PREFIX`. For the integrator's list.

### 12. MINOR. Two edits sit outside the platform's four blocks

`HS_CHANNEL` and `HS_KEY_PREFIX` are declared in the harness block above the storage fallback, and the
fallback's own check now writes `HS_KEY_PREFIX + "hs_probe"`; a stylesheet comment at line 668 was reworded.
All three are right (the check wrote a raw `hs_probe` before the namespace existed) and the builder's report
names the first two. They should be added to table 0.4 in `platform.final.md` so the next reader of S7 finds
them there.

## What was checked and found sound

- **PF-0** is unchanged in meaning: the diff adds lines above and below it and alters none of its own.
- **Table 0.4**, line by line: `Platform.boot` at start-up in the same turn; the keydown guard right after
  `if (crashed) return;`; `Platform.victoryPage()` after `showRecord` in `endCelebration` (the only place a
  victory page is made); `Platform.defeatPage()` after `showDebrief` in `endFall`; `#ovStars` a button with the
  same content and hiding; `#setAcct` present and hidden; `track("error", ...)` first in `showCrashCard`.
- **Hotkey paths**: six `keydown` listeners in the file. The game's own (window) is guarded. The trick card's
  and the warn chip's (document) act only in battle; the nardi board's and the town's (window, capture) only
  while they are open, and the Hall neither opens over them nor can they open under it (the page is inert).
- **No name collides**: each of the 20 new top-level names is declared once in `pf`, never in the base, never
  in `gp/work` (`ec7448e`).
- **Network**: `p0.js`'s plain walk sees one request (the document) at `/` and on `file://`; the reviewer's
  mutant that adds a `fetch` at boot is caught.
- **Storage**: no other `Storage.prototype` use, no `storage` listener, no cookie, IndexedDB, cache or service
  worker in the file; `p0.js` logs every raw `getItem`, `setItem` and `removeItem` from before the page's
  script and finds none without the prefix under `/next/` and none with it at `/`.
- **Other pages**: the Hall opens over the chronicle and a chapter's story (menu pages; the tally is left out
  there, so only a later door reaches it), closes itself when a battle begins under it, stays under the crash
  card (z-index 90) and takes no Escape there, is drawn again when a phone is turned (667x320 to 320x667).
- **Style**: plain JavaScript in the file's manner, comments that say why, American spelling, no long dash in
  the diff or the new files.

## What was rerun, and its result

| command (from `/home/user/hs-wt/pf`) | result |
| --- | --- |
| `node deploy/check-page.js index.html` | PASS: 1 inline script parses |
| `timeout 900 node tools/selftest.js` | PASS: 151 checks, 0 errors, perfMs 11.25 |
| `node tools/town-isolation.js` | PASS: 9 cases, 0 bad |
| `node tools/platform/p0.js` | PASS: 0 fails, 106.9 s; boxes 680x320, 680x320, 577x302, 644x354, 357x464; 10 keys written under `next:` |
| `node tools/regress/run-all.js --only=iphone,doors,vic` (full) | PASS 3/3 in 801 s: iphone 657 states at ten sizes, doors 12 doors, vic 198 presses on 17 battlefields |
| `node tools/regress/run-all.js --quick`, run 1 | 6/9 at load 12 to 20 (the reviewer's own mutant runs and the other track beside it). PASS padplace, plots, probe, vic, live, iphone. FAIL nag, dance10, doors |
| `run-all.js --quick --only=nag,dance10,doors` | nag PASS, doors PASS, dance10 FAIL (load rose to 14 in the run) |
| `dance10.js --quick`, three times each on pf and on the base, turn about | pf: FAIL (load 10), PASS, PASS. base: FAIL (load 14, the same "a tap at 9862 ms ended the dance"), PASS, PASS |
| `node tools/regress/run-all.js --quick`, run 2 | PASS 9/9 in 663 s at load 7 (padplace, plots, probe, vic, nag, dance10, live, doors, iphone): the whole quick run green in one run |
| `node tools/platform/compare-shots.js /home/user/hs-wt/next/index.html` | 40 pairs, all the same |
| reviewer's `cmp.js` (base against pf, sha256 of each photo): the map (3), Settings over the map and over a battle, two chronicles, two battles, three victories, two defeats, the tally under the pointer, at 1600x900 by mouse, 1194x834 and 667x320 by touch | 45 pairs the same. 3 differ: the tally focused by script (finding 4) |
| reviewer's `mut.js`: 18 mutants of the page through `p0.js` | 18 caught (the guard, three of the namespace, two of inert, the cap, the column's width, the door with no tab, Escape, `/nextish/`, a request at boot, a test tab outside the harness, a 40 px close button, the Hall behind `file://`, boot not calling back, no error event, the safe area, the focus not returned) |

nag, doors and dance10 are load failures by the rule of the build: each passed when run again, and dance10
fails the same way on the base under the same load (its tap is timed at 9.4 s against the page's 10 s, and the
page's line that decides, 60445, is untouched).

## What could not be checked

- **Safari and iOS themselves.** Only Chromium is installed. That a `<button>` laid out as a flex column draws
  as the `<div>` did on iOS Safari, that iOS adds no tap highlight or dress of its own to it, and that the
  safe areas are real `env()` values rather than the suite's `--sa*` stand-ins, are all unseen.
- **A real nginx or Caddy** for finding 2 (the server was emulated).
- **A real Android phone** for finding 3 (the keyboard was stood in for by a window resize).
- **A screen reader** on the Hall (roles and labels were read in the DOM only).
- The plain page (no harness) was not compared pixel for pixel: it animates. The harness's scenes were.
