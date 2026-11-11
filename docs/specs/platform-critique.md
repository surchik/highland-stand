# Highland Stand: a critique of the platform spec

A skeptical and security review of `docs/specs/platform.md` (commit f7657c8) with its files under
`docs/specs/platform/`, read against `index.html` at master 54207ce, the gameplay spec
(`docs/specs/gameplay.md`, 2af988b), and Supabase's own sources. The revised spec is
`docs/specs/platform.final.md`; its appendix says what was changed for each number here and what was not.

Five lenses: (1) security and privacy, (2) correctness against a self-hosted Supabase and against the page,
(3) the gate, (4) the seam with gameplay, (5) scope.

Severity: **blocker** (must be fixed before a line is built: it loses data, exposes the owner, breaks a
binding decision or makes a headline number wrong), **major** (must be fixed in the spec; it would cost a
rework or a real fault), **minor** (cheap to fix, low harm).

How each finding was checked is said with it: **[measured]** run here on PostgreSQL 16 with the spec's own
files, **[source]** read in the named file of `supabase/auth`, `supabase/supabase`, `supabase/postgres` or
`PostgREST` (master or develop, fetched from raw.githubusercontent.com; copies under the session's
`scratchpad/top/ref/` and `ref/critic/`), **[page]** read in `index.html`, **[reasoned]** argued from the
spec's own text. What could not be checked is listed at the end.

The spec is careful work. Its SQL ran as it said, its line numbers are right, its functions exist, and most
of what it marks verified I could verify again. What follows is what it missed.

---

## Blockers

### 1. Making the Supabase public opens the owner's other projects, and the guide publishes the whole gateway

