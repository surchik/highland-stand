# The platform's tools

Checks of the platform track (docs/specs/platform.final.md, section 10). They need only Playwright with its
Chromium (`NODE_PATH=$(npm root -g)`), as the regression suite does, and share its helpers (`tools/regress/lib.js`,
`tools/regress/iphone-audit.js`). Each prints a `FAIL ...` line per problem and a `RESULT ...` line, and exits 1 on
any failure.

| script | what it holds the page to |
| --- | --- |
| `p0.js` | Work package P0, the seam. It serves the page itself (at `/`, `/next/` and `/nextish/`) and checks: the Hall with the harness's test tabs at 1600x900 (mouse), 1194x834 (touch), an iPhone held sideways (667x320; 852x393 with the safe areas) and upright (375x553): opened from the campaign's tally, the three layouts, the tab's box at least 560x280 held sideways, everything inside the visible area minus the safe areas and 44 px to a finger (the iPhone suite's audit), badge and pip, a toast over it, closed by its button and by Escape with the map back in reach, a tab drawn again when the layout changes; no hotkey of the game's while it is open; no door with no tab; tabs pushed on a plain page as gameplay pushes them (the opening order of 0.3, a tab that throws, no Hall over a battle or the nardi board); `Platform`'s four calls and where the game makes them; `track()` (queues, the last 400, never throws); no network request but the page itself; the staging channel (under `/next/` every key read or written begins `next:`, the live page neither sees nor touches them, and the other way around; a browser that refuses writes; the harness; every spelling a web server answers with the staging page, such as `//next/`, `/%6Eext/` and `/NEXT/`, with a real save in the browser that the staging page must not see); the five tabs the two specs name all whole and in sight without scrolling at 1600x900, 1194x834 and the ten iPhone sizes of `iphone.js` (a sixth scrolls and fades); a field in a tab kept when a phone's keyboard shrinks the window into another layout; a double tap on the tally; the plaque with no tab takes no focus; the Hall under `?selftest`. About 4 to 6 minutes (the `selftest` part waits out the whole suite). `--only=hall,five,field,selftest,notab,plain,track,next,photo`, `--shots=dir`, `--verbose`. |
| `compare-shots.js` | Two copies of the page photographed by the harness and compared pixel for pixel: the map, Settings (over the map and over a battle), the chronicle, the victory and defeat pages, at 1600x900 (mouse), 1194x834, 667x320 and 375x553 (touch): 40 pairs. `node tools/platform/compare-shots.js <base index.html> [new index.html] [--out=dir]`. A package that must change nothing a player sees ends with every pair the same. About 100 s. |

The harness's own door to the Hall, for photos and for other tracks' tests:

- `?shot=hall` opens the Hall over the map; `&tab=<id>` picks its tab. With no tab in `HALL_TABS` it ends in
  `PHOTO_ERROR`: the Hall does not open empty.
- `&testtab` (with `?shot=...` or `?selftest`) adds a test tab of the harness's own, `&testtab=N` up to six of them
  (ids `test1`, `test2`, ...); `&long` gives each a long list, to see its box scroll. The first has a badge of 3 and
  the second of 1; "Spend one" counts the shown tab's badge down. They exist nowhere but under the harness.
- `?shot=menu&testtab` is the map with the tally as the Hall's door.
