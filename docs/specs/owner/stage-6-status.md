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

TESTS_PLACEHOLDER
