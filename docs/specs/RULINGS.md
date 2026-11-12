# Rulings: the seam between the two final specs, and how the build is run

Read this before `platform.final.md` and `gameplay.final.md`. Where a spec disagrees with a ruling here,
the ruling wins. The rulings settle the three points the two reviews left marked DIFFERS, the asks one
review made after the other had finished, and the points left "for the owner" where the owner's standing
instructions already answer them. Points the owner must still answer are listed at the end; until then
the default named there is built.

## A. The seam (binding on both tracks)

**S1. The battle clock (gameplay N3).** The clock is gameplay's final section 6.1: the sum of `dt` in
`update` from the first wave's horn to the last foe's fall. Waiting between waves counts. Pauses, menus and
cards do not. It is game time, so the speed button does not change it. `min`, `fast` and `slow` in the
ruleset are in that clock; `slow` is 1.4 times par. The platform's 0.3 item 2 ("while a wave is on the
field") and every line of `platform.final.md`, `schema.sql` and its tests that assume a wave-time clock are
overridden. The event field stays `sec`; the platform posts it as `p_stats.sim_sec`. The words under the
boards and on the score's tooltip are N12: "The battle clock runs between waves too. Pause to plan."

**S2. A resumed battle (gameplay N5).** It stays `std` and stays ranked. The cost of a wave fought again is
in its numbers: `p_stats.lives` is filled from the event's `lives_board` when the event has one (never more
than `lives`), `sec` already holds the dropped attempt's time, and the stars shown are the event's `stars`.
The platform's 0.3 item 3 sentence "a battle with a wave fought again after a reload is `open`" is
overridden. Reason: phones evict tabs, and "track where they left off" is a headline feature; a resume must
not throw an honest player off the headline board. Never ranked at all (`ranked: false` on `battle_start`):
the coached stand, test mode, an endless stand, a legacy run. A `victory` with `aided: true` is not posted.
A new player's short tray is `std`.

**S3. A lost daily (gameplay N6).** Every daily is `daily.waves` waves long (12). A lost daily is scored
by waves cleared out of `daily.waves`: `floor(4000 * cleared / daily.waves)`, capped under 4,000. The server
reads `daily.waves` from the published ruleset. The script-table lookup for a lost daily in `schema.sql` is
replaced by this and its test changed.

