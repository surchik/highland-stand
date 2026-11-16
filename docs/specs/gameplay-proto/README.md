# The measurements behind docs/specs/gameplay.md

Made on master 54207ce. Nothing here is part of the game.

- `balance-time.diff`: three lines added to a copy of `tools/balance.js` so each battle also returns the
  game seconds of every wave (`secs`), the gold invested and the gold left.
- `base-normal.table.txt`: that bot on master, Normal, 7 builds, 1 seed. `summarize.js` prints battle time
  from its JSON lines.
- `tables.js`, `tables.txt`: the script tables for 10 to 20 waves and, from the baseline's wave times, how
  long each battlefield would take at each length.
- `proto-patch.js`: the script map and the pay-ahead rule of the spec's section 1 as a patch (run through
  the bot's `PATCH=`) on a copy of `index.html` whose `const TOTAL_WAVES` is a `let`:
  `sed 's/^const TOTAL_WAVES = 20;/let TOTAL_WAVES = 20;/' index.html > proto.html`, then
  `PATCH="var PROTO_WAVES = {erebuni:10, ...}; var PROTO_SCRIPT = {avarayr:[...]}; $(cat proto-patch.js)" GAME=proto.html JSON=1 node balance-time.js 1`.
  It pays ahead on every wave (the spec's exception for waves 3 and 4 is not in it).
- `proto-normal.table.txt`, `compare.txt` (`sum2.js`): the same bot on the prototype with the spec's 17
  lengths, nothing retuned, and the two runs side by side.
- `check-tricks.js`: with the patch loaded, each battlefield's commander waves, the first wave of every
  trick and the outflankers' waves on all three difficulties, and a flag if an ambush road opens or is
  first told on a commander wave.
- `padroad.js`, `padroad.txt`: for every pad and plot, the least ground-range radius that reaches a road
  (what the Garrison Post's reach was set from).
