# Highland Stand: the platform build spec

Accounts, the sign-in gate, cloud saves, leaderboards, the daily challenge's boards, the share card, first-party
analytics, the owner's stats page, the privacy page, the owner's setup guide and the staging channel.
Written against `index.html` at master 54207ce (line numbers below are that file's). Nothing here changes
gameplay; the gameplay track has its own spec (`docs/specs/gameplay.md`). The seam between the two is section 0.3.

Files that belong to this spec, all under `docs/specs/platform/`:

| file | what it is | state |
| --- | --- | --- |
| `schema.sql` | the draft of `deploy/supabase/schema.sql` (section 2) | runs twice cleanly on PostgreSQL 16 |
| `standins.sql` | Supabase's roles, `auth.users` and `auth.uid()` for a plain PostgreSQL (section 10.1) | used by the test below |
| `schema-test.sql` | a first SQL test of every policy and function | passes (`SCHEMA TESTS PASSED`) |
| `update.sh.proposed` | `deploy/update.sh` with the staging channel (section 9.3) | passes `test-update.sh` |
| `test-update.sh` | tries an `update.sh` on a throwaway origin, clone and web root | passes |
| `setup-guide.md` | the draft of `deploy/supabase/README.md`, for the owner (section 9) | text |

Marks used below: **[V]** verified in this session against a primary source (named in section 12), **[U]** not
verified (web access to the provider's own site was blocked, or it can only be seen on a real device or on the
owner's server). Every [U] is collected in section 12 with how to settle it.

---

## 0. The shape of it

### 0.1 Decisions in one page

1. **No SDK.** The page talks to the owner's Supabase with plain `fetch`: seven Auth calls and a dozen
   `POST /rest/v1/rpc/hs_*` calls. Reasons: the game is one file with no build step and loads nothing from
   another host (D6 forbids third-party scripts, and a CDN copy of supabase-js is one); the SDK is about 100 KB
   of code of which this needs a few hundred lines; and the page must decide for itself what happens when the
   service is slow, down or returns to a different window (sections 1.6, 3.6), which the SDK hides.
2. **Everything in the database is named `hs_...`** and is reached through functions only. The owner's Supabase
   already runs other things; nothing here can collide with them. Every table has row level security on; the
   public API roles can read their own rows on five tables and nothing else; every write goes through a
   `security definer` function that checks `auth.uid()`.
3. **The platform is off wherever it cannot work**, and then the page behaves exactly as today: on `file://`
   (the selftest, the photo harness and all nine regression scripts load the page that way), under
   `HARNESS_ON`, and while the two public constants are empty. So the existing tools need no change and stay
   green (section 10.5).
4. **The gate is a layer of its own** (`#gate`) over the page, not a new mode of `#overlay`. D3's switch is one
   constant, `HS_GATE = "required"`, which the owner can also override from the stats page without a deploy
   (`hs_config`, section 3.2). The gate never locks anyone out: when the Auth service does not answer, when the
   device is offline, or after two sign-ins in a row that did not finish, it offers **Play now** (section 3.6).
5. **The iPhone Home Screen app is treated as a separate browser**, because it is one: its storage is not
   Safari's. A sign-in that returns in another window is handed back to the window that began it through the
   server (`hs_handoff`, section 1.6), so sign-in works whichever window iOS chooses to return to.
6. **Cloud saves are one document per account with a version number** (optimistic writes). The page syncs the
   keys named in `CLOUD_KEYS`; it notices changes by itself (a hook on `localStorage.setItem`), so gameplay code
   never calls the network. Merge: records keep the best of both, lists are joined, the battle in progress is
   the newest with a prompt when two fresh battles disagree (section 4).
7. **A score is computed by the server from the battle's numbers**, not sent by the page:
   *a win is worth 4,000, plus up to 3,000 for the defenders kept, up to 1,500 for speed and up to 1,500 for
   gold never spent.* The numbers must fit the bounds of a **ruleset** the owner publishes from the page with
   one button; boards are per ruleset, so a rebalance never mixes boards (sections 2.4, 5).
8. **Progression never tilts a board.** Every run is tagged `std` (the standard loadout: no upgrade tree, no hero
   levels, no gifts of gold) or `open`. The boards show Standard first; Open is a second tab. The daily
   challenge is always the standard loadout, the same for everyone (section 5.4).
9. **The daily challenge is derived from the UTC date by two lines of arithmetic** that the page and the
   database both compute (section 5.6). Three ranked attempts a day.
10. **Analytics are one table of events in the same Supabase**, sent in batches by the page, with a random
    anonymous id in `localStorage` before sign-in. No cookie, no IP address, no user agent string, no
    third-party code (section 7). The owner reads them on `?stats`, an admin-only page inside `index.html`.
11. **The staging channel** publishes branch `next` at `/next/`. Because that is the same origin as the live
    game, a page served from `/next/` keeps its saves and its session under their own names (`next:` before
    every key), so trying a build can never touch a real save (section 9.3).

### 0.2 Where the code goes in `index.html`

All platform code is new and sits in four places. Nothing else in the file changes except the lines listed in 0.4.

| block | where | what |
| --- | --- | --- |
| **PF-0** | in the script, right after the storage fallback (after line 3139) | the staging namespace (9.3), the three constants, `track()`, `CLOUD_KEYS`, `HALL_TABS` |
| **PF-CSS** | at the end of the stylesheet (before line 2240) | `#gate`, `#hall`, `#ovScore`, `#shareSheet`, `#privacyPage`, `#statsPage`, the phone rules for each |
| **PF-HTML** | in the body, after `#overlay` (after line 3086) | static markup of `#gate`, `#hall`, `#privacyPage` (its text is real HTML, readable without scripts), `#statsPage`, and inside `#overlay`: `#ovScore`, `#hallBtn`, `#boardBtn`, `#shareBtn` |
| **PF-MAIN** | a section `// ---------- platform ----------` just before `// ---------- main loop ----------` (line 75990) | the `Platform` object: auth, gate, cloud, boards, daily, share, analytics, stats |

PF-0, verbatim (the builder fills nothing in; the owner supplies the two values later):

```js
// ---------- platform: accounts, cloud saves, boards, analytics (docs/specs/platform.md) ----------
// The owner's Supabase. Both values are public by design (the anon key only opens what row level security
// allows). Empty: the platform is off and the game is the game of before. NEVER put a service key, a JWT
// secret or a provider's secret in this file.
const HS_SUPABASE_URL = "";        // e.g. "https://supabase.avunjian.com" (no slash at the end)
const HS_SUPABASE_ANON_KEY = "";
const HS_GATE = "required";        // "required" | "optional" | "off" (docs/specs/platform.md, section 3)
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
// ("max", "union", "records", "newer", "run", or a function (mine, theirs) => string|null given the two raw
// strings). Gameplay adds its new keys here. Keys not listed never leave the device.
const CLOUD_KEYS = [
  { key: "hs_records", merge: "records" },
  { prefix: "hs_best_", merge: "max" },
  { key: "hs_open_kept", merge: "union" },
  { key: "hs_unlocked_seen", merge: "union" },
  { key: "hs_chapters_seen", merge: "union" },
  { key: "hs_tricks_seen", merge: "union" },
  { key: "hs_tutorial_done", merge: "max" },
  { key: "hs_nardi", merge: "newer" },
  { key: "hs_run", merge: "run" },
];
// The tabs of the Hall page (section 5.5). The platform adds Daily, Leaderboards and Account; gameplay may add
// its own (the upgrade tree, the heroes) with { id, label, icon, render(el), badge() }.
const HALL_TABS = [];
```

`track` is a function declaration on purpose: it is hoisted, and its queue lives on `window`, so a call from any
line of the file, at any moment of start-up, is safe.

### 0.3 The seam with gameplay

Gameplay code never calls the network and never reads the platform's state. The whole contract:

**What the platform gives gameplay**

- `track(name, props)`: analytics, and the signal the platform acts on (it asks for a run token on
  `battle_start`, posts the score on `victory` and `defeat`).
- `CLOUD_KEYS`: add a row and the key syncs.
- `HALL_TABS`, `openHall(tabId)`: a page shell with tabs, for the upgrade tree and the heroes if gameplay wants it.
- `Platform.daily()`: `{ day, levelIndex, twist, attemptsLeft, best, rank } | null` for gameplay's daily UI.
- `Platform.player()`: `{ signedIn, name } `, for a hero's or a card's wording. Read only.

**What the platform needs from gameplay** (each is used in the section named)

1. **`RULESET`** (a constant; the platform uses `String(RULESET)`) and **`rulesetData()`**, which returns the
   object of section 2.4: per battlefield its wave count and, per difficulty, `lives`, `fast`, `slow`, `earnMax`;
   the score weights; the daily's pool, twists, `diff`, `attempts` and per-twist multipliers. `RULESET` must
   change whenever anything in `rulesetData()` or in the fight itself changes. A selftest check pins a hash of
   `rulesetData()` to `RULESET` so a change without a bump fails the suite (5.2).
2. **Three counters per battle**, kept in the run and saved with it (`runRecord`, line 10641):
   `simSec` (seconds of battle clock from the first wave's horn to the last foe's fall: the sum of `dt` in
   `update`, so game speed, pauses and menus do not count, and waiting between waves does),
   `spent` (gold laid out on towers, upgrades, repairs and plots; a sale gives nothing back to it, except the
   full refund of a placement undone within its 5 seconds), and `earned` (the starting purse plus every coin
   paid since: bounties, wave bonuses, interest, early-call bonuses).
3. **The loadout tag**: `"std"` when the battle is fought with no upgrade-tree effect, the battlefield's hero at
   his base level, and no gift of gold (the nardi blessing, the town's gift); else `"open"`. Gameplay decides
   how a player chooses a standard battle once he owns upgrades; today's game is `std` unless a blessing paid.
4. **The events of section 7.2**, each a `track(...)` call at the point named there. Four of them carry the
   battle's numbers and are the platform's triggers: `battle_start`, `victory`, `defeat`, `battle_quit`.
5. **The daily**: `DAILY_TWISTS = [{ id, name, line, apply }]` and `startDaily(levelIndex, twistId)`, which
   begins a Normal battle in the standard loadout with the twist applied, writes no record and opens no road
   (as `recordsBarred()` does today), and **leaves `hs_run` alone**: a daily is one sitting, is not saved to
   resume, and never replaces a campaign battle in progress. Its events carry `mode: "daily"`.
6. **New keys** registered in `CLOUD_KEYS` with a merge rule (gameplay's notes name `hs_council`, `hs_heroes`,
   `hs_towers_seen`). A key that holds something spent (stars on the tree) needs a function rule; "newer" would
   let an old device undo a purchase.
7. **Two layout promises** (5.5): the phone's map page gets no further control in its top row (it is full: tally,
   story, nardi, gear), so the campaign tally `#ovStars` becomes a button that opens the Hall; and the phone's
   victory page keeps its top right corner beside the gear free for the platform's two round buttons.
8. Gameplay never writes a key that starts `hs_pf_` (the platform's own, never synced).

### 0.4 The lines of today's code that change

| line | today | becomes |
| --- | --- | --- |
| 3139 (after) | | PF-0 |
| 76205-76207 | `requestAnimationFrame(frame);` then the first chapter's story | `requestAnimationFrame(frame); Platform.boot(() => { if (!HARNESS_ON && !chaptersSeen().includes(mapChapter())) showChapterIntro(mapChapter()); });` With the platform off `boot` calls its argument at once: the same behavior as today. |
| 60737 (keydown handler, first line) | | `if (Platform.blocking()) return;` (no hotkey reaches the game under the gate, the Hall, the privacy or stats page) |
| 60669 `syncOverlayUp` | | no change; the platform calls it after it lifts its own `inert` (it exports nothing new) |
| 11502 (in `endCelebration`, after `showRecord`) | | `Platform.victoryPage();` (shows the score strip and the two doors; a no-op when off) |
| 11886 (in `endFall`, after `showDebrief`) | | `Platform.defeatPage();` (a lost daily shows its score) |
| 56549 (`syncChapterBar`) | `#ovStars` is a `div role="img"` | a `button` with the same content; its click is `openHall()` when the platform or a gameplay tab is there, else nothing |
| 2979-3007 `#settings` | | one more row, `#setAcct` "Account and boards", shown on menu pages only (`body.onMenu`) when the platform is on |
| 76030 `showCrashCard` | | first line `track("error", { msg: String(err && err.message || err).slice(0, 120) });` |

Everything else the platform needs it reads through functions that exist: `getSavedRun`, `resumeRun`,
`furthestOpen`, `levelConquered`, `levelStanding`, `starTally`, `showBrief`, `selectMapLevel`, `openCampaignMap`,
`battleLive`, `escapeHtml`, `icon`, `toast`, `isPhone`, `phoneWide`, `phoneFold`, `hyName`, `Snd.play`.

### 0.5 The platform's own keys

All start `hs_pf_`, live in `localStorage`, are never synced, and are removed by sign-out where marked.

| key | holds | sign-out |
| --- | --- | --- |
| `hs_pf_aid` | the anonymous id (a random UUID), made on the first visit | kept |
| `hs_pf_dev` | `{ id, label }`: a short random id of this browser and a word for it ("iPhone", "iPad", "Mac", "Windows PC", "Android phone", "this browser") | kept |
| `hs_pf_auth` | the session: `{ at, rt, exp, uid, prov }` (access token, refresh token, expiry in epoch seconds, user id, provider) | removed |
| `hs_pf_me` | `{ uid, name, admin }`, a copy of the profile for instant display | removed |
| `hs_pf_pkce` | a sign-in under way: `{ v, h, p, t, sa, back }` (verifier, handoff id, provider, start time, begun in the Home Screen app, where to go back to) | removed |
| `hs_pf_gate` | `{ fails, guest }`: sign-ins in a row that did not finish; guest play chosen (optional mode) | kept |
| `hs_pf_sync` | `{ owner, ver, dirty, pulled, pushed }` (section 4) | reset |
| `hs_pf_run` | the run token of the battle in progress (5.3) | removed |
| `hs_pf_out` | scores waiting for a connection (5.3) | removed |
| `hs_pf_evq` | analytics events not yet sent (7.3) | kept |
| `hs_pf_cfg` | the last `hs_config` answer (3.2) | kept |
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
| `GET /settings` | at the gate, before the buttons show | answers `{ external: { google: true, facebook: true, discord: true, ... } }` **[V]**. It is the health probe (3.6) and decides which of the three buttons show, so the owner can open the providers one at a time. 4 s time limit. |
| `GET /authorize?provider=<p>&redirect_to=<url>&code_challenge=<c>&code_challenge_method=s256` | a top-level navigation (`location.assign`), never a `fetch` | **[V]** the route needs no `apikey` on the default gateway (Kong's `auth-v1-open-authorize`; **[U]** the newer default gateway, Envoy, is assumed to do the same: the setup guide's test 3 shows it). `scopes` is left out: the server asks each provider for the email scope by itself **[V]**. |
| `POST /token?grant_type=pkce` body `{ auth_code, code_verifier }` | on return with `?code=` | answers `{ access_token, refresh_token, expires_in, expires_at, user, provider_token?, ... }` **[V]**. `provider_token` and `provider_refresh_token` are dropped at once and never stored: the game never calls a provider. |
| `POST /token?grant_type=refresh_token` body `{ refresh_token }` | 1.4 | a new pair each time (rotation) **[V]** |
| `GET /user` | once after sign-in, to read the provider name for the Account tab | |
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
   in the selftest against RFC 7636's vector, and needs no secure-context API).
2. It stores `hs_pf_pkce = { v, h, p, t: Platform.now(), sa: standalone, back }` (`back` is `""`, `"stats"` or
   `"hall"`: where the player was), sets the gate to its waiting state (1.6), sends `provider_tapped`, flushes
   analytics with `keepalive`, and navigates to
   `B/auth/v1/authorize?provider=<p>&redirect_to=<R>&code_challenge=<c>&code_challenge_method=s256`
   where `R = location.origin + location.pathname + "?hsh=" + h` (so `/next/` returns to `/next/`).
3. The provider signs the player in and sends him to `B/auth/v1/callback`, which sends him to `R` with
   `&code=<uuid>` added, or with `error`, `error_code` and `error_description` in the query (and again after
   `#`) **[V]**. The code is good for 5 minutes and once **[V]**.
4. On every load, before the game's first page is decided, `Platform.boot` reads the query:
   - `code` and a stored `hs_pf_pkce` whose `h` equals `hsh` and whose `t` is under 10 minutes old: exchange
     (`POST /token?grant_type=pkce`), store the session, remove `hs_pf_pkce`, strip `code`, `hsh`, `error*`
     and the fragment from the address with `history.replaceState`, send `signed_in`, go on to 3.4.
   - `code` and `hsh` but no matching `hs_pf_pkce`: this window is not the one that began (1.6).
   - `error`: remove `hs_pf_pkce`, strip the address, count a failure (`hs_pf_gate.fails`), show the gate with
     "Sign-in did not finish. Try again, or use another account." and send `signin_error { provider, error }`
     (`error` is the server's `error_code` or `error`, never the description).
   - an exchange that fails: the same, with `error: "exchange_" + status`.
   The address is stripped before any analytics call, and no event ever carries the query string.

Who may be redirected to: Supabase sends the player back to `redirect_to` only when it is on the same scheme,
host and port as its `SITE_URL`, or matches a pattern in `ADDITIONAL_REDIRECT_URLS`; otherwise to `SITE_URL`
itself **[V]**. So `SITE_URL=https://highland.avunjian.com` covers the live page and `/next/`; a second name for
the game (hyeland.avunjian.com is served by the same web server today) needs
`ADDITIONAL_REDIRECT_URLS=https://hyeland.avunjian.com/**`.

One account, several buttons: Supabase links a new sign-in to an existing account with the same verified email
by itself **[V]**, so a player who used Google on the iPad and Discord on the PC with one email has one account.

### 1.3 Where the session is kept

`hs_pf_auth` in `localStorage`: `{ at, rt, exp, uid, prov }`. Not a cookie (the page has no server of its own).
The risk of a token in `localStorage` is script injection; the page loads no outside script, builds every name
and message with `escapeHtml` or `textContent`, and the display name is the only text of another player it ever
shows (5.5). The access token lives one hour (`JWT_EXPIRY`, default 3600 **[V]**).

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
analytics sessions that carried the account, and the account's row in `auth.users` (and with it Supabase's
identities, sessions and refresh tokens). Then the device is cleared as at sign-out and the page reloads to the
gate. Words: "Delete your account? Your name, progress and scores are removed from our server and from this
device. This cannot be undone." **Delete everything** / **Keep my account**. GoTrue has no call a player can
make to delete himself (its delete is admin only **[V]**), hence the function; that the function's owner may
delete from `auth.users` is checked by `schema.sql`'s last statement on the owner's server **[U]**.

### 1.6 Safari, the Home Screen app, in-app browsers

**Safari, Chrome, Firefox, Edge on any device**: the redirect of 1.2 leaves and returns in the same tab. Nothing
special.

**The iPhone or iPad Home Screen app** (`navigator.standalone === true`): its `localStorage` is its own, not
Safari's **[V, by developers' reports; U on current iOS]**, so a player who signed in in Safari is not signed
in there, and the verifier of a sign-in begun there exists only there. What iOS does with the navigation to
Google differs by version by report (it may stay in the app, open a browser sheet over the app, or leave for
Safari, and the sheet may or may not share the app's storage) **[U]**. The page therefore does not depend on
any of them:

- The window that receives `?code=` **and has the verifier** signs in (1.2). If it is not the Home Screen app
  although the sign-in began in one (`hs_pf_pkce.sa` is true, `navigator.standalone` is not), it is a sheet that
  shares the app's storage: it shows only "You are signed in. Tap Done to go back to the game." The app under
  it sees `hs_pf_auth` appear (a `storage` event, and a check every second while it waits) and goes on.
- The window that receives `?code=` and `hsh` **without the verifier** calls
  `POST /rpc/hs_handoff_put { p_id: hsh, p_code: code }` and shows "You are signed in. Go back to Highland
  Stand on your Home Screen." (in Safari) with one more line: "Or keep playing here: sign in again in this
  window." and the three buttons.
- The window that began (the gate's **waiting** state: "Finish signing in in the window that opened. Then come
  back here." with **Start over**) asks `POST /rpc/hs_handoff_take { p_id: h }` when it becomes visible and
  every 2 seconds while visible, for 5 minutes. When a code comes it exchanges it with its own verifier. The
  code is useless to anyone without the verifier, is deleted when taken, and expires in 5 minutes.
- A window that loads with a stale `hs_pf_pkce` (older than 10 minutes) and no `code` removes it.

**In-app browsers** (a link opened inside Facebook, Instagram, TikTok, Discord, LinkedIn, an Android WebView):
Google refuses to sign in inside embedded web views (`disallowed_useragent`) **[V]**. The page detects them by
user agent (`FBAN|FBAV|FB_IAB|Instagram|Line\/|MicroMessenger|TikTok|musical_ly|Twitter|LinkedInApp|Snapchat|
Pinterest|GSA\/|; wv\)`), hides the Google button there, and shows above the others: "This app's browser can
block sign-in. For Google, open highland.avunjian.com in Safari or Chrome." with **Copy link** (`navigator.
clipboard.writeText`, with a selected text field as the fallback). Facebook's and Discord's buttons stay.
`gate_shown` carries `state: "inapp"` so the stats show how many arrive this way.

**Android "Add to Home screen"** shares Chrome's storage **[V, by report]**: nothing special.

---

## 2. The database

The file: `docs/specs/platform/schema.sql`, to be copied to `deploy/supabase/schema.sql` unchanged. One file,
safe to run again, no secret in it. It was run twice on PostgreSQL 16 here and passes `schema-test.sql`
(79 assertions: roles, policies, each function's refusals and results). It uses nothing newer than PostgreSQL 13
(`normalize()`), so it runs on any Supabase image.

### 2.1 Tables

| table | one row per | columns that matter | who reads it directly |
| --- | --- | --- | --- |
| `hs_profiles` | player | `user_id`, `name` (chosen), `name_key` (folded, unique), `name_changed_at`, `hidden`, `first_aid` | the player, his own row |
| `hs_saves` | player | `version`, `data` (the save document, section 4.1), `bytes`, `device`, `updated_at` | the player, his own row |
| `hs_rulesets` | ruleset | `id`, `data` (2.4), `active` | nobody (functions) |
| `hs_runs` | ranked battle begun | `id` (the run token), `user_id`, `mode`, `level_id`, `diff`, `ruleset`, `day`, `twist`, `started_at`, `finished_at` | the player, his own rows |
| `hs_scores` | accepted result | the run, the numbers sent, `score`, `stars`, `loadout`, `flags` | the player, his own rows |
| `hs_score_best` | player and board and period | `board`, `period`, `score`, `score_id`, `achieved_at` | the player, his own rows |
| `hs_sessions` | visit of the page | `sid`, `aid`, `uid`, `day`, `build`, `ruleset`, `channel`, `dev_class`, `os`, `browser`, `standalone`, `vw`, `vh`, `lang`, `ref` | nobody |
| `hs_events` | event | `sid`, `seq`, `name`, `props`, `cts`, `ts` | nobody |
| `hs_admins` | admin | `user_id` | nobody |
| `hs_config` | switch | `key`, `value` | nobody (`hs_config()`) |
| `hs_name_blocklist` | refused word | `pattern` (folded), `kind` | nobody |
| `hs_rate` | rate counter | `bucket`, `key`, `n` | nobody |
| `hs_handoff` | sign-in in transit | `id`, `code`, `created_at` | nobody |

Board keys: `c:<level>:<diff>:<loadout>:<ruleset>` with periods `all` and `w:<that week's Monday>` (ISO weeks,
Monday 00:00 UTC); `d:<yyyy-mm-dd>` with period `all` for a daily.

### 2.2 Row level security

- Row level security is **enabled on all thirteen tables**.
- All privileges on them are **revoked from `public`, `anon` and `authenticated`** (Supabase grants everything
  on new tables in `public` to those roles by default; the stand-ins copy that default so the test proves the
  revoke).
- `authenticated` is granted `select` on `hs_profiles`, `hs_saves`, `hs_runs`, `hs_scores`, `hs_score_best`,
  each with one policy: `using (user_id = (select auth.uid()))`. No insert, update or delete policy exists on
  any table: no client can write a row.
- Everything else is a function. All `hs_*` functions in `public` are `security definer` with
  `set search_path = ''` (every name inside is schema-qualified), `execute` is revoked from `public` and granted
  as listed in 2.3. Helpers live in the schema `hs_private`, which the API does not serve and no API role may use.
- The stats are views in `hs_private` read only through `hs_stats()`, which refuses anyone not in `hs_admins`.

### 2.3 Functions (`POST /rest/v1/rpc/<name>`)

Open to everyone (`anon` and `authenticated`):

| function | arguments | answers |
| --- | --- | --- |
| `hs_config()` | | `{ gate?, cloud?, notice?, ev_sample?, boards?, daily?, now }` |
| `hs_track(p_ctx, p_events)` | 7.3 | `{ accepted, dropped }` |
| `hs_board(p_mode, p_level, p_diff, p_loadout, p_ruleset, p_period, p_day, p_limit)` | campaign: level, diff, loadout, ruleset, period `all` or `week`; daily: day (default today) | `{ board, period, rows: [{ rank, name, score, lives, sec, at, me }], me: { rank, score, lives, sec, at } or null, total, now }`; an admin's rows also carry `id` and `uid` |
| `hs_daily_status(p_ruleset)` | | `{ day, level, twist, diff, attempts, used, best, rank, total, ends_in, now }` |
| `hs_handoff_put(p_id, p_code)`, `hs_handoff_take(p_id)` | 1.6 | `{ ok }`, `{ code }` |

Signed-in players only:

| function | arguments | answers, refusals |
| --- | --- | --- |
| `hs_profile_get()` | | `{ user_id, name or null, hidden, name_changed_at, admin, now }` |
| `hs_profile_set_name(p_name, p_aid)` | | `{ ok, name }`; `name_length`, `name_chars`, `name_blocked`, `name_taken`, `name_wait` |
| `hs_save_get()` | | `{ version, data, updated_at, device, now }` (`version: 0, data: null` when none) |
| `hs_save_put(p_expected, p_data, p_device)` | the version the page last saw (0: none) | `{ ok: true, version }` or `{ ok: false, version, data }` (someone wrote in between: merge and send again); `save_too_large` (over 256 KB), `save_invalid` |
| `hs_run_begin(p_mode, p_level, p_diff, p_ruleset, p_twist)` | | `{ ok, run_id, day, attempts_left, now }` or `{ ok: false, reason: "no_attempts" }`; `ruleset_unknown`, `level_unknown`, `daily_mismatch`, `no_profile` |
| `hs_score_submit(p_run, p_stats)` | `p_stats = { won, lives, waves, sim_sec, spent, earned, loadout, build }` | `{ accepted, score, stars, board, best_all, rank_all, total_all, best_week, rank_week, total_week }`; `score_implausible` (with `details`), `run_unknown`, `run_finished`, `run_expired`, `stats_invalid`, `ruleset_unknown` |
| `hs_delete_account()` | | `{ ok }` |

Admins only (`not_admin` otherwise): `hs_stats(p_days)` (7.5), `hs_admin_publish_ruleset(p_id, p_data)`,
`hs_admin_set_config(p_key, p_value)`, `hs_admin_moderate(p_user, p_hidden, p_name)`,
`hs_admin_remove_score(p_score)`, `hs_admin_purge_events(p_days)`.

Rate limits (per hour, per player unless said): name changes 20, save writes 240, runs begun 60, scores 40,
events 900 per device and 60,000 for everyone together (`hs_config.ev_cap_hour`), handoffs 600 a minute for
everyone. Over the limit: 429, except events, which are dropped silently.

### 2.4 A ruleset

Published by an admin from the stats page with one button (the page sends its own `rulesetData()`); never typed
by hand. Scores are accepted only for a published, active ruleset, and each ruleset has its own boards.

```json
{ "v": 1,
  "score": { "win": 4000, "lives": 3000, "speed": 1500, "thrift": 1500, "lostMax": 3999 },
  "levels": {
    "erebuni": { "waves": 10, "d": [ { "lives": 30, "fast": 300, "slow": 900, "earnMax": 6000 },
                                    { "lives": 20, "fast": 300, "slow": 900, "earnMax": 5500 },
                                    { "lives": 14, "fast": 300, "slow": 900, "earnMax": 5200 } ] }
  },
  "daily": { "pool": ["erebuni", "tushpa"], "twists": ["noarchers", "halfpurse"], "k": 5, "j": 3,
             "diff": 1, "attempts": 3, "t": { "halfpurse": { "earn": 0.9, "slow": 1.2 } } } }
```

Per battlefield and difficulty (`d` is indexed as `DIFFS`): `lives` (the defenders the difficulty begins with),
`fast` (seconds of battle clock of the fastest battle that can be fought: every wave called as early as the game
allows), `slow` (the battle clock of a battle that calls no wave early and sends each wave within a few seconds:
the par), `earnMax` (the most gold the battle can pay, starting purse included, with a margin of 10%). Gameplay
produces `fast`, `slow` and `earnMax` with the balance bot and keeps them in the page beside `LEVEL_HP`
(numbers in the examples above are placeholders). `daily.t[twist]` scales `lives`, `fast`, `slow`, `earn` for a
twist that changes them.

### 2.5 What a cheater can still do, and what would stop it

The page computes nothing the server trusts, but the server cannot see the battle. `hs_score_submit` refuses
what cannot be: a run that is not the caller's or was posted before; a ruleset that is not published; more
defenders than the difficulty has; a wave count that is not the battlefield's; a battle shorter than nine
tenths of the fastest possible; more gold earned than the battle can pay, or more spent than earned; a result
sent sooner after `hs_run_begin` than the battle's clock divided by the game's top speed (4x) allows; a fourth
daily attempt; more than 40 results an hour. Results that are possible but rare are stored with a flag (`fast`,
`perfect`) and listed for the admin, who can remove a score or hide a player (his rows leave every board).

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

---

## 3. The gate (D3)

### 3.1 What it is

`#gate`: a fixed layer over the whole page (`z-index: 60`, above the menu pages, Settings and the rotate card,
below the crash card), with a dimmed backdrop through which the campaign map shows, and one card in the game's
walnut and bronze (`.kit`). While it is up: `#overlay`, `#topbar`, `#shop` and `#spellbar` are `inert`,
`Platform.blocking()` is true (no hotkey reaches the game), no battle can start. It has seven states:

| state | shown when | card |
| --- | --- | --- |
| `checking` | at load while `/settings`, a code exchange or the first save pull is under way (at most 4 s, then `down`) | the crest, "Opening the gates..." |
| `signin` | no session, mode `required` or `optional` | 3.3 |
| `waiting` | a provider's button was tapped and the page is still here (1.6) | "Finish signing in in the window that opened. Then come back here." **Start over** |
| `other` | this window got a code that belongs to another window (1.6) | "You are signed in. ..." |
| `name` | signed in, no profile yet | 3.5 |
| `welcome` | signed in, with a name | 3.4 |
| `down` | Auth does not answer, the device is offline, or two sign-ins in a row did not finish | 3.6 |

### 3.2 The switch

`HS_GATE` in the page is the default. `hs_config().gate`, when the owner has set it on the stats page
(`hs_admin_set_config('gate', '"optional"')`), overrides it. The page reads `hs_config` at every load (2.5 s
limit, in parallel with `/settings`) and keeps the answer in `hs_pf_cfg`; the mode used at a load is the cached
one, so a change shows on each player's next visit and no load waits for it. `cloud: false` in the same answer
turns the whole platform off for that load (a kill switch that needs no deploy).

| mode | not signed in | signed in |
| --- | --- | --- |
| `required` (D3) | the gate's `signin` state; no guest play except through 3.6 | `welcome` |
| `optional` | `signin` with a fourth, quiet button **Play as a guest** and the line "Guest progress stays on this device."; chosen once it is remembered (`hs_pf_gate.guest`) and the gate does not return; the Account tab keeps the three buttons | `welcome` |
| `off` | no gate; the Account tab keeps the three buttons ("Sign in to save your progress and post scores.") | no `welcome`; a toast "Welcome back, <name>." |

The gate is not shown at all, in any mode: under `HARNESS_ON`, on `file://`, with the constants empty, on
`?privacy`, and on `?stats` (which has its own sign-in line).

**The cost of `required`, measured.** The funnel of 7.5 counts devices at `page_load`, `gate_shown`,
`provider_tapped`, `signed_in`, `name_set`, `battle_start`. The gate's cost is `signed_in / gate_shown` for
first-time devices, shown on the stats page as one number with the per-provider split and the count of
`gate_bypass`. To compare against no gate the owner sets `optional` for a week on the stats page: the same
funnel then shows how many choose **Play as a guest** and how many of each group reach their first victory and
come back the next day. No rebuild either way.

### 3.3 The sign-in card: words and buttons

```
[crest]  HIGHLAND STAND
Sign in to take command.
Your progress is saved to your account. Pick up where you left off on any device.

[ G  Continue with Google   ]
[ f  Continue with Facebook ]
[ D  Continue with Discord  ]

For players 13 and older. We keep your email address, a player name you choose, your progress and
your scores. We never post to your accounts.  Privacy
```

- The three buttons are shown in that order, each only when `/settings` says the provider is on. If none is
  on, the state is `down`.
- Each button is a `button.gateBtn` with the provider's mark drawn as inline SVG at the left (Google's
  four-color G on a white button with dark text; Facebook's white f on #1877F2; Discord's white mark on
  #5865F2) and the words "Continue with <Provider>". These are the providers' own wordings and colors; their
  brand rules ask for the mark unaltered and for these or similar words **[U]**.
- "Privacy" is a link to `?privacy` (same tab; that page's **Back to the game** returns).
- After a sign-in that did not finish: a line above the buttons, "Sign-in did not finish. Try again, or use
  another account."
- In an in-app browser: the note of 1.6 above the buttons, and no Google button.
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
[ Defender4821          ]
[ Save name ]
```

The field is filled with "Defender" and four random digits (never the provider's name, which the page never
reads). 3 to 16 characters; letters of any alphabet, digits, spaces, dots, dashes, underscores (the page checks
`/^[\p{L}\p{N} ._-]{3,16}$/u` as the player types; the server's rule is 5.5). Refusals, under the field:
`name_length` "Use 3 to 16 characters." · `name_chars` "Use letters, numbers, spaces, dots, dashes and
underscores." · `name_taken` "That name is taken. Try another." · `name_blocked` "That name is not allowed. Try
another." · `name_wait` "You can change your name once a week." · no connection: "No connection. Try again."
If the service fails here twice the card offers **Later** (the player goes on as "Defender" locally and is
asked again on the next load; without a profile no score posts).

### 3.6 When the Auth service is down

Nobody is ever locked out. The rules:

| what the page sees | what the player sees | what is remembered |
| --- | --- | --- |
| no session, and `GET /auth/v1/settings` fails (status 0, 5xx, or 4 s pass), or `navigator.onLine` is false | `down`: "**Sign-in is not answering.** You can play now. Your progress stays on this device and joins your account the next time you sign in." (offline: "**You are offline.** You can play now. ...") **Play now** · **Try again** | nothing: the next load tries again |
| two sign-ins in a row came back with an error or never came back (`hs_pf_gate.fails >= 2`) | the `signin` card with one more line and button: "Sign-in is giving trouble. You can play now and sign in later." **Play now** | `fails` is reset by a sign-in that works |
| a session exists but its refresh fails for the network | no gate at all: the player is treated as signed in (name from `hs_pf_me`), the save waits in the queue (4.3) | |
| a session exists and the server refuses it (1.4) | the game goes on; the gate returns on the next load | |
| `/settings` answers but lists none of the three providers | `down` | |

**Play now** closes the gate for this visit as a guest (`gate_bypass { why }` with `down`, `offline` or
`errors`), and the player's progress is local until a later sign-in migrates it (4.6). A player who bypassed is
asked again on his next load, in the `signin` state, never in the middle of a battle.

### 3.7 First-run funnel events

In order, for a new device in `required` mode (properties in 7.2): `page_load` → `gate_shown` →
`provider_tapped` → (the page leaves and returns) → `page_load` → `signed_in` → `name_set` → `gate_passed` →
`welcome_tap` → `chapter_story` → `brief_open` → `battle_start` → `tutorial_step` (one per step) →
`wave_end` ... → `tutorial_done` → `victory` or `defeat`. The side exits each have an event: `signin_error`,
`gate_down`, `gate_bypass`, `page_hide`.

### 3.8 Layouts

One card, three arrangements. All sizes are CSS pixels; every button is at least 44 px tall to a finger; the
card keeps out of the safe areas (`--sat`, `--sar`, `--sab`, `--sal`), and scrolls inside itself if a very
short window cuts it.

| layout | rule | card | inside |
| --- | --- | --- | --- |
| desktop, iPad | neither phone query | centered, 460 px wide, padding 30 px | one column: crest 64 px and title on one line, the two lines of text (17 px), the buttons 320 x 52 px with 10 px between, the small print 12.5 px, centered |
| phone, sideways | `(max-height: 500px)` | centered, `min(640px, 100vw - 24px - insets)` wide, at most `100dvh - 16px - insets` tall | two columns: left (flexible) the crest 40 px, the title 20 px, the text 13.5 px, the small print 11 px; right (250 px) the buttons 250 x 44 px with 8 px between. At 667 x 320 the right column is 3 x 44 + 2 x 8 = 148 px tall, the left one fits in 250 px. |
| phone, upright | `(max-width: 500px)` and not sideways | `100vw - 24px` wide, centered | one column, buttons full width and 48 px tall, text 15 px, small print 11.5 px |

The welcome, name, waiting and down cards use the same three arrangements (sideways: the words left, the
buttons right). The rotate card (`#rotateHint`, shown to a phone held upright) lies under the gate; it shows
once the gate is passed, as today.

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
- Not synced, by decision: `hs_settings` (volumes belong to a device), `hs_home_tip`, the `hs_mig_*` flags (each
  device migrates its own old data before it syncs), `hs_nardi_bless` and every `hs_town*` key (the town is
  hidden), and all `hs_pf_*`.

### 4.2 How the page notices a change

Gameplay keeps writing `localStorage` through its helpers, as today. PF-MAIN wraps the storage once at start:
`Storage.prototype.setItem` and `removeItem` (after the quota guard of line 3136), or the methods of the
in-memory fallback object, call `Cloud.touched(key)` after the write when `key` matches `CLOUD_KEYS`. That sets
`hs_pf_sync.dirty`, stamps `run.at` when the key is `hs_run`, and schedules a push (4.3). Writes the platform
itself makes while applying a merge are not counted. So no call site in the game changes, and a key gameplay
adds to `CLOUD_KEYS` syncs with no further code.

### 4.3 When it syncs

**Pull** (`hs_save_get`, then merge, then push if the merge changed the cloud's side):

- at load, for a signed-in player, before the welcome card's buttons go live (2.5 s limit, 3.4);
- right after a sign-in;
- when the page becomes visible again, if a menu page is up and the last pull is over 5 minutes old;
- never while a battle is live: a battle in play is never replaced under the player.

**Push** (`hs_save_put` with the version last seen):

| trigger | delay |
| --- | --- |
| a victory, a defeat, an abandon (the events `victory`, `defeat`, `battle_quit`) | at once |
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

`Cloud.merge(mine, theirs)` is a pure function of two documents (it is unit-tested in the selftest, 10.5).
For each key the rule named in `CLOUD_KEYS`:

| rule | result | used for |
| --- | --- | --- |
| `max` | the larger number; a number beats a non-number; one side missing: the other | `hs_best_*` (the wave reached, 21 once won), `hs_tutorial_done` |
| `union` | the JSON arrays joined, mine first, no item twice; a side that is not an array counts as empty | `hs_open_kept`, `hs_unlocked_seen`, `hs_chapters_seen`, `hs_tricks_seen` |
| `records` | per battlefield id and per difficulty, the larger of each of `stars`, `lives`, `endless` (clamped as `levelRecord` clamps them, line 10935); a battlefield only one side has is kept | `hs_records` |
| `newer` | the value of the document whose `at` is later | `hs_nardi` |
| a function | its return value for `(mine, theirs)` (raw strings, `null` when missing) | gameplay's keys |
| `run` | 4.5 | `hs_run` |

Nothing a player has won is ever lost by a merge: records and roads only grow. No rule deletes a key (the
battle in progress is the one thing that can end). The merged values are written back to `localStorage`; if a
menu page is up it is rebuilt (`buildMenu()`), so stars and open roads won elsewhere appear.

### 4.5 The battle in progress

`mine` and `theirs` are the two `run` parts. In this order:

1. The same `val`: nothing to do.
2. A battle is live on this device right now: mine stands (and is stamped now).
3. One side is a "none" mark and the other a battle: the later `at` wins. So a battle finished on the iPad
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
         S = clamp((slow - simSec) / (slow - fast))  1 at the fastest battle that can be fought, 0 at par or slower
         T = clamp(1 - spent / earned)               the share of all gold earned that was never laid out
lost (the daily only):  score = floor(3999 * wavesCleared / wavesTotal)      (0 to 3,999: under any win)
```

The inputs are the three counters of 0.3 (2) plus `lives` and the wave count; `fast`, `slow` and `livesMax`
come from the ruleset, so the page and the server compute the same number (`Platform.scoreOf(stats)` in the
page for the strip; `hs_score_submit` for the board; a selftest vector and the SQL test use the same example:
20 of 20 kept, 600 s between 300 and 900, 900 of 3,000 spent: 4000 + 3000 + 750 + 1050 = 8,800).

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
- The selftest pins it: `hash(JSON.stringify(rulesetData()))` (the page's `sha256`, first 8 hex digits) must
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
   the event says `ranked: true` (gameplay sets it false for the coached first stand, a test-mode run and an
   endless stand), the page calls `hs_run_begin` (5 s limit; tried again at 10 s and 30 s if the network
   failed). The answer's `run_id` is kept: `hs_pf_run = { rid, mode, lv, diff, ruleset, t }`.
   With `resumed: true` the token saved with the battle is used if its `lv`, `diff` and `ruleset` match.
2. `victory` (and `defeat` when `mode` is `daily`): if a token is held, `hs_score_submit(rid, stats)`. A
   network failure puts `{ rid, stats, t }` in `hs_pf_out` (20 entries at most, dropped after 7 days), sent
   again at the next load, on `online`, and after any successful call.
3. `battle_quit`, or the next fresh `battle_start`: the token is dropped. The run stays unfinished on the
   server; a daily attempt stays spent.

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

- Every run carries `loadout`: `std` or `open` (0.3 (3)). It is part of the board's key.
- **Standard** is the board shown first, the one the victory strip and the share card name without a
  qualifier, and the only one that counts for the daily. Everyone on it fought with the same tools.
- **Open** is the second tab ("Upgrades and hero levels count here."). A player who never switches his
  upgrades off still has a board to climb.
- Gameplay owns how a battle becomes standard for a player who owns upgrades (its spec; this spec only needs
  the tag to be true). Until the progression ships every battle is `std` unless a gift of gold paid into it.
- If time runs short the Open boards are the first thing cut (11.3): open runs then show "Score 7,750 · Not
  ranked: upgrades were on".

### 5.5 Names, the Hall, and the doors

**Display names.** Chosen at first sign-in (3.5), changed on the Account tab. The server is the judge
(`hs_private.name_clean`): compatibility forms folded (NFKC), outer spaces trimmed and inner runs made one
space; 3 to 16 characters; no control or invisible direction characters; no ASCII punctuation but dot, dash
and underscore; not on the blocklist; unique after folding (lower case, spaces dots dashes underscores
removed, the digits 0 1 3 4 5 7 and @ $ read as the letters they imitate), so "Aram", "a r a m" and "Ar4m"
are one name. One change in 7 days (free in the first 10 minutes). The blocklist (`hs_name_blocklist`) ships
with the game's own name and words of authority; the words to refuse are the owner's to add, in folded form,
and should cover slurs against any people. An admin can rename or hide a player (`hs_admin_moderate`); a hidden
player's rows are on no board. On the page a name is only ever set with `textContent` or drawn with
`fillText`: it is never parsed as HTML.

**The Hall** (`#hall`): a full page in the game's style (`z-index: 50`; the map is `inert` under it), opened
only from a menu page, closed by its X, Escape or the browser's back. A row of tabs from `HALL_TABS`, in this
order: gameplay's tabs (if any), **Daily**, **Leaderboards**, **Account**.

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
| phone sideways | the top row of the side column is full (tally, chapter story, nardi, gear: 226 of 232 px at 667 px wide), so **the tally itself is the door**: `#ovStars` becomes a button that opens the Hall, with the same red dot. No new control, nothing shrinks. |
| every layout | Settings (the gear) gains **Account and boards** on menu pages, and tapping the tally opens the Hall everywhere. |

**Doors on the victory page.**

| layout | where |
| --- | --- |
| desktop, iPad, phone upright | `#ovScore`, a strip between the record row (`#ovRecord`) and the page's text: the score line of 5.3, then two small buttons, **Leaderboard** (opens the Hall on this battlefield, difficulty and loadout, on This week) and **Share** (section 6). Buttons 40 px tall on the iPad as the page's other quiet buttons are, 44 px on the upright phone. |
| phone sideways | the page is full to the pixel (title, stars, four lines, Next battle, three buttons at 667 x 320), so the score line joins the record row as text ("★★★ Normal · 7,750 · #12 this week") and the two buttons are round 44 px icon buttons fixed at the top right, left of the gear: `#boardBtn` at `right: calc(60px + var(--sar))`, `#shareBtn` at `right: calc(110px + var(--sar))`, `top: calc(8px + var(--sat))`, the slots the map page's nardi and story buttons use (neither is on the victory page). If the title reaches under them they hide the way the tally does, and the same two actions are in Settings. |

The defeat page gets the strip only for a lost daily (its score and rank, **Leaderboard**, no Share).

### 5.6 The daily challenge

**One battlefield and one twist per UTC day, from the date alone.** With `day` = whole days since 1 January
1970 UTC (`Math.floor(Platform.now() / 86400000)`), `pool` the ruleset's list of battlefield ids (`n` long)
and `twists` its list of twist ids (`m` long):

```
k = the smallest whole number >= 5 that shares no factor with n        (17 battlefields: k = 5)
j = the smallest whole number >= 3 that shares no factor with m
battlefield = pool[(day * k) % n]
twist       = twists[(day * j + Math.floor(day / n)) % m]
```

Every battlefield comes up once in every `n` days, never two days running, and the twists shift by one against
the battlefields each cycle. The database computes the same two lines (`hs_private.daily_pick`; the SQL test
checks it against the arithmetic) and refuses a daily run whose battlefield or twist is not the day's. `k` and
`j` are worked out by the page and published in the ruleset. The day is the server's (the page corrects its
clock by the server's, 1), so a device with a wrong clock still plays today's.

**Rules.** Normal difficulty; the standard loadout; the twist's effect (gameplay's `DAILY_TWISTS`: a name and
one line each, such as "No Archers: the archers' slot is closed."); the same for everyone. It is open to every
signed-in player who has fought Erebuni once, whatever the campaign has reached; it writes no record, opens no
road and does not touch a campaign battle in progress (0.3 (5)).

**Attempts.** Three ranked attempts a day; the best counts. An attempt is spent when the first wave is sent
(that is when the run begins on the server); looking at the battlefield's chronicle costs nothing. A lost
attempt scores for the waves it held (5.1). After the third, **Practice** plays the same battle unranked.
Without a connection at the first wave the battle is practice ("Practice: no connection. This battle is not
ranked."), and no attempt is spent.

**The Daily tab.**

```
Daily challenge · November 10
Ani, c. 1041 to 1044
No Archers: the archers' slot is closed.
Normal · Standard loadout · The same for everyone
Attempts left: 2 of 3      Your best today: 7,420 (#12 of 87)
[ Play today's challenge ]                      New challenge in 5 h 12 min
(today's board: 50 rows, the player's own pinned)
Yesterday: 1. Bagrat 9,105   2. Aram 8,800   3. Nune 8,640
```

**The share text** (the card is section 6): "Highland Stand daily, Nov 10: Ani, No Archers. Score 7,420, #12
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

The time is the battle clock (`simSec`) as minutes and seconds. All words are drawn in the page's own face
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
script, no pixel, no fingerprint. The server never stores an IP address or a user agent string.

### 7.1 Who is who

- `aid`: a random UUID made on the first visit and kept in `localStorage` (`hs_pf_aid`). It names a browser,
  not a person, and never leaves this site. It is what makes a funnel possible before sign-in.
- `sid`: a random id per page load. `seq`: the event's number within it.
- After sign-in the server adds the account to the session by itself (from the token, never from the page), so
  the visits before the sign-in and after it join. "Delete my account" removes those sessions and their events.
- Clearing the browser's site data makes a new `aid`. The Home Screen app has its own.

### 7.2 The events

Every event: `{ n: name, q: seq, t: device time in ms, p: props }`. Props are short and flat. `lv` is a
battlefield id, `diff` 0 to 2, `mode` is `campaign`, `daily` or `endless`. **G** marks the events gameplay
sends with `track()`; the others the platform sends itself.

| event | when | props |
| --- | --- | --- |
| `page_load` | every load, first | `gate` (the mode in force), `signed` (a session exists), `returning` (an `aid` existed), `progress` (battlefields held on this device), `standalone`, `ret` (this load is a return from a provider) |
| `gate_shown` | the gate's `signin` state appears | `mode`, `state` (`signin`, `inapp`), `providers` (e.g. `"gfd"`) |
| `gate_down` | the `down` state appears | `why` (`timeout`, `http`, `offline`, `none`, `errors`) |
| `provider_tapped` | a provider's button | `provider` |
| `signed_in` | a code exchanged | `provider`, `new` (no profile yet), `handoff` (it came through 1.6), `ms` (from the tap, when the same window) |
| `signin_error` | a return with an error, or a failed exchange | `provider`, `error` |
| `name_set` | a name accepted | `changed` (false: the first) |
| `gate_bypass` | **Play now** or **Play as a guest** | `why` (`down`, `offline`, `errors`, `guest`) |
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

A player's path through a first visit is 3.7. Where a player quits is `battle_quit` (not followed by
`battle_back` in that visit) and the last `page_hide.where` of his last visit.

### 7.3 Sending

- Events queue in memory and in `hs_pf_evq` (200 events or 60 KB at most; the oldest go first when full).
- A batch (50 events at most) is sent: 20 s after the first unsent event; when 20 are waiting; as the page is
  hidden or closed (with `keepalive`, so it leaves with the page); after a sign-in. `POST /rpc/hs_track
  { p_ctx, p_events }` where `p_ctx = { aid, sid, build, ruleset, channel, dev, os, browser, standalone, vw, vh,
  lang, ref }`: `build` is `BUILD_ID`; `channel` is `live` or `next`; `dev` is `phone` (the phone layout, or a
  screen whose short side is at most 500 px), `tablet` (touch, not a phone) or `desktop`; `os` one of `ios`,
  `android`, `mac`, `windows`, `linux`, `other`; `browser` one of `safari`, `chrome`, `firefox`, `edge`,
  `inapp`, `other`; `vw`, `vh` the window; `lang` the first language tag; `ref` the referring site's host name
  only (never its path), empty for the game's own pages.
- Offline, or the service down: the events stay in the queue and go with the next load. After a failure the
  next try waits 30 s, doubling to 10 minutes. Three refusals in a row (4xx) stop sending for the visit.
- Nothing is sent under `HARNESS_ON`, on `file://`, or with the platform off. The queue on `window.__hsEv`
  still fills there, which is how the selftest checks gameplay's `track` calls (10.5).

### 7.4 Limits and sampling

- Per visit: 600 events. Per battle: 40 of `tower_built`, `tower_upgraded`, `tower_sold` and `plot_bought`
  together (the rest are dropped; the battle's totals are in `victory` and `defeat`). `wave_end` is never
  dropped.
- `hs_config.ev_sample` (0 to 1, default 1): when the owner lowers it, a device sends the tower events only if
  its `aid` falls in that share (the same devices every day). Funnel, battle and gate events are never sampled.
- Server: 900 events an hour per device, 60,000 an hour in all, 50 per batch, 1 KB of props per event, names
  of lower-case letters, digits and underscores. Over a limit the batch is dropped without an error.
- Keeping: `hs_admin_purge_events(180)` removes visits older than 180 days; the stats page has the button, and
  the setup guide shows how to schedule it.

### 7.5 The owner's stats page (`?stats`)

`https://highland.avunjian.com/?stats` shows `#statsPage` instead of the game (the gate is not shown; the game
under it does not start a battle). Not signed in: one line and the three buttons (the sign-in returns to
`?stats`). Signed in but not in `hs_admins`: "This page is for the game's owner." and a link back. An admin: one
call, `hs_stats(days)`, and the page draws it. A period switch (7, 30, 90 days). Plain tables and bars made of
`div`s, in the game's colors, one column, readable on a phone.

| card | from `hs_stats` | shows |
| --- | --- | --- |
| Totals | `totals`, `daily` | accounts, saves, scores and events in the period; people, visits and signed-in people per day as a bar per day |
| First visit funnel | `funnel` | devices first seen in the period that reached each step: `page_load`, `gate_shown`, `provider_tapped`, `signed_in`, `name_set`, `battle_start`, `tutorial_done`, `wave_end`, `victory`; each bar with its share of the first and of the step before. Under it **the gate's cost**: `signed_in / gate_shown`. |
| The gate | `gate` | taps and sign-ins per provider, errors by code, bypasses by reason, arrivals in in-app browsers |
| Coming back | `retention` | per first-seen day: new devices, the share seen the next day (day 1) and seven days on (day 7); the period's averages on top |
| Where players quit | `quits` | battles left and not come back to, by battlefield, difficulty and wave: the 20 most common, and per battlefield a row of bars by wave |
| Battlefields | `fields` | per battlefield and difficulty: battles ended, win rate, defenders kept in the wins (average and as a share), the average wave of the defeats, quits |
| Devices | `devices` | people by phone, tablet, desktop; by system; Home Screen app or not |
| Rulesets | `rulesets` | each ruleset seen in visits with whether it is published, and **Publish ruleset <id>** for the page's own |
| Scores to look at | `flagged` | flagged results with **Remove** (`hs_admin_remove_score`) and **Hide player** (`hs_admin_moderate`) |
| Switches | `config` | the gate (`required`, `optional`, `off`), boards and daily on or off, the events cap and sample, **Remove events older than 180 days** |

Visits from `/next/` (`channel: "next"`) are left out of every card.
