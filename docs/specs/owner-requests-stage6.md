# Owner requests after stage 4 (16 November)

Two requests from the owner, to build once stage 4 is integrated (no agent may be on gp/work or pf/work then).

## 1. Remove the "Standard battle" switch

The owner: "lets remove this toggle of 'standard battle' not needed".

The switch is on the chronicle page (index.html, `standardBattle`, the `bkKnob` row). The leaderboards (P5) rank
Standard battles. The owner did not answer how the boards should rank once the switch is gone. Default until he
rules: remove the switch from the chronicle; a ranked Standard battle is started from the Leaderboards screen (the
platform's door to a Standard battle already exists). Do not drop the Standard ruleset itself without his word.

## 2. The victory music: proper traditional kef or zurna music

The owner: "find better armenian music for the closing part", then "the victory music should be updated to proper
traditional kef or zurna music find it online".

So it is the victory screen, and he wants a real recording. Four web searches (16 November) found no Armenian
zurna and dhol dance recording under a free licence: Wikimedia Commons has only a Turkish zurna recording from
1930 and two short Armenian dhol videos (licence unchecked); the Armenian Museum of America's Sound Archive has
Hovsep Bedrosian's zurna discs from 1940, still under US recording rights; Sonoton (album SAS0121) and Artlist sell
licensed tracks. A recording may go in the game only with a licence the owner holds or a free licence that is
verified. Until he supplies one: arrange a traditional dance tune (Kochari or Tamzara) for the game's generated
instruments in zurna and dhol style. A real file also means the page gains an audio asset beside it (as the
trailer has), with the generated tune as the fallback.

## 3. Sign-in requests after the first real sign-in (17 November)

The owner signed in with Google on /next/ against the game's own Supabase stack (https://hs-db.avunjian.com,
deploy/hs-supabase) and asked:

- "the video playing should have audio": the first-visit trailer. /trailer.mp4 has no audio track at all (ffprobe:
  one h264 stream, 30 s), and the page starts it muted and looping. It needs a sound track made and muxed in, and
  the page must try to play with sound and fall back to muted with a clear "Sound on" button (browsers refuse
  sound before a tap).
- "when we login with google it should grab their name instead of defender123231": the name card should start
  from the provider's name (user_metadata full_name or name), within the name rules, with the generated name only
  as the fallback.
- "lets also add a normal login and sign up with email, capture basic details": email and password sign-up and
  sign-in beside the providers. This stack has email sign-up off and no mail sender; the game's functions ask
  that a session began with a provider (amr holds oauth; migration 005). Needs: a mail sender for confirmation
  and password reset, the server settings, a migration, the forms, and the owner's list of details to capture.

The owner's answers (17 November): sign-up captures name, email and password, nothing else. Mail goes through
Resend. The trailer gets music and a voice-over. Sign-in stays required (HS_GATE "required"). Sign-in went live
on the main page the same day (master f782fea).

Later the same day the owner said: "dont verify email for now". So email sign-up confirms at once (GoTrue's
autoconfirm on), no confirmation mail is sent, and Resend is not needed to launch it. Without a mail sender there
is no "forgot password" either: say so on the form, and add the reset flow when mail is set up. Known cost: an
address can be registered by someone who does not own it, and a later Google sign-in with that address would
join the same account; the stakes are a game save, and an address that already has an account cannot be taken.

## 4. The victory screen (17 November)

The owner: "at the end when the win happens, leave it on kochari dance a bit longer, user can always click out,
mouse pointer changes to a cross, should be a regular mouse, text says foes fallened change to enemies destroyed,
also someething about the kochari dance text better to remove it".

- The victory dance holds longer before the page moves on (about twice as long, unless he gives a number); a
  click or tap still leaves at once.
