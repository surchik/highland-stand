# Regression suite

Scripts that play the real page in headless Chromium the way a player does: buttons pressed where they are drawn
(each press first checked with `elementFromPoint`, so a covered button fails), pads, plots and towers pressed on the
canvas where the game's own projection draws them, by mouse and by touch (CDP touch events, as an iPad's finger).
They need only Playwright with its Chromium:

```
NODE_PATH=$(npm root -g) node tools/regress/run-all.js            # the whole suite on index.html, about 15-20 min
NODE_PATH=$(npm root -g) node tools/regress/run-all.js --quick    # a sample of each, about 5-7 min
NODE_PATH=$(npm root -g) node tools/regress/run-all.js path/to/other/index.html --only=vic,doors
```

`run-all.js` prints one `PASS`/`FAIL` line per script with its failures under it, then a `SUMMARY` line, and exits 1
when anything failed. Its options: `--quick`, `--only=a,b`, `--jobs=n` (scripts side by side; the default 1 keeps the
timed ones honest), `--shots=dir` (a screenshot of every failure, a folder per script), `--log=dir` (each script's
whole output).

Each script also runs alone, takes the page as its first argument (default: the repo's `index.html`, or `GAME=`),
prints a `FAIL ...` line per problem and a `RESULT <name> PASS|FAIL {...}` line, and exits 1 on any failure. All accept
`--quick`, `--shots=dir` and `--verbose`; those that walk battlefields take `--levels=0,ani,10-16`.

| script | what it holds the game to |
| --- | --- |
| `padplace.js` | Every pad of every battlefield takes a tower: the tower's card pressed in the tray, then the pad pressed at the center of its paved ring, by mouse at 1600x900 and 2000x1250 and by touch at 1194x834 (a first tap arms the pad and shows the reach, a second builds). The press must build that tower on that pad. |
| `plots.js` | Every plot is bought through its price sign (the signboard's box as drawn this frame, `plotSignRects`), at 1600x900 by mouse and 1194x834 by touch, on an empty field (each claimed plot then takes a tower) and on a field with a tower on every pad, whose towers must not catch the press. |
| `probe.js` | Tapping a tower selects it: a tower of every kind and rank on every pad of every battlefield, each pressed on its body, must open its own panel (1600x900, 2000x1250, 1194x834 touch). |
| `vic.js` | The victory page at 2000x1250, 1440x900 and 1194x834 (touch) on every battlefield: the victory won in the game's loop, the dance ended by a tap, an ending card (Ani, Sis) put away by its button; every button wholly on screen, uncovered at center and corners, apart from the others, its label whole and at least 40 px tall to a finger; and each does its job (Next battle through a new chapter's nardi invitation and story to the next chronicle, Replay and Begin, Hold Forever, Campaign Map). |
| `nag.js` | The tutorial played through on a fresh save, by mouse and by touch: the Send Wave step's reminders at 8 s and 18 s (Space named to a keyboard only, the button shaking, no wave by itself), the Auto step outlining Auto, Auto then sending the next wave by itself, and with Auto off the cleared field's reminder toasts at 15 s and every 25 s, three in all. |
| `dance10.js` | The victory dance: taps at 0.5, 3, 6 and 9.4 s leave it dancing, a tap after 10 s ends it without pressing the button that comes up under the finger, and left alone it dances on past 10 s to the end of its tune. Sis's horn call (an ending in terms, no dance) takes no tap. Mouse and touch. |
| `live.js` | Every battlefield played live for three waves at 4x with sound (the Web Audio graph opened by the first click): Shift+G test gold, six towers from the tray, Shift+click for 4x, Send Wave, Auto. Fails on any page or console error, the crash card, an exception inside a sound (the sound engine swallows them; the script counts them), a silent audio graph, or a stand lost. Each battle is left by Settings, Abandon, Abandon. |
| `doors.js` | The map's Nardi and Under Ararat doors open and close at 1600x900 (mouse), 1194x834 and 834x1194 (touch): the board's rules card, its leave card's Keep playing and Leave the board; the town's start card closed, then a town begun, its leave card's Keep and Leave; the map back in reach after each; then a battlefield tapped on the map, its chronicle begun and its first wave on the field. |

`lib.js` holds what the scripts share: the command line, the sizes, the page opened with its error listeners
(page errors, console errors and the game's crash card all fail a script), the input helpers (`tapAt`, `press`,
`reach`, `worldToClient`) and `enterBattle`, which reaches a battlefield's chronicle as the map leads there (every road
opened, as Shift+U does) and presses Begin the Stand.

What the scripts set up directly in the page rather than through the interface, because it is not what they test:
gold (`gold = 1e6`) where towers or plots are bought in bulk, the towers that stand before a probe or a plots run on a
full field, the last wave's cleared field that wins a victory (the game's own loop then ends the wave and dances), and
the clock wound forward for the later tutorial reminders (and all of them under `--quick`).

Known as live (3d4bb2a), and allowed for:
- the victory page's quiet buttons (Replay, Hold Forever, Campaign Map) are 40 px tall on the iPad, under Apple's
  44 pt guideline; `vic.js` fails them only below 40 px;
- the town's start card covers the top bar's leave button and offers only Begin, so a finger leaves it by the back
  swipe (or by Begin, then Leave); `doors.js` takes the back swipe there, and Escape by keyboard.