*Lens 1.* The spec treats the anon key as harmless ("the anon key only opens what row level security
allows") and names every object `hs_` so nothing collides. It never asks what else the same key opens.

- The setup guide's step 1 proxies **all of port 8000** to the public name: Studio (behind one password),
  `/pg` (the database's management API), storage, realtime, GraphQL, and `/rest/v1/<any table>` of **every
  project in that database**.
- Supabase grants `anon` and `authenticated` everything on every new table, function and sequence in
  `public` by default [source: `supabase/postgres` `00000000000000-initial-schema.sql`, lines 40 to 42]. A
  table of another project that was made in SQL and never had row level security switched on is readable and
  writable by anyone holding the anon key. The game prints that key in a page the whole internet loads.
- Supabase's compose file publishes the gateway on every interface (`${KONG_HTTP_PORT}:8000`), and Docker
  goes round `ufw`. The Supabase may already answer on `http://<server>:8000` without https.
- An install made from `.env.example` and never re-keyed has the published demo `JWT_SECRET`, `ANON_KEY` and
  `SERVICE_ROLE_KEY` [source: `docker/.env.example`]. Anyone can then mint a service-role token. The guide
  never asks.

**Fix (applied: spec 9.1, 9.2, 10.6; guide steps 0, 1, 4):**
1. A step 0 before anything is public: the four example values are not in use (the guide gives the exact
   strings to look for); the dashboard password is strong; the gateway's port is bound to `127.0.0.1` or
   closed from outside (a `curl` from another machine shows it).
2. The public name serves **two path prefixes only**: `/auth/v1/` and `/rest/v1/rpc/hs_`. Everything else
   answers 404. Exact nginx and Caddy blocks are in the guide. Studio stays where it was (an SSH tunnel or
   its present address). The page needs nothing else: it calls no table.
3. An audit query in step 4 lists every table in an API schema that an API role can touch and that has row
   level security off, and every function `anon` may execute that is not `hs_`. The owner sees his other
   projects' exposure before the key is printed.
4. The page and `tools/platform/smoke.js` refuse an anon key whose payload says `"iss":"supabase-demo"`.

### 2. A stranger can fill the shared database through `hs_track`, and the cap counts the wrong thing

*Lens 1.* `hs_track` is open to everyone, as it must be. Its limits do not hold.

- [measured] 1,300 calls from made-up device ids put 59,901 events in the table: 10 MB. That is the
  **intended** hourly cap. Kept for the spec's 180 days it is 43 GB, in the database the owner's other
  projects live in.
- [measured] The cap is leakier than intended. `rate_ok` counts **calls** and the function compares that to
  `cap / batch size`, so after 1,200 batches of 50 a batch of 25 is still under its limit, then one of 12,
  and so on: roughly four times the cap. In the same run a single-event batch from an honest device was
  still accepted after the "cap" was reached, so the cap is neither a ceiling nor fair.
- Every made-up device id also leaves a row in `hs_rate`, even when its events are dropped.
- The only remedy is a button ("Remove events older than 180 days") that deletes everything in one
  statement. The API roles' statements are cut off after 8 seconds (item 21), so on a full table the button
  fails exactly when it is needed.
- One pool for everyone means a flood blacks out the real players' counts for the hour.

**Fix (applied: `schema.sql`, spec 2.3, 7.4, guide step 1):** limits count events (`rate_ok` takes an
amount); visitors draw on one pool (`ev_cap_hour`, now 20,000) checked before any per-device row is
written; a signed-in player draws on his own 1,500 an hour and on no pool; a size ceiling `ev_max_mb`
(1,024 MB) above which visitors' events are dropped, and everyone's above one and a half times it; old
visits leave by themselves (one call in 200 removes up to 300 expired visits, so no scheduler is needed);
the admin's purge works in pieces of 5,000 and says when to call again; the stats page shows how full the
table is. The guide adds a per-address rate limit and a 512 KB body limit on the public proxy.
[measured after the fix] 3,000 calls with mixed batch sizes: 19,985 events accepted, 791 rate rows.

### 3. The privacy page says something that is not true

*Lens 1.* Section 8.1: "The game's database does not store your IP address." Section 7: "The server never
stores an IP address or a user agent string."

The sign-in service is in that database and stores both: `auth.sessions` has `ip` and `user_agent`,
`auth.audit_log_entries` has `ip_address` [source: `supabase/auth` `internal/models/sessions.go` lines 92
to 93, `audit_log_entry.go` line 106]. The web server and the gateway log addresses too, and where
Supabase's own log store runs, request logs sit in the same PostgreSQL. A privacy page with a false
sentence is the one thing a provider's reviewer or a regulator can hold against a small game.

**Fix (applied: spec 0.1, 7, 8.1):** the sentences now say what is true: the game's own counts carry no
address; the sign-in service records the address and browser of each sign-in, and the web server keeps
ordinary logs for a number of days the owner fills in.

### 4. The owner's switch never reaches a first-time visitor, so the gate's cost cannot be compared

*Lens 3.* D3 asks for the gate to be a switch whose cost is measured. Section 3.2: "the mode used at a load
is the cached one, so a change shows on each player's next visit and no load waits for it", and 3.9 step 6
says the same. A first visit has no cache. So a new device always gets the constant `required`, whatever the
owner set on the stats page, and the experiment of 3.2 ("set `optional` for a week ... the same funnel then
shows how many choose Play as a guest") measures nothing: the funnel is made of first visits. The kill
switch `cloud: false` has the same hole and takes two loads to act on anyone.

The spec's own test contradicts its rule: flow 10 expects "a fresh context then has Play as a guest".

**Fix (applied: spec 3.2, 3.9):** a load without a session waits for `hs_config` beside `/settings` (the
`checking` card is up anyway; 2.5 s limit) and uses the fresh answer; the cache is used only when the call
fails, and at once for a signed-in load, where the mode changes nothing a player must wait for. A kill
switch that arrives during a signed-in load stops the syncing for the rest of that load.

### 5. A browser that keeps no site data can never pass a required gate

*Lens 3.* When storage is blocked the page falls back to memory [page: lines 3120 to 3138]. Then
`hs_pf_pkce` is gone when the provider sends the player back. The page sees a code with no verifier and
takes it for another window's: it shows "You are signed in. Go back to Highland Stand on your Home Screen."
on a desktop browser, offers to "sign in again in this window", and the same thing happens again. The
escape of 3.6 needs `hs_pf_gate.fails >= 2`, which is also in memory and is 0 again after every reload. In
`required` mode that player is locked out for good: the one thing D3 forbids. Safari with "Block All
Cookies", and browsers with site data blocked for the site, behave this way.

**Fix (applied: spec 0.2, 3.1, 3.6, 3.9):** PF-0 notes when storage is memory only (`HS_STORE_MEM`). The
gate then shows a state of its own, `nostore`: "This browser is not keeping this site's data, so a sign-in
cannot be remembered here. You can play now. Your progress lasts until you close this page." with **Play
now**, and no provider buttons. And a return with a code and no verifier is "Sign-in did not finish here.
Try again." unless the handoff is built and the sign-in can have begun in a Home Screen app.

### 6. Gameplay's `victory` and `defeat` events are larger than the server will keep

*Lens 4.* The server skips, without an error, any event whose props are over 1,024 bytes
(`continue when ... > 1024`). Gameplay's battle facts, sent as the props of `victory`, `defeat` and
`battle_quit`, are larger: [measured] the example in gameplay 6.1 is 1,063 bytes compact and about 1,226 as
PostgreSQL writes `jsonb`, which is what the check measures. So every victory and defeat would be dropped:
no win rate, no defenders kept, no last step of the funnel. The spec also says props are "short and flat";
gameplay's are nested one level.

**Fix (applied: `schema.sql`, spec 7.2, 7.3, 7.4):** 4,096 bytes an event; a batch is at most 50 events
and 60 KB and the page splits by bytes; one level of nesting is allowed; a unit check holds
`JSON.stringify(battleFacts())` under 3 KB. [measured] an event of 1.5 KB is kept, one of 5 KB is not.

### 7. The stats page shows strangers' text to the one account that can change everything

*Lens 1.* Section 1.3 says "the display name is the only text of another player it ever shows". Not so:
`hs_stats` groups by event props (`lv`, `provider`, `why`, `error`), by `ruleset`, `dev`, `os`, all sent by
anyone through `hs_track`, and `?stats` draws them for a signed-in admin whose tokens are in
`localStorage`. The spec promises `textContent` for names only. One `innerHTML` in the stats drawing and a
visitor's event runs script as the admin: the gate, the kill switch, moderation and the purge are his.

There is a second fault in the same place. The views cast props straight to numbers
(`(e.props ->> 'diff')::integer`). [measured, reasoned] One event with `"diff":"x"` makes `hs_stats` fail
for everyone, on every call, until that event is purged.

**Fix (applied: `schema.sql`, spec 1.3, 7.5, 10.3):** every string that comes from the server is put on
the page as text, never as markup, the stats page included; `hs_stats` passes a prop through only when it
is a short tag (`^[A-Za-z0-9_.:-]{1,40}$`), else the word "other"; numbers go through a cast that cannot
fail. [measured] with hostile events in the table the stats answer, contain no `<`, and show "other". Flow
10 posts such an event and looks for any element it made.

### 8. With email auto-confirm on, a Discord account takes over anyone's account, the admin's first

*Lens 1 and 2.* Supabase links a new sign-in to the account that has the same verified email. In the Auth
server "verified" is `email.Verified || config.Mailer.Autoconfirm` [source: `internal/models/linking.go`
line 67], and Discord is the one provider of the three that reports an unverified email as such
[source: `provider/discord.go` line 82; Facebook's is always marked verified, line 96]. So on an install
with `ENABLE_EMAIL_AUTOCONFIRM=true` (the common setting where no mail server is configured) anyone can
make a Discord account with the owner's email, never verify it, press Continue with Discord, and be linked
to the owner's account. The guide's step 6 then makes that account the admin.

The spec's table (8.2) also has the mechanism wrong: "a Discord account whose email is not verified gives
none: set `GOTRUE_EXTERNAL_DISCORD_EMAIL_OPTIONAL=true`". It gives the email with `verified: false`; with
auto-confirm off the sign-in fails with `provider_email_needs_verification` and `EMAIL_OPTIONAL` does not
change that [source: `external.go` lines 412 to 452].

**Fix (applied: spec 1.1, 3.3, 3.6, 7.5, 8.2, guide step 3):** `/auth/v1/settings` answers
`mailer_autoconfirm` [source: `settings.go` line 37]. The page reads it: when it is true the Discord button
is not shown and the stats page says why in red. The guide checks the value before step 6 and says what
turning it off means for the owner's other projects. An unverified Discord email gets its own line on the
gate: "Discord says your email is not verified. Verify it in Discord, then try again."

---

## Majors

### 9. The daily's arithmetic does not do what the spec says it does

*Lens 2.* Section 5.6: `twist = twists[(day * j + floor(day / n)) % m]`, "the twists shift by one against
the battlefields each cycle". They do not: over a cycle of `n` days the index moves by `n * j + 1`, not by
1. [measured] With 17 battlefields and 6 or 12 twists (`j` = 5) that is 86, which shares a factor of 2 with
`m`, so **each battlefield only ever meets half of the twists**; with 2 battlefields and 3 twists each
battlefield gets one twist forever. The spec's SQL test only checked that SQL and the formula agree.

**Fix (applied: `schema.sql`, spec 5.6):** `twist = twists[((day % n) * j + floor(day / n)) % m]`.
[measured] Over `n * m` days every battlefield meets every twist exactly once, and neither repeats on
consecutive days for the real sizes (17 by 6, `k` = 5, `j` = 5).

### 10. The handoff is built on a guess; build it only if the owner's iPhone asks for it

*Lens 5 and 1.* The page sets `apple-mobile-web-app-capable` [page: line 6], so the Home Screen app is
real. Whether iOS returns a provider's redirect into it is unknown (the spec says so). Against that guess
the spec puts, in its "never cut" list: a table, two functions any visitor may call, a gate state, a poll
every 2 seconds for 5 minutes, and a test flow. The put is limited to 600 a minute **for everyone
together**, so one script holding that limit blocks every handoff.

**Fix (applied: spec 1.6, 11; `schema-handoff.sql`):** the first release ships without it. The owner's
step 6 (his first sign-in on `/next/`) is done once from the Home Screen: the page itself reports where
the return landed (`signed_in { standalone, same }`). If it lands in the app, the handoff is never built.
If not, it is built as specified, from its own optional SQL file, with limits per handoff id. Until then a
return that lands elsewhere is a failed sign-in like any other and reaches **Play now** after two.

### 11. Coming back from the provider without signing in is not specified

*Lens 3.* A player taps Google, looks at Google's page, and presses Back. The browser restores the game
from its back-forward cache in the `waiting` state: "Finish signing in in the window that opened. Then come
back here." No window is open. Or the page reloads with a fresh `hs_pf_pkce` and no code: 3.9 has no line
for it. The rule "two sign-ins in a row ... never came back" (3.6) has no place where "never came back" is
counted.

**Fix (applied: spec 1.2, 3.1, 3.6, 3.9):** on `pageshow` from the cache, and on any load with a
`hs_pf_pkce` under 10 minutes old and no code, outside a Home Screen app: the `signin` card with "Sign-in
did not finish. Try again, or use another account.", the failure counted, `signin_error { error:
"abandoned" }`. The `waiting` state exists only with the handoff.

### 12. Direct reads serve nobody and show a cheater which of his scores were flagged

*Lens 1.* `authenticated` may `select` its own rows of five tables. The page reads no table. `hs_scores`
has `flags`: a player who posts made-up numbers can read back which were flagged and tune them.

**Fix (applied: `schema.sql`, spec 2.2):** no grant and no policy on any table. Row level security with no
policy denies everything; the functions are the only doors. The test asserts the API roles hold no
privilege on any `hs_` table or sequence.

### 13. The server's name rule is weaker than the page's

*Lens 1.* The page checks `[\p{L}\p{N} ._-]`; "the server is the judge", and the server only refuses
control characters, direction marks and ASCII punctuation. [measured] `hs_private.name_clean` accepted
`★★★`, `A😀😀`, stacked combining marks ("Zalgo" text, which spills over neighboring rows of a board) and
`卐卐卐`. Anyone who calls the function directly gets them.

**Fix (applied: `schema.sql`, spec 5.5):** letters and digits of any alphabet, read under an ICU collation
so the rule does not hang on the database's locale ([measured] under the `C` collation Armenian letters are
not letters); the starting blocklist gains the two swastika signs; the file's last statement tests three
names on the owner's server and warns. Honest limit, now written down: scripts that need combining marks
(Devanagari, Thai) cannot make a name, as on the page.

### 14. An older build deletes a newer build's keys from the cloud save

*Lens 2.* The page syncs "the keys named in `CLOUD_KEYS`". A tab left open, or a cached page, from before
gameplay added `hs_council` merges and pushes a document without it. The cloud copy loses the War Council
until a newer device pushes again; a new device that signs in between gets none.

**Fix (applied: spec 4.1, 4.4):** keys a build has no rule for are carried through a merge untouched; a
document whose `v` is above the build's is neither applied nor overwritten ("Reload to update the game").

### 15. Any removal of `hs_run` is stamped as "no battle as of now" and can kill a battle on another device

*Lens 2.* The hook treats `removeItem("hs_run")` as the mark of a finished battle. The page also removes
the key in a migration [page: line 76089]. Rule 3 of 4.5 then prefers that fresh mark over a battle the
iPad saved an hour ago, and drops it.

**Fix (applied: spec 4.2, 4.5):** the mark is written on `victory`, `defeat` and `battle_quit { how:
"abandon" }` only. Any other removal leaves this device with no battle and no claim, so the cloud's battle
is adopted.

### 16. A merge can rewrite gameplay's keys in the middle of a battle

*Lens 4.* Pulls never happen in battle, but a push that the server answers with `ok: false` merges and
writes every key back (4.3, 4.4), `hs_council` and `hs_heroes` included. Gameplay asked for the opposite
(its N2).

**Fix (applied: spec 4.3, 4.4):** in a live battle the merged document goes up and is held in memory; the
device's keys are written when the battle ends, then `onSavesChanged()` is called.

### 17. The seam: seven places where the two specs disagree

*Lens 4.* Each is settled in the final spec (0.3) as follows.

| | platform draft | gameplay | settled |
| --- | --- | --- | --- |
| a. the battle clock | all of `dt` from the first horn, waiting included | wave time only (`sec`) | gameplay's. It owns the rules a score is computed from, and its reason holds (the draft's clock makes a pause the way to think for free). The server's wall-clock check works with either. |
| b. a lost daily | `waves / wavesTotal` | `script / 20`, with `script` posted | by script, but **not posted**: the ruleset carries each battlefield's script table and the server reads the script wave from the waves cleared. One number fewer to trust. |
| c. which twists a battlefield may get | one list for all | a list per battlefield (pairs the bot cannot win are left out) | `daily.skip[battlefield]`; the pick walks to the next twist. Publishing refuses a battlefield that leaves out all. |
| d. a twist's bounds | multipliers only | "Few defenders" sets 12 outright | `livesSet` beside the multipliers. |
| e. who may be ranked | `ranked` on `battle_start` | also not `legacy`, `aided`, `tutorial`, `resumed` | `ranked: false` for the coached stand, test mode, endless and legacy runs; at `victory` a run that was `aided` is not posted, and gameplay's final `loadout` is already `open` for a run with a wave fought twice. |
| f. the Hall | the platform's page | gameplay's two tabs live in it, and gameplay will build "a bare page of its own" wherever it is absent | the Hall's shell is not the platform's to switch off: it ships in P0 and works on `file://` and under the harness. One page, not two. |
| g. the daily's dice | `startDaily(levelIndex, twistId)` | seeds from `Platform.daily().day` | `startDaily(levelIndex, twistId, day)`: the day is passed, so it works with the platform off. |

Also settled: the event's `sec`, `wave` and `waves` map to `sim_sec`, `waves` (cleared) and the ruleset's
length in `p_stats`; `records` merges every numeric field per difficulty by the larger, so `beyond` needs
no rule of its own; the platform's own stamp decides which run is newer, not the run's `t` (a device
clock); after a merge the page calls gameplay's `onSavesChanged()`, not `buildMenu()`; gameplay's "endless
board" (its 6.2) is not in these releases. On the phone held sideways the victory page is full to the pixel
[page: screenshot at 667 x 320]: the platform adds no row there, and gameplay's `#ovGrowth` row must take
its 44 px from the page's own text. That is flagged to gameplay.

### 18. The number the owner will decide on is easy to get wrong

*Lens 3.* "The gate's cost is `signed_in / gate_shown` for first-time devices."

- Crawlers that run scripts and prerendered tabs load the page, see the gate and never sign in.
- `signed_in` and `name_set` are events the page sends. They can be lost, and anyone can send them.
- Today's players meeting the gate for the first time, brand-new visitors, and arrivals inside another
  app's browser are three different stories in one number.

**Fix (applied: `schema.sql`, spec 3.2, 7.2, 7.5):** no analytics from a webdriver, a known crawler or a
prerender; `gate_shown` is sent once the card has been on screen for a second; the funnel's `signed_in` is
"a visit that carried an account" and `name_set` is "that account has a profile", both from the server's
own rows; every funnel step is given for new devices, returning players and in-app arrivals apart.

### 19. Counting before anyone has agreed to it

*Lens 1.* A random id is written to `localStorage` on the first load and events go out before the gate's
small print is read. In the EU, storing an identifier that is not strictly needed asks for consent in most
readings; first-party audience counts are exempt in some countries and not in others. The spec does not
mention it.

**Fix (applied: spec 0.2, 3.3, 7.1, 8.1, 13):** the gate's small print says "We count how the game is
played." beside the Privacy link; a constant `HS_ANON_ID` chooses `"device"` (the draft's behavior) or
`"visit"` (before a sign-in or a guest's choice the id lives in `sessionStorage` and ends with the tab;
the funnel still works across the provider's redirect, day-1 and day-7 return are then counted for
accounts and guests only). Which one is the owner's decision with whoever reads his privacy page.

### 20. `hs_stats`, the purge and account deletion will be cut off by Supabase's own timeouts

*Lens 2.* Supabase sets `statement_timeout` to 3 s for `anon` and 8 s for `authenticated` [source:
`supabase/postgres` initial schema, lines 59 to 60]. `hs_stats` reads every event of the window several
times. PostgREST also runs a function marked `stable` in a **read-only** transaction, even on POST [source:
PostgREST `transactions.rst`]: a later edit that adds a write to one of the six stable functions passes the
stand-in and fails on the real service.

**Fix (applied: `schema.sql`, spec 2.3, 10.1, 10.2):** `set statement_timeout` on `hs_stats` (30 s), the
purge (60 s) and account deletion (30 s), which PostgREST 12 and later lifts into the transaction
[source: same file, "Hoisted Function Settings"; the owner's version is unverified]; `hs_stats` takes a
list of cards so the page can ask card by card if the whole is too slow; the stand-in runs stable functions
read-only and applies the two role timeouts; the SQL test calls each stable function in a read-only
transaction.

### 21. The real Supabase is first met in the last work package

*Lens 5.* The stand-ins for PostgREST and for the Auth server are written by the hand that writes the
page. They will agree with the page. Whether the owner's install agrees (its version, its gateway, CORS,
its default grants, its timeouts) is found out in P9, after everything is built.

**Fix (applied: spec 10.6, 11.1):** `tools/platform/smoke.js <address> <anon key>`: public values only,
about fifteen checks against the real service (the demo key, `/settings` and its providers and
`mailer_autoconfirm`, the preflight, `/authorize` without a key, `hs_config`, a table read refused, a
signed-in function refused to a visitor, Studio and `/pg` not served on the public name, port 8000 closed).
It runs the day the owner hands over the two values, at the end of P1. P2 ends with the owner's own
sign-in on `/next/`, which is also the Home Screen check of item 10.

### 22. The first release is too large to finish and test as one

*Lens 5.* The draft is one release of ten work packages, thirteen tables, twenty functions, fourteen
browser flows at up to six sizes, a daily that waits on gameplay's twists and a board that waits on
gameplay's final balance.

**Fix (applied: spec 11):** three releases, each shippable and each with its own exit test.
**R1 Accounts** (the owner's "start with analytics", "login", "track where they left off"): the seam and
the Hall's shell, the schema, the smoke test, sign-in and the gate, cloud saves, analytics and the stats
page, privacy and deletion, the guide, staging. **R2 Boards**: scores, boards, the victory strip, the
share card. **R3 Daily**: the daily and its board. The schema ships whole in R1 (it is written and
tested); the score functions answer `ruleset_unknown` until a ruleset is published in R2.

---

## Minors

Each is applied in the final spec unless marked.

23. **`hs_tutorial_done` and `max`.** "0" means "asked to run again" [page: line 60835]. `max` turns it
    back to "1" at the next merge, before the player reaches Erebuni. Rule `flag`: the cloud keeps "1" once
    either side has it; a local "0" is left alone.
24. **`hs_nardi` and `newer`.** The document's `at` is stamped by every push, so "newer" means "pushed
    last", not "changed last". Keys with the `newer` rule carry their own time of last change.
25. **The prefix rule needs no walk through storage.** The harness's and the fallback's storage objects
    have no `key()` or `length` [page: lines 3102 to 3108, 3126 to 3131]. `hs_best_*` is listed with
    `bestKey(i, e)` for every battlefield and age instead.
26. **The hook must look at `this`.** `Storage.prototype.setItem` is also `sessionStorage`'s.
27. **`GET /user` is not needed.** The provider is in the token answer (`user.app_metadata.provider`).
28. **Five minutes at the provider.** A slow sign-in (a password reset, a second factor) comes back as
    `bad_oauth_state` at `SITE_URL` without `hsh` [source: `external.go` lines 556 to 569, 141 to 146].
    Its line: "Sign-in took too long. Try again." A staging sign-in's error of this kind lands on the live
    page: harmless, now said.
29. **One person, two accounts.** A different button with a different email is a different, empty account,
    and looks like lost progress. The button used last on a device is marked "Last used"; a new account on
    a device that held another says so.
30. **`hs_config` answers 404** (the schema is not installed): the platform is off for that load.
31. **The gate is in the page.** Anyone with the browser's tools can pass it. Nothing on the server
    depends on it. Now said, so nobody builds on it.
32. **Who owns the functions.** Older installs' SQL editor runs as `supabase_admin`, a superuser [source:
    current compose has `PG_META_DB_USER: postgres`; older ones differ]. `schema.sql` begins `set role
    postgres` and its last statement warns if a function is owned by a superuser. Sequences are revoked
    from the API roles too.
33. **Runs begun and never finished** stay forever (60 an hour per account). The purge removes those over
    30 days old.
34. **A score that meets a 401** (the session ended during the battle) was lost. It waits in the outbox
    for the same account's next sign-in, 7 days.
35. **`keepalive` and the preflight.** Every call is two requests unless the gateway caches the preflight
    (Envoy answers `max-age: 3600` [source: `lds.template.yaml`]; Kong sets none). Firefox before 133 has
    no `keepalive`. Nothing breaks: the queues are in storage. Now said.
36. **A framed page** cannot be sent to a provider. In a frame the buttons open the game's own address in
    a new tab.
37. **The server's clock offset** is kept between loads, so an offline load still stamps in server time.
38. **"Defender" and four digits** is 10,000 names. Six digits, and a second try on `name_taken`.
39. **In-app browsers are where the share card sends people.** A link opened inside Facebook or Instagram
    meets a gate without Google. An **Open in browser** button (`x-safari-https://` on iOS, an `intent:`
    link on Android) beside **Copy link**: unverified, on the owner's checklist. Whether such arrivals
    should get **Play now** under `required` is the owner's.
40. **`notice`** was a switch with no place on the page. It is one line on the gate's cards, 140
    characters, shown as text.
41. **Staging shares the live origin.** "Trying a build can never touch a real save" is true only while
    the build's own namespace code is whole. `publish_next` now refuses a page without that line; the
    guide says to use a private window for `/next/`; a host name of its own is the owner's option.
42. **Account deletion left the device's earlier anonymous visits.** They go too, and the page makes a
    new anonymous id afterwards, so the privacy page's "counts are removed" is true.
43. **Look-alike letters across alphabets** (a Cyrillic "а" for a Latin "a") are not folded. The admin's
    rename is the remedy. Now said.
44. **A daily's first-wave call is not retried.** The draft retried `hs_run_begin` at 10 s and 30 s; for a
    daily that would spend an attempt after the player was told "Practice". One try, 5 s.
45. **The pure checks need not be in the self-test.** Gameplay's rule is that the first suite gets edits
    only. The platform's pure checks live in `tools/platform/unit.js`; the page's suites get the two that
    need the page (the privacy page exists; the gate is not shown under the harness).

---

## Checked and found sound

So the builder need not check again: the Auth routes and PKCE rules; the redirect rule; `/authorize` and
`/callback` open without a key on Kong, **and on Envoy** [source: `lds.template.yaml` lines 89 to 126;
this settles one of the spec's unverified points]; CORS on both gateways; `Authorization: Bearer <anon
key>` on current and older gateways (the gateway rewrites an `sb_` key itself [source:
`kong-entrypoint.sh`]); PostgREST's error mapping; `revoke ... from public, anon, authenticated` on the
functions and the stand-ins' copy of Supabase's default grants; `search_path = ''` on every definer
function; score arithmetic and its test vector; the star rule (0.85 and 0.5, as `victoryStars`); the top
speed of 4 in the wall-clock check [page: line 60413]; every line number and function name of 0.4; the
`next:` shim against the page's storage code; `update.sh.proposed` and its six cases; account deletion's
cascade.

## What I could not check

1. Anything on the owner's server: its Supabase version, gateway, whether port 8000 is open, whether
   auto-confirm is on, what else lives in its `public` schema, whether `und-x-icu` exists there, whether
   its PostgREST lifts function timeouts (12 or later does).
2. What iOS does with a provider's redirect from a Home Screen app. My recollection is that since iOS 12.2
   the return stays inside the app; it is a recollection, hence item 10's check.
3. Whether an unverified Discord account may authorize an app at all (Discord's own docs were not
   reachable). If it may not, item 8 loses its attack and keeps its cheap guard.
4. The `x-safari-https://` and `intent:` links of item 39.
5. The legal reading of item 19 in any country.
6. Nothing in the page was built. Every layout claim rests on the draft's screenshots of master.
