# The battle camera

One block of the page (`const Cam`, right after the canvas is set up in `index.html`) gives the battle the impact it
lacked: the kill that wins a battle is held and shown, the fall of the citadel gets a slow look, and the few
truly heavy events shake the field. Settings has one switch for all of it, "Battle camera".

## What the player sees

### The last blow

When the last foe of the last wave falls to a blow (not when it walks through the gates), the battle does not cut
to the victory. For 1.6 seconds of the player's time:

- the game's time runs at a fifth of its pace (it drops there in about a tenth of a second and comes back up over
  the last fifth of the hold), so the foe's fall, the coin and the last shots in the air are seen slowly;
- the camera pushes in to 1.6x on the falling foe, never past the field's edge (a foe near an edge sits off the
  middle of the view, and the view stays full of field);
- the rest of the field darkens softly round the foe;
- the battle's HUD (the top bar, the tray, the spells) stands back to about a quarter of its strength;
- the music dips by 7 dB and one deep stroke of the dhol sounds with a low horn under it, built from the sound
  set's own drum, thump and horn (no new file, no new entry in the sound table);
- a phone gives a three-part pulse where the browser can (Android; iOS Safari has no such call and nothing happens).

Then the victory is declared exactly as before (the same `victory()`), and the camera eases back to the whole
field over 0.7 seconds while the dance begins.

A commander's last blow holds 2.2 seconds, closes in to 1.78x, and its horn is lower and longer.

A tap, a click or a key during the hold does one thing only: it ends the hold at once and the victory follows on
the next frame. It presses nothing (not the button under the finger, not a hotkey), and it does not end the dance.

Endless stands have no last wave and no last blow. A last wave that ends with its last foe reaching the gates has
none either.

### The fall

When the last defender is lost, the camera pushes slowly in on the citadel (to 1.42x over 1.2 seconds) before the
beat the defeat always had: the bell and the smoky dusk of 1.5 seconds wait for it, and the camera eases back
during the second half of that beat, so it is back at the whole field when the defeat page opens. It is quieter
than the last blow: no slow motion (the field already stands still), no drum, one short pulse on a phone. A tap
ends the push-in and the bell tolls at once.

### Weight on heavy hits

A brief, small, decaying shake of the picture for these events and no others:

| event | shake | lasts | phone pulse |
| --- | --- | --- | --- |
| a commander felled | 5 px | 300 ms | 30 ms |
| the wrath (the lightning class spell) | 4.5 px | 300 ms | 25 ms |
| a Powder Mine's blast | 4 px | 260 ms | 20 ms |
| a defender lost to a commander or a siege beast (ram, elephant) | 4 px | 280 ms | 25 ms |
| the frost (the holding spell, whatever its look) | 2.5 px | 200 ms | 12 ms |
| a catapult's stone landing | 1.5 px | 160 ms | none |

Pixels are of the field at its drawn size before the screen's scale. Shakes that fall together add up to 6 px and
never more; a stone's shake never adds to another and comes at most once in 350 ms. Arrows, bolts and ordinary
kills shake nothing. The shake is drawn only: the picture is slid by whole pixels after it is painted, and the
arithmetic that turns a tap into a place on the field does not know of it.

## The switch

Settings, under Ambient: "Battle camera", On or Off (on a phone held sideways it sits in the title's row, since
both columns below are full). Off turns off the last blow, the fall's push-in, the shake and the phone's pulse;
every timing is then exactly what it was before this feature.

It is kept with the other settings in `hs_settings` (as `cam: true` or `cam: false`), through the page's storage
wrapper, so on `/next/` the key is `next:hs_settings` like the rest. It is written only once the player has
pressed the switch; until then the switch follows the system.

## Reduce motion

With the system's "reduce motion" on (`prefers-reduced-motion: reduce`) and the switch never pressed, the switch
reads Off, and:

- the last blow is a plain 0.6 second pause: the game's time slows, the field dims a little, the drum sounds; no
  zoom, no HUD fade, no shake, no pulse;
- the fall has no push-in;
- nothing shakes and the phone never pulses.

A player who then presses the switch On has asked for the camera and gets all of it; pressing it Off removes the
pause as well.

## What it leaves alone: scores, the clock, saves, the run log

- Nothing is settled during the last blow. `endWaveIfClear` simply waits (`Cam.hold()`), so the clear's bonus,
  the interest, the Stores' pay, the victory's event, the record, the stars and the cleared run are all booked by
  the same code, in the same order, from the same state as without the camera.
- The battle's clock stands still from the winning kill to the victory: `update` skips `battleTick` while the
  blow is held, so `sec` (what a board ranks by), the player's own seconds (`realS` and the seconds at each speed)
  and the idle seconds are those of the kill's own step, exactly as when the victory is declared in that step.
  The slow seconds are not counted at all, neither as game time nor as the player's.
- Nothing can be done in the hold: no foe is left, and every tap, click and key is taken by the skip. The purse,
  the walls and the towers at the victory are those of the kill.
- The speed setting is not touched: during the hold the game takes one slowed step a frame whatever the speed, and
  `victory()` then sets 1x as it always has.
- The saved run (`hs_run`) is cleared by `victory()` as before. A tab closed inside the 1.6 seconds leaves the run
  as it was saved at the last wave's horn, as a tab closed a moment before the kill always did.
- A defeat is settled at once, before the push-in, by the unchanged `defeat()`: the event, the hero's experience,
  the record and the cleared run. Only the bell, the dusk and the page come 1.2 seconds later.
- The server sees the same events with the same numbers; `wave_end` and `victory` arrive 1.6 seconds later on the
  wall clock, which it does not compare with `sec`.
- The frame governor (which lowers the canvas's density on a device that cannot keep pace) does not judge the
  camera's frames.

`tools/regress/cam.js` holds the page to this: the victory's numbers and saved record with the camera equal the
same battle's with the switch off.

## Tests and stills

Under the test harness (`?shot`, `?selftest`) and in a browser driven by a test (`navigator.webdriver`) there is
no camera at all, unless the test sets `window.__hsCamTest` before the page loads (`tools/regress/cam.js` does).

The photo harness stages stills:

- `?shot=battle&lv=avarayr&wave=14&blow=0.5`: the last blow half way through (any share from 0 to 1; a commander
  where the wave has one); `&blow=-1` is the moment before, the last foe standing alone;
- `?shot=fall&lv=avarayr&wave=8&push=0.5`: the push-in on the citadel half way through.

```
node tools/shot.js "shot=battle&lv=avarayr&wave=14&blow=0.5" out.png 1280 720
NODE_PATH=$(npm root -g) node tools/regress/cam.js --verbose
```

## How it is drawn

The field is painted as it always is. Then `Cam.paint` copies the part of the finished picture the camera looks
at over the field's own box, enlarged (the canvas drawn onto itself), and lays the darkening over it. Nothing in
the field's drawing knows of the camera, so the sprites baked at the screen's scale are not baked again as the
zoom moves, and the letterbox and the HUD's bars are never painted over. The cost is a slightly soft picture
while the camera is in (about 1.6x of the same pixels).
