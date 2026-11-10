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
