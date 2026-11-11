# Highland Stand: the platform build spec (final)

Accounts, the sign-in gate, cloud saves, leaderboards, the daily challenge's boards, the share card, first-party
analytics, the owner's stats page, the privacy page, the owner's setup guide and the staging channel.
Written against `index.html` at master 54207ce (line numbers below are that file's). Nothing here changes
gameplay; the gameplay track has its own spec (`docs/specs/gameplay.md`). The seam between the two is section 0.3.

**This is `docs/specs/platform.md` revised after its review** (`docs/specs/platform-critique.md`, 47 numbered
findings). Every blocker and every major of the review is applied here, and most minors. Appendix A lists what
changed, by the review's numbers; Appendix B what was not taken, and why. Where this file and `platform.md`
differ, this file stands. A builder reads this file only.

Files that belong to this spec, all under `docs/specs/platform/`:

| file | what it is | state |
| --- | --- | --- |
| `schema.sql` | the draft of `deploy/supabase/schema.sql` (section 2), revised with this spec | runs twice cleanly on PostgreSQL 16 |
| `schema-handoff.sql` | the draft of `deploy/supabase/schema-handoff.sql`: the sign-in handoff, **optional** (section 1.6) | runs twice cleanly; loaded only if the owner's iPhone check asks for it |
| `standins.sql` | Supabase's roles, `auth.users` and `auth.uid()` for a plain PostgreSQL (section 10.1) | used by the test below |
| `schema-test.sql` | a first SQL test of every rule and function | passes with and without the handoff (`SCHEMA TESTS PASSED`, 124 assertions) |
| `update.sh.proposed` | `deploy/update.sh` with the staging channel (section 9.3) | passes `test-update.sh` |
| `test-update.sh` | tries an `update.sh` on a throwaway origin, clone and web root | passes (7 cases) |
| `setup-guide.md` | the draft of `deploy/supabase/README.md`, for the owner (section 9), revised with this spec | text |

Marks used below: **[V]** verified against a primary source (named in section 12), **[M]** measured here on
PostgreSQL 16 with the files above, **[U]** not verified (it can only be seen on a real device or on the owner's
server, or the provider's own site could not be reached). Every [U] is collected in section 12 with how to
settle it.

---

## 0. The shape of it

### 0.1 Decisions in one page

1. **No SDK.** The page talks to the owner's Supabase with plain `fetch`: five Auth calls and a dozen
   `POST /rest/v1/rpc/hs_*` calls. Reasons: the game is one file with no build step and loads nothing from
   another host (D6 forbids third-party scripts, and a CDN copy of supabase-js is one); the SDK is about 100 KB
   of code of which this needs a few hundred lines; and the page must decide for itself what happens when the
   service is slow, down or returns to a different window (sections 1.6, 3.6), which the SDK hides.
2. **Everything in the database is named `hs_...`** and is reached through functions only. The owner's Supabase
   already runs other things; nothing here can collide with them. Every table has row level security on and
   **no policy and no grant**: the public API roles can read and write no table at all. Every read and write
   goes through a `security definer` function that checks `auth.uid()`.
3. **The public name of the Supabase serves two path prefixes and nothing else**: `/auth/v1/` and
   `/rest/v1/rpc/hs_` (and of `/auth/v1/` only the routes the page uses: P1 close, see 9.1). The game prints the anon key in a page everyone loads, and that key opens every table of
   every other project in the same database that lacks row level security. So the dashboard, the other
   projects' tables and every other service stay off the public name, and the owner audits his other tables
   before the key is printed (sections 9.1, 10.6; the guide's steps 0, 1 and 4).
4. **The platform is off wherever it cannot work**, and then the page behaves exactly as today: on `file://`
   (the selftest, the photo harness and all nine regression scripts load the page that way), under
   `HARNESS_ON`, and while the two public constants are empty. So the existing tools need no change and stay
   green (section 10.5). One thing is never off: the Hall's shell (a page with tabs), because gameplay's War
   Council and Captains live in it (0.3).
5. **The gate is a layer of its own** (`#gate`) over the page, not a new mode of `#overlay`. D3's switch is one
   constant, `HS_GATE = "required"`, which the owner can also override from the stats page without a deploy
   (`hs_config`, section 3.2); a visitor's first load waits for that switch, so it reaches new devices too.
   The gate never locks anyone out: when the Auth service does not answer, when the device is offline, when
   the browser keeps no site data, or after two sign-ins in a row that did not finish, it offers **Play now**
   (section 3.6).
6. **The iPhone Home Screen app is treated as a separate browser**, because it is one: its storage is not
   Safari's. Whether a sign-in begun there comes back there is not known for current iOS. The first release
   signs in with the plain redirect; the owner's first sign-in on the staging page is done from the Home
   Screen and the page reports where the return landed. Only if it landed elsewhere is the **handoff** built
   (`hs_handoff`, section 1.6), from its own optional SQL file.
7. **Cloud saves are one document per account with a version number** (optimistic writes). The page syncs the
   keys named in `CLOUD_KEYS`; it notices changes by itself (a hook on `localStorage.setItem`), so gameplay code
   never calls the network. Merge: records keep the best of both, lists are joined, the battle in progress is
   the newest with a prompt when two fresh battles disagree; keys a build does not know pass through untouched
   (section 4).
8. **A score is computed by the server from the battle's numbers**, not sent by the page:
   *a win is worth 4,000, plus up to 3,000 for the defenders kept, up to 1,500 for speed and up to 1,500 for
   gold never spent.* The numbers must fit the bounds of a **ruleset** the owner publishes from the page with
   one button; boards are per ruleset, so a rebalance never mixes boards (sections 2.4, 5).
9. **Progression never tilts a board.** Every run is tagged `std` (the standard loadout: no upgrade tree, no hero
   levels, no gifts of gold) or `open`. The boards show Standard first; Open is a second tab. The daily
   challenge is always the standard loadout, the same for everyone (section 5.4).
10. **The daily challenge is derived from the UTC date by two lines of arithmetic** that the page and the
    database both compute (section 5.6); over `n * m` days every battlefield meets every twist once **[M]**.
    Three ranked attempts a day.
11. **Analytics are one table of events in the same Supabase**, sent in batches by the page, with a random
    anonymous id before sign-in. No cookie, no third-party code, and no IP address or user agent string in the
    game's own tables (the sign-in service and the web server keep their own records of both, and the privacy
    page says so: sections 7, 8.1). The owner reads them on `?stats`, an admin-only page inside `index.html`.
    Limits count events, not calls; a stranger's flood cannot fill the database or starve the players' counts
    (section 7.4).
12. **The staging channel** publishes branch `next` at `/next/`. Because that is the same origin as the live
    game, a page served from `/next/` keeps its saves and its session under their own names (`next:` before
    every key), and the publishing script refuses a page that lacks that code (section 9.3).
13. **Three releases, not one** (section 11). **R1 Accounts**: the seam, sign-in and the gate, cloud saves,
    analytics and the stats page, privacy and deletion, the guide, staging. **R2 Boards**: scores, boards, the
    victory strip, the share card. **R3 Daily**: the daily challenge and its board. The schema ships whole in
    R1; the score functions answer `ruleset_unknown` until a ruleset is published.

### 0.2 Where the code goes in `index.html`

All platform code is new and sits in four places. Nothing else in the file changes except the lines listed in 0.4.

| block | where | what |
| --- | --- | --- |
| **PF-0** | in the script, right after the storage fallback (after line 3139) | `HS_STORE_MEM`, the staging namespace (9.3), the four constants, `track()`, `CLOUD_KEYS`, `HALL_TABS` |
| **PF-CSS** | at the end of the stylesheet (before line 2240) | `#gate`, `#hall`, `#ovScore`, `#shareSheet`, `#privacyPage`, `#statsPage`, the phone rules for each |
| **PF-HTML** | in the body, after `#overlay` (after line 3086) | static markup of `#gate`, `#hall` (the Hall's shell: P0, always on), `#privacyPage` (its text is real HTML, readable without scripts), `#statsPage`, and inside `#overlay`: `#ovScore`, `#hallBtn`, `#boardBtn`, `#shareBtn` |
| **PF-MAIN** | a section `// ---------- platform ----------` just before `// ---------- main loop ----------` (line 75990) | the `Platform` object: auth, gate, cloud, boards, daily, share, analytics, stats |

PF-0, verbatim (the builder fills nothing in; the owner supplies the two values later):

```js
// ---------- platform: accounts, cloud saves, boards, analytics (docs/specs/platform.final.md) ----------
// The owner's Supabase. Both values are public by design (of this game the anon key opens nothing but the
// hs_ functions; what it opens of OTHER projects in the same Supabase is section 9.1). Empty: the platform is off and the game is the game of before. NEVER put a service key, a JWT
// secret or a provider's secret in this file.
const HS_SUPABASE_URL = "";        // e.g. "https://supabase.avunjian.com" (no slash at the end)
const HS_SUPABASE_ANON_KEY = "";
const HS_GATE = "required";        // "required" | "optional" | "off" (docs/specs/platform.final.md, section 3)
const HS_ANON_ID = "device";      // "device" | "visit": where the anonymous id lives before a sign-in (section 7.1)
// Gameplay's one door to analytics, and the platform's one way to hear of a battle. It never throws and never
// touches the network: it only queues. With the platform off the queue is kept short and goes nowhere.
function track(name, props) {
  try {
    const q = window.__hsEv || (window.__hsEv = []);
    q.push([String(name), props || null, Date.now()]);
    if (q.length > 400) q.splice(0, q.length - 400);
    if (window.__hsEvKick) window.__hsEvKick();
  } catch (e) {}
}
// The keys a player owns that follow the account from device to device, each with its merge rule
// ("max", "flag", "union", "records", "newer", "run", or a function (mine, theirs) => string|null given the two raw
// strings). Gameplay adds its new keys here. Keys not listed never leave the device.
const CLOUD_KEYS = [
  { key: "hs_records", merge: "records" },
  { prefix: "hs_best_", merge: "max" },
  { key: "hs_open_kept", merge: "union" },
  { key: "hs_unlocked_seen", merge: "union" },
  { key: "hs_chapters_seen", merge: "union" },
  { key: "hs_tricks_seen", merge: "union" },
  { key: "hs_tutorial_done", merge: "flag" },
  { key: "hs_nardi", merge: "newer" },
  { key: "hs_run", merge: "run" },
];
// The tabs of the Hall page (section 5.5). The platform adds Daily, Leaderboards and Account; gameplay may add
// its own (the upgrade tree, the heroes) with { id, label, icon, render(el), badge() }.
const HALL_TABS = [];
```

`track` is a function declaration on purpose: it is hoisted, and its queue lives on `window`, so a call from any
line of the file, at any moment of start-up, is safe.

One more line belongs to PF-0, right after the storage fallback (line 3139) and before the staging namespace:

```js
// True when the page runs on memory because the browser keeps no site data (the fallback above took over).
// A sign-in cannot survive the trip to a provider and back then, and the gate says so (section 3.6).
const HS_STORE_MEM = !HARNESS_ON && !(typeof Storage !== "undefined" && window.localStorage instanceof Storage);
```

### 0.3 The seam with gameplay

Gameplay code never calls the network and never reads the platform's state. The whole contract follows. Where
the two drafts disagreed, the ruling is marked **(settled)**; the gameplay spec's numbers (N1 to N9, its 9.5)
are named beside the item that answers them.

**What the platform gives gameplay**

- `track(name, props)`: analytics, and the signal the platform acts on (it asks for a run token on
  `battle_start`, posts the score on `victory` and `defeat`). Declared in PF-0, before any gameplay code. With
  the platform off it only fills a short queue on `window.__hsEv` and sends nothing (N1).
- `CLOUD_KEYS`: add a row and the key syncs. Gameplay pushes its rows with a merge function each (N2).
- **The Hall's shell** (`#hall`, `HALL_TABS`, `openHall(tabId)`): a page with tabs. **(settled)** It is part
  of P0 and is not behind the platform's switch: it opens on `file://`, under `?shot` and `?selftest`, and
  with the constants empty, showing gameplay's tabs alone. So gameplay builds no page of its own for the War
  Council and the Captains (its 4.6 planned one "wherever the Hall is absent"; it is never absent). The
  platform's tabs (Account in R1, Leaderboards in R2, Daily in R3) appear only when the platform is on (N4).
- `openHall()` with no tab opens, in this order: gameplay's `council` tab while its `badge()` is above zero
  (stars unspent); else the Daily tab while today's daily is unplayed; else the first tab. The star tally
  `#ovStars` calls `openHall()` (N4).
- `onSavesChanged()` **(settled)**: if gameplay defines this function, the platform calls it after any merge
  that changed a synced key on this device (in place of today's `buildMenu()`), never while a battle is on
  the field (N2).
- `Platform.daily()`: `{ day, levelIndex, twist, attemptsLeft, best, rank } | null` for gameplay's daily UI.
  `null` with the platform off.
- `Platform.player()`: `{ signedIn, name }`, for a hero's or a card's wording. Read only.

**What the platform needs from gameplay** (each is used in the section named)

1. **`RULESET`** (a constant; the platform uses `String(RULESET)`) and **`rulesetData()`**, which returns the
   object of section 2.4: per battlefield its wave count `waves`, its **script table** `script` (the script
   wave each of its waves stands for, 20 at the last: gameplay's `levelScript`), and per difficulty `lives`,
   `min` (gameplay's `minS`: the clock no battle can beat; the only clock value that refuses a result, 2.4),
   `fast`, `slow`, `earnMax`; the score weights; the daily's pool, twists, `diff`, `attempts`, per-twist
   bounds, and per battlefield the twists it leaves out (`skip`). `RULESET` must change whenever anything in
   `rulesetData()` or in the fight itself changes. A check in gameplay's second self-test suite pins a hash
   of `rulesetData()` to `RULESET` so a change without a bump fails (5.2).
2. **Three counters per battle**, kept in the run and saved with it, as gameplay's 6.1 defines them
   **(settled: the clock is gameplay's, N3)**:
   `sec` (game seconds **while a wave is on the field**: the speed button, pauses, menus and the time taken
   between waves do not count; an early call does), `spent` (gold laid out on towers, ranks, masteries, land,
   repairs and rebuilds; a sale gives nothing back to it, except the full refund of a placement undone within
   its 5 seconds), and `earned` (the starting purse plus every coin paid since). `fast` and `slow` in the
   ruleset are in the same clock.
3. **The loadout tag** on `battle_start` and, final, on `victory`: `"std"` or `"open"` as gameplay's 6.4
   defines them. **(settled, N5)** Gameplay folds into the final tag everything that keeps a battle off the
   Standard boards and can still be ranked: a battle with a wave fought again after a reload (`resumed > 0`)
   is `open`. What is never ranked at all is said on `battle_start` with `ranked: false`: the coached stand,
   test mode, an endless stand, and a legacy run (a 20-wave battle begun before the new lengths). A battle
   whose `victory` says `aided: true` is not posted.
4. **The events of section 7.2**, each a `track(...)` call at the point named there, with at least the props
   listed there; gameplay may add props and events of its own (its section 7 lists them) inside the limits of
   7.4: a name of lower-case letters, digits and underscores, props under 4 KB, one level of nesting. Four
   events carry the battle's numbers and are the platform's triggers: `battle_start`, `victory`, `defeat`,
   `battle_quit`. The platform builds what it posts from the event:
   `p_stats = { won, lives, waves: e.wave, sim_sec: e.sec, spent, earned, loadout, build }`.
5. **The daily**: `DAILY_TWISTS = [{ id, name, line, apply }]` and
   **`startDaily(levelIndex, twistId, day)`** **(settled: the day is passed)**, which begins a Normal battle
   in the standard loadout with the twist applied, seeds gameplay's own dice from `day`, writes no record and
   opens no road (as `recordsBarred()` does today), and **leaves `hs_run` alone**: a daily is one sitting, is
   not saved to resume, and never replaces a campaign battle in progress. Its events carry `mode: "daily"`.
   **(settled, N6)** A lost daily is scored by the script wave it reached, out of 20; the server reads that
   from the waves cleared and the ruleset's script table, so `script` is **not** among the numbers posted.
6. **New keys** registered in `CLOUD_KEYS` with a merge function each (gameplay's 4.7: `hs_council`,
   `hs_heroes`, `hs_towers_seen`). The function gets the two raw strings (`null` when a side has none) and
   returns the string to keep. `hs_records` needs nothing new: its rule takes the larger of **every** numeric
   field per difficulty, so `beyond` is covered. The run's `t` field is gameplay's own; which of two runs is
   newer is decided by the platform's stamp (the server's clock, 4.1). The daily's attempts and best are the
   server's to count (`hs_daily_status`); a local `hs_daily` key, if gameplay keeps one for its own page, is
   not synced and is not the authority.
7. **Layout promises** (5.5). The phone's map page gets no further control in its top row (it is full: tally,
   story, nardi, gear), so the campaign tally `#ovStars` becomes a button that opens the Hall. The victory
   page, top to bottom: `#ovRecord`, gameplay's `#ovGrowth` (the hero's bar and the Council button, N7), the
   platform's `#ovScore`, the page's text. **On a phone held sideways the platform adds no row**: the score
   joins the record row as text and two round buttons sit beside the gear, in the top right corner, which
   stays the platform's. That page is full to the pixel at 667 x 320 today, so `#ovGrowth`'s 44 px there must
   come out of the page's own text; that is gameplay's to solve and is flagged to it. The chronicle's left
   column is gameplay's (N8): the platform adds nothing to it.
8. Gameplay never writes a key that starts `hs_pf_` (the platform's own, never synced).
9. `battleFacts()` and `renderBriefArt(lvl)` may be read by the share card (N9). Nothing else of the battle is.

**Not in these releases**: an endless board (gameplay's 6.2 names one). Endless stands are not ranked; their
record stays the device's and the save's. And the Open boards do not yet show `power` or `heroLevel` beside a
score (N5's "may").

### 0.4 The lines of today's code that change

| line | today | becomes |
| --- | --- | --- |
| 3139 (after) | | PF-0 |
| 76205-76207 | `requestAnimationFrame(frame);` then the first chapter's story | `requestAnimationFrame(frame); Platform.boot(() => { if (!HARNESS_ON && !chaptersSeen().includes(mapChapter())) showChapterIntro(mapChapter()); });` With the platform off `boot` calls its argument at once: the same behavior as today. |
| 60739 (keydown handler, after its `if (crashed) return;`) | | `if (Platform.blocking()) return;` (no hotkey reaches the game under the gate, the Hall, the privacy or stats page) |
| 60669 `syncOverlayUp` | | no change; the platform calls it after it lifts its own `inert` (it exports nothing new) |
| 11502 (in `endCelebration`, after `showRecord`) | | `Platform.victoryPage();` (shows the score strip and the two doors; a no-op when off) |
| 11886 (in `endFall`, after `showDebrief`) | | `Platform.defeatPage();` (a lost daily shows its score) |
| 3017 | `<div id="ovStars" role="img">` (filled by `syncChapterBar`, line 56549; hidden by `fitCampaignStars` when a title reaches it) | `<button id="ovStars" type="button">` with the same content and the same hiding; its click is `openHall()` when the Hall has a tab (gameplay's or the platform's), else nothing (and then it keeps `cursor: default`) |
| 2979-3007 `#settings` | | one more row, `#setAcct` "Account and boards", shown on menu pages only (`body.onMenu`) when the platform is on |
| 76030 `showCrashCard` | | first line `track("error", { msg: String(err && err.message || err).slice(0, 120) });` |
| the harness block, above the storage fallback (built in P0) | | `const HS_CHANNEL = ...` and `HS_KEY_PREFIX` (9.3), read before anything touches storage; the channel is read from the path as the web server reads it (doubled slashes merged, percent codes decoded, capitals as small letters) |
| the storage fallback's check (built in P0) | `localStorage.setItem("hs_probe", ...)` | the same key under `HS_KEY_PREFIX` |
| `recoverToMap` (built in P0) | closes the nardi board and the town | also `try { closeHall(); } catch (e) {}`: "Return to map" on the crash card puts the Hall away |

Everything else the platform needs it reads through functions that exist: `getSavedRun`, `resumeRun`,
`furthestOpen`, `levelConquered`, `levelStanding`, `starTally`, `showBrief`, `selectMapLevel`, `openCampaignMap`,
`battleLive`, `escapeHtml`, `icon`, `toast`, `isPhone`, `phoneWide`, `phoneFold`, `hyName`, `Snd.play`.

### 0.5 The platform's own keys

All start `hs_pf_`, live in `localStorage`, are never synced, and are removed by sign-out where marked.

| key | holds | sign-out |
| --- | --- | --- |
| `hs_pf_aid` | the anonymous id (a random UUID), made on the first visit; with `HS_ANON_ID = "visit"` only at a sign-in or a guest's choice (7.1) | kept; replaced by a new one after "Delete my account" |
| `hs_pf_dev` | `{ id, label }`: a short random id of this browser and a word for it ("iPhone", "iPad", "Mac", "Windows PC", "Android phone", "this browser") | kept |
| `hs_pf_auth` | the session: `{ at, rt, exp, uid, prov }` (access token, refresh token, expiry in epoch seconds, user id, provider) | removed |
| `hs_pf_me` | `{ uid, name, admin }`, a copy of the profile for instant display | removed |
| `hs_pf_pkce` | a sign-in under way: `{ v, h, p, t, sa, back }` (verifier, handoff id, provider, start time, begun in the Home Screen app, where to go back to) | removed |
| `hs_pf_gate` | `{ fails, guest }`: sign-ins in a row that did not finish; guest play chosen (optional mode) | kept |
| `hs_pf_sync` | `{ owner, ver, dirty, pulled, pushed, off, kat }` (section 4; `off` is the server's clock minus the device's, `kat` the times keys with the `newer` rule last changed) | reset, but `off` is kept |
| `hs_pf_run` | the run token of the battle in progress (5.3) | removed |
| `hs_pf_out` | scores waiting for a connection, or for the same account's next sign-in (5.3) | removed |
| `hs_pf_evq` | analytics events not yet sent (7.3) | kept |
| `hs_pf_cfg` | the last `hs_config` answer (3.2), the providers `/settings` last listed, and the provider this device signed in with last (3.3) | kept |
| `hs_pf_daily` | today's `hs_daily_status` answer (5.6) | removed |
| `hs_pf_stash` | another account's unsent progress found at sign-in (4.6) | kept |

---

## 1. Supabase without an SDK

`B` below is `HS_SUPABASE_URL`. Every request but the top-level navigation of 1.2 carries the header
`apikey: <HS_SUPABASE_ANON_KEY>`; calls made for a signed-in player also carry
`Authorization: Bearer <access token>`, the others `Authorization: Bearer <anon key>`. JSON in, JSON out,
`Content-Type: application/json`. One helper does all of it:

```js
// api("POST", "/rest/v1/rpc/hs_save_get", {}, { auth: true, timeout: 8000 }) -> { ok, status, data, code }
// Never throws. status 0: the network failed or the time ran out. code: the "message" of a PostgREST error
// (the function's own word, e.g. "name_taken") or the "error_code" of an Auth error.
```

It refreshes the access token first when `auth: true` and the token has under 90 seconds left (1.4), sets
`keepalive: true` when asked (for the last flush as the page hides; the body must then be under 60 KB), and
measures the server's clock from the `now` field every `hs_*` function returns (`Platform.now()` is the device's
clock plus that offset; every time stamp the platform writes uses it, so two devices with wrong clocks still
agree which save is newer).

### 1.1 The endpoints

Auth (GoTrue), under `B/auth/v1`:

| call | when | notes |
| --- | --- | --- |
| `GET /settings` | at the gate, before the buttons show | answers `{ external: { google: true, facebook: true, discord: true, ... } }` **[V]**. It is the health probe (3.6) and decides which of the three buttons show, so the owner can open the providers one at a time. It also answers `mailer_autoconfirm` **[V]**, which decides whether Discord's button may show (3.3). 4 s time limit. |
| `GET /authorize?provider=<p>&redirect_to=<url>&code_challenge=<c>&code_challenge_method=s256` | a top-level navigation (`location.assign`), never a `fetch` | **[V]** the route needs no `apikey` on the default gateway (Kong's `auth-v1-open-authorize`; the newer default gateway, Envoy, does the same in Supabase's current files **[V]**; the guide's check after step 3 shows it on the owner's install). `scopes` is left out: the server asks each provider for the email scope by itself **[V]**. |
| `POST /token?grant_type=pkce` body `{ auth_code, code_verifier }` | on return with `?code=` | answers `{ access_token, refresh_token, expires_in, expires_at, user, provider_token?, ... }` **[V]**. `provider_token` and `provider_refresh_token` are dropped at once and never stored: the game never calls a provider. The provider's name for the Account tab is `user.app_metadata.provider` in this answer, so `GET /user` is never called. |
| `POST /token?grant_type=refresh_token` body `{ refresh_token }` | 1.4 | a new pair each time (rotation) **[V]** |
| `POST /logout?scope=local` | sign-out | 204 **[V]**; the local session is removed whatever it answers |

PostgREST, under `B/rest/v1`: only `POST /rpc/<function>` with the arguments as a JSON object **[V]**. The
functions are section 2.3. No table is read directly by the page. Errors come back as
`{ code, message, details, hint }` with a status: 400 for the functions' own refusals (`P0001`), 401 or 403 for
`42501` (not signed in, not an admin), 429 for the rate limits (`PT429`) **[V]**.

### 1.2 Signing in (PKCE, a full-page redirect)

No pop-up: iOS blocks them and a Home Screen app has none.

1. The player taps a provider's button. The page makes a verifier (64 random bytes as hex, 128 characters:
   inside the server's 43 to 128 rule **[V]**), its challenge `base64url(sha256(verifier))`, and a handoff id
   (32 random bytes, base64url). SHA-256 is a small synchronous function inside the page (so it can be checked
   in `unit.js` against RFC 7636's vector, and needs no secure-context API).
2. It stores `hs_pf_pkce = { v, h, p, t: Platform.now(), sa: standalone, back }` (`back` is `""`, `"stats"` or
   `"hall"`: where the player was), sends `provider_tapped`, flushes
   analytics with `keepalive`, and navigates to
   `B/auth/v1/authorize?provider=<p>&redirect_to=<R>&code_challenge=<c>&code_challenge_method=s256`
   where `R = location.origin + location.pathname + "?hsh=" + h` (so `/next/` returns to `/next/`; a sign-in
   begun on the stats page returns to `?stats&hsh=...`). In a Home Screen app with the handoff built, the gate
   is first set to its `waiting` state (1.6).
3. The provider signs the player in and sends him to `B/auth/v1/callback`, which sends him to `R` with
   `code=<uuid>` added to its query (the rest of the query is kept **[V]**), or with `error`, `error_code` and `error_description` in the query (and again after
   `#`) **[V]**. The code is good for 5 minutes and once **[V]**.
4. On every load, before the game's first page is decided, `Platform.boot` reads the query. The same is done
   on `pageshow` when the page comes back from the browser's back-forward cache (`event.persisted`), because a
   player who presses Back on the provider's page lands there with no load at all.
   - `code` and a stored `hs_pf_pkce` whose `h` equals `hsh` and whose `t` is under 10 minutes old: exchange
     (`POST /token?grant_type=pkce`), store the session, remove `hs_pf_pkce`, strip `code`, `hsh`, `error*`
     and the fragment from the address with `history.replaceState`, send `signed_in` (with `standalone` and
     `same: true`), go on to 3.4.
   - `code` but no matching `hs_pf_pkce`: this window cannot finish the sign-in. With the handoff built and
     `hsh` present, 1.6 applies. Otherwise: strip the address, count a failure, show the `signin` card with
     "Sign-in did not finish here. Try again.", send `signin_error { error: "no_verifier" }`.
   - `error`: remove `hs_pf_pkce`, strip the address, count a failure (`hs_pf_gate.fails`), send
     `signin_error { provider, error }` (`error` is the server's `error_code` or `error`, never the
     description), and show the gate with one line by code:

     | the server's `error_code` | the line |
     | --- | --- |
     | `provider_email_needs_verification` | "<Provider> says your email is not verified. Verify it there, then try again." |
     | `bad_oauth_state`, `flow_state_expired`, `flow_state_not_found` | "Sign-in took too long. Try again." (the server gives a sign-in five minutes at the provider **[V]**) |
     | `access_denied` with no code (the player pressed Cancel at the provider) | "Sign-in was canceled." |
     | anything else | "Sign-in did not finish. Try again, or use another account." |

     An error can arrive without `hsh` and at the site's root: when the server cannot read where the sign-in
     began it sends the player to `SITE_URL` **[V]**. A staging sign-in that fails this way lands on the live
     page. That is harmless (the live page has no sign-in under way and shows the line), and is said here so
     nobody hunts it as a bug.
   - an exchange that fails: the same as an error, with `error: "exchange_" + status`.
   - no `code`, no `error`, and a `hs_pf_pkce` under 10 minutes old, outside a Home Screen app: the player
     came back without signing in. Remove `hs_pf_pkce`, count a failure, show the `signin` card with "Sign-in
     did not finish. Try again, or use another account.", send `signin_error { error: "abandoned" }`. (In a
     Home Screen app with the handoff built, this is the `waiting` state of 1.6 instead.)
   - a `hs_pf_pkce` older than 10 minutes: remove it, nothing else.
   The address is stripped before any analytics call, and no event ever carries the query string.

Who may be redirected to: Supabase sends the player back to `redirect_to` only when it is on the same scheme,
host and port as its `SITE_URL`, or matches a pattern in `ADDITIONAL_REDIRECT_URLS`; otherwise to `SITE_URL`
itself **[V]**. So `SITE_URL=https://highland.avunjian.com` covers the live page and `/next/`; a second name for
the game (hyeland.avunjian.com is served by the same web server today) needs
`ADDITIONAL_REDIRECT_URLS=https://hyeland.avunjian.com/**`.
If the Supabase's `SITE_URL` already belongs to another project of the owner's, it stays that project's and the
game's address goes into `ADDITIONAL_REDIRECT_URLS` instead. The rare sign-in that fails before the server knows
where it began (step 4's note) then ends on that other project's page: one more reason for the owner to know
which case he is in (the guide's step 1).

One account, several buttons: Supabase links a new sign-in to an existing account with the same verified email
by itself **[V]**, so a player who used Google on the iPad and Discord on the PC with one email has one account.
What counts as "verified" is the Auth service's to say, and one setting makes it say too much: 3.3.

### 1.3 Where the session is kept

`hs_pf_auth` in `localStorage`: `{ at, rt, exp, uid, prov }`. Not a cookie (the page has no server of its own).
The risk of a token in `localStorage` is script injection; the page loads no outside script, builds every name
and message with `escapeHtml` or `textContent`, and puts every string that comes from the server on the page as text, never as markup: other players' names
on the boards (5.5) and, above all, what strangers' events carry onto the stats page (7.5). The access token lives one hour (`JWT_EXPIRY`, default 3600 **[V]**).

Storage that fails (Safari's old private mode, blocked site data) already falls back to memory (line 3120): the
session then lasts for the visit, and the gate comes again on the next. Safari also clears a site's script
storage after seven days of browser use without a visit to it **[U]** (from memory of WebKit's own description;
Home Screen apps are exempt): today that silently wipes a Safari player's whole campaign. With an account he
signs in again and has everything back. That is the best single argument for the gate, and the welcome page
says it ("Your progress is saved to your account").

### 1.4 Keeping the session fresh

- Before any call with `auth: true`, and on `visibilitychange` to visible: if `exp - now < 90` s, refresh.
- One refresh at a time across tabs: inside `navigator.locks.request("hs_pf_auth", ...)` where the browser has
  it (Safari 15.4 and later), else a plain in-page promise. Inside the lock the page **reads `hs_pf_auth`
  again**: another tab may have refreshed already, and then it uses that. (A refresh token works once; used
  again within 10 seconds it still answers, later than that the whole session is ended **[V]**.)
- A refresh that fails with status 0 or 5xx: the session stays, the call that wanted it fails soft (queued or
  shown as offline), and the next refresh is tried no sooner than 30 s later.
- A refresh the server refuses (400 with `refresh_token_not_found`, `refresh_token_already_used`,
  `session_not_found`, or any 4xx): if the access token is still valid, keep using it until it ends; once it has
  ended the session is over: remove `hs_pf_auth`, keep everything else, and show the gate again on the next
  load (not in the middle of a battle: a toast says "You were signed out. Your progress is safe on this device.").

### 1.5 Signing out and deleting the account

**Sign out** (Hall, Account tab): push the save first (4.3). If the push succeeds: `POST /logout?scope=local`,
remove the keys marked in 0.5 and every `CLOUD_KEYS` key from this device, send `signed_out`, reload. If it
cannot push: "Your latest progress could not be saved yet. Sign out anyway?" with **Stay signed in** and
**Sign out anyway** (the unsent progress then waits in `hs_pf_stash` for that account, 4.6). The words before
either: "Sign out? Your progress stays in your account. This device starts fresh."

**Delete my account** (Account tab, a second tap confirms as Abandon does today, line 60595):
`POST /rpc/hs_delete_account`, which removes the profile, the save, the runs, the scores and board rows, the
visits that carried the account and the same devices' visits from before any sign-in, the sign-in service's
own log of the account, and the account's row in `auth.users` (and with it Supabase's
identities, sessions and refresh tokens). Then the device is cleared as at sign-out, a new anonymous id is made, and the page reloads to the
gate. Words: "Delete your account? Your name, progress and scores are removed from our server and from this
device. This cannot be undone." **Delete everything** / **Keep my account**. GoTrue has no call a player can
make to delete himself (its delete is admin only **[V]**), hence the function; that the function's owner may
delete from `auth.users` is checked by `schema.sql`'s last statement on the owner's server **[U]**.

### 1.6 Safari, the Home Screen app, in-app browsers, frames

**Safari, Chrome, Firefox, Edge on any device**: the redirect of 1.2 leaves and returns in the same tab. Nothing
special.

**The iPhone or iPad Home Screen app** (`navigator.standalone === true`; the page sets
`apple-mobile-web-app-capable`, line 6, so it is a real mode of this game). Its `localStorage` is its own, not
Safari's **[V, by developers' reports; U on current iOS]**: a player who signed in in Safari is not signed in
there, and the verifier of a sign-in begun there exists only there. What iOS does with the navigation to the
provider is not known for current versions **[U]**: it may stay in the app (then the redirect of 1.2 simply
works), or show a browser sheet over the app, or leave for Safari.

So the question is settled by looking, before anything is built for it:

1. **R1 ships the plain redirect only.** In a Home Screen app a return that lands in another window is a
   failed sign-in like any other: the window with the code has no verifier ("Sign-in did not finish here. Try
   again."), the app counts an abandoned sign-in when it is seen again, and after two the app offers **Play
   now** (3.6). Nobody is locked out.
2. **The owner's first sign-in on `/next/` is done from the Home Screen** (the guide's step 6). The page
   itself reports the answer: `signed_in` carries `standalone` (the window that finished is the Home Screen
   app) and `same` (it held the verifier), `signin_error { error: "no_verifier" }` is a return in the wrong
   window, and the stats page's gate card shows the three counts for Home Screen apps on their own line.
3. **If the return lands in the app**: the handoff is never built. Delete `schema-handoff.sql` from the plan.
4. **If it lands elsewhere**: build the handoff (work package P2b, section 11), exactly as follows.

**The handoff** (only when step 4 says so; `docs/specs/platform/schema-handoff.sql`, tested):

- The window that receives `?code=` **and has the verifier** signs in (1.2). If it is not the Home Screen app
  although the sign-in began in one (`hs_pf_pkce.sa` is true, `navigator.standalone` is not), it is a sheet that
  shares the app's storage: it shows only "You are signed in. Tap Done to go back to the game." The app under
  it sees `hs_pf_auth` appear (a `storage` event, and a check every second while it waits) and goes on.
- The window that receives `?code=` and `hsh` **without the verifier** calls
  `POST /rpc/hs_handoff_put { p_id: hsh, p_code: code }` and shows the gate's `other` state: "You are signed
  in. Go back to Highland Stand on your Home Screen." with one more line: "Or keep playing here: sign in again
  in this window." and the buttons. This state is shown only on iOS (the only place a Home Screen app of this
  game exists); everywhere else a code without a verifier is the failed sign-in of 1.2.
- The window that began, when it is a Home Screen app, shows the gate's `waiting` state ("Finish signing in
  in the window that opened. Then come back here." with **Start over**) and asks
  `POST /rpc/hs_handoff_take { p_id: h }` when it becomes visible and every 2 seconds while visible, for 5
  minutes. When a code comes it exchanges it with its own verifier. The code is useless to anyone without the
  verifier, is deleted when taken, and expires in 5 minutes.
- Limits **[M]**: three puts per handoff id in five minutes, 600 puts a minute for everyone, 200 takes per id
  in five minutes (a waiting window asks 150 times). One stranger cannot hold everyone's handoff.

**In-app browsers** (a link opened inside Facebook, Instagram, TikTok, Discord, LinkedIn, an Android WebView):
Google refuses to sign in inside embedded web views (`disallowed_useragent`) **[V]**. The page detects them by
user agent (`FBAN|FBAV|FB_IAB|Instagram|Line\/|MicroMessenger|TikTok|musical_ly|Twitter|LinkedInApp|Snapchat|
Pinterest|GSA\/|; wv\)`), hides the Google button there, and shows above the others: "This app's browser can
block sign-in. For Google, open highland.avunjian.com in Safari or Chrome." with **Copy link**
(`navigator.clipboard.writeText`, with a selected text field as the fallback) and **Open in browser** (a link
to `x-safari-https://highland.avunjian.com/` on iOS and to
`intent://highland.avunjian.com/#Intent;scheme=https;end` on Android **[U]**: it is on the owner's checklist,
and is dropped if it does nothing on his devices). Facebook's and Discord's buttons stay.
`gate_shown` carries `state: "inapp"` so the stats show how many arrive this way. These arrivals matter: a
shared card (section 6) is most often opened inside exactly these apps.

**A framed page** (`window.top !== window`): a provider refuses to show its page in a frame. The provider
buttons then open the game's own address in a new tab (`window.open(location.href, "_blank")`) with the line
"Sign-in opens the game in its own tab."

**Android "Add to Home screen"** shares Chrome's storage **[V, by report]**: nothing special.

---

## 2. The database

The file: `docs/specs/platform/schema.sql`, to be copied to `deploy/supabase/schema.sql` unchanged. One file,
safe to run again, no secret in it. It was run twice on a fresh PostgreSQL 16 here and passes `schema-test.sql`
(124 assertions: roles, grants, each function's refusals and results, the limits, the daily's arithmetic, the
stats against hostile events) **[M]**. It uses nothing newer than PostgreSQL 13 (`normalize()`), so it runs on
any Supabase image. It begins with `set role postgres`, so no function is owned by a superuser on installs
whose SQL editor runs as one, and ends with three checks that warn the owner (2.6).

### 2.1 Tables

| table | one row per | columns that matter |
| --- | --- | --- |
| `hs_profiles` | player | `user_id`, `name` (chosen), `name_key` (folded, unique), `name_changed_at`, `hidden`, `first_aid` |
| `hs_saves` | player and channel (`live`, or `next` for the staging page, 9.3) | `version`, `data` (the save document, section 4.1), `bytes`, `device`, `updated_at` |
| `hs_rulesets` | ruleset | `id`, `data` (2.4), `active` |
| `hs_runs` | ranked battle begun | `id` (the run token), `user_id`, `mode`, `level_id`, `diff`, `ruleset`, `day`, `twist`, `started_at`, `finished_at` |
| `hs_scores` | accepted result | the run, the numbers sent, `score`, `stars`, `loadout`, `flags` |
| `hs_score_best` | player and board and period | `board`, `period`, `score`, `score_id`, `achieved_at` |
| `hs_sessions` | visit of the page | `sid`, `aid`, `uid`, `day`, `build`, `ruleset`, `channel`, `dev_class`, `os`, `browser`, `standalone`, `vw`, `vh`, `lang`, `ref` |
| `hs_events` | event | `sid`, `seq`, `name`, `props`, `cts`, `ts` |
| `hs_admins` | admin | `user_id` |
| `hs_config` | switch | `key`, `value` |
| `hs_name_blocklist` | refused word | `pattern` (folded), `kind` |
| `hs_rate` | rate counter | `bucket`, `key`, `n` |
| `hs_handoff` (optional file, 1.6) | sign-in in transit | `id`, `code`, `created_at` |

Nobody reads any of them directly: not a visitor, not a player, not even his own rows.

Board keys: `c:<level>:<diff>:<loadout>:<ruleset>` with periods `all` and `w:<that week's Monday>` (ISO weeks,
Monday 00:00 UTC); `d:<yyyy-mm-dd>` with period `all` for a daily.

### 2.2 Row level security

- Row level security is **enabled on all twelve tables** (and on the thirteenth when its file is loaded).
- All privileges on them, and on their sequences, are **revoked from `public`, `anon` and `authenticated`**
  (Supabase grants everything on new tables, functions and sequences in `public` to those roles by default
  **[V]**; the stand-ins copy that default so the test proves the revoke).
- **No policy and no grant exists on any table.** Row level security with no policy denies every row. The
  page reads no table, and a direct read would be a leak: a player's own `hs_scores` rows carry `flags`, which
  would tell a cheater which of his made-up results were noticed.
- Everything is a function. All `hs_*` functions in `public` are `security definer` with
  `set search_path = ''` (every name inside is schema-qualified), `execute` is revoked from `public`, `anon`
  and `authenticated` and granted as listed in 2.3. Helpers live in the schema `hs_private`, which the API does
  not serve and no API role may use.
- The stats are views in `hs_private` read only through `hs_stats()`, which refuses anyone not in `hs_admins`.
- What an admin can do if his session is stolen: change the switches, publish a ruleset, rename or hide a
  player, remove a score, remove old events. No function gives an admin a player's save, email or token.

### 2.3 Functions (`POST /rest/v1/rpc/<name>`)

Open to everyone (`anon` and `authenticated`):

| function | arguments | answers |
| --- | --- | --- |
| `hs_config()` | | `{ gate?, cloud?, notice?, ev_sample?, boards?, daily?, now }` |
| `hs_track(p_ctx, p_events)` | 7.3 | `{ accepted, dropped }` |
| `hs_board(p_mode, p_level, p_diff, p_loadout, p_ruleset, p_period, p_day, p_limit)` | campaign: level, diff, loadout, ruleset, period `all` or `week`; daily: day (default today) | `{ board, period, rows: [{ rank, name, score, lives, sec, at, me }], me: { rank, score, lives, sec, at } or null, total, now }`; an admin's rows also carry `id` and `uid` |
| `hs_daily_status(p_ruleset)` | | `{ day, level, twist, diff, attempts, used, best, rank, total, ends_in, now }` |
| `hs_handoff_put(p_id, p_code)`, `hs_handoff_take(p_id)` | only with the optional file (1.6) | `{ ok }`, `{ code }` |

Signed-in players only:

| function | arguments | answers, refusals |
| --- | --- | --- |
| `hs_profile_get()` | | `{ user_id, name or null, hidden, name_changed_at, admin, now }` |
| `hs_profile_set_name(p_name, p_aid)` | | `{ ok, name }`; `name_length`, `name_chars`, `name_blocked`, `name_taken`, `name_wait` |
| `hs_save_get(p_channel)` | `live` (the default) or `next` | `{ version, data, updated_at, device, now }` (`version: 0, data: null` when none) |
| `hs_save_put(p_expected, p_data, p_device, p_channel)` | the version the page last saw (0: none) | `{ ok: true, version }` or `{ ok: false, version, data }` (someone wrote in between: merge and send again); `save_too_large` (over 256 KB), `save_invalid` |
| `hs_run_begin(p_mode, p_level, p_diff, p_ruleset, p_twist)` | | `{ ok, run_id, day, attempts_left, now }` or `{ ok: false, reason: "no_attempts" }`; `ruleset_unknown`, `level_unknown`, `daily_mismatch`, `no_profile` |
| `hs_score_submit(p_run, p_stats)` | `p_stats = { won, lives, waves, sim_sec, spent, earned, loadout, build }` (`waves`: waves cleared; `sim_sec`: the battle clock of 0.3) | `{ accepted, score, stars, board, best_all, rank_all, total_all, best_week, rank_week, total_week }`; `score_implausible` (with `details`), `run_unknown`, `run_finished`, `run_expired`, `stats_invalid`, `ruleset_unknown` |
| `hs_delete_account()` | | `{ ok }` |

Admins only (`not_admin` otherwise): `hs_stats(p_days, p_cards)` (7.5), `hs_admin_publish_ruleset(p_id, p_data)`,
`hs_admin_set_config(p_key, p_value)`, `hs_admin_moderate(p_user, p_hidden, p_name)`,
`hs_admin_remove_score(p_score)`, `hs_admin_purge_events(p_days)` (5,000 visits a call; `more: true` says to
call again).

**Limits** (per hour, per player unless said): name changes 20, save writes 240, runs begun 60, scores 40.
Over the limit: 429. Events are counted one by one, not call by call **[M]**: a visitor's draw on one pool for
all visitors (`ev_cap_hour`, 20,000 an hour) and on 900 an hour per device id; a signed-in player's draw on
his own 1,500 an hour and on no pool. Over a limit events are dropped without an error (7.4). The pool is read
first and charged last, only for a batch the device's limit lets through, so one device id cannot drain it (P1
close). What the limits count is what is stored: each call is one transaction, so a refused call (a result
`score_implausible`, a name refused) is rolled back with its counter and counts against no limit; only the
proxy's 10 a second per address limits refused calls (none on Caddy). Nothing leaks by it, since the bounds are
public. An access token of a deleted account answers `not_signed_in` (P1 close).

**What Supabase itself does to every call**, and what the schema does about it:

- A visitor's statement is cut off after 3 seconds and a player's after 8 **[V]**. `hs_stats` (30 s), the
  purge (60 s) and account deletion (30 s) carry their own `statement_timeout`, which PostgREST 12 and later
  applies to the call **[V; U on the owner's version]**. If the owner's PostgREST is older, the stats page asks
  `hs_stats` card by card (`p_cards`), each of which is light.
- A function marked `stable` runs in a **read-only** transaction, even on POST **[V]**. Six functions are
  stable and none of them writes: `hs_config`, `hs_board`, `hs_daily_status`, `hs_profile_get`, `hs_save_get`,
  `hs_stats`. The test calls each in a read-only transaction and fails if a seventh appears **[M]**. So a rate
  limit can never be added to one of these six without making it volatile; reads are limited at the proxy
  instead (9.1).

### 2.4 A ruleset

Published by an admin from the stats page with one button (the page sends its own `rulesetData()`); never typed
by hand. Scores are accepted only for a published, active ruleset, and each ruleset has its own boards.

```json
{ "v": 1,
  "score": { "win": 4000, "lives": 3000, "speed": 1500, "thrift": 1500, "lostMax": 3999 },
  "levels": {
    "erebuni": { "waves": 10, "script": [1, 2, 3, 5, 8, 10, 12, 15, 18, 20],
                 "d": [ { "lives": 30, "min": 240, "fast": 300, "slow": 900, "earnMax": 6000 },
                        { "lives": 20, "min": 240, "fast": 300, "slow": 900, "earnMax": 5500 },
                        { "lives": 14, "min": 240, "fast": 300, "slow": 900, "earnMax": 5200 } ] }
  },
  "daily": { "pool": ["erebuni", "tushpa"], "twists": ["thin", "few"], "k": 5, "j": 3,
             "diff": 1, "attempts": 3,
             "skip": { "tushpa": ["few"] },
             "t": { "thin": { "earn": 0.8 }, "few": { "livesSet": 12 } } } }
```

Per battlefield: `waves` (its length) and `script` (the script wave each of its waves stands for, as many
entries as waves, the last one 20: gameplay's script map). Per difficulty (`d` is indexed as `DIFFS`): `lives`
(the defenders the difficulty begins with), `fast` and `slow` (the two ends of the speed share: full at
`fast` or under, none at `slow` or over; gameplay sets both around its par, its 6.2), **`min`** (the clock no
battle can beat, gameplay's `minS`), and `earnMax` (the most gold the battle can pay, starting purse included,
an upper bound). **Of the clock's values only `min` refuses a result; `fast` shapes the score and raises a flag.**
The draft refused anything under nine tenths of `fast`; gameplay's `fast` is "six tenths of par, or `min` if
that is longer", so a brilliant battle between the two would have been refused as impossible. A ruleset
without `min` falls back to `fast`. Gameplay produces all of them with the balance bot as its 6.2 and 6.3 say,
in its own clock (wave time), and keeps them in the page beside `LEVEL_HP` (numbers in the example are
placeholders).

The daily: `pool` and `twists` are lists of ids; `k` and `j` are the two steps of 5.6; `skip[battlefield]`
lists the twists that battlefield never gets (the pairs gameplay's bot cannot win); `t[twist]` changes the
bounds for a twist that changes them: multipliers `lives`, `fast`, `slow`, `earn`, or `livesSet` to set the
defenders outright. Publishing refuses a ruleset whose script table has the wrong length or does not end on
20, whose pool names a battlefield it does not have, or where a battlefield of the pool leaves out every
twist **[M]**.

### 2.5 What a cheater can still do, and what would stop it

The page computes nothing the server trusts, but the server cannot see the battle. `hs_score_submit` refuses
what cannot be: a run that is not the caller's or was posted before; a ruleset that is not published; more
defenders than the difficulty has; a wave count that is not the battlefield's; a battle shorter than nine
tenths of the shortest there can be (the ruleset's `min`); more gold earned than the battle can pay, or more spent than earned; a result
sent sooner after `hs_run_begin` than the battle's clock divided by the game's top speed (4x) allows; a fourth
daily attempt; more than 40 results an hour. Results that are possible but rare are stored with a flag (`fast`,
`perfect`) and listed for the admin (and for nobody else: a player cannot read his own flags), who can remove a score or hide a player (his rows leave every board).

What that leaves: **anyone who reads the page can begin a run, wait as long as the fastest battle takes at 4x
(a few minutes), and post the best numbers the bounds allow.** He can also script the real game (an aim bot),
or play with the page's code changed (free gold, slow foes) and post honest-looking numbers. A second account is
one more sign-in away.

What it would take to stop it, in rising cost:

1. *Tighter bounds* (cheap): gameplay's bot gives a best-known score per battlefield; a result above it by more
   than a margin is held for review instead of shown. Catches made-up numbers, not a modified game.
2. *Replay checking* (the real fix, weeks of work in the gameplay track): the page records the battle's seed and
   every order the player gave with its tick; a worker on the VPS (Node, `tools/balance.js` already runs the
   battle without a browser) replays the top results and removes those that do not reproduce. It needs the
   battle to be exactly repeatable, which it is not today: the fight draws from `Math.random`, which the
   painting and the sound also draw from, frame by frame. The fight's dice would have to become a seeded
   generator of their own, and the update a fixed time step. Then a posted result is either a real battle or a
   forged order log that happens to win, and writing one is as hard as playing well.
3. *Provider reputation* (cheap, partial): boards could show only accounts older than a day, or with a verified
   email from the provider; slows throwaway accounts.

For a free history game the proposal is: ship the bounds, the flags and the admin's two buttons now; look at
the flagged list weekly; build replay checking only if the boards come to matter to players.

### 2.6 What the file checks on the owner's server

`schema.sql` ends with three checks that only warn, for things that cannot be known here **[U]**: that its role
may delete from `auth.users` ("Delete my account" needs it); that the name rule reads letters as letters on
this server (it tries an Armenian name, `★★★` and a name with a picture in it); and that no `hs_` function is
owned by a superuser. The guide's step 4 tells the owner to pass any warning on to the builder.

---

## 3. The gate (D3)

### 3.1 What it is

`#gate`: a fixed layer over the whole page (`z-index: 60`, above the menu pages, Settings and the rotate card,
below the crash card), with a dimmed backdrop through which the campaign map shows, and one card in the game's
walnut and bronze (`.kit`). While it is up: `#overlay`, `#topbar`, `#shop` and `#spellbar` are `inert`,
`Platform.blocking()` is true (no hotkey reaches the game), no battle can start. Its states:

| state | shown when | card |
| --- | --- | --- |
| `checking` | at load while `/settings` and `hs_config`, a code exchange or the first save pull is under way (at most 4 s, then `down`) | the crest, "Opening the gates..." |
| `signin` | no session, mode `required` or `optional` | 3.3 |
| `name` | signed in, no profile yet | 3.5 |
| `welcome` | signed in, with a name | 3.4 |
| `down` | Auth does not answer, the device is offline, or it lists no provider | 3.6 |
| `nostore` | the browser keeps no site data (`HS_STORE_MEM`, 0.2) | 3.6 |
| `waiting`, `other` | **only if the handoff is built** (1.6): the Home Screen app waits for its other window; the other window says where to go | 1.6 |

**What the gate is not.** It is a door in the page, not a lock on the server. Anyone who opens the browser's
tools can remove it and play. Nothing on the server depends on it having been passed: every function checks
the caller's token for itself. Nobody should build anything on "this player passed the gate".

### 3.2 The switch

`HS_GATE` in the page is the default. `hs_config().gate`, when the owner has set it on the stats page
(`hs_admin_set_config('gate', '"optional"')`), overrides it. How a load learns the mode:

- **A load without a session waits for `hs_config`**, beside `/settings` (both are asked at once; the
  `checking` card is up meanwhile; `hs_config` has 2.5 s). The fresh answer decides the mode. So the owner's
  switch reaches a device on its **first** load, which is the load the funnel is made of. Only when the call
  fails or runs out of time is the last answer kept in `hs_pf_cfg` used, and with no such answer the constant.
- **A load with a session uses `hs_pf_cfg` at once** and asks again in the background: for a signed-in player
  the mode only chooses between the welcome card and a toast, and no load should wait for that.
- `cloud: false` in the answer turns the whole platform off: for a load without a session at once (the page
  is then the game of before); for a signed-in load from the moment the answer arrives (syncing and posting
  stop for the rest of that load, nothing on screen is torn down).
- `hs_config` answering 404 means the schema is not installed: the platform is off for that load.

| mode | not signed in | signed in |
| --- | --- | --- |
| `required` (D3) | the gate's `signin` state; no guest play except through 3.6 | `welcome` |
| `optional` | `signin` with a fourth, quiet button **Play as a guest** and the line "Guest progress stays on this device."; chosen once it is remembered (`hs_pf_gate.guest`) and the gate does not return; the Account tab keeps the three buttons | `welcome` |
| `off` | no gate; the Account tab keeps the three buttons ("Sign in to save your progress and post scores.") | no `welcome`; a toast "Welcome back, <name>." |

The gate is not shown at all, in any mode: under `HARNESS_ON`, on `file://`, with the constants empty, on
`?privacy`, and on `?stats` (which has its own sign-in line).

**The cost of `required`, measured.** The funnel of 7.5 counts devices at `page_load`, `gate_shown`,
`provider_tapped`, `signed_in`, `name_set`, `battle_start`. The gate's cost is `signed_in / gate_shown`, shown
on the stats page **three times, never as one number**: for new devices (no battlefield held at their first
load), for returning players (today's players meeting the gate with progress on the device), and for arrivals
inside another app's browser. Four things keep the number honest:

1. `gate_shown` is sent when the sign-in card has been on screen for one second, not when it is made.
2. Nothing is counted from a crawler, a webdriver or a prerendered tab (7.3).
3. `signed_in` and `name_set` in the funnel are not the page's word: the server counts a device as signed in
   when one of its visits carried an account, and as named when that account has a profile.
4. Bypasses (`gate_bypass` by reason) are shown beside it, so "signed in" and "played anyway" are not confused.

To compare against no gate the owner sets `optional` for a week on the stats page: the same funnel then shows
how many choose **Play as a guest** and how many of each group reach their first victory and come back the
next day. No rebuild either way.

### 3.3 The sign-in card: words and buttons

```
[crest]  HIGHLAND STAND
Sign in to take command.
Your progress is saved to your account. Pick up where you left off on any device.

[ G  Continue with Google   ]
[ f  Continue with Facebook ]
[ D  Continue with Discord  ]   Last used

For players 13 and older. We keep your email address, a player name you choose, your progress and
your scores. We count how the game is played. We never post to your accounts.  Privacy
```

- The three buttons are shown in that order, each only when `/settings` says the provider is on. If none is
  on, the state is `down`. The list of providers last seen is kept in `hs_pf_cfg`, so when the page falls
  back to its cache the buttons still show.
- **Discord is held back while the Auth service confirms emails by itself.** `/settings` answers
  `mailer_autoconfirm` **[V]**. When it is `true`, the Auth service treats an email a provider has not
  verified as verified, and Discord is the one provider of the three that passes unverified emails on **[V]**:
  a Discord account made with someone else's address would be joined to that person's account. So with
  `mailer_autoconfirm: true` the Discord button is not shown, `gate_shown` carries `held: "d"`, and the stats
  page says so in red (7.5). The guide's step 3 has the owner look at this value before anyone signs in.
- Each button is a `button.gateBtn` with the provider's mark drawn as inline SVG at the left (Google's
  four-color G on a white button with dark text; Facebook's white f on #1877F2; Discord's white mark on
  #5865F2) and the words "Continue with <Provider>". These are the providers' own wordings and colors; their
  brand rules ask for the mark unaltered and for these or similar words **[U]**.
- The button a device signed in with last (`hs_pf_cfg.lastProv`) carries the small words "Last used". A
  player who taps a different button with a different email gets a different, empty account, and takes it
  for lost progress; this is the cheapest guard against that. The name card of a new account on a device
  that held another account adds: "This is a new account. If you played before, you may have used another
  button." with **Back to sign-in** (it signs out).
- "Privacy" is a link to `?privacy` (same tab; that page's **Back to the game** returns).
- After a sign-in that did not finish: one line above the buttons, by what happened (1.2 step 4).
- One line from the owner, if he set one (`hs_config().notice`, at most 140 characters, shown as text):
  under the title, on the `signin`, `down` and `welcome` cards. For "Facebook sign-in is back" and the like.
- In an in-app browser: the note of 1.6 above the buttons, and no Google button. In a frame: 1.6.
- `optional` mode: under the three, **Play as a guest** and its line.
- Focus goes to the first button; Tab cycles inside the card; Escape does nothing.

### 3.4 What a returning player sees: the welcome card

Shown for every signed-in load (modes `required` and `optional`), and after a sign-in.

```
Welcome back, Aram.
14 of 51 stars. 5 of 17 battlefields held.

[ Resume: Avarayr Plain, Wave 7 ]        (a battle is in progress)
[ Continue: Dvin Gates, 640 AD  ]        (none is: the furthest open battlefield not yet won)
[ Campaign Map ]   [ Today's challenge ]
```

- The first line is "Welcome, <name>." the first time an account is seen on this device.
- The lead button is exactly one of: **Resume: <battlefield>, Wave <n>** (the text of today's Resume button,
  line 55012; it calls `resumeRun()`), or **Continue: <battlefield>, <date>** (it selects that battlefield and
  opens its chronicle: `selectMapLevel(i); showBrief()`, through the chapter's story first when that chapter is
  new, as `marchToNext` does), or for a player with nothing won **Begin: Erebuni Rise, 782 BC**. When every
  battlefield is won: **Campaign Map** leads alone.
- **Campaign Map** closes the gate onto the map as it is today (the callback of `Platform.boot` runs: a new
  chapter's story first). **Today's challenge** opens the Hall on its Daily tab; it shows only when the daily is
  on, the tutorial is done and the player has attempts left.
- While the save is being pulled (4.3) the buttons are dimmed and the second line reads "Checking your saved
  progress..." for at most 2.5 s; then they are live with whatever arrived (a pull that ends later still merges,
  4.4). So a button never changes its meaning under a finger.
- After a first sign-in on a device that had progress, one more line: "Your progress on this device is now
  saved to your account." or, when the account already had some, "Your progress on this device was joined
  with your account."
- When two fresh battles disagree the card shows the choice of 4.5 in place of the lead button.
- Every button sends `welcome_tap { choice }`. The card sets no key: it is rebuilt from the save each load.

"Continue where you left off" is therefore one tap from the address bar on every device: the battle in
progress if there is one (from this device or, through the cloud, another), else the next battlefield.

### 3.5 The name card

```
Choose your player name
It is shown on the leaderboards. Do not use your real name.
[ Defender482193        ]
[ Save name ]
```

The field is filled with "Defender" and six random digits (never the provider's name, which the page never
reads). 3 to 16 characters; letters of any alphabet, digits, spaces, dots, dashes, underscores (the page checks
`/^[\p{L}\p{N} ._-]{3,16}$/u` as the player types; the server holds the same rule, 5.5). If the untouched suggestion comes back `name_taken`, the page tries one more suggestion by itself. Refusals, under the field:
`name_length` "Use 3 to 16 characters." · `name_chars` "Use letters, numbers, spaces, dots, dashes and
underscores." · `name_taken` "That name is taken. Try another." · `name_blocked` "That name is not allowed. Try
another." · `name_wait` "You can change your name once a week." · no connection: "No connection. Try again."
If the service fails here twice the card offers **Later** (the player goes on as "Defender" locally and is
asked again on the next load; without a profile no score posts).

### 3.6 When sign-in cannot work

Nobody is ever locked out. The rules:

| what the page sees | what the player sees | what is remembered |
| --- | --- | --- |
| no session, and `GET /auth/v1/settings` fails (status 0, 5xx, or 4 s pass), or `navigator.onLine` is false | `down`: "**Sign-in is not answering.** You can play now. Your progress stays on this device and joins your account the next time you sign in." (offline: "**You are offline.** You can play now. ...") **Play now** · **Try again** | nothing: the next load tries again |
| the browser keeps no site data (`HS_STORE_MEM`: storage is blocked or failed, so the page is running on memory, line 3120) | `nostore`: "**This browser is not keeping this site's data**, so a sign-in cannot be remembered here. You can play now. Your progress lasts until you close this page. To sign in, allow site data (cookies) for this site, or leave private browsing." **Play now**. No provider buttons: a sign-in could not survive the trip to the provider and back. | nothing can be |
| two sign-ins in a row did not finish (`hs_pf_gate.fails >= 2`): an error came back, the exchange failed, the return had no verifier, or the player came back without signing in (1.2 step 4) | the `signin` card with one more line and button: "Sign-in is giving trouble. You can play now and sign in later." **Play now** | `fails` is reset by a sign-in that works |
| a session exists but its refresh fails for the network | no gate at all: the player is treated as signed in (name from `hs_pf_me`), the save waits in the queue (4.3) | |
| a session exists and the server refuses it (1.4) | the game goes on; a toast, never in the middle of a wave; the gate returns on the next load | a score won meanwhile waits for the same account's next sign-in (5.3) |
| `/settings` answers but lists none of the three providers (or only Discord, held back by 3.3) | `down` | |

**Play now** closes the gate for this visit as a guest (`gate_bypass { why }` with `down`, `offline`,
`nostore` or `errors`), and the player's progress is local until a later sign-in migrates it (4.6). A player
who bypassed is asked again on his next load, in the `signin` state, never in the middle of a battle.

The third row makes the gate easy to walk around: tap a button, come back twice, play. That is intended. The
page cannot tell a player who changed his mind from one whose provider is blocked on his network, and the
second must not be locked out. The stats page counts these bypasses, so the owner sees how many take that
road (it is his to decide whether to keep it, section 13).

### 3.7 First-run funnel events

In order, for a new device in `required` mode (properties in 7.2): `page_load` → `gate_shown` →
`provider_tapped` → (the page leaves and returns) → `page_load` → `signed_in` → `name_set` → `gate_passed` →
`welcome_tap` → `chapter_story` → `brief_open` → `battle_start` → `tutorial_step` (one per step) →
`wave_end` ... → `tutorial_done` → `victory` or `defeat`. The side exits each have an event: `signin_error`
(with what went wrong, `abandoned` included), `gate_down`, `gate_bypass`, `page_hide`.

### 3.8 Layouts

One card, three arrangements. All sizes are CSS pixels; every button is at least 44 px tall to a finger; the
card keeps out of the safe areas (`--sat`, `--sar`, `--sab`, `--sal`), and scrolls inside itself if a very
short window cuts it.

| layout | rule | card | inside |
| --- | --- | --- | --- |
| desktop, iPad | neither phone query | centered, 460 px wide, padding 30 px | one column: crest 64 px and title on one line, the two lines of text (17 px), the buttons 320 x 52 px with 10 px between, the small print 12.5 px, centered |
| phone, sideways | `(max-height: 500px)` | centered, `min(640px, 100vw - 24px - insets)` wide, at most `100dvh - 16px - insets` tall | two columns: left (flexible) the crest 40 px, the title 20 px, the text 13.5 px, the small print 11 px; right (250 px) the buttons 250 x 44 px with 8 px between. At 667 x 320 the right column is 3 x 44 + 2 x 8 = 148 px tall, the left one fits in 250 px. |
| phone, upright | `(max-width: 500px)` and not sideways | `100vw - 24px` wide, centered | one column, buttons full width and 48 px tall, text 15 px, small print 11.5 px |

The welcome, name, down and nostore cards (and the waiting and other cards, where the handoff is built) use the same three arrangements (sideways: the words left, the
buttons right). The rotate card (`#rotateHint`, shown to a phone held upright) lies under the gate; it shows
once the gate is passed, as today.

### 3.9 Start-up, step by step

`Platform.boot(onMap)` is called once, at the end of the page's own start-up (0.4), in the same turn of the
script, so no tap can reach the map before the gate is up. `onMap` is today's last step (a new chapter's story
over the map).

```
0. The platform is off (HARNESS_ON, file:, the constants empty and no test override,
   or an anon key that is Supabase's published demo key)                              -> onMap(); done.
1. ?privacy                      -> show #privacyPage; done (the game waits on its map under it).
2. Start analytics (aid, sid) unless this is a crawler, a webdriver or a prerender (7.3); queue page_load.
3. Read code, error and hsh from the address; strip them from it (1.2).
4. ?stats                        -> show #statsPage (7.5); done.
5. Show #gate in `checking`.
6. Storage is memory only (HS_STORE_MEM)                 -> the `nostore` state; done (Play now -> onMap()).
7. A code or an error came, or a sign-in was left unfinished (1.2 step 4):
     a code and its verifier     -> exchange it: a session, or a failure.
     anything else               -> a failure is counted; its line is kept for the `signin` card.
8. A session is held (hs_pf_auth):
     the mode is the cached one (hs_pf_cfg, else HS_GATE); hs_config is asked in the background.
     in parallel: hs_profile_get (the name; hs_pf_me shows meanwhile) and the save pull (4.3).
     no name yet                 -> the `name` state, then on.
     mode off                    -> hide the gate; toast; onMap(); done.
     else                        -> the `welcome` state, its buttons dimmed until the pull ends or 2.5 s pass.
   No session:
     at once, together: hs_config (2.5 s) and GET /settings (4 s).
     hs_config says cloud false, or answers 404          -> hide the gate; onMap(); done.
     the mode is hs_config's answer; if it did not come, the cached one; if none, HS_GATE.
     mode off, or optional with guest play chosen        -> hide the gate; onMap(); done.
     /settings failed, or the device is offline          -> the `down` state.
     /settings answered                                  -> the `signin` state (`down` if no button is left).
9. Leaving the gate: lift `inert`, syncOverlayUp(), send gate_passed, then what was chosen:
     Campaign Map, Play now, Play as a guest   -> onMap()
     Resume                                    -> resumeRun()
     Continue, Begin                           -> the battlefield's chronicle, through its chapter's story when new
     Today's challenge                         -> onMap(); openHall("daily")
```

Nothing in these steps can leave a player on a dead page: every wait has a limit, and every failure ends in a
state with a button that plays.

---

## 4. Cloud saves

### 4.1 The save document

One per account, in `hs_saves.data`. The server treats it as opaque; the page owns its shape:

```json
{ "v": 1, "at": 1794000000000, "dev": "k3f9", "label": "iPhone",
  "keys": { "hs_records": "{\"erebuni\":{...}}", "hs_best_erebuni_0": "21", "hs_chapters_seen": "[\"kingdoms\"]" },
  "run": { "at": 1794000000000, "dev": "k3f9", "label": "iPhone", "val": "<the hs_run string, or null>", "tok": null } }
```

- `keys` holds the raw `localStorage` strings of every `CLOUD_KEYS` key but `hs_run`, exactly as the game
  wrote them. The platform never interprets a key it has no rule for.
- `run` is the battle in progress: `val` is the `hs_run` string, or `null` meaning "no battle in progress as of
  `at`" (a battle won, lost or abandoned leaves that mark, so another device drops its stale copy). `tok` is
  the run token (5.3), which travels with the battle.
- `at` are milliseconds of `Platform.now()` (the server's clock), `dev` and `label` come from `hs_pf_dev`.
- `v` is the document's format. A build never applies or overwrites a document whose `v` is above its own (4.4).
- `keysAt` (beside `keys`) holds, for each key with the `newer` rule, the time it last changed on the device
  that wrote it: `{ "hs_nardi": 1794000000000 }`.
- The server's clock offset is kept in `hs_pf_sync.off`, so a load that reaches no server still stamps in the
  server's time.
- Not synced, by decision: `hs_settings` (volumes belong to a device), `hs_home_tip`, the `hs_mig_*` flags (each
  device migrates its own old data before it syncs), `hs_nardi_bless` and every `hs_town*` key (the town is
  hidden), and all `hs_pf_*`.

### 4.2 How the page notices a change

Gameplay keeps writing `localStorage` through its helpers, as today. PF-MAIN wraps the storage once at start:
`Storage.prototype.setItem` and `removeItem` (after the quota guard of line 3136; the wrapper acts only when
`this` is the page's `localStorage`, because `sessionStorage` shares the prototype), or the methods of the
`next:` object of 9.3. They call `Cloud.touched(key)` after the write when `key` matches `CLOUD_KEYS`. That
sets `hs_pf_sync.dirty`, notes the time for a key with the `newer` rule, stamps `run.at` when the key is
`hs_run` and it was **set**, and schedules a push (4.3). Writes the platform itself makes while applying a
merge are not counted. So no call site in the game changes, and a key gameplay adds to `CLOUD_KEYS` syncs
with no further code.

Three rules the hook keeps:

- **The "no battle" mark is written by a battle's end, never by a removal.** `run.val = null` with a fresh
  `at` means "the battle was finished, as of now", and it wins over an older battle on another device (4.5).
  The page writes it on `victory`, `defeat` and `battle_quit { how: "abandon" }` only. The game also removes
  `hs_run` for other reasons (a migration of old saves does, line 76089); such a removal leaves this device
  with no battle and **no mark**, so a battle the cloud holds is adopted, not destroyed.
- **No walk through storage.** The memory fallback and the harness's storage have no `key()` or `length`.
  The `hs_best_` prefix rule lists its keys with `bestKey(i, e)` for every battlefield and age the build
  knows; keys of that prefix which only the cloud's document has pass through untouched (4.4).
- The hook is in place before the page's own migrations run, and their writes are changes like any other.

### 4.3 When it syncs

**Pull** (`hs_save_get`, then merge, then push if the merge changed the cloud's side):

- at load, for a signed-in player, before the welcome card's buttons go live (2.5 s limit, 3.4);
- right after a sign-in;
- when the page becomes visible again, if a menu page is up and the last pull is over 5 minutes old;
- never while a battle is live: a battle in play is never replaced under the player. (A push the server turns
  away during a battle is merged for the cloud only; the device's keys wait for the battle's end, 4.4.)

**Push** (`hs_save_put` with the version last seen):

| trigger | delay |
| --- | --- |
| a victory, a defeat, an abandon (the events `victory`, `defeat`, `battle_quit`; these also write the "no battle" mark, 4.2) | at once |
| a wave cleared (`wave_end`; the game saves the run there, line 11363) | at once, but not more often than every 25 s |
| any other change of a synced key in battle (a tower built: the game saves the run then too) | 25 s after the last one |
| a change on a menu page (a chapter's story seen, a nardi game) | 2 s after the last one |
| the page is hidden or closed (`visibilitychange` to hidden, `pagehide`) while dirty | at once, with `keepalive` (skipped when the body is over 60 KB: the next load sends it) |
| the device comes back online (`online`) while dirty; a sign-in | at once |

A push that the server answers with `ok: false` (another device wrote since) merges the returned document
(4.4) and pushes again, three times at most. A push that fails for the network leaves `dirty` set: the save is
simply sent whole the next time (the sync is by state, not by a log of changes, so nothing queues up and
nothing can be replayed twice). After a failure the next try waits 5 s, then 15 s, 60 s, then 5 minutes.

**Limits.** The server refuses a document over 256 KB. The page builds at most 200 KB: over that it leaves the
run out, sends `sync_fail { why: "size" }`, and tells nobody (records are a few KB; a run is 2 to 10 KB).
Today's whole save is under 20 KB.

The Account tab shows the state in one line: "Saved to your account just now." / "Saved to your account 12
minutes ago." / "Waiting for a connection. Your progress is safe on this device."

### 4.4 Merge rules

`Cloud.merge(mine, theirs)` is a pure function of two documents (unit-tested, 10.4).
For each key the rule named in `CLOUD_KEYS`:

| rule | result | used for |
| --- | --- | --- |
| `max` | the larger number; a number beats a non-number; one side missing: the other | `hs_best_*` (the wave reached, 21 once won) |
| `flag` | `"1"` once either side has it. On this device a value of `"0"` is left as it is (it is a wish of this device: "run the tutorial again", line 60835) while the document keeps `"1"` | `hs_tutorial_done` |
| `union` | the JSON arrays joined, mine first, no item twice; a side that is not an array counts as empty | `hs_open_kept`, `hs_unlocked_seen`, `hs_chapters_seen`, `hs_tricks_seen` |
| `records` | per battlefield id, per field and per difficulty, the larger number (clamped as `levelRecord` clamps them, line 10935, for the fields it knows); so `stars`, `lives`, `endless` and gameplay's `beyond` need no rule each; a battlefield only one side has is kept | `hs_records` |
| `newer` | the value whose **own** time of last change is later (`keysAt[key]` in each document, noted by the hook, 4.2); not the document's `at`, which every push renews | `hs_nardi` |
| a function | its return value for `(mine, theirs)` (raw strings, `null` when missing) | gameplay's keys |
| `run` | 4.5 | `hs_run` |

Four more rules, for the document as a whole:

- **A key this build has no rule for is carried through untouched** (the cloud's value, else this device's).
  An older build, a tab left open since before an update, never deletes what a newer build added to the
  save. It also never writes such a key to this device.
- **A document whose `v` is above the build's is neither applied nor overwritten.** The page stops syncing
  for the load, sends `sync_fail { why: "newer" }`, and says once on a menu page: "A newer version of the
  game saved your progress. Reload to update."
- **Nothing a player has won is ever lost by a merge**: records and roads only grow. No rule deletes a key
  (the battle in progress is the one thing that can end).
- **A merge never rewrites this device's keys under a battle.** While a battle is live, a merge (it can
  only come from a push the server turned away, 4.3) is pushed and held in memory; the device's keys are
  written when the battle has ended. After any merge that changed a key on the device, and never during a
  battle, the page calls gameplay's `onSavesChanged()` if it is defined, else `buildMenu()` when a menu page
  is up, so stars, open roads, the Council and the heroes are read again.

### 4.5 The battle in progress

`mine` and `theirs` are the two `run` parts. In this order:

1. The same `val`: nothing to do.
2. A battle is live on this device right now: mine stands (and is stamped now).
3. One side is a "none" mark and the other a battle: the later `at` wins. A mark is only ever written by a
   battle's end (4.2). A device whose battle is simply gone has no mark and no claim: it takes the cloud's battle. So a battle finished on the iPad
   after the phone last saved it is dropped from the phone ("That battle was finished on your iPad."), and a
   battle begun after the mark is kept.
4. Two different battles, both saved within the last 24 hours, on different devices: **ask**. On the welcome
   card, in place of the lead button:

   ```
   Two battles in progress
   This device: Avarayr Plain, wave 7, 10 minutes ago.
   Your iPad: Dvin Gates, wave 3, 2 hours ago.
   [ Keep this device's battle ]   [ Take the iPad's battle ]
   The other one is dropped.
   ```
   The choice is stamped now, so it wins everywhere (`save_conflict_choice { keep }`).
5. Two different battles otherwise: the later `at` wins, with a toast when this device's was replaced: "Your
   battle from your iPad is here: Dvin Gates, wave 3."
6. A battle from the cloud is adopted only if this build can fight it: it is written, `getSavedRun()` (line
   10710, which runs `validRun`) is asked, and if that says no the device keeps what it had and leaves the
   cloud's `run` part as it found it, for the device that can fight it.

Times are words: "just now" (under a minute), "5 minutes ago", "2 hours ago", "yesterday", "3 days ago".

### 4.6 A guest's progress, and someone else's

`hs_pf_sync.owner` says whose progress the synced keys on this device are: `""` for a guest's, else a user id.

At a sign-in (or a load with a session) as account U:

| `owner` | the account's save | what happens | the welcome card's extra line | `save_merge.case` |
| --- | --- | --- | --- | --- |
| U | any | the normal pull and merge | none | `same` |
| `""`, this device has progress | none | the device's progress is uploaded as the account's first save | "Your progress on this device is now saved to your account." | `upload` |
| `""`, this device has none | exists | the account's save is written to the device | none | `download` |
| `""`, this device has progress | exists | merged by 4.4 and 4.5 (records: the best of both; the battle: 4.5) | "Your progress on this device was joined with your account." | `merge` |
| another account V | any | V's synced keys are set aside in `hs_pf_stash` if they were never pushed (else dropped), the device is cleared, then as "this device has none" | none | `download` |

Then `owner = U`. When V signs in here again and a stash for V waits, it is merged into V's save and removed.
The stash is one slot of at most 256 KB.

**The migration of today's players** is the second row: on the day the gate goes live every existing player
has local progress and no account; his first sign-in uploads it whole. Until he signs in (or while he plays
through 3.6) nothing of his is touched.

Sign-out and account deletion clear the synced keys from the device (1.5), so a shared tablet starts fresh for
the next person and one player's progress is never merged into another's account.

---

## 5. Leaderboards and the daily challenge

### 5.1 What a score is

One sentence, shown under every board and on the victory page's strip (as a tooltip and, on touch, on a tap of
the score): **"A win is worth 4,000, plus up to 3,000 for the defenders you kept, up to 1,500 for speed and up
to 1,500 for gold you never spent."**

```
won:   score = 4000 + round(3000 * L + 1500 * S + 1500 * T)        (4,000 to 10,000)
         L = lives / livesMax                        the share of the difficulty's defenders still standing
         S = clamp((slow - sec) / (slow - fast))  1 at `fast` or under, 0 at `slow` or over (gameplay sets both around its par)
         T = clamp(1 - spent / earned)               the share of all gold earned that was never laid out
lost (the daily only):  score = floor(3999 * scriptWave / 20)              (0 to 3,999: under any win)
```

The inputs are the three counters of 0.3 (2) plus `lives` and the wave count; `fast`, `slow` and `livesMax`
come from the ruleset, so the page and the server compute the same number (`Platform.scoreOf(stats)` in the
page for the strip; `hs_score_submit` for the board; a `unit.js` vector and the SQL test use the same example:
20 of 20 kept, 600 s between 300 and 900, 900 of 3,000 spent: 4000 + 3000 + 750 + 1050 = 8,800).

**The clock** is gameplay's `sec`: game seconds while a wave is on the field (0.3 (2)). Waiting between waves,
pauses and the speed button do not move it; calling a wave early does. **`scriptWave`** is the script wave the
last cleared wave stands for (0 when none was cleared). The server reads it from the ruleset's script table
and the waves cleared, so the page posts no number for it, and a loss on wave 8 of 10 and one on wave 15 of 20
compare honestly.

Why these: defenders kept is the game's own measure (its stars); speed rewards the game's one risk the player
chooses, calling a wave early; thrift rewards holding with less. What it does not reward: stalling (no term
grows with time), selling the towers before the last foe falls (`spent` never goes down), an easier difficulty
(each difficulty has its own board). Equal scores rank by who got there first.

This formula is a proposal to gameplay, which owns the rules a score is computed from. Its shape (a win bonus
and three capped shares) is fixed in `hs_score_submit`; the five weights and every par are data in the ruleset
and can change with a ruleset bump and no change to the database.

### 5.2 Rulesets

- `RULESET` names the rules a score was earned under. Boards are per ruleset; a new ruleset starts empty
  boards ("The boards start fresh when the battles are rebalanced." under the board). Records and stars on
  the device are not affected.
- The self-test (gameplay's second suite) pins it: `hash(JSON.stringify(rulesetData()))` (the page's `sha256`, first 8 hex digits) must
  equal the constant `RULESET_PIN` written beside `RULESET`. A balance change without a new `RULESET` and pin
  fails the selftest, so two different games can never share a board.
- A ruleset is published from `?stats` (7.5): the page shows "This page plays ruleset 3. The server does not
  have it. **Publish ruleset 3**". Until then battles are fought and scored on the device but not ranked
  ("The boards for this version open soon"). An admin who opens the game with an unpublished ruleset gets a
  toast on the map: "Admin: publish ruleset 3 on the stats page." The staging channel publishes its own
  ruleset the same way; its sessions and scores carry `channel: "next"` and are left out of the stats.

### 5.3 From a battle to a board

The platform listens to four events (0.3). Its whole state is `hs_pf_run`.

1. `battle_start` with `resumed: false`: `hs_pf_run` is cleared. If the player is signed in, has a name, and
   the event says `ranked: true` (gameplay sets it false for the coached first stand, a test-mode run, an
   endless stand and a legacy run), the page calls `hs_run_begin` (5 s limit; for a campaign battle it is
   tried again at 10 s and 30 s if the network failed; **for a daily it is tried once**, because the player
   is told at once whether the attempt counts, 5.6). The answer's `run_id` is kept:
   `hs_pf_run = { rid, mode, lv, diff, ruleset, t }`.
   With `resumed: true` the token saved with the battle is used if its `lv`, `diff` and `ruleset` match.
2. `victory` (and `defeat` when `mode` is `daily`): if a token is held and the event does not say
   `aided: true`, the page posts
   `hs_score_submit(rid, { won, lives, waves: e.wave, sim_sec: e.sec, spent, earned, loadout, build })`.
   The `loadout` is the event's, which is final (0.3 (3)).
   A network failure, **or a 401 because the session ended during the battle**, puts
   `{ rid, uid, stats, t }` in `hs_pf_out` (20 entries at most, dropped after 7 days). It is sent again at
   the next load, on `online`, after any successful call, and after a sign-in by the same account; an entry
   of another account is never sent.
3. `battle_quit`, or the next fresh `battle_start`: the token is dropped. The run stays unfinished on the
   server (it is removed after 30 days); a daily attempt stays spent.

The victory page's score strip (`#ovScore`) says, in the page's small type, exactly one of:

| state | words |
| --- | --- |
| posting | "Score 7,750" |
| posted | "Score 7,750 · #12 this week" (with " · your best" when it beat the player's all-time best; "#1 of 3 this week" while a board has under 10 players) |
| posted, open loadout | "Score 7,750 · #4 this week · Open" |
| not signed in | "Score 7,750 · Sign in to post it" (the words are a button to the Account tab) |
| waiting for the network | "Score 7,750 · It posts when you are back online" |
| the battle began offline | "Score 7,750 · Not ranked: this battle began offline" |
| ruleset not published | "Score 7,750 · The boards for this version open soon" |
| refused by the server | "Score 7,750 · Not ranked" (`score_rejected { reason }` goes to the stats) |
| not rankable (test mode, the coached stand, endless) | no strip |

### 5.4 Progression and fairness

D5 gives players upgrades bought with stars and heroes who level up. A board where those count is a board of
who has played longest. So:

- Every run carries `loadout`: `std` or `open` (0.3 (3)). It is part of the board's key. The tag on `victory` is
  final: gameplay has already made a battle with a wave fought twice `open`. A battle that was `aided`, a legacy
  run, the coached stand and an endless stand are not ranked at all.
- **Standard** is the board shown first, the one the victory strip and the share card name without a
  qualifier, and the only one that counts for the daily. Everyone on it fought with the same tools.
- **Open** is the second tab ("Upgrades and hero levels count here."). A player who never switches his
  upgrades off still has a board to climb.
- Gameplay owns how a battle becomes standard for a player who owns upgrades (its spec; this spec only needs
  the tag to be true). Until the progression ships every battle is `std` unless a gift of gold paid into it.
- If time runs short the Open boards are the first thing cut in R2 (11.4): open runs then show "Score 7,750 · Not
  ranked: upgrades were on".

### 5.5 Names, the Hall, and the doors

**Display names.** Chosen at first sign-in (3.5), changed on the Account tab. The server is the judge
(`hs_private.name_clean`), and **its rule is the page's rule, not a weaker one** **[M]**: compatibility forms
folded (NFKC), outer spaces trimmed and inner runs made one space; 3 to 16 characters; **letters and digits
of any alphabet, spaces, dots, dashes and underscores, and nothing else**: no symbols, no pictures, no
stacked marks (text made to spill over the rows around it), no control or invisible direction characters;
not on the blocklist; unique after folding (lower case, spaces dots dashes underscores removed, the digits
0 1 3 4 5 7 and @ $ read as the letters they imitate), so "Aram", "a r a m" and "Ar4m" are one name. The
letter classes are read under an ICU collation where the server has one, so the rule does not hang on the
database's locale; `schema.sql`'s last statement tries three names on the owner's server and warns if the
rule reads them wrongly. One change in 7 days (free in the first 10 minutes). The blocklist
(`hs_name_blocklist`) ships with the game's own name, words of authority and the two swastika signs; the
words to refuse are the owner's to add, in folded form, and should cover slurs against any people. An admin
can rename or hide a player (`hs_admin_moderate`); a hidden player's rows are on no board.

Two limits, said plainly: an alphabet whose words need combining marks (Devanagari, Thai) cannot make a name
here, on the page or on the server; and look-alike letters of different alphabets (a Cyrillic "а" for a Latin
"a") are not folded together, so a copied name is the admin's to rename.

**No text from the server is ever parsed as markup.** A name is set with `textContent` or drawn with
`fillText`. The same holds for every string the server sends: a board's rows, the owner's `notice`, a
device's label, and everything on the stats page (7.5).

**The Hall** (`#hall`): a full page in the game's style (`z-index: 50`; the map is `inert` under it), opened
only from a menu page, closed by its X or Escape. Its shell (the page, the tab row, the three layouts below)
belongs to P0 and is always there, with the platform on or off, on `file://` and under the harness (0.3). A
row of tabs from `HALL_TABS`, in this order: gameplay's tabs (the War Council, the Captains), then the
platform's, each from the release that brings it and only while the platform is on: **Daily** (R3),
**Leaderboards** (R2), **Account** (R1). With no tab at all the Hall's doors are not shown. `openHall()`
without a tab chooses as 0.3 says: the Council while stars are unspent, else the Daily while unplayed, else
the first tab.

*Leaderboards tab.* Controls: the battlefield (‹ name ›, any battlefield the player has opened; it starts on
the last one fought), the three difficulty seals, **This week | All time**, **Standard | Open**. Then the
list, 50 rows: rank, name, score, defenders kept ("17/20"), battle clock ("10:00"). The player's own row is
tinted; if he is below the fold his row is pinned under the list: "#132 · Aram · 7,420". Under the list the
score sentence and "Weeks run Monday to Sunday, UTC." States: loading (three faint rows), empty ("No scores
yet. Be the first to hold this field."), no connection ("The boards need a connection." **Try again**), not
signed in ("Sign in to post your scores." with the three buttons).

*Daily tab.* 5.6. *Account tab.* The name with **Change**, "Signed in with Google", the sync line (4.3),
**Sign out**, **Delete my account**, **Privacy**. For a guest: the sign-in card of 3.3.

Hall layouts: desktop and iPad, a centered column 720 px wide, tabs on top, the list scrolling inside the
card. Phone sideways: tabs as a column of 44 px icons with short labels at the left (64 px wide), the tab's
controls in a second column (200 px), the list in the rest, scrolling in its own frame with the fold fade
(`phoneFold`); rows 30 px, text 12.5 px. Phone upright: tabs across the top, controls then list in one
scrolling column.

**Doors on the map page.**

| layout | door |
| --- | --- |
| desktop, iPad, phone upright | `#hallBtn`: a round 44 px button with a trophy, fixed at the top left, 10 px to the right of the campaign tally (`left` is set from the tally's right edge whenever `fitCampaignStars` runs, and it hides with the tally when a long title pushes the tally away). Title "Daily challenge and leaderboards". A red dot on it while today's daily is unplayed. Measured free at 1600, 1194, 1024 and 834 px wide and on the upright phone (between the tally and the crest, or the Nardi button). |
| phone sideways | the top row of the side column is full (tally, chapter story, nardi, gear: about 226 of 232 px at 667 px wide, read off a screenshot), so **the tally itself is the door**: `#ovStars` becomes a button that opens the Hall, with the same red dot. No new control, nothing shrinks. |
| every layout | Settings (the gear) gains **Account and boards** on menu pages, and tapping the tally opens the Hall everywhere. |

**Doors on the victory page.**

| layout | where |
| --- | --- |
| desktop, iPad, phone upright | `#ovScore`, a strip under gameplay's `#ovGrowth` row (itself under the record row, `#ovRecord`) and above the page's text: the score line of 5.3, then two small buttons, **Leaderboard** (opens the Hall on this battlefield, difficulty and loadout, on This week) and **Share** (section 6). Buttons 40 px tall on the iPad as the page's other quiet buttons are, 44 px on the upright phone. |
| phone sideways | the page is full to the pixel (title, stars, four lines, Next battle, three buttons at 667 x 320), so the score line joins the record row as text ("★★★ Normal · 7,750 · #12 this week") and the two buttons are round 44 px icon buttons fixed at the top right, left of the gear: `#boardBtn` at `right: calc(60px + var(--sar))`, `#shareBtn` at `right: calc(110px + var(--sar))`, `top: calc(8px + var(--sat))`, the slots the map page's nardi and story buttons use (neither is on the victory page). If the title reaches under them they hide the way the tally does, and the same two actions are in Settings. The platform adds no row to this page; gameplay's `#ovGrowth` takes its room from the page's own text (0.3 (7)). |

The defeat page gets the strip only for a lost daily (its score and rank, **Leaderboard**, no Share).

### 5.6 The daily challenge

**One battlefield and one twist per UTC day, from the date alone.** With `day` = whole days since 1 January
1970 UTC (`Math.floor(Platform.now() / 86400000)`), `pool` the ruleset's list of battlefield ids (`n` long)
and `twists` its list of twist ids (`m` long):

```
k = the smallest whole number >= 5 that shares no factor with n        (17 battlefields: k = 5)
j = the smallest whole number >= 3 that shares no factor with m        (6 or 12 twists: j = 5)
battlefield = pool[(day * k) % n]
i           = ((day % n) * j + Math.floor(day / n)) % m
twist       = the first of twists[i], twists[i + 1], ... (wrapping) that is not in skip[battlefield]
```

Every battlefield comes up once in every `n` days and never two days running. Within a cycle of `n` days the
twist steps by `j`; each new cycle shifts every battlefield's twist by one. So **over `n * m` days every
battlefield meets every twist exactly once**, and for the real sizes (17 by 6, 17 by 12) no twist comes two
days running **[M: checked in SQL for 17 by 6 and 17 by 12, two full cycles each]**. (The draft's line, `(day * j + floor(day /
n)) % m`, did not do this: with 17 battlefields each one met only half of the twists.) `skip[battlefield]`
is the ruleset's list of twists that battlefield never gets (gameplay's bot leaves out the pairs its mix
cannot win); the pick then walks on to the next twist **[M]**. The database computes the same lines
(`hs_private.daily_pick`) and refuses a daily run whose battlefield or twist is not the day's. `k` and `j`
are worked out by the page and published in the ruleset. The day is the server's (the page corrects its
clock by the server's, 1), so a device with a wrong clock still plays today's. The page starts the battle
with `startDaily(levelIndex, twistId, day)`: gameplay seeds its own dice from the day (0.3 (5)).

**Rules.** Normal difficulty; the standard loadout; the twist's effect (gameplay's `DAILY_TWISTS`: a name and
one line each, such as "Thin purse: bounties are a fifth lower today."); the same for everyone. It is open to every
signed-in player who has fought Erebuni once, whatever the campaign has reached; it writes no record, opens no
road and does not touch a campaign battle in progress (0.3 (5)).

**Attempts.** Three ranked attempts a day; the best counts. An attempt is spent when the first wave is sent
(that is when the run begins on the server); looking at the battlefield's chronicle costs nothing. A lost
attempt scores for the waves it held (5.1). After the third, **Practice** plays the same battle unranked.
Without an answer from the server within 5 seconds of the first wave (one try, 5.3) the battle is practice ("Practice: no connection. This battle is not
ranked."), and no attempt is spent. Leaving the page ends an attempt: a daily is one sitting (0.3 (5)), and the
Daily tab says so under its button ("One sitting. Leaving the battle ends the attempt.").

**The Daily tab.**

```
Daily challenge · November 10
Ani, c. 1041 to 1044
Thin purse: bounties are a fifth lower today.
Normal · Standard loadout · The same for everyone
Attempts left: 2 of 3      Your best today: 7,420 (#12 of 87)
[ Play today's challenge ]                      New challenge in 5 h 12 min
(today's board: 50 rows, the player's own pinned)
Yesterday: 1. Bagrat 9,105   2. Aram 8,800   3. Nune 8,640
```

**The share text** (the card is section 6): "Highland Stand daily, Nov 10: Ani, Thin purse. Score 7,420, #12
today. https://highland.avunjian.com"

---

## 6. The share card

A picture drawn on a canvas when a victory page (or a daily's result) opens, offered by the **Share** button.

**Size and file.** 1200 x 630 px (the link-preview shape every messenger shows whole), JPEG at quality 0.9,
named `highland-stand-<battlefield id>.jpg`, about 150 to 250 KB.

**What is on it** (coordinates in px from the top left; the text column starts at x = 64):

| y | what | style |
| --- | --- | --- |
| whole card | the battlefield as it stood at the victory: the game canvas's field box copied when the page opens (the dance's last frame), full width, cropped to 1200:630 around 55% of its height; if the copy fails, a gradient #2a1c10 to #14100c | |
| whole card | for legibility: a dark veil from the left (88% at x = 0, 55% at x = 620, none from x = 900) and over the bottom 110 px (to 70%); a 2 px bronze line (#b98a3e) 14 px inside the edge | |
| 96 | the crest (56 px) and **HIGHLAND STAND** | 30 px, bold, letter-spaced, #f0cf85 |
| 150 | daily only: "Daily challenge · Nov 10" | 22 px, #e6d3a8 |
| 190 | the page's own title: "<Battlefield> Stands!" (or the battlefield's `endTitle`); a lost daily: "<Battlefield>: held 7 of 18 waves" | 62 px bold #fff3d6, shrunk to no less than 40 px to fit 640 px |
| 240 | the place's name in Armenian letters (`hyName`), when it has one | 34 px, the page's Armenian face, #f0cf85 |
| 290 | "<date> · <Difficulty>" (daily: "· <twist name>" added) | 26 px #e6d3a8 |
| 352 | the three stars, won ones gold | 44 px each |
| 420 | "<kept> of <max> defenders kept" | 30 px #fff3d6 |
| 462 | "Held in <m:ss> · Score <n,nnn>" | 30 px #fff3d6 |
| 504 | when known: "#<rank> this week" (daily: "#<rank> of <total> today"; open loadout: "· Open" added) | 30 px bold #f0cf85 |
| 566 | signed in: "Held by <player name>" | 24 px #e6d3a8 |
| 556, 590 (right-aligned at x = 1136) | "Free in your browser" and **highland.avunjian.com** | 20 px and 26 px bold #fff3d6 |

The time is the battle clock (`sec`) as minutes and seconds. All words are drawn in the page's own face
(`getComputedStyle(document.body).fontFamily`). The address is the page's canonical one (the `<link
rel="canonical">`), so a card made on `/next/` still names the game.

**When it is drawn.** As the victory page opens (so the picture is ready before the finger comes: a browser
only lets a page share inside a tap, and making the picture takes longer than that), and again when the rank
arrives. The Share button is live once the first picture is ready.

**The tap.**

1. If `navigator.canShare({ files: [file] })`: `navigator.share({ files: [file], title: "Highland Stand",
   text })`. (iPhone, iPad, Android, and from the Home Screen.) The address is inside `text`, because some
   apps drop a separate `url` when a picture comes with it.
2. Otherwise a small card (`#shareSheet`) over the page: the picture at 300 px, **Save picture** (a download
   link), **Copy picture** (where the browser can put a picture on the clipboard; a PNG is made for it then),
   **Copy text**, and **Share link** where `navigator.share` exists without files. Each confirms with a toast
   ("Picture saved.", "Copied.").
3. A share the player cancels is not an error.

**The words** (`text`): "I held <Battlefield> in Highland Stand with <kept> of <max> defenders. Score <n,nnn>.
https://highland.avunjian.com". The daily's is in 5.6.

Events: `share_tapped { from, method }`, `share_done { method }`. The card works for a guest too (no name
line, no rank).

---

## 7. Analytics (D6)

First-party only: events go from the page to `hs_track` in the owner's Supabase. No cookie, no third-party
script, no pixel, no fingerprint. **The game's own tables hold no IP address and no user agent string.** That
sentence is about `hs_sessions` and `hs_events` only: the sign-in service keeps the address and browser of
every sign-in in its own tables (`auth.sessions`, `auth.audit_log_entries`) **[V]**, and the web server and
the gateway write ordinary access logs. The privacy page says both (8.1).

### 7.1 Who is who

- `aid`: a random UUID that names a browser, not a person, and never leaves this site. It is what makes a
  funnel possible before sign-in. Where it lives is one constant, `HS_ANON_ID` (0.2):
  - `"device"` (the default): made on the first visit and kept in `localStorage` (`hs_pf_aid`). Day-1 and
    day-7 return are then counted for every device.
  - `"visit"`: until the player signs in or chooses to play as a guest (**Play now**, **Play as a guest**),
    the id lives in `sessionStorage` and ends with the tab; it survives the trip to the provider and back,
    so a first visit's funnel is whole. Only from that choice on is it kept in `localStorage`. Return is
    then counted for accounts and guests only, and a visitor who leaves at the gate and comes back another
    day counts as a new device. This is the setting for an owner who is told that an identifier kept before
    any choice needs consent where his players live (section 13).
- `sid`: a random id per page load. `seq`: the event's number within it.
- After sign-in the server adds the account to the session by itself (from the token, never from the page), so
  the visits before the sign-in and after it join. "Delete my account" removes the visits that carried the
  account **and the same devices' visits from before any sign-in** **[M]**, and the page then makes a new
  `aid`, so nothing counted later joins what was removed.
- Clearing the browser's site data makes a new `aid`. The Home Screen app has its own.

### 7.2 The events

Every event: `{ n: name, q: seq, t: device time in ms, p: props }`. Props are short: numbers, booleans and ids, at most one level of nesting, no free text, under 4 KB an event
(a battle's facts are about 1.2 KB). `lv` is a
battlefield id, `diff` 0 to 2, `mode` is `campaign`, `daily` or `endless`. **G** marks the events gameplay
sends with `track()`; the others the platform sends itself.

| event | when | props |
| --- | --- | --- |
| `page_load` | every load, first | `gate` (the mode in force), `signed` (a session exists), `returning` (an `aid` existed), `progress` (battlefields held on this device), `standalone`, `ret` (this load is a return from a provider) |
| `gate_shown` | the gate's `signin` or `nostore` card has been on screen for one second | `mode`, `state` (`signin`, `inapp`, `nostore`), `providers` (e.g. `"gfd"`), `held` (a provider held back, 3.3) |
| `gate_down` | the `down` state appears | `why` (`timeout`, `http`, `offline`, `none`, `errors`) |
| `provider_tapped` | a provider's button | `provider` |
| `signed_in` | a code exchanged | `provider`, `new` (no profile yet), `standalone` (this window is a Home Screen app), `same` (this window held the verifier), `handoff` (it came through 1.6), `ms` (from the tap, when the same window) |
| `signin_error` | a return with an error, a failed exchange, a return without the verifier, or a sign-in left unfinished (1.2) | `provider`, `error` (the server's code, `exchange_<status>`, `no_verifier`, `abandoned`), `standalone` |
| `name_set` | a name accepted | `changed` (false: the first) |
| `gate_bypass` | **Play now** or **Play as a guest** | `why` (`down`, `offline`, `nostore`, `errors`, `guest`) |
| `gate_passed` | the gate closes | `how` (`session`, `signin`, `bypass`), `ms` since load |
| `welcome_tap` | a button of the welcome card | `choice` (`resume`, `continue`, `begin`, `map`, `daily`) |
| `chapter_story` **G** | a chapter's story opens (`showChapterIntro`) | `ch` |
| `brief_open` **G** | a battlefield's chronicle opens (`showBrief`) | `lv` |
| `tutorial_step` **G** | the coach enters a step (`tutGo`) | `id`, `i` |
| `tutorial_done` **G** | the tutorial ends (`endTutorial`) | `skipped`, `i` (the step it was on) |
| `battle_start` **G** | the first wave of a battle is sent, and a battle is resumed | `lv`, `diff`, `mode`, `loadout`, `ruleset`, `ranked`, `resumed`, `tutorial`, `twist` (daily) |
| `wave_end` **G** | a wave is cleared (`endWaveIfClear`) | `lv`, `diff`, `mode`, `wave`, `lives`, `gold`, `towers`, `sec` (battle clock so far), `early` (it was called early) |
| `tower_built` **G** | `placeTower` | `lv`, `wave`, `type`, `pad` |
| `tower_upgraded` **G** | `upgradeTower`, a mastery chosen | `type`, `level`, `spec` |
| `tower_sold` **G** | `sellTower` | `type`, `level`, `wave` |
| `plot_bought` **G** | `buyPlot` | `lv`, `wave` |
| `trick_met` **G** | a trick's first-time card shows (`showTrickCard`) | `lv`, `wave`, `trick` |
| `defeat` **G** | `defeat()` | `lv`, `diff`, `mode`, `wave`, `waves`, `lives_max`, `sec`, `spent`, `earned`, `loadout`, `ruleset`, `through` (what got through, as the debrief counts it: up to three `role:count` pairs), `road` (the road that cost most) |
| `victory` **G** | `victory()` | `lv`, `diff`, `mode`, `lives`, `lives_max`, `waves`, `stars`, `sec`, `spent`, `earned`, `loadout`, `ruleset`, `twist` |
| `battle_quit` **G** and platform | **G**: Abandon and "Replay tutorial" from a battle (`how: "abandon"`); platform: the page is hidden or closed while a battle is live (`how: "left"`) | `lv`, `diff`, `mode`, `wave`, `how` |
| `battle_back` | the page is seen again with that battle still live | `lv`, `wave` |
| `page_hide` | the page is hidden or closed | `where` (`gate`, `map`, `brief`, `story`, `battle`, `victory`, `defeat`, `hall`, `nardi`), `sec` (the visit so far) |
| `save_merge` | 4.6 | `case`, `run` (`none`, `mine`, `theirs`, `asked`) |
| `save_conflict_choice` | 4.5 | `keep` |
| `sync_fail` | a push or pull failed three times | `op`, `status`, `why` |
| `hall_open` | the Hall opens | `tab`, `from` (`map`, `victory`, `welcome`, `settings`) |
| `board_open` | a board is shown | `mode`, `lv`, `diff`, `period`, `loadout` |
| `score_posted` | a score accepted | `mode`, `lv`, `diff`, `score`, `rank`, `best` |
| `score_rejected` | a score refused | `reason` |
| `daily_played` | a daily battle ends (won, lost or left) | `lv`, `twist`, `attempt`, `won`, `score`, `ranked` |
| `share_tapped`, `share_done` | section 6 | `from`, `method` |
| `privacy_open` | the privacy page | `from` |
| `signed_out`, `account_deleted` | 1.5 | |
| `error` | the crash card shows | `msg` (120 characters at most), `where` |

Gameplay sends more props on its events than this table lists, and more events (its section 7). The server
takes any name and any props inside the limits of 7.4, so neither spec needs the other's leave for a new one.

A player's path through a first visit is 3.7. Where a player quits is `battle_quit` (not followed by
`battle_back` in that visit) and the last `page_hide.where` of his last visit.

### 7.3 Sending

- Events queue in memory and in `hs_pf_evq` (200 events or 60 KB at most; the oldest go first when full).
- A batch (50 events and 60 KB at most; the page fills a batch by bytes, not only by count) is sent: 20 s after the first unsent event; when 20 are waiting; as the page is
  hidden or closed (with `keepalive`, so it leaves with the page); after a sign-in. `POST /rpc/hs_track
  { p_ctx, p_events }` where `p_ctx = { aid, sid, build, ruleset, channel, dev, os, browser, standalone, vw, vh,
  lang, ref }`: `build` is `BUILD_ID`; `channel` is `live` or `next`; `dev` is `phone` (the phone layout, or a
  screen whose short side is at most 500 px), `tablet` (touch, not a phone) or `desktop`; `os` one of `ios`,
  `android`, `mac`, `windows`, `linux`, `other`; `browser` one of `safari`, `chrome`, `firefox`, `edge`,
  `inapp`, `other`; `vw`, `vh` the window; `lang` the first language tag; `ref` the referring site's host name
  only (never its path), empty for the game's own pages.
- Offline, or the service down: the events stay in the queue and go with the next load. After a failure the
  next try waits 30 s, doubling to 10 minutes. Three refusals in a row (4xx) stop sending for the visit.
- Nothing is counted from a crawler or a test robot: when `navigator.webdriver` is true, when the user agent
  names one (`bot|crawl|spider|slurp|preview|lighthouse|headless`), or while the page is a prerender
  (`document.prerendering`), the queue is not started. (The platform's own Playwright flows switch this off
  through `__HS_PLATFORM_TEST`.)
- Every call costs a preflight request unless the gateway lets the browser remember it (Envoy does, for an
  hour **[V]**; Kong sets no time). Firefox before 133 has no `keepalive`. Neither breaks anything: what was
  not sent is still in `hs_pf_evq` and goes with the next load.
- Nothing is sent under `HARNESS_ON`, on `file://`, or with the platform off. The queue on `window.__hsEv`
  still fills there, which is how the selftest checks gameplay's `track` calls (10.5).

### 7.4 Limits and sampling

On the page:

- Per visit: 600 events. Per battle: 40 of `tower_built`, `tower_upgraded`, `tower_sold` and `plot_bought`
  together (the rest are dropped; the battle's totals are in `victory` and `defeat`). `wave_end`, `victory`,
  `defeat` and the gate's events are never dropped.
- `hs_config.ev_sample` (0 to 1, default 1): when the owner lowers it, a device sends the tower events only if
  its `aid` falls in that share (the same devices every day). Funnel, battle and gate events are never sampled.

On the server (`hs_track`, all **[M]**):

- An event: a name of lower-case letters, digits and underscores (2 to 40 characters); props an object of at
  most **4,096 bytes** as the database writes it (a battle's facts are about 1.2 KB there). A batch: 50
  events and 60 KB at most. An event that breaks a rule is skipped; the rest of its batch is kept.
- **Limits count events, not calls.** A visitor's events draw on one pool for all visitors
  (`hs_config.ev_cap_hour`, default 20,000 an hour) and on 900 an hour per device id. The pool is looked at
  first, so once it is dry a flood of made-up device ids adds no rows of any kind. A signed-in player's
  events draw on his own 1,500 an hour and on no pool: a flood from strangers cannot black out the players'
  counts. Over a limit the batch is dropped without an error.
- **A ceiling on size.** Above `hs_config.ev_max_mb` megabytes of events (default 1,024, indexes included)
  visitors' events are dropped; above one and a half times that, everyone's. The stats page shows how full
  the table is.
- **Old visits leave by themselves.** About one call in 200 removes up to 300 visits older than
  `hs_config.ev_keep_days` (default 180) with their events. No scheduler is needed. The stats page's button
  does the same in pieces of 5,000 and says when to press again.
- What the worst case now costs: 20,000 small events an hour is about 3.5 MB an hour **[M: 59,901 events
  took 10 MB]**, so a constant flood of small events reaches the ceiling after about twelve days; a flood of
  the largest events allowed (4 KB each) reaches it within a day. Either way the table then stops growing,
  the players' own counts keep arriving until one and a half times the ceiling, and the stats page says so.

On the proxy (the guide's step 1): at most 10 requests a second per address to `/rest/v1/rpc/`, bodies of
512 KB at most. This is the only limit that knows who is asking; the database's limits cannot (a device id is
whatever the caller says it is).

### 7.5 The owner's stats page (`?stats`)

`https://highland.avunjian.com/?stats` shows `#statsPage` instead of the game (the gate is not shown; the game
under it does not start a battle). Not signed in: one line and the provider buttons (the sign-in returns to
`?stats`). Signed in but not in `hs_admins`: "This page is for the game's owner." and a link back. An admin:
`hs_stats(days)`, and the page draws it; if that call runs out of time, the page asks card by card
(`hs_stats(days, ["funnel"])` and so on). A period switch (7, 30, 90 days). Plain tables and bars made of
`div`s, in the game's colors, one column, readable on a phone.

**The stats page shows strangers' text to the one account that can change everything, so:**

- Every value is put on the page with `textContent`. No string from `hs_stats` is ever joined into markup,
  an attribute, a style or a URL. The builder's review checks `#statsPage`'s code for `innerHTML`.
- The server passes a prop through only when it is a short tag (letters, digits, `_ . : -`, 40 at most);
  anything else arrives as the word "other". A number that is not one arrives as nothing. So a stranger's
  event can neither break the stats nor carry markup into them **[M]**.

| card | release | from `hs_stats` | shows |
| --- | --- | --- | --- |
| Health | R1 | `events_mb`, `config`, and `/settings` | how full the events table is against its ceiling; **in red** when `mailer_autoconfirm` is on ("Discord sign-in is held back: the sign-in service confirms emails by itself. See the guide, step 3."), when the anon key is the demo key, or when the page's ruleset is not published |
| Totals | R1 | `totals`, `daily` | accounts, saves, scores and events in the period; people, visits and signed-in people per day as a bar per day |
| First visit funnel | R1 | `funnel` | devices first seen in the period that reached each step: `page_load`, `gate_shown`, `provider_tapped`, `signed_in`, `name_set`, `battle_start`, `tutorial_done`, `wave_end`, `victory`; each step for **new devices, returning players and in-app arrivals apart** (3.2), each bar with its share of the first and of the step before. Under it **the gate's cost** for each of the three: `signed_in / gate_shown`. |
| The gate | R1 | `gate` | taps and sign-ins per provider, errors by code (`abandoned` and `no_verifier` among them), bypasses by reason, arrivals in in-app browsers, and Home Screen apps on a line of their own (1.6) |
| Coming back | R1 | `retention` | per first-seen day: new devices, the share seen the next day (day 1) and seven days on (day 7); the period's averages on top |
| Where players quit | R1 | `quits` | battles left and not come back to, by battlefield, difficulty and wave: the 20 most common, and per battlefield a row of bars by wave |
| Battlefields | R1 | `fields` | per battlefield and difficulty: battles ended, win rate, defenders kept in the wins (average and as a share), the average wave of the defeats, quits |
| Devices | R1 | `devices` | people by phone, tablet, desktop; by system; Home Screen app or not |
| Switches | R1 | `config` | the gate (`required`, `optional`, `off`), the owner's line (`notice`), the events' pool, ceiling, days kept and sample, **Remove old events**; from R2 boards on or off, from R3 the daily |
| Rulesets | R2 | `rulesets` | each ruleset seen in visits with whether it is published, and **Publish ruleset <id>** for the page's own |
| Scores to look at | R2 | `flagged` | flagged results with **Remove** (`hs_admin_remove_score`) and **Hide player** (`hs_admin_moderate`) |

Visits from `/next/` (`channel: "next"`) are left out of every card.

---

## 8. Privacy and the providers' rules

### 8.1 The privacy page (`?privacy`)

`#privacyPage` is **static HTML in the body** (`<section id="privacyPage" hidden>`), not text built by script:
a provider's reviewer, a crawler, or a browser with scripts off can read it at
`https://highland.avunjian.com/?privacy`. With `?privacy` in the address the page shows it over everything
(`z-index: 70`), skips the gate, and starts no sound; **Back to the game** goes to the plain address. It is also
reached from the gate's small print, the Account tab and the stats page. Its deletion part has the id `delete`
(`?privacy#delete` is the link the providers ask for). The words (the owner fills the bracketed places
and should have the page read by someone who knows his country's law; this spec is not legal advice):

> **Privacy**
>
> Highland Stand is a free game made by [owner's name]. Write to [contact email] about anything on this page.
>
> **What we keep when you sign in**
>
> - Your account: the email address, name and picture address that Google, Facebook or Discord gives our
>   server when you sign in. We need the email so the same person gets the same account. The game never
>   shows your email, your real name or your picture, and we never write to you.
> - A player name you choose. It is shown on the leaderboards.
> - Your progress: the battlefields you have held, your stars, and the battle you are in the middle of.
> - Your scores.
>
> **What we count**
>
> We count what happens in the game: pages opened, battles begun, won and lost, towers built, and where
> players stop. Each count carries a random number kept in your browser, the kind of device (phone, tablet
> or desktop), its system, the size of its window, your language, and the name of the site you came from.
> Once you sign in, your counts are tied to your account. We use them only to make the game better. Our
> counts do not include your IP address.
>
> **What the sign-in service and the web server record**
>
> When you sign in, the sign-in service on our server records the time, your IP address and the kind of
> browser, as sign-in services do, to keep accounts safe. Like every web server, ours writes a line for each
> request with the IP address, and keeps those lines for [number] days.
>
> **What we do not do**
>
> No ads. No trackers from other companies. No cookies. We do not sell or share what we keep. We cannot post
> to your Google, Facebook or Discord account or read anything in it.
>
> **Where it is kept**
>
> On the game's own server in [country]. In your browser: your progress, your sign-in and the random number,
> in this site's storage.
>
> **How long**
>
> Your account, name, progress and scores: until you delete your account. Counts: 180 days.
>
> **How to delete your data**
>
> In the game, open the Hall from the campaign map, choose Account, then Delete my account. Your account,
> name, progress, scores and counts are removed from our server at once, and so is the sign-in service's
> record of your sign-ins. The web server's lines leave when their [number] days are over. Or write to us from the address you
> signed in with. To remove what is in your browser, sign out, or clear this site's data in your browser.
> To end the game's access to your sign-in: in your Google Account under Security, in Facebook's settings
> under Apps and Websites, or in Discord's settings under Authorized Apps.
>
> **Children**
>
> The game's accounts are for players 13 and older. If you believe a younger child has an account here,
> write to us and we will delete it.
>
> **Changes**
>
> When the game changes what it keeps, this page changes first. Last changed: [date].

`deploy/check-page.js` gains nothing for it; a selftest check holds the page to having `#privacyPage` with its
`#delete` part (10.5).

### 8.2 What each provider wants before its button works for everyone

The callback address for all three is `https://<the Supabase host>/auth/v1/callback` **[V]**. The secrets go
only into the Supabase `.env` on the server (9.2).

| | Google | Facebook (Meta) | Discord |
| --- | --- | --- | --- |
| where | Google Cloud console: a project, then "OAuth consent screen" (Google Auth Platform) and Credentials | developers.facebook.com: an app with the use case "Authenticate and request data from users with Facebook Login" | discord.com/developers: an application, its OAuth2 page |
| what to fill | app name, support email, audience External; an OAuth client of type Web application with the callback as its authorized redirect URI; home page `https://highland.avunjian.com`, privacy link `https://highland.avunjian.com/?privacy`, authorized domain `avunjian.com` | the callback under Facebook Login, Settings, "Valid OAuth Redirect URIs"; the `email` permission added beside `public_profile` **[V]**; in Basic settings: an app icon, a category, the Privacy Policy URL, and under User data deletion the instructions address `https://highland.avunjian.com/?privacy#delete` (Meta accepts either a callback or an instructions address **[V]**) | the callback under OAuth2, Redirects **[V]**; optional privacy and terms links on the application's page |
| before the public can use it | press **Publish app** so the status is "In production". In "Testing" only listed test users (100 at most) can sign in **[V]**. With only the email and profile scopes, which is all Supabase asks for, Google's verification is not required; it is required to show an app name and logo on Google's screen **[V]**. Without it Google's screen names the Supabase host, not the game. | switch the app from Development to **Live**. In Development only people with a role on the app can sign in **[V]**. Whether Meta asks for business verification or App Review for the `email` permission differs by account **[U]**; the Supabase guide says apps asking only for `public_profile` and `email` can often go live without a detailed review **[V as their statement]**. | nothing: sign-in with the `identify` and `email` scopes needs no review **[U]** |
| traps | Google refuses sign-in inside other apps' browsers **[V]** (1.6). Its brand rules: the standard-color G on a white, dark or neutral button, the words "Sign in with Google" or "Continue with Google", shown no less prominently than the other buttons **[V]**; they also name Google's own typeface for the words, which the game does not load (no third-party requests): relevant only if brand verification is ever sought. | a Facebook account made with a phone number has no email, and Supabase then refuses the sign-in unless `GOTRUE_EXTERNAL_FACEBOOK_EMAIL_OPTIONAL=true` is set (9.2) **[V in the Auth server's source; U on the owner's installed version]** | a Discord account with no email at all (made with a phone number) needs `GOTRUE_EXTERNAL_DISCORD_EMAIL_OPTIONAL=true` the same way. An email Discord has **not verified** is another matter: Discord passes it on marked unverified, the sign-in then fails with `provider_email_needs_verification` whatever that setting says, and the gate tells the player to verify it in Discord (1.2) **[V]**. Where the Auth service confirms emails by itself, that unverified address would be trusted instead: Discord is held back there (3.3) |
| age | accounts from 13 (higher in some countries; younger only as supervised accounts) **[U]** | from 13 **[U]** | from 13 (higher in some countries) **[U]** |

**Email auto-confirm.** One setting of the owner's Supabase decides whether an email a provider has not
verified is trusted: `ENABLE_EMAIL_AUTOCONFIRM` (the Auth service's `MAILER_AUTOCONFIRM`), `false` in
Supabase's example and often set to `true` on installs without a mail server. With it on, a Discord account
made with someone else's address is joined to that person's account, the admin's included **[V]**. The page
reads the setting from `/settings` and holds Discord back while it is on (3.3); the guide's step 3 has the
owner look at it; the stats page says so in red.

**Children under 13.** All three providers set their own floor at 13 or above, so the gate says "For players
13 and older" and the game asks no age itself. What the owner should weigh: with `required`, a child under 13,
or a classroom without accounts, cannot play at all. `optional` lets them play as guests with nothing stored
on the server but anonymous counts. The switch is one tap on the stats page.

---

## 9. The owner's setup guide, and the staging channel

### 9.1 The guide, and what going public exposes

`docs/specs/platform/setup-guide.md` is the full text of `deploy/supabase/README.md`, written for a
non-engineer: each step says what to click or paste and what should be seen after.

**The danger the guide is built around.** The owner's Supabase holds other projects. Until now it may never
have been asked for from the internet. The game prints its address and its anon key in a page everyone loads.
With that key anyone may read and write **every table of every project in that database that has row level
security off**, because Supabase grants its API roles everything on new tables by default **[V]**; and the
gateway that the game must reach also serves the dashboard, the database's management API, storage and the
rest. None of that is the game's, and all of it would be one address away. So:

- **Step 0, before anything is public**: the install's secrets are its own (not the four values printed in
  Supabase's example file, which anyone can use to make an all-powerful key), the dashboard's password is
  strong, and the gateway's own ports (8000, and Kong's https port 8443 where Kong is the gateway) do not answer
  from outside the server.
- **The public name serves two path prefixes only**: `/auth/v1/` (sign-in) and `/rest/v1/rpc/hs_` (the
  game's functions). Of `/auth/v1/` only what the page uses (P1 close): `settings`, `authorize`, `callback`,
  `logout`, `health`, `token` with `grant_type` `pkce` or `refresh_token`, and `user` read only. Supabase's
  defaults leave sign-up by email and phone open (phone with auto-confirm), so `signup`, `otp`, `recover`,
  `magiclink` and a password sign-in would let anyone make signed-in accounts past the visitors' event pool, or
  send mail and texts to any address, through the game's name. Everything else answers 404 there: the dashboard, `/pg`, storage, realtime, GraphQL,
  every table, and every function of another project. The page needs nothing else. The same block limits
  each address to 10 requests a second on the functions and bodies to 512 KB (7.4). If the Supabase is
  already public because another project of the owner's uses it, that address stays as it is (narrowing it
  would break that project) and the audit below is what protects the other projects; the game then gets a
  second, narrow name of its own, and the providers' callback stays on the first.
- **An audit before the key is handed over** (in step 4): one query lists every table of an API schema that
  an API role may touch and that has row level security off, and every function a visitor may run that is
  not the game's. With the two prefixes these are not reachable through the game's address, but the owner
  should know them, because the same key works on any other address that reaches the same gateway.

The guide's steps:

0. Before anything is public (above).
1. Give the Supabase a public https address that serves the two prefixes (a name such as
   `supabase.avunjian.com`, its DNS record, the nginx or Caddy block, three lines of Supabase's `.env`), and
   check from outside that the prefixes answer and nothing else does.
2. Make the three provider apps, each with the one callback address.
3. Put each provider's id and secret into Supabase's `.env` and switch the providers on in
   `docker-compose.yml`; restart the Auth service; check `/auth/v1/settings` lists them **and says
   `"mailer_autoconfirm": false`**. If it says `true`: either set `ENABLE_EMAIL_AUTOCONFIRM=false` (the
   guide says what that means for the owner's other projects: their email sign-ups then need a working mail
   server), or leave Discord off. The page holds Discord back by itself while it is `true` (3.3).
4. Run `schema.sql` in the Studio's SQL editor; read its warnings; run the audit query.
5. Hand over the two public values (the address and the anon key). Never the service key or the JWT secret.
   The builder runs the smoke test (10.6) the same day and reports what it found.
6. Sign in once on `/next/` **from the iPhone's Home Screen** (and say whether "Welcome" appeared in the
   Home Screen app: this decides whether the handoff of 1.6 is ever built), then on a computer, then make
   yourself an admin with one line of SQL.
7. (R2) Open `/next/?stats` and press Publish ruleset.
8. The checklist for the release at hand (every provider on a desktop browser, iPhone Safari, the iPhone
   Home Screen app, an iPad, an Android phone, a link opened inside Facebook's app; a second device resumes;
   sign out; delete the account; stop the Auth service and see "Sign-in is not answering" with Play now
   working; block the site's data in a browser and see Play now).
9. Going live, and the upkeep: backups, the weekly look at the stats, the words to refuse in names.

### 9.2 Where each secret goes

| secret | where it lives | never |
| --- | --- | --- |
| Google, Facebook and Discord client secrets | the Supabase folder's `.env` on the VPS, as `GOOGLE_SECRET`, `FACEBOOK_SECRET`, `DISCORD_SECRET`, passed to the Auth service by lines in `docker-compose.yml` (`GOTRUE_EXTERNAL_<PROVIDER>_ENABLED`, `_CLIENT_ID`, `_SECRET`, `_REDIRECT_URI`, and for Facebook and Discord `_EMAIL_OPTIONAL: "true"`) **[V]** | in the repository, the page, a chat, an email |
| the JWT secret, the service role key, the database password | already in that `.env`; nothing here needs them | anywhere else |
| the anon key and the Supabase address | **public**: in `index.html` (`HS_SUPABASE_ANON_KEY`, `HS_SUPABASE_URL`) | |

The provider ids (not secrets) sit beside their secrets in the same `.env`. After a change:
`sh run.sh recreate auth` in the Supabase folder (older installs: `docker compose up -d --force-recreate
auth`), then `curl -H "apikey: <anon key>" https://<host>/auth/v1/settings` must show the three under
`external` **[V]**.

### 9.3 The staging channel: branch `next` at `/next/`

**The script.** `docs/specs/platform/update.sh.proposed` replaces `deploy/update.sh`. What changes: the two
flows are functions (`publish_master`, exactly today's steps, and `publish_next`), each run in a subshell
with `set -e`, and the script exits with the master flow's status, so nothing the staging channel does can
change what the live page does or reports. `publish_next`:

- asks the remote for the branch (`git ls-remote --heads origin next`). No answer: leave `/next/` as it is.
  No such branch: remove `$WEB/next/` (and say so once).
- the same commit as last published (`.git/hs-next-live`) or last refused (`.git/hs-next-rejected`): nothing.
- else fetches it, reads `index.html` and `og.jpg` out of the commit with `git show` (**the clone's checkout
  stays on master**), runs `deploy/check-page.js` on that page, **refuses a page that lacks the staging namespace's line**
  (`const HS_CHANNEL = `: without it a build would read and write the live game's saves and sign-in, which
  share its origin), and publishes to `$WEB/next/` with the same
  write-then-rename as the live page. A page that fails is logged once and `/next/` stays as it was.

The cron line and `setup-server.sh` do not change. The run that pulls the new script is still the old one (the
header of `update.sh` explains why), so `/next/` appears on the run after: within four minutes of the push.
Both web servers of `setup-server.sh` serve it as it lies: nginx by `try_files $uri $uri/ /index.html`, Caddy
by `file_server` **[V in the repository's own configs; U on the live server's actual config]**.

**Testing the script safely.** `bash docs/specs/platform/test-update.sh path/to/update.sh` builds a bare
"origin", a clone and a web root in a temporary folder (the script honors `HS_REPO` and `HS_WEB`), and walks
seven cases: no branch `next`; a branch published at `/next/` with the live page untouched and the clone still
on master; a broken page on `next` refused once while master still goes out on the same run; `next` mended;
a broken master refused while `/next/` is still served, then mended; a page without the namespace line refused; the branch deleted and `/next/` removed.
It passes on the proposed script here. It goes into the repository as `tools/platform/test-update.sh`.

**The page on `/next/`.** Same origin as the live game, so three things are needed in the page, all in PF-0:

1. *Its own storage.* Before anything reads a save:

   ```js
   // A page served from /next/ shares its origin, and so its storage, with the live game. It keeps everything
   // under names of its own: every key is stored with "next:" before it. Nothing else in the file knows.
   const HS_CHANNEL = /^\/next(\/|$)/.test(location.pathname) ? "next" : "live";
   if (HS_CHANNEL === "next" && !HARNESS_ON && typeof Storage !== "undefined" && window.localStorage instanceof Storage) {
     const real = window.localStorage, P = "next:";
     const own = () => { const ks = []; for (let i = 0; i < real.length; i++) { const k = real.key(i); if (k && k.startsWith(P)) ks.push(k.slice(P.length)); } return ks; };
     Object.defineProperty(window, "localStorage", { configurable: true, value: {
       getItem: k => real.getItem(P + k),
       setItem: (k, v) => real.setItem(P + k, v),      // the quota guard above still applies
       removeItem: k => real.removeItem(P + k),
       key: i => { const ks = own(); return i < ks.length ? ks[i] : null; },
       get length() { return own().length; },
     } });
   }
   ```
   It sits after the storage fallback (line 3139): when storage has already fallen back to memory there is
   nothing to separate. The cloud's hook (4.2) wraps this object's methods as it wraps the fallback's.
2. *Its own mark.* A thin ribbon at the top left of every page: "Staging build · your saves here are separate".
   `<meta name="robots" content="noindex">` is added by script. Analytics carry `channel: "next"` and are left
   out of the stats.
3. *The same Supabase, kept apart.* A staging build signs in against the same Supabase (the return to
   `/next/` is allowed because its host is the `SITE_URL`'s, 1.2), so an account is the same account on both
   channels. What a staging build writes is kept apart from the live game's, so a build under trial that still holds its
   namespace code (the publishing script checks that it does) cannot
   reach a real save or a real board:
   - *saves*: `hs_save_get` and `hs_save_put` are called with `p_channel: "next"`; the server keeps one save
     document per account and channel;
   - *scores and the daily*: the ruleset id the page sends from `/next/` is `String(RULESET) + "-next"`, which
     the admin publishes from `/next/?stats`; its boards are its own;
   - *analytics*: `channel: "next"`, left out of the stats.

---

## 10. Tests

### 10.1 The local stack (`tools/platform/stack.js`)

One Node process (no dependency but `pg`, installed under `tools/platform/node_modules` by `npm install`,
which the README names) that gives a page everything the real Supabase gives it, on `http://127.0.0.1:<port>`:

- **PostgreSQL.** On this machine the system's own PostgreSQL 16 server is installed
  (`/usr/lib/postgresql/16/bin`), and the stack uses it: `initdb` and `pg_ctl` run as the `postgres` user
  (`runuser -u postgres --`; PostgreSQL refuses to run as root) on a data folder under `/var/tmp/hs-stack`
  (**not** under the session's scratch folder, which the `postgres` user cannot enter: that is what failed
  when `embedded-postgres` was tried there). Where no system server exists the stack falls back to the npm
  package `embedded-postgres` installed under `/var/tmp/hs-stack` with `createPostgresUser: true`. It then
  loads `standins.sql` and `deploy/supabase/schema.sql`. The versions differ from the owner's (Supabase ships
  PostgreSQL 15 or 17); the schema uses nothing version-bound.
- **A stand-in for PostgREST** at `/rest/v1/rpc/<fn>`: checks the `apikey` header, reads the bearer token
  (the anon key, or a JWT signed with the stack's test secret), and runs the call **as PostgREST does**: in one
  transaction, `set local role anon|authenticated`, `set_config('request.jwt.claims', <the claims>, true)`,
  then `select public.<fn>(<named arguments>)` with the JSON body's keys as argument names. So row level
  security and the grants are enforced for real, by the database. A function marked stable or immutable is run in a **read-only** transaction, and the role's statement
  timeout is set as Supabase sets it (3 s for a visitor, 8 s for a player) unless the function carries its
  own: both as the real service does **[V]**, so a write slipped into a stable function, or a slow query,
  fails here first. Errors are mapped as PostgREST maps them
  (`P0001` 400, `42501` 401 or 403, `PT429` 429) with the same JSON. It answers `OPTIONS` as the gateway does.
- **A stand-in for Auth** at `/auth/v1`: `/settings`, `/authorize` (stores the challenge, sends the browser
  to the fake provider), `/callback` (finds or makes the `auth.users` row by email, issues a one-time code,
  sends the browser back with `?code=` or with `error` in the query and after `#`), `/token?grant_type=pkce`
  (checks the verifier against the challenge with SHA-256; a code works once and for 5 minutes),
  `/token?grant_type=refresh_token` (rotation; a used token works again for 10 seconds, then ends the
  session), `/user`, `/logout`. Open routes need no `apikey`, the others do, as on the gateway.
- **A fake provider** at `/provider/authorize`: a page of test people ("Aram", "Bagrat", "a Facebook account
  with no email", "a Discord account with an unverified email", "cancel", "provider error"); a control call lets a test pick one without a click.
- **The page itself** at `/` and `/next/` (the file under test, read from disk each time), so the origin and
  the redirect are real.
- **Controls** for tests, under `/__test/`: Auth down (every Auth route answers 503 or hangs), PostgREST
  down, the server's clock moved, a session's tokens expired, a run's start moved back (the SQL test's trick,
  for score checks), the database emptied, `/settings` answering `mailer_autoconfirm: true`.

The page under test gets the stack's address through `window.__HS_PLATFORM_TEST = { url, anonKey, gate }`,
set by Playwright's `addInitScript`; PF-MAIN reads it **only when `location.hostname` is `127.0.0.1` or
`localhost`**, so it means nothing on the live site. The JWT secret in the stack is a test value named as one.

### 10.2 SQL tests (`tools/platform/sql-tests.js`)

`schema-test.sql` grown into a suite run against the stack's database, one case per rule, each as the three
callers (a visitor, a player, an admin) where it applies:

- every `hs_` table: row level security is on; no API role holds any privilege on any `hs_` table or
  sequence; no policy exists; a visitor and a player read and write nothing directly, not even their own
  rows; no `hs_` function is executable by `PUBLIC`; every definer function pins `search_path`; each stable
  function runs in a read-only transaction, and no seventh one exists;
- names: each refusal, folding, uniqueness, the weekly limit, the first-10-minutes grace, the blocklist; symbols, pictures and stacked marks refused, letters of other alphabets accepted;
- saves: first write, versions, a stale write gets the stored document back, two devices racing a first
  write, size and shape refusals, the rate limit;
- runs and scores: each refusal of 2.5 by name; the score arithmetic against the page's `scoreOf` for a
  table of inputs (the same table is in `unit.js`); best-of per board; this week's key across a Sunday
  midnight UTC; ranks with ties; a hidden player; a removed score restores the next best; Standard and Open
  are different boards; rulesets do not mix;
- the daily: the pick equals the page's for every day of a year and three pool sizes; a wrong battlefield or
  twist; three attempts; a lost attempt's score by the script; every pair once in `n * m` days; a skipped twist walked past; `livesSet`; yesterday's board;
- analytics: batch limits, bad names, a borrowed session id, the per-device and overall caps, the account
  joined to a session at sign-in; `hs_stats` for a small made-up history with known answers (funnel counts,
  day 1 and day 7, quits with and without `battle_back`, win rate and defenders kept per battlefield);
- account deletion: every row of one player gone, his devices' earlier visits and the sign-in service's log
  of him too, the other player untouched;
- limits: events counted one by one; the visitors' pool dry while a signed-in player still counts; the size
  ceiling; an event of 1.5 KB kept and one of 5 KB not;
- hostile events (markup where an id belongs, text where a number belongs): the stats answer, hold no `<`,
  and show "other";
- the handoff, only with its file loaded: once, expiry, bad ids, three puts per id.

### 10.3 Playwright flows (`tools/regress/platform.js`)

It starts the stack itself, plays the page over `http://127.0.0.1`, and follows the suite's conventions
(`lib.js`: presses where things are drawn, page and console errors fail, a `RESULT` line, `--quick`,
`--shots`). Sizes: 1600 x 900 by mouse, 1194 x 834 by touch, and the iPhone sizes of `iphone.js` (667 x 320,
852 x 393 with insets, 393 x 659) by touch with its audit (`iphone-audit.js`: every control on screen, out
of the safe areas, 44 px to a finger, text at least 11 px, nothing covered). The flows:

1. **Gate.** A fresh visitor sees the sign-in card and nothing of the game answers a tap or a key; the three
   buttons, the privacy link and back; a provider switched off on the server has no button; an in-app
   browser's user agent hides Google and shows the note.
2. **Sign-in.** Google, then Facebook, then Discord through the fake provider: the address is clean after
   the return, the name card refuses a taken and a bad name, the welcome card leads with "Begin: Erebuni Rise".
3. **Errors.** The provider cancels; the provider errors; the code is used twice; the verifier is missing; the player comes back with the browser's Back button (from the cache, and by a reload); an unverified Discord email; a sign-in that took over five minutes.
   After two the card offers Play now.
4. **Play and save.** The tutorial's first waves, a wave cleared, the page closed: the server holds a save
   whose run is that battle (read back through the stack's database).
5. **A second device.** A second browser context signs in as the same person: the welcome card says "Resume:
   Erebuni Rise, Wave 3"; resuming continues that battle. Both contexts then play different battles offline
   and come back: the "Two battles in progress" choice appears and each answer does what it says.
6. **A guest's progress.** A context with today's local saves (the `hs_` keys of a player who has won five
   battlefields) signs in to a new account: all of it is in the account; signs in to an account that has
   other progress: the best of both.
7. **Score and board.** A victory staged as the suite's `vic.js` stages one (the last wave's cleared field;
   the run's start moved back through the control): the strip shows the score and "#1 this week"; the Hall's
   board lists the player; a second player's lower score ranks second; Standard and Open differ.
8. **Daily.** Today's battlefield and twist match the server's; three attempts; the board; the day changes
   (the clock control) and the challenge with it.
9. **Share card.** With `navigator.share` and `canShare` stubbed: the tap shares a JPEG file of 1200 x 630
   whose text carries the score; without them the sheet's Save, Copy picture and Copy text each work.
10. **Stats.** A player is refused; an admin sees the funnel of the flows above with the right counts,
    publishes a ruleset, switches the gate to `optional`, and a fresh context then has Play as a guest on its first load. With a visitor's events in the table
    that carry markup, and text where numbers belong, the stats still answer and no element or handler was
    made from them. With `mailer_autoconfirm: true` no Discord button shows and the Health card says why.
11. **Auth down.** With Auth down a fresh visitor gets "Sign-in is not answering" and Play now, plays, and
    on a later visit with Auth up signs in and keeps what he won. A signed-in player with Auth down goes
    straight to his welcome card and plays; his save goes up when the service returns. A context whose storage is blocked gets the `nostore` card,
    plays through **Play now**, and is never shown a provider button.
12. **The Home Screen app** (only if the handoff is built, P2b). Two contexts stand for the app and Safari: the app starts a sign-in, the return
    lands in the other context, the handoff brings the code back, the app is signed in.
13. **Sign out, delete.** Sign-out clears the device; "Delete my account" empties the database of that
    player and returns to the gate.
14. **Staging.** The page at `/next/` signs in, keeps its saves under `next:`, and a context on `/` sees none
    of it.

### 10.4 Unit checks in Node (`tools/platform/unit.js`)

The pure parts of PF-MAIN are written between two marker comments (`// ==== PLATFORM PURE BEGIN ====` and
`END`), as the town's simulation is, so a Node script loads them without a browser: `Cloud.merge` (a table
of cases per rule, and the run rule's six), `scoreOf`, `dailyOf`, `sha256` and the PKCE challenge, the name
check, the event queue's limits. Among the merge cases: a key with no rule is carried through; a document of a newer format is left alone; a
removal of `hs_run` that no battle's end caused writes no mark; `flag`; the per-key `newer`.
Runs in under a second; `run-all.js` does not need it, the builder does.

### 10.5 What goes into the selftest and the regression suite

**Self-test.** The harness turns the platform off, so nothing of it runs there and no existing check
changes. Gameplay's rule for the first suite (`?selftest=1`: 151 checks, about 122 s of a 125 s budget) is
"edits only", and the platform keeps to it: **the platform adds no check to the first suite.** Its pure
checks (`Cloud.merge`, `scoreOf`, `dailyOf`, `sha256` and the PKCE challenge, the name check, the event
queue) run in Node (`tools/platform/unit.js`, 10.4), in under a second, with no budget to keep. Three checks
need the page itself and go into gameplay's second suite (its own 125 s), together under 20 ms:

1. `#privacyPage` exists with its `#delete` part; `#gate` is in the page and is not shown under the harness;
2. the Hall opens under the harness with gameplay's tabs and no tab of the platform's (0.3);
3. gameplay's `track` calls: after a staged battle `window.__hsEv` holds a `battle_start`, a `wave_end` and a
   `victory` with every property of 7.2, and `JSON.stringify` of the victory's props is under 3,000
   characters (the server keeps events up to 4 KB; this one belongs to the gameplay track's checks, as does
   the `RULESET` pin of 5.2).

If the second suite does not exist yet when P0 merges, the first of the three waits for it; nothing is added
to the first suite in the meantime.

Anything that needs a network, a clock or the stack stays out of the self-test.

**Regression suite.** The nine scripts load the page from `file://`, where the platform is off: they pass
unchanged, and that is itself the proof that the platform changes nothing when off. `platform.js` joins
`run-all.js` as the tenth script (limit 900 s; `--quick` runs flows 1, 2, 4, 5, 7 and 11 at 1600 x 900 and
667 x 320). `tools/regress/README.md` gets its row. `iphone.js` is not changed; the new pages are held to its
bar by `platform.js` using the same audit.

**Before every merge to master:** `node deploy/check-page.js index.html`, `timeout 900 node tools/selftest.js`,
`run-all.js --quick`, `node tools/platform/unit.js`, `node tools/platform/sql-tests.js`,
`bash tools/platform/test-update.sh deploy/update.sh`. Before each release also
`node tools/platform/smoke.js <address> <anon key>` (10.6).

### 10.6 The smoke test against the real Supabase (`tools/platform/smoke.js`)

The stand-ins of 10.1 are written by the same hand as the page, so they prove the page against themselves.
The owner's own Supabase must be met early, not in the last work package. `node tools/platform/smoke.js
<address> <anon key>` uses the two **public** values only, changes nothing but one event marked
`channel: "smoke"` (left out of the stats), and prints a line per check with what to do when it fails:

1. the anon key is not Supabase's published demo key (its payload does not say `"iss":"supabase-demo"`);
2. `GET /auth/v1/settings` answers within 4 s; which of the three providers are on;
3. `mailer_autoconfirm` is false (else: Discord is held back, 3.3; the guide's step 3 says what to do);
4. the preflight (`OPTIONS /rest/v1/rpc/hs_config` from the game's origin with `apikey, authorization,
   content-type`) answers with `access-control-allow-origin`; whether it carries a `max-age`;
5. `GET /auth/v1/authorize?provider=google` without a key answers 302 to the provider;
6. `POST /rest/v1/rpc/hs_config` answers with `now` (the schema is installed, PostgREST has seen it);
7. `GET /rest/v1/hs_saves` and `GET /rest/v1/hs_events` are refused or not served (no table is readable);
8. `POST /rest/v1/rpc/hs_save_get` as a visitor is refused (401 or 403), and so is `hs_stats`;
9. `POST /rest/v1/rpc/hs_track` with one event answers `accepted: 1`; a 5 KB event is not accepted;
10. `POST /rest/v1/rpc/hs_board` for a board that does not exist answers an empty list within 3 s;
11. the public name serves nothing but the two prefixes (9.1): `/`, `/pg/`, `/storage/v1/`, `/realtime/v1/`,
    `/graphql/v1`, `/rest/v1/` and `/rest/v1/rpc/` followed by a name that does not start `hs_` are all 404, and
    so are Auth's `signup`, `otp`, `recover`, `magiclink` and a password sign-in (a write to `user`: 403 or 404);
12. the gateway's own ports do not answer from outside: 8000 (`http://<host>:8000/auth/v1/settings` times out)
    and 8443 (Kong's https); 5432 and 6543 are named when they answer. When the machine running it cannot open a
    direct connection to the address's own port, the check is reported as not answerable from there (P1 close);
13. the address is https and its certificate is valid.

It runs the day the owner hands over the two values (the end of P1) and again before each release. It needs
no secret and may be run by anyone.

---

## 11. The build

### 11.1 Three releases

The draft was one release. It is three, each of which can go live and be measured before the next is begun.
The owner asked to "start with analytics" and for sign-in and "track where they left off": that is R1, and it
needs nothing from gameplay but the `track` calls. Boards need gameplay's final pars; the daily needs its
twists.

| release | what a player gets | work packages | needs from gameplay |
| --- | --- | --- | --- |
| **R1 Accounts** | sign-in with the gate, progress and the battle in progress on every device, the Account tab, the privacy page, account deletion; the owner gets the stats page and the switches | P0, P1, P2, P3, P4, P8, P9 | the events of 7.2 (its WP3); nothing else |
| **R2 Boards** | a score on the victory page, leaderboards, the share card | P5, P7, P9 again | `RULESET`, `rulesetData()` with final pars (its WP8), the three counters, the loadout tag |
| **R3 Daily** | the daily challenge and its board | P6, P9 again | `DAILY_TWISTS`, `startDaily`, the skip lists (its WP3 and WP8) |

The schema is installed whole in R1 (it is written and tested, and the owner runs one file once). The score
and daily functions are there from that day and answer `ruleset_unknown` until an admin publishes a ruleset,
which the page cannot do before R2.

### 11.2 Work packages

Each ends with the suite green (10.5).

| WP | release | what | done when |
| --- | --- | --- | --- |
| **P0 Seam** | R1 | PF-0 (the constants, `HS_STORE_MEM`, `track`, `CLOUD_KEYS`, `HALL_TABS`, the staging namespace), **the Hall's shell** (the page, its tab row, its three layouts, `openHall`, the tally as its door; no tab of the platform's yet), `Platform` with `boot`, `blocking`, `victoryPage`, `defeatPage` as no-ops, the lines of 0.4 | the page behaves as before with the constants empty: selftest, check-page and `run-all --quick` pass; the Hall opens under the harness with a test tab and is not offered when it has no tab; `/next/` in the stack keeps its keys under `next:` |
| **P1 Stack and schema** | R1 | `deploy/supabase/schema.sql` (and `schema-handoff.sql`, not loaded), `tools/platform/stack.js`, `sql-tests.js`, `unit.js`, `smoke.js` | the SQL suite passes on the stack; a `curl` session against the stack signs in through the fake provider and calls `hs_profile_get`; **the smoke test passes against the owner's Supabase** (as soon as he has done the guide's steps 0 to 5) |
| **P2 Sign-in and the gate** | R1 | section 1 and section 3: PKCE, the session, refresh, sign-out, the gate's states in three layouts, the name card, the switch and `hs_config`, the `nostore` and `down` escapes; **no handoff** | flows 1, 2, 3, 11 pass at every size; with Auth down or storage blocked nobody is locked out; the address never keeps a code; **the owner has signed in on `/next/` from his iPhone's Home Screen and said where the return landed** |
| **P2b The handoff** | R1, only if P2's last line says the return landed outside the app | 1.6's handoff, `schema-handoff.sql`, the `waiting` and `other` states | flow 12 passes; the owner's Home Screen sign-in ends in "Welcome" |
| **P3 Cloud saves** | R1 | section 4: the document, the hook, pull and push, merge, the run rule and its prompt, the guest's migration, the stash, the Account tab and its sync line | flows 4, 5, 6, 13 pass; `Cloud.merge` cases pass in `unit.js` (unknown keys carried, a newer document left alone, no mark from a bare removal); a save made by today's game (the suite's migration fixtures) uploads whole |
| **P4 Analytics and stats** | R1 | section 7: the queue, batching by bytes, the platform's events, `?stats` with the R1 cards | flow 10 passes, hostile events included; the funnel of a scripted first visit has the right count at each step and for each kind of device; nothing is sent on `file://` or from a webdriver outside the test's own switch |
| **P8 Privacy, deletion, the guide, staging** | R1 | section 8's page, "Delete my account", `deploy/supabase/README.md`, `deploy/update.sh` with `/next/`, `tools/platform/test-update.sh` | flows 13 and 14 pass; `test-update.sh` passes; the guide's commands were each run against the stack or marked as for the owner's server |
| **P5 Scores and boards** | R2 | 5.1 to 5.5: the run token, posting, the outbox, the victory strip, the Hall's Leaderboards tab, the doors on every layout, publishing a ruleset, the stats page's two R2 cards | flow 7 passes at every size; the strip shows each state of 5.3; `vic.js` and `iphone.js` still pass unchanged |
| **P7 Share card** | R2 | section 6 | flow 9 passes; the picture is checked by eye at the three layouts for a short and a long battlefield name and a guest |
| **P6 Daily** | R3 | 5.6 with gameplay's twists and `startDaily` | flow 8 passes; the page's pick equals the server's for a year of days, skip lists included |
| **P9 The owner's pass** | each release | on the owner's real Supabase through `/next/`: the guide's checklist for that release on real devices | the checklist is ticked; then `next` is merged to master |

Order for R1: P0, P1 (the smoke test as soon as the owner's two values arrive), then P2 and P4 side by side,
P3, P8, P9. P0 can merge to master on its own day: it changes nothing a player sees and gives gameplay
`track`, `CLOUD_KEYS` and the Hall.

### 11.3 Risks

| risk | what is done about it |
| --- | --- |
| Going public exposes the owner's other projects | two path prefixes on the public name, step 0, the audit, the smoke test's checks 11 and 12 (9.1, 10.6) |
| The gate turns new players away (the owner chose `required` over the recommended `optional`) | measured from day one for three kinds of device (3.2); the switch is one tap and reaches first visits; never a lock-out (3.6) |
| Sign-in in the iPhone Home Screen app behaves differently from what was assumed | looked at on the owner's iPhone before anything is built for it; the handoff is ready as a spec and a tested SQL file (1.6) |
| The owner's Supabase confirms emails by itself | the page holds Discord back and the stats page says so; the guide's step 3 (3.3) |
| A provider's review (Meta above all) delays its button | buttons follow `/settings`: launch with the providers that are ready |
| The owner's Supabase is an older install (routes, env names, the gateway, timeouts) | the smoke test on the day the values arrive; the guide's checks after each step; every assumption about it is in section 12 |
| A merge bug loses progress | merges only ever grow records; unknown keys pass through; `Cloud.merge` is pure and tested; the device keeps its own copy; the previous cloud document is returned on every conflict |
| Token theft through script injection | no outside script; every string from the server is text, the stats page above all; an optional content security policy (11.4) |
| Forged scores | 2.5: bounds, flags the player cannot read, the admin's buttons; the honest limit is written down |
| Events fill the disk | limits that count events, a pool for visitors, a size ceiling, visits that leave by themselves, the proxy's limit (7.4) |
| Two tracks editing one 4.5 MB file | platform code lives in four marked blocks (0.2); the lines touched outside them are the table of 0.4; the shared pages are settled in 0.3 (7) |
| The page's weight and start-up | PF-MAIN is a few thousand lines beside 79,000; `boot` adds at most one 4 s wait, only when the service is slow, and shows the gate's own page while it waits |

### 11.4 If time runs short: what is cut, in this order

Within R1:
1. The optional content security policy (`<meta http-equiv>`: `connect-src` the Supabase host only, no outside
   scripts). Nice to have; needs care with the sound engine's worklet.
2. The stats page's bars: tables only.
3. `hs_pf_stash` (4.6): another account's unsent progress is dropped at sign-in with a warning at sign-out.
4. `HS_ANON_ID = "visit"` (7.1), if the owner keeps `"device"`.
5. **Open in browser** in in-app browsers (1.6): **Copy link** stays.

Within R2: the Open boards (only standard runs are ranked); this week's boards (all-time only); the share
sheet's Copy picture (Save and Copy text stay). Within R3: yesterday's podium; the practice mode.

Whole releases can wait: R3 without harm to R2, R2 without harm to R1.

Never cut: the gate with its escapes (3.6), the two prefixes and step 0 (9.1), cloud saves with the guest's
migration, the funnel events and their three kinds, the limits of 7.4, "no table is readable" and its tests,
the privacy page and account deletion, the smoke test.

---

## 12. What was verified, and what was not

**Verified in this session [V]**, with the source:

| what | source |
| --- | --- |
| The Auth routes, their parameters and answers: `/authorize` (`provider`, `redirect_to`, `code_challenge`, `code_challenge_method`), `/token?grant_type=pkce` (`auth_code`, `code_verifier`), `/token?grant_type=refresh_token`, `/logout?scope=`, `/user`, `/settings`, `/health`; the code is added to the return address's query and the rest of the query is kept | `supabase/auth` master: `openapi.yaml`, `internal/api/external.go`, `pkce.go`, `token.go`, `verify.go` (read from raw.githubusercontent.com) |
| The challenge must be 43 to 128 characters of `A-Z a-z 0-9 . _ ~ -`; `s256` in any case; the code is good 5 minutes (300 s floor) and once; errors return in the query and after `#` as `error`, `error_code`, `error_description` | the same files; Supabase docs `guides/auth/sessions/pkce-flow.mdx` |
| `redirect_to` is honored when on `SITE_URL`'s scheme, host and port, or matching `GOTRUE_URI_ALLOW_LIST` globs; else `SITE_URL` | `internal/utilities/request.go`; docs `guides/auth/redirect-urls.mdx` |
| The server adds the email scope for Google, Facebook and Discord itself; a provider that returns no email fails the sign-in unless `EMAIL_OPTIONAL` is set for it | `internal/api/provider/{google,facebook,discord}.go`, `external.go`, `conf/configuration.go` |
| Access tokens last 3600 s by default; refresh tokens rotate; reuse within 10 s is allowed, later ends the session | `conf/configuration.go`; docs `guides/auth/sessions.mdx` |
| Identities with the same verified email are linked to one user | docs `guides/auth/auth-identity-linking.mdx` |
| Self-hosting: the callback is `https://<host>/auth/v1/callback`; providers are enabled by `GOTRUE_EXTERNAL_*` lines in `docker-compose.yml` fed from `.env`; `SITE_URL`, `ADDITIONAL_REDIRECT_URLS`, `API_EXTERNAL_URL`; `sh run.sh recreate auth`; the check through `/auth/v1/settings`; a reverse proxy to the gateway's port 8000 | `supabase/supabase` master: `docker/.env.example`, `docker/docker-compose.yml`, docs `guides/self-hosting/self-hosted-oauth.mdx`, `self-hosted-proxy-https.mdx` |
| `/auth/v1/authorize` and `/callback` need no `apikey`; the other Auth routes and `/rest/v1` do; CORS is on | `docker/volumes/api/kong.yml` (the Kong gateway) |
| PostgREST: `POST /rpc/<fn>` with a JSON object of named arguments; `RAISE` maps to 400, `42501` to 401 or 403, `PTxyz` to status xyz | `PostgREST/postgrest` main: `docs/references/api/functions.rst`, `errors.rst` |
| How supabase-js itself does it (verifier, challenge, refresh margin, which refresh errors end a session) | the npm package `@supabase/auth-js` 2.119.0, `src/GoTrueClient.ts`, `src/lib/helpers.ts`, `fetch.ts` |
| The draft's `schema.sql` loaded twice and passed its test; the draft's `update.sh` passed its test (the revised files: the next table) | run here on PostgreSQL 16.15 and bash |
| Google refuses OAuth in embedded web views; "Testing" allows 100 listed users; verification is not required for the basic scopes and is required to show a name and logo; the button rules | web search results quoting Google's developer blog, support pages and branding guidelines (the pages themselves could not be opened) |
| Meta accepts a data deletion instructions address in place of a callback; Development mode limits sign-in to people with a role | web search result quoting Meta's documentation; Supabase docs `social-sign-in/auth-facebook.mdx` |
| The map and victory pages' free room at 1600 x 900, 1194 x 834, 1024 x 768, 834 x 1194, 667 x 320, 932 x 430 and 393 x 659 | screenshots of master taken with `tools/shot.js` |

**Verified or measured in the review**, added to the table above:

| what | source |
| --- | --- |
| The Auth service stores the IP address and user agent of each session and the IP address of each audit entry | `supabase/auth` master: `internal/models/sessions.go` (lines 92, 93), `audit_log_entry.go` (line 106) |
| An email is treated as verified for account linking when the provider says so **or** `Mailer.Autoconfirm` is on; Discord passes its own `verified` flag, Facebook's email is always marked verified; an unverified email with auto-confirm off fails with `provider_email_needs_verification`, whatever `EMAIL_OPTIONAL` says | `internal/models/linking.go` (line 67), `provider/discord.go` (line 82), `provider/facebook.go` (line 96), `internal/api/external.go` (lines 412 to 452) |
| `/settings` answers `mailer_autoconfirm` | `internal/api/settings.go` (line 37) |
| A sign-in whose state is older than five minutes, or cannot be read, is sent to `SITE_URL` with `error_code` in the query | `external.go` (lines 141 to 146, 556 to 569, 822 to 845) |
| The Envoy gateway (the default of current installs) opens `/auth/v1/authorize` and `/auth/v1/callback` without a key and answers the preflight with every header allowed and `max-age: 3600` | `supabase/supabase` master: `docker/volumes/api/envoy/lds.template.yaml` (lines 42 to 48, 89 to 126). This settles a point the draft left open. |
| The gateway itself turns an `sb_` publishable key into a signed anon token, so `Authorization: Bearer <anon key>` works with either kind of key | `docker/volumes/api/kong-entrypoint.sh` (line 17), `kong.yml` |
| Supabase grants `anon` and `authenticated` everything on new tables, functions and sequences in `public`; `anon` statements are cut off after 3 s and `authenticated` after 8 s; `postgres` is not a superuser and holds every privilege on the `auth` tables | `supabase/postgres` develop: `migrations/db/init-scripts/00000000000000-initial-schema.sql` (lines 40 to 42, 59, 60), `migrations/db/migrations/10000000000000_demote-postgres.sql` |
| PostgREST runs a `stable` or `immutable` function in a read-only transaction even on POST, and applies a function's own `statement_timeout` to the call | `PostgREST` main: `docs/references/transactions.rst` ("Access Mode on Functions", "Hoisted Function Settings") |
| The current compose file's SQL editor runs as `postgres`; the example `.env` prints a `JWT_SECRET`, an anon key and a service key that are public knowledge | `docker/docker-compose.yml` (`PG_META_DB_USER`), `docker/.env.example` |
| The page sets `apple-mobile-web-app-capable`; speeds are 1, 2 and a hidden 4; `victoryStars` is 0.85 and 0.5; `hs_tutorial_done` holds "1", "0" or nothing; a migration removes `hs_run`; the storage fallbacks have no `key()` | `index.html` lines 6, 60413, 10927, 60835, 76089, 3102 to 3131 |
| [M] The revised `schema.sql` loads twice on a fresh database and passes 124 assertions, with and without the handoff's file; the name rule refuses symbols, pictures and stacked marks and accepts Armenian, Cyrillic, CJK, Arabic and accented Latin letters; a flood of 3,000 calls of mixed sizes from made-up devices is held to 19,985 events and 791 rate rows; an event of 1.5 KB is kept and one of 5 KB is not; hostile events leave the stats working and free of markup; the daily's pick covers every pair of 17 by 6 and 17 by 12 with no repeat on consecutive days; the proposed `update.sh` passes 7 cases | run here on PostgreSQL 16.15 (database `hs_crit`) and bash |
| [M] On the draft's schema: 1,300 calls put 59,901 events (10 MB) in the table and a single-event batch was still accepted after the "cap"; `★★★`, a name with a picture, stacked marks and `卐卐卐` were accepted as names; one event with `"diff":"x"` made `hs_stats` fail (22P02); a battle of 280 s where `fast` was 300 failed with "malformed array literal" instead of being flagged; gameplay's example of a battle's facts is 1,063 bytes compact and about 1,226 as `jsonb` text, over the draft's 1,024 | run here before the revision (database `hs_test`) |

**Not verified [U]**, with how each is settled:

| what | how it is settled |
| --- | --- |
| The owner's Supabase: its version, its gateway, whether its gateway port answers from outside, whether its secrets are the example's, whether `mailer_autoconfirm` is on, what else lives in its `public` schema and whether those tables have row level security, whether `GOTRUE_EXTERNAL_*_EMAIL_OPTIONAL` exists in its Auth version, whether its PostgREST is 12 or later (function timeouts), whether the collation `und-x-icu` exists there, whether `postgres` may delete from `auth.users` | the guide's step 0 and the checks after steps 1, 3 and 4; `schema.sql`'s three closing warnings; the smoke test (10.6) on the day the two values arrive |
| supabase.com's docs site itself (blocked here); the docs and sources were read from the repositories' main branches, which may run ahead of the owner's installed version | compare with the installed version's `.env.example` and compose file on the server; the smoke test |
| What iOS does with a provider redirect from a Home Screen app on current versions (stays in the app, a sheet, or Safari; whether a sheet shares the app's storage). The reviewer's recollection is that since iOS 12.2 the return stays in the app; it is a recollection | the owner's first sign-in on `/next/` is done from the Home Screen and the page reports where the return landed (1.6); the handoff is built only if it landed elsewhere |
| Whether Discord lets an account with an unverified email authorize an app at all (if not, the takeover of 3.3 cannot happen; the guard costs nothing either way) | Discord's developer docs, or one try with a throwaway account on `/next/` |
| Safari's seven-day limit on a site's script storage, and Home Screen apps' exemption from it | from memory of WebKit's announcement; it only strengthens the case for accounts, nothing depends on it |
| Meta: whether `email` needs App Review or business verification for this app; Discord: that `identify` and `email` need no review; the three providers' minimum ages; Facebook's and Discord's button brand rules | the owner sees it in each console while making the app (guide, step 2); the gate's "13 and older" is conservative for all three |
| Google's exact rule for "Testing" with only basic scopes (one result said any user may sign in) | the guide says to press Publish app either way |
| Web Share with files in an iPhone Home Screen app; the clipboard picture write on each browser; the `x-safari-https://` and `intent:` links of 1.6 | the owner's checklist; the sheet's Save picture and **Copy link** work everywhere |
| The guide's nginx and Caddy blocks (the two prefixes, the limit per address, the body limit): neither server is installed here, so they were written and not run | the four `curl` lines after the guide's step 1; the smoke test's checks 11 and 12 |
| That the live web server serves `/next/` from `$WEB/next/` | the repository's nginx and Caddy configs both do; the first `next` push shows it |
| Whether storing the anonymous id before any choice needs consent where the owner's players live | not a technical question: the owner's, with whoever reads his privacy page (section 13); both behaviors are specified (7.1) |
| The numbers in the ruleset examples (`fast`, `slow`, `earnMax`), and the score weights' feel | gameplay's balance bot produces the pars; the weights are data |
| The page: nothing was built. The layouts' free room was read off screenshots of master; the phone's victory page at 667 x 320 has no free row | the builder's audit at the iPhone sizes (`iphone-audit.js`) for every new control; gameplay's `#ovGrowth` there is gameplay's to fit (0.3 (7)) |

---

## 13. For the owner: to do and to decide

**To do** (the guide walks through each): check the Supabase's secrets and its port before anything is public
(step 0); give it its https name with the two prefixes; make the three provider apps; put their secrets in the
Supabase `.env`; look at `mailer_autoconfirm`; run `schema.sql` and the audit query; hand over the address and
the anon key; sign in on `/next/` from the iPhone's Home Screen and say where it landed; make yourself an
admin; (R2) publish the ruleset; run the checklist on your devices; fill the bracketed places of the privacy
page (name, contact, country, days the web server's logs are kept); add the words to refuse to
`hs_name_blocklist`.

**To decide:**

1. **The gate after its first week.** `required` is built as you chose. The stats page will show what it
   costs, for new visitors, for today's players and for arrivals inside other apps, each on its own. The
   recommendation stands: try `optional` for a week and compare. The switch now reaches a visitor's first
   load.
2. **The escape after two sign-ins that did not finish.** It keeps a player from being locked out when a
   provider is blocked on his network. It also lets anyone who wants to skip the gate do so with two taps
   and two presses of Back. The page cannot tell the two apart. Keep it (recommended), or tell the builder
   to count only the failures the server reports.
3. **Children and classrooms.** With `required` nobody under 13, and nobody without one of the three accounts,
   can play. Is that intended for a history game?
4. **Arrivals inside Facebook's, Instagram's or TikTok's browser.** A shared card is opened there most of the
   time, and Google does not sign in there. They can use Facebook or Discord, or copy the link. Should they
   get **Play now** as well, while the gate is `required`?
5. **Email auto-confirm on your Supabase.** If `mailer_autoconfirm` is on, either turn it off (your other
   projects' email sign-ups then need a working mail server) or launch without Discord. The page holds
   Discord back by itself until it is off.
6. **Counting before a choice.** The game counts visits with a random number kept in the browser from the
   first load. In some countries that asks for consent. Ask whoever reads your privacy page. If the answer
   is "do not keep it before the visitor chooses", the builder sets `HS_ANON_ID = "visit"`: the number then
   ends with the tab until the visitor signs in or plays as a guest, and return visits are counted for
   those only.
7. **Launching before Meta approves.** The buttons follow what the server has switched on: launch with Google
   and Discord if Facebook's review drags?
8. **The second address** (hyeland.avunjian.com). A sign-in and a save belong to one address in the browser.
   Simplest: make the second name redirect to the first. Otherwise it needs one more line in Supabase's `.env`.
9. **The score's weights** (4,000 / 3,000 / 1,500 / 1,500) and whether Open boards are wanted at all (R2).
10. **How long counts are kept** (180 days proposed), how large the events may grow (1 GB proposed), and who
    the privacy page names as the contact.
11. **Staging on the live address.** `/next/` shares the live game's browser storage; the build keeps its own
    names and the publishing script refuses a build that does not. A name of its own for staging
    (next.highland.avunjian.com) would separate them for good, at the cost of one more DNS record,
    certificate and line in Supabase's `.env`. Use a private window for `/next/` either way.

---

## Appendix A. What the review changed

By the numbers of `docs/specs/platform-critique.md`. "SQL" means `schema.sql` and `schema-test.sql` were
changed and the test passes; "guide" means `setup-guide.md`.

| # | finding | where it is applied |
| --- | --- | --- |
| 1 | going public opens the owner's other projects | 0.1 (3), 9.1, 10.6, 11.3; guide steps 0, 1, 4 |
| 2 | `hs_track` could fill the database; the cap counted calls | 2.3, 7.4; SQL (`rate_ok` with an amount, the visitors' pool, `ev_max_mb`, the rolling removal, the purge in pieces); guide step 1 |
| 3 | the privacy page's sentence on IP addresses | 0.1 (11), 7, 8.1 |
| 4 | the switch never reached a first visit | 3.2, 3.9 |
| 5 | no site data: locked out | 0.2 (`HS_STORE_MEM`), 3.1, 3.6, 3.9, flow 11 |
| 6 | battle events over the server's 1 KB | 0.3 (4), 7.2, 7.3, 7.4; SQL (4 KB, 60 KB a batch) |
| 7 | strangers' text on the stats page; stats that one event could break | 1.3, 5.5, 7.5, flow 10; SQL (`tag`, `int_or_null`) |
| 8 | auto-confirm and Discord | 1.1, 3.3, 3.6, 7.5 (Health), 8.2, 12; guide step 3 |
| 9 | the daily's arithmetic | 5.6; SQL (`daily_pick`, coverage tests) |
| 10 | the handoff on a guess | 0.1 (6), 1.6, 3.1, 11.2 (P2b); `schema-handoff.sql` with limits per id |
| 11 | Back from the provider | 1.2 step 4, 3.6, 3.7, flow 3 |
| 12 | direct reads and the flags | 0.1 (2), 2.2; SQL (no grant, no policy, sequences revoked) |
| 13 | the server's name rule | 3.5, 5.5; SQL (`name_letters`, blocklist, closing check) |
| 14 | older builds dropping newer keys | 4.1, 4.4 |
| 15 | a bare removal of `hs_run` as a mark | 4.2, 4.5 |
| 16 | a merge under a live battle | 4.3, 4.4 |
| 17 | the seam's seven disagreements | 0.3, 2.4, 5.1, 5.3, 5.4, 5.5, 5.6; SQL (`script`, `skip`, `livesSet`) |
| 18 | the funnel's honesty | 3.2, 7.2, 7.3, 7.5; SQL (`hs_stats`: three kinds of device, two steps from the server's rows) |
| 19 | counting before a choice | 0.2 (`HS_ANON_ID`), 3.3 (small print), 7.1, 8.1, 13 (6) |
| 20 | Supabase's timeouts; read-only stable functions | 2.3, 10.1, 10.2; SQL (function timeouts, `p_cards`, read-only test) |
| 21 | the real Supabase met last | 10.6, 11.2 (P1, P2) |
| 22 | one release too large | 0.1 (13), 11 |
| 23 | `hs_tutorial_done` | 0.2, 4.4 (`flag`) |
| 24 | `hs_nardi` and `newer` | 4.1, 4.4 |
| 25 | no walk through storage | 4.2 |
| 26 | the hook and `sessionStorage` | 4.2 |
| 27 | `GET /user` | 1.1 (removed) |
| 28 | five minutes at the provider | 1.2 step 4 |
| 29 | one person, two accounts | 3.3 |
| 30 | `hs_config` 404 | 3.2, 3.9 |
| 31 | the gate is in the page | 3.1 |
| 32 | who owns the functions | 2, 2.6; SQL (`set role postgres`, closing check) |
| 33 | runs never finished | 5.3; SQL (the purge) |
| 34 | a score that meets a 401 | 3.6, 5.3 |
| 35 | `keepalive` and the preflight | 7.3 |
| 36 | a framed page | 1.6 |
| 37 | the clock offset | 0.5, 4.1 |
| 38 | default names | 3.5 |
| 39 | in-app arrivals | 1.6 (**Open in browser**, unverified); **Play now** for them is the owner's (13 (4), Appendix B) |
| 40 | `notice` | 3.3, 7.5; SQL (140 characters) |
| 41 | staging and the live origin | 0.1 (12), 9.3, 13 (11); `update.sh.proposed` and its test (7 cases) |
| 42 | deletion and the device's earlier visits | 1.5, 7.1, 8.1; SQL (the visits, and the sign-in service's log of the account) |
| 43 | look-alike letters | 5.5 (said) |
| 44 | a daily's first-wave call | 5.3, 5.6 |
| 45 | the pure checks and the self-test | 10.5 |
| 46 | a flagged score crashed instead of being flagged | SQL (`array_append`; a test that posts a battle under `fast`) |
| 47 | the server refused honest battles under `fast` | 0.3 (1), 2.4; SQL (`min`) |

## Appendix B. What was not taken, and why

| what | why not |
| --- | --- |
| Making `optional` the default | D3 is the owner's decision and binding. The spec measures its cost and makes the switch reach first visits; the recommendation is in section 13. |
| **Play now** for in-app arrivals under `required` (review item 39) | It would widen D3's exception on the reviewer's word. It is offered to the owner (13 (4)); only **Open in browser** is added, marked unverified. |
| Counting only server-reported failures toward the escape | It would lock out a player whose provider is blocked on his network, which D3 forbids. Left as built, and put to the owner (13 (2)). |
| A limit per IP address inside the database (a salted hash in `hs_rate`) | It would put a form of the visitor's address in the game's own tables, against the sentence the privacy page now makes true. The proxy limits by address instead; the database limits by pool and by size. |
| A content security policy as a must | The page is one inline script, so a policy must allow inline script and cannot stop injected markup from running; what it can stop (sending data to another host) is real but small, and a wrong policy breaks the sound engine on some browser. It stays optional and first to be cut. |
| Daily rollup tables for the stats | More machinery than a game of this size needs. A longer timeout on the function, card-by-card calls and the size ceiling are enough; if the stats page ever feels slow, rollups are the next step. |
| Posting `script` with a lost daily (gameplay's N6) | The server can read it from the waves cleared and the ruleset's script table, so the number need not be trusted at all. Gameplay gets the scoring it asked for. |
| An endless board (gameplay's 6.2) | Not asked for by the owner and not in the draft. Endless stands stay unranked. |
| Showing `power` and `heroLevel` on the Open boards (gameplay's N5 "may") | Not needed for R2; one more column to design on a phone. Later. |
| Removing `hs_pf_stash` from R1 outright | It stays on the cut list (11.4). Without it a player who signs out offline loses that session's progress, which is worth forty lines. |
| A staging host of its own as a must | More work for the owner (DNS, certificate, one more allowed address) for a risk that mostly touches his own browser. The publishing script's check and a private window cover it; the host is offered (13 (11)). |
| supabase-js after all | The draft's reasons hold: one file, no outside script, and the gate's behavior when the service is slow must be the page's own. The review found no fault that the SDK would have prevented; the faults were in the database and the setup. |
| Replay checking of scores | Unchanged from the draft: weeks of work in the gameplay track, worth it only if boards come to matter. |
