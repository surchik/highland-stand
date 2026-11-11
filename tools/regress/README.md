# Regression suite

Scripts that play the real page in headless Chromium the way a player does: buttons pressed where they are drawn
(each press first checked with `elementFromPoint`, so a covered button fails), pads, plots and towers pressed on the
canvas where the game's own projection draws them, by mouse and by touch (CDP touch events, as an iPad's finger).
They need only Playwright with its Chromium:

```
NODE_PATH=$(npm root -g) node tools/regress/run-all.js            # the whole suite on index.html, about 28 min
NODE_PATH=$(npm root -g) node tools/regress/run-all.js --quick    # a sample of each, about 8 min
NODE_PATH=$(npm root -g) node tools/regress/run-all.js path/to/other/index.html --only=vic,doors
```

`run-all.js` prints one `PASS`/`FAIL` line per script with its failures under it, then a `SUMMARY` line, and exits 1
when anything failed. Under a script's line come its `KNOWN` lines: faults of the live game that the script reports
without failing (below). Its options: `--quick`, `--only=a,b`, `--jobs=n` (scripts side by side; the default 1 keeps
the timed ones honest), `--shots=dir` (a screenshot of every failure, a folder per script), `--log=dir` (each script's
whole output), `--strict` (a known fault fails its script too).

Each script also runs alone, takes the page as its first argument (default: the repo's `index.html`, or `GAME=`),
prints a `FAIL ...` line per problem and a `RESULT <name> PASS|FAIL {...}` line, and exits 1 on any failure. All accept
`--quick`, `--shots=dir` and `--verbose`; those that walk battlefields take `--levels=0,ani,10-16`.

| script | what it holds the game to |
| --- | --- |
| `padplace.js` | Every pad of every battlefield takes a tower: the tower's card pressed in the tray, then the pad pressed at the center of its paved ring, by mouse at 1600x900 and 2000x1250 and by touch at 1194x834 (a first tap arms the pad and shows the reach, a second builds). The press must build that tower on that pad. |
| `plots.js` | Every plot is bought through its price sign (the signboard's box as drawn this frame, `plotSignRects`), at 1600x900 by mouse and 1194x834 by touch, on an empty field (each claimed plot then takes a tower) and on a field with a tower on every pad, whose towers must not catch the press. |
| `probe.js` | Tapping a tower selects it: a tower of every kind and rank on every pad of every battlefield, each pressed on its body, must open its own panel (1600x900, 2000x1250, 1194x834 touch). |
| `vic.js` | The victory page at 2000x1250, 1440x900 and 1194x834 (touch) on every battlefield: the victory won in the game's loop, the dance ended by a tap, an ending card (Ani, Sis) put away by its button; every button wholly on screen, uncovered at center and corners, apart from the others, its label whole and at least 40 px tall to a finger; and each does its job (Next battle through a new chapter's nardi invitation and story to the next chronicle, Replay and Begin, Hold Forever, Campaign Map). One size at a time (`--jobs=3` for all three at once): each page's renderer grows by about half a gigabyte a minute over the run (master too), and three at once passed a 15 GB machine's memory. |
| `nag.js` | The tutorial played through on a fresh save, by mouse and by touch: the Send Wave step's reminders at 8 s and 18 s (Space named to a keyboard only, the button shaking, no wave by itself), the Auto step outlining Auto, Auto then sending the next wave by itself, and with Auto off the cleared field's reminder toasts at 15 s and every 25 s, three in all. |
| `dance10.js` | The victory dance: taps at 0.5, 3, 6 and 9.4 s leave it dancing, a tap after 10 s ends it without pressing the button that comes up under the finger, and left alone it dances on past 10 s to the end of its tune. Sis's horn call (an ending in terms, no dance) takes no tap. Mouse and touch. |
| `live.js` | Every battlefield played live for three waves at 4x with sound (the Web Audio graph opened by the first click): Shift+G test gold, six towers from the tray, Shift+click for 4x, Send Wave, Auto. Fails on any page or console error, the crash card, an exception inside a sound (the sound engine swallows them; the script counts them), a silent audio graph, or a stand lost. A trick's first-time card that is up when the stand ends (Tushpa's shields come on wave 4) is put away by its button, then each battle is left by Settings, Abandon, Abandon. |
| `doors.js` | The map's doors at 1600x900 (mouse), 1194x834 and 834x1194 (touch), in two loads of the page. A plain load (as a player opens the game; Under Ararat is hidden since a27052d): no Town door on the map, no town region loaded, and a town gift won earlier is not paid but waits; Nardi's door opens the board, its rules card and its leave card's Keep playing and Leave the board work. A `?town` load (the tester's door): the town's start card closed, then a town begun, its leave card's Keep and Leave. The map back in reach after each; then, in both loads, a battlefield tapped on the map, its chronicle begun and its first wave on the field (the `?town` load pays the waiting gift). |

