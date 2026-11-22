# The living map

The campaign map is the page every player comes back to after every battle. It used to be a small, still parchment in
the middle of a dark page. It is now larger where the window has room, it moves, and a victory visibly carries the
player along the road to the next battlefield.

Everything here is drawn by one block of `index.html`, `const MapLife = (() => { ... })()`, set just before
`checkNewUnlocks`. It has no asset files. The battle camera (`Cam`) and the recordings (`Rec`) are separate and were
not touched.

## What the player sees

**The map lives.** A clear second canvas, `#mapLife`, lies exactly over the map's sheet (the `#worldMap` canvas inside
its bronze border) and is redrawn about thirty times a second, in the chart's own ink and wash:

- cloud shadows drift slowly over the highlands;
- the rivers shimmer (small light dashes run from source to mouth) and the lakes and seas carry small ink ripples
  that come and go;
- every fortress the player has won flies its crimson banner in the wind, over a faint wisp of hearth smoke;
- the battlefield still to be won on this chart (the first open, unwon one) stands under threat: an enemy camp of two
  or three tents with thin smoke columns, a column of ink dots advancing along the road from the fort beyond, and a
  slow crimson ring about the fort. The tents keep clear of every nameplate, the other forts and the compass;
- locked forts stay still and pale;
- a small flock of birds crosses the sheet about every twenty seconds;
- a loose needle on the compass rose swings as the chart is laid out and settles on north.

The nameplates always stand over what is on the ground, as on the baked chart; only the cloud shadows and the birds
pass over them. The layer takes no pointer: the map's own canvas answers every tap, hover and click as before.

**The march.** When a victory opens a new road, the map plays a short scene the next time it is laid out (2.2 seconds
after a short lead-in):

1. the won fort's banner runs up its pole (0 to 0.25 of the scene);
2. a dashed crimson route inks itself along the road from the won fort to the new one, with a small banner-bearer at
   its head (0.16 to 0.8);
3. the seal on the new fort breaks, its two halves falling away, a ring of light goes out and the new nameplate lights
   (0.8 to 1). The threat then gathers about the new fort.

Until the seal breaks, the baked chart keeps the new fort pale and sealed and its road dotted, so the scene has
something to open. Any tap or key ends the scene at once and the chart shows its final state; the tap or key still
does whatever it would have done, so input is never held back.

If the new battlefield is on the next chapter's chart, the scene on the old chart is the banner and a short route
toward the chart's edge with the words "The road leads on"; on the new chart it is the seal breaking and the plate
lighting.

The scene plays once for each newly opened battlefield. `checkNewUnlocks` (which already tells each new road exactly
once, through `hs_unlocked_seen`) hands the battlefield to `MapLife.opened`, which keeps its id in the save under
`hs_map_march` (through the page's storage wrapper, so `/next/` keeps it as `next:hs_map_march`). The mark is spent as
the scene begins. A mark that no longer tells the truth (its fort already won, or lost at) is dropped without a scene.

**The ember.** After a defeat, the fort that fell glows like an ember for one second as the map comes back, with a few
sparks rising.

## The larger map

In a window at least 1100 px wide, 600 px tall and 17:10 or wider (a laptop or desktop screen), the map page becomes
two columns under the title: the map takes the page from the frame's left side, and a column at the right holds the
chapters as a list (with the two arrows and "Chapter story" under it), the difficulty seals, "Today's challenge",
Resume when there is one, and the march button. The title, the line under it and a defeat's debrief keep their place
across the top; Nardi, Town, Settings and the campaign's stars keep their corners.

| window | map before | map now |
| --- | --- | --- |
| 1280 x 720 | 656 x 362 | 814 x 450 |
| 1366 x 650 | 530 x 292 | 717 x 396 |
| 1600 x 900 | 980 x 542 | 1086 x 601 |
| 1920 x 1080 | 1175 x 650 | 1374 x 761 |
| 2560 x 1440 | 1175 x 650 | 1434 x 794 |

Windows less wide than 17:10 (a tablet, a 16:10 or 4:3 screen) keep the one-column page, where it gives the larger
map; its height limit rose from 656 to 860 px, so a tall window grows the map too. The phone layouts are unchanged
apart from the layer. The map is never drawn wider than 1440 px: its baked chart is 2160 px wide.

Hit-testing reads the sheet inside the border (`mapNodeAt`), so a fort answers at the same chart point at every size.

## Reduced motion

With the system's "reduce motion" setting:

- nothing drifts, waves or flies: no cloud shadows, no ripples, no smoke, no birds, no swinging needle. The banners
  are the baked chart's still ones;
- the layer holds one still frame: the threat in ink (a dashed ring, the tents, the column standing on its road);
- the march is an instant change: the chart shows the new road and fort open at once, and the new nameplate is
  lit for 0.4 seconds;
- the ember is a still glow for one second.

## Performance and pausing

- The baked chart is not redrawn for the animation. Only the clear layer is, at most every 31 ms (about 30 frames a
  second), at the screen's own pixel ratio (up to 3) and never more than 2880 px wide.
- A frame is a clear, about sixteen soft gradient fills for the cloud shadows, and a few hundred short strokes.
  The chart's geometry (river lines, lake outlines, roads) is worked out once per chart and kept.
- The loop runs only while the map page is showing. It ends, and the layer is put away, on a chronicle, a chapter
  story, a victory page and in battle. A one-second heartbeat (one cheap check) starts it again when the map is back.
- While the map is showing but covered, nothing is drawn: Settings, the Hall, the Town, Nardi, a card, or anything
  else that lies over the middle of the map, and whenever the page is hidden (the browser stops the frames, and
  `document.hidden` is checked too).
- Off entirely under the photo and self-test harness (`HARNESS_ON`) and in a browser driven by a test
  (`navigator.webdriver`) unless the test sets `window.__hsMapTest`. There the map is the still chart as before and no
  march is kept or played.

## Stills and tests

- `node tools/shot.js "shot=menu&life=1&t=3.2" out.png 1280 720`: a frame of the living map `t` seconds on its clock
  (also on `shot=defeat`).
- `shot=menu&lv=1&march=0.5`: the march `march` of the way through, from the battlefield before `lv` to it.
- `shot=defeat&ember=0.45`: the ember on the fort that fell.
- `tools/regress/maplife.js` (in `run-all.js`): the layer's place and pixels, that it animates and pauses, the
  fort hit-testing, the march played once, skipped by a tap and a key, and not replayed, reduced motion, and the wide
  window's layout, at 1600x900, 1194x834 and 667x320.