- The pointer over the victory screen is the ordinary arrow, not the cross. (`#game { cursor: crosshair }` is the
  battle's; the victory and other non-battle pages should not show it.)
- The victory count's label about fallen foes becomes "Enemies destroyed".
- Remove the caption that names the dance under the plaque (danceCaption: "A circle dance in the manner of the
  Armenian kochari" and its two siblings).
Note for request 2: the victory tune today is an original kochari-style melody played by a generated kef band or
zurna and dhol (Settings, "Victory band"); the code says a verified traditional kochari can replace it.

The victory music, settled (17 November): the owner supplied two recordings and said "use these two songs for the
victory dance": "Kochari (Armenian Folk Dance)" by New Age Armenia (album Ancient Legacy, 2013, 4 min 41 s) and
"Yarkhushta" by Sasna Crer Folk Group (album The Best Of Sasna Crer Folk Group, 2019, 1 min 38 s). Web copies
(mp3, 128 kbit/s) are in assets/victory/. The rights to publish them are the owner's to hold; the builder does not
judge them. To build: the victory screen plays one of the two (alternate, or by the Settings' "Victory band"),
loaded only when a victory comes, with the generated kochari as the fallback when the file cannot load or sound
is off; deploy/update.sh must publish the two files beside the page (as it does the trailer); the dancers'
steps are locked to 96 BPM today, so match the choreography's tempo to each recording or let it run free.

## 5. Music during battles (17 November)

The owner uploaded five recordings and said: "add these as background music for levels during game play". All
five are by New Age Armenia: "Hov Arek Sarer Jan" (3 min 49 s), "Na Mi Naz Ooi" (4 min 16 s), "Sheyk Sar"
(4 min 38 s), "Sev Gakavik (Black Partridge)" (4 min 11 s) and "Oorakh Ler (Joyous Mountain)" (4 min 49 s); the
last two are from the album Ancient Legacy. Web copies (mp3, 128 kbit/s, about 4 MB each) are in assets/music/.
The rights to publish them are the owner's to hold, as with the victory recordings.

To build:

- A battle plays one of the five, loaded only when the battle starts (never with the page: 21 MB in all), and
  goes on to another when it ends. Pick by the battlefield's number so a field keeps its opening tune, then
  rotate; do not repeat the tune just heard.
- It replaces the generated battle music while it plays; the generated music stays as the fallback when a file
  cannot load. The Settings' music switch and volume govern it; sound effects stay on top at their own level.
- It pauses with the battle, fades out at victory (the victory recording takes over) and at defeat, and stops on
  leaving the battle. It never plays on the map, the chronicle or the trailer unless the owner asks.
- deploy/update.sh must publish assets/music/ beside the page, as for the victory files.
- The test harness runs without sound: the music must not start there, and no test may wait on a file loading.

Five more (17 November), the owner: "some more for the background music". Also by New Age Armenia, web copies
in assets/music/ (mp3, 128 kbit/s): "Mardigi Yerke" (4 min 27 s), "Vartani Mor Vokhbe (Vartan's Mother's
Lamentation)" (5 min 50 s), "Al-Ayloughs/Balkoni Dage Hov E (Red Handkerchief)" (2 min 51 s), "Alakiaz (Name of
a Mountain)" (2 min 4 s) and "Mi Lar Mayrig (Don't Cry Mother)" (4 min 16 s); the last four are from Ancient
Legacy. That makes ten battle tunes. Two are laments by their titles (Vartan's mother, "Don't Cry Mother"): put
them in the rotation, but where a tune is chosen for a battlefield's opening, prefer them for the battlefields
whose history is a loss or a siege, and do not open a battle on them where a brighter one fits. The total is
about 46 MB; nothing loads until a battle starts, and only the one tune that plays.

One more (17 November): "Siroun Es, Hokiag (You're Beautiful, My Love)" by New Age Armenia (Ancient Legacy,
4 min 20 s), assets/music/siroun-es-hokiag.mp3. Eleven battle tunes in all (about 50 MB, still loaded one at a
time). It is a love song by its title: in the rotation, but not a battlefield's opening tune where a martial one
fits.

## What was built (stage 6, branch s6/work)

**1. The Standard battle switch is gone.** The chronicle has no switch (`bkStd` is now a mark, not a button). A
ranked Standard battle starts from the Leaderboards tab: on the Standard board a new button, **Fight for this board**,
closes the Hall and opens that battlefield's chronicle as a Standard battle on the board's difficulty
(`openBriefStandard`). The chronicle then says "Standard battle" in its row and "Level 1 · Standard" on the hero's
line; Replay keeps it, the map and any other battlefield's chronicle put it away. Before stage 6 the platform had no
such door (`openBriefStandard` existed, nothing called it); it is there now. The Standard ruleset and the boards are
unchanged: a battle with a Council tier still posts to the Open board, one without to the Standard board.

**2 and 4. The victory screen.**
- The victory plays the owner's two recordings in turn (Kochari, then Yarkhushta, then Kochari; the turn is kept on
  the device, `hs_vic_rec`). A file is asked for only when a victory comes. The generated kochari plays instead when
  the file fails or has not begun 2.5 s in, when the page is a test harness, and on a browser without sound; the
  Settings "Victory band" still chooses the generated band and the painted musicians.
- Tempo, measured with librosa (onset strength at 64-sample hops, its autocorrelation over the bar; the bar shows up
  as the strongest period in both): **Kochari 102.4 beats a minute** (bar 1.172 s, 2/4) from its full-band entry at
  45 s (the first 45 s are a slow prelude, so the dance's part begins there); **Yarkhushta 95.6 beats a minute**
  (bar 1.255 s). Both carry a 3+3+2 accent inside the bar, which beat trackers read as 136 and 128. The dancers now
  step at the recording's tempo, timed by the recording's own clock while it plays (`celebrationBeat`); the first
  strong beat is estimated (45.31 s and 0.61 s), so the steps follow the tempo and may sit a little off the downbeat.
- The dance holds about twice as long: `DANCE_MAX_MS` is 43.2 s (was 21.6 s); the generated band plays its tune
  twice. A tap after the first 10 s still leaves at once, as before.
- The pointer is the cross only over a battle; over the dance, the victory page and every other page it is the arrow.
- The count reads "N enemies destroyed" (was "foes felled"). The caption under the plaque is removed.

**3a. Google's name.** The name card starts from the sign-in's own first name (`nameFromMeta`: Google's given name,
else the first word of `full_name` or `name`, cleaned to the name rule; the first two words when the first is too
short). The generated "Defender" and six digits stay the fallback. The card's line then says the name starts from
the sign-in's first name and can be changed. When the name is taken the card tries the first name with three digits.

**3b. Email and password.** "Continue with email" stands beside the providers whenever the server's `/settings` says
the email sign-up is on. Sign-up asks for a player name, an email and a password (8 characters or more) and nothing
else; no mail is sent and the server confirms the address at once. The name typed there is saved as the player name
at once. The form says that a reset of a forgotten password comes later. The Account tab and the Leaderboards tab's
sign-in line offer it too.
- Migration **009_email_signin**: a session begun by password (`amr` "password") is a session of the game's own;
  an account with an email identity may become a player. The admin's and the superadmin's functions still ask for
  a provider's session, and the owner's superadmin grant still asks for an account that signed in with a provider.
  A one-time code (`otp`) is no session of the game's. It has a down file; it grants nothing new.
- On the server: `./providers.sh email` (and `--off`) in `deploy/hs-supabase`. The narrow Caddy block now passes the
  sign-up and the password sign-in. While the email sign-up is on, the page holds the Discord button back (as it
  always did while the server confirms addresses itself).
- The test stand-in of GoTrue (`tools/platform/stack.js`) now signs up and signs in by password when its `email`
  setting is on, so the whole flow is tested end to end (platform flow 16).

**3c. The trailer's sound.** `trailer.mp4` (AAC 128 kbit/s) and `trailer.webm` (Opus 96 kbit/s) now carry a
soundtrack: the first half minute of the owner's "Sheyk Sar" (a quiet opening that builds to the full band as the
title card comes), ducked under a voice-over, the whole at -16 LUFS. Files: 4.45 MB and 3.75 MB (were 3.95 and
3.46). The page tries to play it with sound; where the browser refuses sound before a tap it plays muted, and a
**Sound on** button beside Play now turns the sound on (and off again). The trailer's files now load from beside the
page, so `/next/` shows its own.
- The voice: **Kokoro** (Kokoro-82M, Apache-2.0, run locally through kokoro-onnx), voice **am_michael** (American
  male), speed 1.0. (Piper was tried first; its better voices are under non-commercial licences, so it was dropped.)
- The lines, and when each begins:
  - 0.4 s: "From Erebuni to Artsakh, for twenty-eight centuries, Armenians have held these highlands."
  - 6.4 s: "Seventeen battlefields. Five eras. Raise your towers on the mountain roads."
  - 17.0 s: "Every wave counts. Hold the line."
  - 26.4 s: "Highland Stand. Hold the highlands."
- Three voices to judge, the first and last lines read by each (we cannot hear them):
  `docs/specs/owner/voice-samples/am_michael.mp3` (the trailer's), `bm_george.mp3` (British male) and
  `af_heart.mp3` (American female). Another voice, or other lines, is one command:
  `PY=<python with kokoro-onnx> KOKORO=<model folder> bash tools/trailer-sound.sh --voice=bm_george`.

**5. Battle music.** Eleven tunes from `assets/music/`. A battle asks for one tune as it begins, never with the page.
Each battlefield opens on a tune of its own (`REC_OPEN`), then they turn in order through all eleven, and a battle
never opens on the tune heard last. The two laments open only battlefields of loss: "Vartan's Mother's
Lamentation" opens Avarayr (where Vartan Mamikonian fell) and Shushi 2020; "Don't Cry Mother" opens Sis 1375 and
Stepanakert 2023. The love song "Siroun Es, Hokiag" opens none. All of them come round in the rotation.
While a tune plays, the generated music is turned down; it comes back when no file plays (before one has loaded,
after one fails). The Music switch and its volume govern it; effects stay at their own level and duck it as they
duck the generated music. It pauses with the battle (Settings opened in battle lets it play, so its volume can be
heard), stops while the page is hidden, fades at victory (the victory recording takes over) and at defeat, and stops
on Abandon. It never plays on the map, the chronicle or the trailer. Each file's loudness was measured and trimmed
to sit about 3 dB over the generated field music at the default volume. The test harness opens no sound, so nothing
there loads or waits on a file.

**6. Publishing.** `deploy/update.sh` publishes `assets/victory/*.mp3`, `assets/music/*.mp3` and the trailer's files
beside the page at `/` from master and at `/next/` from the branch, each only when it differs
(`tools/platform/test-update.sh` part E).