| `iphone.js` | The game on an iPhone (touch, an iPhone's Safari user agent) at ten sizes: held sideways in Safari with its bars (SE 667x320, iPhone 15 734x343, Pro Max 814x380), the same in Safari across the whole width with the safe-area insets (iPhone 15 852x343, Pro Max 932x380: Safari with `viewport-fit=cover` may report the insets held sideways), from the Home Screen (SE 667x375; iPhone 15 852x393 and Pro Max 932x430 with the safe-area insets left 59, right 59, bottom 21) and held upright (393x659, 375x553). Every screen and pop-up is opened as a player opens it and held to the quality bar below; `--quick` takes the iPhone 15 in Safari and from the Home Screen. |
| `platform.js` | The platform's flows (docs/specs/platform.final.md 10.3) against the local stack (`tools/platform/stack.js`, which needs the machine's PostgreSQL 16 and `npm install --prefix tools/platform`): the page is served over http from a copy whose two public constants are filled with the stack's address and its throwaway anon key. Flow 1, the gate (nothing of the game in reach under it, the buttons as the server switches them, Discord held back while the server confirms emails itself, an in-app browser, a framed page, the privacy link); flow 2, sign-in with Google, Facebook and Discord through the stack's test provider (the address clean after every return, the name card's refusals, the welcome card, the Account tab and sign-out, a returning player, the session refreshed and refused); flow 3, every failure of a sign-in and "Play now" after two; flow 11, Auth down, hanging or offline and storage blocked, each ending in a battle played. Flow 10, analytics and `?stats`: a scripted first visit per kind of device and its funnel as the server counts it and the page shows it, hostile events sent straight to `hs_track`, the owner's switches, and the request logs that show nothing is sent from a webdriver without the test's switch, on `file://`, or with the constants empty. At 1600x900 (mouse), 1194x834 (touch), iPhone 667x320, 852x393 from the Home Screen with the insets, and 393x659 upright, each card held to `iphone.js`'s audit. `--flows=1,2,3,10,11`, `--sizes=desk,ipad,ses,i15h,i15u`, `--photos=dir`; `--quick` takes 1600x900 and 667x320. |

`iphone.js` in detail. Its states: Chapter I's story (every page), the campaign map (its battlefields' nodes and the
names drawn on it), Settings from the map and in battle, two chronicles (every page, a foe's card from a medallion, a
trick's card from the tricks row), a battle (its HUD and field, a tower tile's line, a long toast, the pause and wave
banners; Settings put away by its Resume or Pause and by its own close button; the wave's toast kept off its
ribbon), a busy field (the panel of the towers a finger reaches first on each side of it, of one choosing its
Mastery, a damaged one and a wreck), every tower by a finger on three full fields at top rank (the tap that opens a
panel presses nothing in it and spends no gold, the panel's buttons stay inside it and the safe area before and after
one tap on Sell, which never sells; a tap 16 px beside a tower opens it or only lights a plot, never buys one; a tower
built from a chosen tile opens at a tap while the tile is still chosen), the foe card from the next-wave row, every trick's first-time card and a card of
two, the line under the wave counter (Mari, Sis), Erebuni's scout bubble, the crash card, three victory pages (Ani's
and Sis's with their cards), the defeat page with its debrief, the end of an endless stand, the nardi board with its
rules, leave, invitation and game-over cards, the tutorial's coach walked step by step by a finger (the finger
that casts the spell on the field held over the next bubble's Skip tutorial must not press it), the rotate card
(upright) and the Home Screen tip (Safari). Held sideways the chronicle's first row of medallions is whole and a
column that runs past its fold fades there, the victory page's buttons are in sight without a scroll and 44 px tall,
and the defeat debrief's tip is in sight as the page opens. What it holds each to:
- a pop-up lies inside the visible area minus the safe areas, or scrolls inside itself with its way forward in view
  as it opens; held upright a page may scroll (the owner's best effort there);
- every control is on screen, out of the safe areas, hit at its center and the middle of each edge by
  `elementFromPoint`, and at least 44 x 44 px to a finger where it is the way forward (never under 36 px). The size is
  measured through the control's center with `elementFromPoint`, so a reach widened past the drawn button counts, and
  a wave chip counts the band of the wave cap the game reads as that chip (`foeTargetAt`);
- text at least 11 px, not cut off, not under a button or anything else, out of the safe areas; the text the game
  draws on its canvases too (`canvasHook` in `iphone-audit.js` measures every `fillText`: the wave and pause banners,
  the map's names, the nardi board, the field);
- held sideways the field fills at least 55% of the safe area and its part free of the HUD at least 45%; held upright
  (the owner's fallback, no portrait redesign) the 16:9 field can be no larger than the width allows, so it must span
  the whole safe width with under 3% of it under the HUD; no pad, plot sign or tower under the HUD; a tower's tap zone
  at least 36 px (the game's own measure, `towerTapReach`, where it has one: a phone widens the zone); a plot's price
  board at least 11 px as an iPhone shows it (the game's own sizing, `plotSignView`, read at the canvas's density on
  an iPhone, 2, whatever `--dpr` the run takes); a battlefield's node on the map 44 px to a finger (the game's
  `mapNodeRadius` where it has one);
- nothing that holds the battle is left without a way out: its close or onward button is pressed by a finger and
  must put it away (a panel by a tap on open ground);
- held upright, the rotate card speaks of a phone, and Play in portrait leaves the controls in reach;
- in Safari (`navigator.standalone` false) a tip, shown once on the first screen or the map, says "Add Highland
  Stand to your Home Screen" and names the Share button, lies over no control, goes with its own button, is
  remembered in an `hs_` key and does not come back after a reload, closed or not (a one-time tip); opened from the Home Screen (`navigator.standalone` true) it never
  shows. The script finds the tip by its shown words (`innerText`: any box that says "Home Screen" and holds a
  button). A layer that takes no taps or must not hide controls (toast, note, tip) is judged by what a finger would
  find under it without it: a control already under another layer (the battle's header under a menu page) is not its
  doing. A text's own element clips its lines too (a text frame that scrolls: what is below its fold is reached by
  scrolling, not cut off).

It prints one `FAIL <size> <state>: ...` line per failure (the same failure on the pages of one leaf or the steps of
the coach once, with the pages or steps), a `FIELD` line per size, and exits 1 on any. Options: `--sizes=ses,i15s,maxs,
i15c,maxc,seh,i15h,maxh,i15u,seu`, `--only=tip,pages,map,settings,chronicle,battle,panel,foe,tricks,note,bubble,crash,victory,
defeat,nardi,coach,towers`, `--dpr=3` (the density of its photos; the checks are the same at any), `--shots=dir` (a photo of
every state that failed), `--photos=dir` (a photo of every state), `--jobs=n` (sizes side by side, default 4).
Chromium cannot emulate `env(safe-area-inset-*)`: `openGame` (`lib.js`, option `insets`) sets the stylesheet's own
`--sat`, `--sab`, `--sal` and `--sar` on `<html>` as the page is parsed, which every rule that keeps out of the safe
area reads, as does `safeInsets()` through `#safeProbe`; the game's file is not changed for it. What `iphone.js` sets
up directly in the page: the staged fields (`photoStageBattle`, then the battle held still by `speedMult = 0`), every
trick marked met (their cards are opened one by one), the victory, defeat and endless pages (`victory()`,
`endCelebration()`, `endFall()`), the crash card (`showCrashCard`), a nardi invitation (`Nardi.offer`) and the end of
a nardi game, and in the coach the steps a finger cannot finish at once (a foe falling, a spell, the hero's march).

`lib.js` holds what the scripts share: the command line, the sizes, the page opened with its error listeners
(page errors, console errors and the game's crash card all fail a script), the input helpers (`tapAt`, `press`,
`reach`, `worldToClient`) and `enterBattle`, which reaches a battlefield's chronicle as the map leads there (every road
opened, as Shift+U does) and presses Begin the Stand.

Under Ararat (the town) is hidden since a27052d: a plain load has no Town door, loads no town region and pays no town
gift. Every script loads the page plain, as a player does; only `doors.js` loads it a second time with `?town` (the
tester's door; `openGame(browser, file, { ..., query: "town" })` in `lib.js`) to open and close the town by its door.

What the scripts set up directly in the page rather than through the interface, because it is not what they test:
gold (`gold = 1e6`) where towers or plots are bought in bulk, the towers that stand before a probe or a plots run on a
full field, the last wave's cleared field that wins a victory (the game's own loop then ends the wave and dances), and
the clock wound forward for the later tutorial reminders (and all of them under `--quick`).

Known faults of the game, reported as `KNOWN` lines and failed only under `--strict`:
- the town's start card has no on-screen way back to the map: it covers the top bar's leave button and offers only
  Begin, so a mouse or a finger leaves only by Begin then Leave (Escape and the browser's back swipe also close it).
  `doors.js` takes Escape by keyboard and the back swipe by touch there. Since a27052d players cannot reach the town
  (it opens only under `?town`), so this matters only on the day it is shown again.

Fixed after 9bd4d17, and now failed by `dance10.js`: the tap that ended the victory dance could press the button that
came up under it. The page took no press for only 450 ms from the touch's start, so a finger held longer (a slow tap;
`dance10.js` holds one 600 ms) or a click the browser delivered late (a slow frame, as in headless Chromium under
load) landed on Next battle. The page (`#overlay.settling`, `settleOverlay`) now takes no press until every pointer
that went down on the field is up and 250 ms more, and for 450 ms at least; the defeat page shares the guard.

Known as live (3d4bb2a, a27052d), and allowed for:
- the victory page's quiet buttons (Replay, Hold Forever, Campaign Map) are 40 px tall on the iPad, under Apple's
  44 pt guideline; `vic.js` fails them only below 40 px.
