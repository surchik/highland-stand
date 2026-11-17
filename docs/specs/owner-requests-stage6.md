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
