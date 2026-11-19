# Where the build stands: stage 6

This is for you, the owner. It says what changed on the branch `s6/work` (to be merged into `next`), what you must
run on your server, and what is not done. The details of each request, and how each was built, are in
`docs/specs/owner-requests-stage6.md` (its last section).

Date: November 17, 2026. The page on this branch has the two Supabase values empty, as the build's rules ask; the
coordinator fills them to publish.

---

## 1. What changed

- **No more "Standard battle" switch** on the chronicle. A ranked Standard battle starts from the Leaderboards tab:
  on a Standard board press **Fight for this board**. The chronicle then shows "Standard battle". The boards rank as
  before.
- **The victory**: your two recordings, Kochari and Yarkhushta, in turn. The dancers step to each one's tempo
  (measured: Kochari 102.4 beats a minute from its full-band entry at 45 s, Yarkhushta 95.6). The dance holds about
  twice as long (43 s); a tap after the first 10 s leaves at once. The pointer over it is the normal arrow. The
  count says "enemies destroyed". The dance's caption is gone. The game's own kochari plays when a file cannot load.
- **Battle music**: your eleven recordings. Each battlefield opens on a tune of its own, then they turn without
  repeating. The two laments open only Avarayr, Sis, Shushi and Stepanakert 2023; the love song opens none. Only the
  tune that plays is loaded, when the battle starts. The Music switch and slider govern it; it pauses with the
  battle, fades at a victory or a defeat, stops when you leave, and never plays on the map, the chronicle or the
  trailer.
- **Google's name**: the name card starts from the first name Google (or Facebook, or Discord) gives, instead of
  "Defender123456".
- **Email and password**: "Continue with email" beside Google and Facebook, once you switch it on (section 2). Sign-up
  asks for a player name, an email and a password, nothing else. No email is sent and there is no password reset yet;
  the form says so. While it is on, the Discord button is held back (as it always was while the server confirms
  addresses itself). Known cost, which you accepted: someone could sign up with an address that is not theirs, and a
  later Google sign-in with that address joins the same account.
- **The trailer has sound**: the opening of your "Sheyk Sar" under a short voice-over (four lines, in
  `owner-requests-stage6.md`). The page tries to play it with sound; where the browser refuses before a tap it plays
  muted with a **Sound on** button. **Please listen to the three voice samples** in
  `docs/specs/owner/voice-samples/` (`am_michael.mp3` is the one in the trailer, `bm_george.mp3` is British,
  `af_heart.mp3` is a woman's voice) and say which you want, or other words.
- **Publishing**: `deploy/update.sh` now publishes `assets/victory/`, `assets/music/` and the trailer beside the
  page, at `/` and at `/next/`. Nothing to do: it happens on the server's next runs after the push.

## 2. Your server, in order

On the server, in `~/highland-supabase` (the folder of `deploy/hs-supabase`), after `next` holds this stage:

1. **Migration 009**: `./migrate.sh` (it backs up the schema first). **Check:** it ends with `highland at 9 of 9`.
   It lets a password session play; your admin and superadmin pages still need a Google, Facebook or Discord
   sign-in. To undo: `node tools/platform/migrate.js down 8 --yes` (see `deploy/supabase/README.md`).
2. **Email on**: `./providers.sh email`. It asks for nothing; it writes two settings into the `.env` (backed up
   first) and restarts only the sign-in container (a few seconds). **Check:** it ends with `"email":true` and
   `"mailer_autoconfirm":true`. Running it twice changes nothing. To turn it off: `./providers.sh email --off`.
3. **Only if you put in the narrow Caddy block** (`./caddy.sh --narrow` earlier): run `./caddy.sh --narrow` once
   more, so the new block (which lets the sign-up and the password sign-in through) replaces the old one.
4. Try it on `/next/`: "Continue with email", create an account, sign out, sign in again.

Do step 1 before step 2: without 009 an email account can sign in but reaches nothing of the game.

## 3. What is not done, or not tried

**Not done:**
- A password reset, and any mail (your ruling: no verification for now). When mail is set up (Resend), the reset
  flow and confirmation can be added.
- The voice is not chosen by you yet: the trailer uses `am_michael` until you pick one of the samples.
- Nothing was tried on your real server, on real Safari or on a real iPhone: GoTrue's real email sign-up, the
  narrow Caddy block's new lines, and whether iOS lets the recordings play without a tap (the page blesses both
  players at the first tap; if iOS still refuses, the game's own music plays instead) are known only from the
  stand-ins and headless Chromium.
- The dancers step at each recording's measured tempo; where the strong beat falls was estimated, so the steps may
  sit a little off the downbeat.
- The page's first self-test is still over its time limit (all 151 checks pass; 130 to 154 s against 125 on this
  machine, which other builds were loading; the stage 4 page took 138 and 145 s in the same runs), as before this stage.

## 4. How this stage was checked

Each run to its end, on the branch's page:

- `deploy/check-page.js`: the page parses.
- The self-tests: suite 2, 57 checks, passed (97 s); suite 1, 151 checks, all passed, over its 125 s budget as
  said above. The saves of today's players (8 fixtures) all resume; the hidden town stays hidden (9 cases).
- The regression suite, every script: padplace (1,265 towers placed), plots (408 bought), probe (801), vic (249
  presses, 17 battlefields, 3 sizes), nag, dance10 (15 runs, the longer dance), iphone (797 screens at ten sizes),
  waves (all 17 battlefields) passed in one run; live (17 battlefields with sound and the recordings) and doors
  passed when run again after another build's jobs filled the machine's memory and crashed their pages in the
  first run; platform (every flow at five sizes, 197 screens, with the new flow 16 for email and password) passed
  alone in 2,677 s after its run-all limit was raised; the new music.js (the recordings, the openings, the trailer's
  sound) passed.
- p0 (the platform's seam) passed, the battle's recordings now allowed beside the page.
- The bot on Normal, one seed, on Erebuni, Avarayr, Tashir, Gyumri Road, Van, Stepanakert 1992 and Sis: 119
  battles, every table the same as on the stage 4 page.
- The server side on the stand-in: the database rules (1,069 checks, with migration 009 and its down), the walls
  between players (450), the restore of a backup (22), the nine migrations up, down to 8, to 0, up, down to 7 and up
  again, the guide's own commands (23), the by-hand deletion of the privacy checklist, curl's session (64 refusals,
  none unexpected), the smoke test against six stand-ins, the page's pure code (435), `update.sh` (43 cases, 7 new),
  and `providers.sh email` against stand-ins (9).

Deployed: master b397f8d went live on 18 November 2026 at about 00:58 UTC, with the chronicle films (stage 5) beside it.