**S4. A battlefield's `rev` in the board's key (gameplay N11).** Accepted. A campaign board's key is
`c:<level>:<diff>:<loadout>:<rev>`. The server takes `rev` from the published ruleset's entry for that
battlefield (never from the client's post). A new `RULESET` that leaves a battlefield's `rev` alone keeps
that battlefield's boards. The daily's board key is per day and is not affected.

**S5. The daily's own tables (gameplay N10).** Accepted. `rulesetData().daily` carries `waves` (12) and
`levels[id]` with the daily's own `script`, `min`, `fast`, `slow`, `earnMax`. A daily result's wave count is
checked against `daily.waves`. The share text takes a twist's name from `twistName(id, levelIndex)`.

**S6. Shared pages (gameplay N4, N7, N8, N9, N12).** As gameplay's 9.5 states them; they agree with the
platform's 0.3 item 7. The Hall gives a gameplay tab a content box of at least 560 x 280 px on a phone held
sideways. On the phone's victory page the platform adds no row and gameplay's one line replaces the last
line of the page's prose.

**S7. Who edits what in `index.html`.** The base branch already holds PF-0 (the four constants,
`HS_STORE_MEM`, `track`, `CLOUD_KEYS`, `HALL_TABS`). Only the platform track edits the platform's four
blocks (PF-0, PF-CSS, PF-HTML, PF-MAIN) and the lines of its table 0.4. Gameplay registers from its own
code: `CLOUD_KEYS.push({ key, merge })` and `HALL_TABS.push({...})`, placed after the functions they name.
Gameplay never edits PF-0. The platform never edits a gameplay function beyond table 0.4. A line both need
changed is named in the track's report, not changed in silence.

**S8. Events.** The server keeps an event up to 4,096 bytes with one level of nesting; gameplay holds
every event under 3 KB and tests it.

## B. Decisions taken from the owner's standing instructions

The owner asked for all of it ("analytics and the progression system, have the users login ... track where
they left off ... a leaderboard, do #3, run the levels 10-20 mix it up, #9 ... loop until you get all these
right") and earlier chose: the self-hosted Supabase; Google, Facebook and Discord; sign-in before playing;
each battlefield its own length.

1. Everything in both specs is built, in the specs' package order. The specs' "releases" are checkpoints on
   branch `next`, not separate launches.
2. Boards open on the final lengths. Nothing with boards reaches players before the owner has set up the
   Supabase and tried sign-in on `/next/`, and by then the lengths are built. Ruleset 1 (today's 20-wave
   game) exists for G1's tests and pins only and is never published.
3. `HS_GATE = "required"` stays the default (the owner's choice). The escapes of platform 3.6 all stay
   (Auth down, offline, no site data, two unfinished sign-ins, in-app browsers where Google refuses): a
   wall that cannot be passed must never be the result.
4. Lengths, the tray of seven with no loadout, the six new towers, heroes per chapter with one Call, the
   Hard seal (68 stars), the Council's rules, tuning on the Standard battle, the daily at 12 waves over all
   17 battlefields: as `gameplay.final.md` recommends.
5. The owner's earlier balance rulings stand (gameplay 5.1).
6. The hidden town stays hidden and untouched.

## C. How the build is run

- Branches: `next` is the integration branch (base: master 54207ce, the specs, PF-0). Each track works in
  its own worktree on its own branch cut from `next`, and is merged back at a checkpoint.
- Nothing is pushed to `master` by a build agent. Nothing is deployed.
- Secrets: no service key, JWT secret or provider secret in the repo, the page, a test fixture or a log.
  The test stack makes its own throwaway secrets at start.
- Every package ends with: `node deploy/check-page.js index.html`; `timeout 900 node tools/selftest.js`
  green; the regression scripts its spec names green; its own new checks green; a commit.
- The selftest's first suite keeps its 151 checks and its time. New gameplay checks go into suite 2
  (gameplay 8.1). Platform checks go into `tools/platform/` and `tools/regress/platform.js`.
- Player-facing text: short sentences, American spelling, no long dashes, history claims sourced or
  labeled as the game's invention, neutral toward every people.

## D. Still the owner's to answer (the default is built meanwhile)

1. The Supabase's public https address and its anon key (until then the two constants stay empty and the
   platform is off).
2. Whether `required` stays after a week of funnel numbers. Default: required.
3. Email auto-confirm on the Supabase: off, or launch without Discord. Default: the page holds Discord
   back while auto-confirm is on.
4. Whether the anonymous id may be kept before a visitor chooses anything. Default: `HS_ANON_ID = "device"`.
5. The second address hyeland.avunjian.com. Default: nothing built for it; redirect it to the first.
6. Launch before Meta approves. Default: buttons follow what the server has switched on.
7. How long counts are kept. Default: 180 days.
8. The privacy page's bracketed places (name, contact, country, days the web server keeps logs).

## E. The machine, and what that means for balance tables

- The build machine has 4 cores and two tracks share it. A timing failure (the selftest's budget, `dance10`,
  `nag`) seen while the other track is running tests is rerun alone before it is believed.
- Balance tables before the lengths are in (G1, G2, G3) are Normal at SEEDS=1 only: G1's baseline (the pars
  of ruleset 1, which is never published) on all 17 battlefields; G2's and G3's kit bounds on Erebuni to
  Sevan plus Sis, Van and Shushi. The full tables of gameplay 8.3 (three difficulties, SEEDS=3) are
  produced once the lengths and the post are in (G4, G5), then per special tower on its own battlefields.
- The owner's setup guide (`deploy/supabase/README.md`) and the smoke test are finished with P1, not P8:
  the owner's own setup is the longest wait of the platform track and must start early.

## F. The shared Supabase (binding on the platform track)

The game's backend runs on the owner's shared self-hosted Supabase (`https://db.avunjian.com`: Postgres 17,
GoTrue, PostgREST behind Kong, the whole REST API exposed), not on a Supabase of its own. Other apps own other
schemas there: PathStream owns `public`, ReqStream owns `reqstream` and `reqstream_meta`. There is one
`auth.users` for all of them, and its email sign-up is open.

**S9. One schema, `highland`, and players by membership.** Everything the game owns is in the schema
`highland`: the tables, the `hs_*` functions the page calls (names unchanged), and the helpers, folded in from
the old `hs_private` and named `_...`. Nothing is created in `public` or anywhere else. The SQL is a set of
numbered migrations with rollbacks (`deploy/supabase/migrations/`, applied by `tools/platform/migrate.js`), each
followed by a lockdown that takes back what Supabase's default privileges grant; the only grants are USAGE on the
schema and EXECUTE on the page's functions, to `anon` and `authenticated` as before; `service_role` gets nothing.
Row level security is on for every table, with policies as defence in depth (a player's own rows only). The page
names the schema in `Accept-Profile` and `Content-Profile` on every `/rest/v1/` call. Signing in proves identity
only: a **player** is an account with a row in `highland.hs_profiles`, made only by the name card
(`hs_profile_set_name`), and only for an account that signed in with Google, Facebook or Discord. Every player's
function asks for a player in a session the game's sign-in began (`amr` says `oauth`) and refuses anyone else
with `42501` (`no_profile`, `not_game_session`); admin functions answer `not_admin`. An account made by
another app's email sign-up gets what a visitor gets. Reason: the shared server's `public` would collide with
PathStream's, and its open sign-up would otherwise make anyone who signs up anywhere a player.

**S10. "Delete my account" removes the game's data only.** Approved by the owner: "Delete my account" removes
only the game's data. `hs_delete_account` deletes the caller's rows in `highland` (profile, saves, runs, scores,
board rows, visits, rate counters, an admin's row) and never touches `auth.users`, `auth.identities` or the
sign-in service's log, which belong to every app on the server. The page's words already promise only the game's
data. The privacy page says that the sign-in itself is kept by the shared sign-in service and how to have it
removed (by writing to the owner).
