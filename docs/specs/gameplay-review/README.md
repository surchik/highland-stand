# What the review of the gameplay spec ran

Made on master 54207ce. Nothing here is part of the game. The findings are in `../gameplay-critique.md`.

- `shot7.js` and `tray7-stepanakert2023-667x320.jpg`: the tray with seven tiles on a phone held sideways.
  The page was a scratch copy of `index.html` with the drums tile's `div.card` repeated twice (as a second
  archer and a second fire tile), opened with `?shot=battle&lv=<n>` at 667 x 320 with touch:
  `NODE_PATH=$(npm root -g) node shot7.js tray7.html "shot=battle&lv=16" out.png 667 320 touch`.
  It prints each tile's size and whether its name is cut (`scrollWidth > clientWidth`). Result: tiles of
  88.4 x 52 px; a name box of 82 px; names of 19 characters and more are cut.
- `paused-build.js`: with `tools/regress/lib.js`, Pause pressed, then the archer tile, then pad 0, by mouse
  at 1600 x 900 and by a finger at 667 x 320. Result at both: one tower built, 50 gold spent, the game
  still paused.
- `selftest-timing.sh`: `tools/selftest.js` once alone, then twice at once. Result on a 4-core machine:
  117 s alone; 120 s and 121 s side by side; 151 checks pass in all three.
- The size of the first spec's example of a battle's numbers: `JSON.stringify` of the object in its section
  6.1 is 1,063 bytes; `platform/schema.sql` line 584 skips an event whose props are over 1,024 bytes.
